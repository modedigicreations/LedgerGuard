import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createLedgerGuardMCPServer } from './server-mcp.js';
import { getReconcilerFor } from './engine/reconciler.js';
import { getJournalServiceFor } from './engine/journal-generator.js';
import { getAuditTrailFor } from './engine/audit-trail.js';
import { backgroundCron } from './cron/scheduler.js';
import { getDashboardHtml } from './dashboard/html.js';
import { createOidcProvider } from './auth/oidc-provider.js';
import { resolveUserIdFromBearer } from './auth/authenticate.js';
import { sendMagicLink, verifyCode } from './auth/magic-link.js';
import { createDashboardSession, resolveDashboardSession, destroyDashboardSession, DASHBOARD_COOKIE_NAME } from './auth/dashboard-session.js';
import { emailFormPage, codeEntryPage, errorPage } from './auth/pages.js';
import { setApiKeyFor, listConnectionsFor, type ConnectedProvider } from './auth/connected-accounts.js';
import { connectFormPage } from './auth/connect-page.js';
import { pool } from './db/pool.js';

export async function buildRestServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    // Railway terminates TLS in front of this app and proxies every
    // request — same reasoning as provider.proxy = true below for
    // oidc-provider. Without this, rate-limit (and anything else keying
    // off req.ip) would see Railway's edge IP for every request, which
    // is shared across all users and would let one abusive client's
    // requests count against everyone else's limit.
    trustProxy: true
  });

  const issuer = process.env.LEDGERGUARD_OIDC_ISSUER || 'http://localhost:3333';
  const provider = await createOidcProvider(issuer);

  await app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  });

  await app.register(cookie);

  // A generous global default (an AI agent driving /mcp can legitimately
  // make many tool calls in one session) — the email-sending routes below
  // get a much stricter override, since those are the real abuse surface
  // (spamming a stranger's inbox with sign-in codes using our own Resend
  // account, not a normal usage pattern at any volume).
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute'
  });

  // Setup Swagger / OpenAPI 3.1
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'LedgerGuard API & AI Plugin',
        description: 'Autonomous Cross-Platform Financial Auditor & Reconciliation Engine for Claude, ChatGPT, and Standalone Finance Ops.',
        version: '1.0.0'
      },
      servers: [
        {
          url: 'http://localhost:3333',
          description: 'Local Standalone Server'
        }
      ]
    }
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false
    }
  });

  // ---------------------------------------------------------------------
  // Dashboard login (cookie-based) — same magic-link mechanism as the
  // OAuth interaction flow below, just finishing differently: a cookie
  // instead of resuming an OAuth grant.
  // ---------------------------------------------------------------------

  app.register(async (loginScope) => {
    loginScope.addContentTypeParser('application/x-www-form-urlencoded', (_req, _payload, done) => done(null));

    loginScope.get('/login', async (req, reply) => {
      reply.type('text/html').send(emailFormPage('/login'));
    });

    loginScope.post('/login', {
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } }
    }, async (req, reply) => {
      const body = await readFormBody(req);
      const email = body.get('email');
      if (!email) {
        reply.type('text/html').send(errorPage('An email address is required.'));
        return;
      }
      const { challengeId } = await sendMagicLink({ email, baseUrl: issuer });
      reply.type('text/html').send(codeEntryPage(email, '/login/code', challengeId));
    });

    loginScope.get('/logout', async (req, reply) => {
      await destroyDashboardSession(req.cookies[DASHBOARD_COOKIE_NAME]);
      reply.clearCookie(DASHBOARD_COOKIE_NAME, { path: '/' });
      reply.redirect('/login');
    });

    // Dashboard-only code verification (no OAuth interaction to resume).
    // challengeId travels as a hidden form field since there's no :uid in
    // this path to scope it the way the OAuth interaction flow's own
    // /interaction/:uid/code does.
    loginScope.post('/login/code', {
      // Defense in depth alongside verifyCode's own 5-attempt-per-code
      // lockout — this bounds how fast someone can cycle through guesses
      // across many different challenges, not just one.
      config: { rateLimit: { max: 20, timeWindow: '15 minutes' } }
    }, async (req, reply) => {
      const body = await readFormBody(req);
      const challengeId = body.get('challengeId');
      const code = body.get('code');
      if (!challengeId || !code) {
        reply.type('text/html').send(errorPage('Missing sign-in code.'));
        return;
      }
      const result = await verifyCode(challengeId, code);
      if (!result) {
        reply.type('text/html').send(errorPage('That code is wrong, expired, or already used. Request a new one.'));
        return;
      }
      const session = await createDashboardSession(result.userId);
      reply.setCookie(DASHBOARD_COOKIE_NAME, session.id, {
        path: '/',
        httpOnly: true,
        secure: issuer.startsWith('https://'),
        sameSite: 'lax',
        expires: session.expiresAt,
      });
      reply.redirect('/');
    });
  });

  // ---------------------------------------------------------------------
  // OAuth interaction pages — rendered by us, driven by oidc-provider's
  // interaction state (interactions.url() in oidc-provider.ts points
  // here). Two prompt kinds: 'login' (no one's signed in yet — show the
  // email form) and 'consent' (signed in, but this client hasn't been
  // authorized yet — show an Allow screen).
  // ---------------------------------------------------------------------

  app.register(async (interactionScope) => {
    interactionScope.addContentTypeParser('application/x-www-form-urlencoded', (_req, _payload, done) => done(null));

    interactionScope.get('/interaction/:uid', async (req, reply) => {
      const { uid } = req.params as { uid: string };
      reply.hijack();
      const interaction = await provider.interactionDetails(req.raw, reply.raw);

      if (interaction.prompt.name === 'consent') {
        const clientId = interaction.params.client_id as string;
        reply.raw.setHeader('Content-Type', 'text/html');
        reply.raw.end(consentPage(uid, clientId));
        return;
      }

      reply.raw.setHeader('Content-Type', 'text/html');
      reply.raw.end(emailFormPage(`/interaction/${uid}/email`));
    });

    interactionScope.post('/interaction/:uid/email', {
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } }
    }, async (req, reply) => {
      const { uid } = req.params as { uid: string };
      const body = await readFormBody(req);
      const email = body.get('email');
      if (!email) {
        reply.type('text/html').send(errorPage('An email address is required.'));
        return;
      }
      await sendMagicLink({ email, interactionUid: uid, baseUrl: issuer });
      reply.type('text/html').send(codeEntryPage(email, `/interaction/${uid}/code`));
    });

    // Lives under /interaction/:uid specifically (not a top-level path) so
    // the browser actually sends oidc-provider's interaction cookie,
    // which interactionFinished() below needs. :uid is the challenge id
    // the code was scoped to (sendMagicLink was called with
    // interactionUid: uid above), so there's no hidden field to carry it.
    interactionScope.post('/interaction/:uid/code', {
      config: { rateLimit: { max: 20, timeWindow: '15 minutes' } }
    }, async (req, reply) => {
      const { uid } = req.params as { uid: string };
      const body = await readFormBody(req);
      const code = body.get('code');
      if (!code) {
        reply.type('text/html').send(errorPage('Missing sign-in code.'));
        return;
      }
      const result = await verifyCode(uid, code);
      if (!result) {
        reply.type('text/html').send(errorPage('That code is wrong, expired, or already used. Request a new one.'));
        return;
      }

      reply.hijack();
      try {
        await provider.interactionFinished(req.raw, reply.raw, { login: { accountId: result.userId } });
      } catch (err) {
        console.error('[magic-link] interactionFinished failed:', err);
        if (!reply.raw.headersSent) {
          reply.raw.statusCode = 500;
          reply.raw.setHeader('Content-Type', 'text/html');
          reply.raw.end(errorPage('Could not complete sign-in. Please try again.'));
        }
      }
    });

    interactionScope.post('/interaction/:uid/consent', async (req, reply) => {
      reply.hijack();
      const interaction = await provider.interactionDetails(req.raw, reply.raw);
      const AccountGrant = (provider as unknown as {
        Grant: new (opts: { accountId: string; clientId: string }) => {
          addOIDCScope(scope: string): void;
          addResourceScope(resource: string, scope: string): void;
          save(): Promise<string>;
        };
      }).Grant;

      const scope = String(interaction.params.scope || 'openid email offline_access');
      const grant = new AccountGrant({
        accountId: interaction.session!.accountId as string,
        clientId: interaction.params.client_id as string,
      });
      grant.addOIDCScope(scope);
      // Resource Indicators (see oidc-provider.ts) need the grant to
      // separately cover the requested resource's scope, not just the
      // OIDC scope — without this, oidc-provider doesn't recognize the
      // resource as authorized and re-prompts for consent every time,
      // looping instead of ever completing (found via a real connector
      // attempt immediately after enabling resourceIndicators).
      const resource = interaction.params.resource;
      if (typeof resource === 'string') {
        grant.addResourceScope(resource, scope);
      }
      const grantId = await grant.save();

      await provider.interactionFinished(req.raw, reply.raw, { consent: { grantId } });
    });
  });

  // ---------------------------------------------------------------------
  // oidc-provider's own endpoints: discovery, authorize, token, DCR
  // registration, jwks, userinfo, session end. Registered as a wildcard
  // in its own scope (so the noop content-type parsers below only apply
  // here) because oidc-provider needs to read the raw request body
  // itself — a Fastify body parser would consume the stream first and
  // leave nothing for it to read.
  // ---------------------------------------------------------------------

  app.register(async (oidcScope) => {
    oidcScope.addContentTypeParser('application/x-www-form-urlencoded', (_req, _payload, done) => done(null));
    oidcScope.addContentTypeParser('application/json', (_req, _payload, done) => done(null));

    const oidcCallback = provider.callback();
    const oidcHandler = async (req: FastifyRequest, reply: FastifyReply) => {
      reply.hijack();
      await oidcCallback(req.raw, reply.raw);
    };
    // oidc-provider's own default route paths — a bare '*' wildcard would
    // collide with @fastify/cors's own catch-all OPTIONS preflight route,
    // so these are enumerated explicitly instead. /auth/:uid is the
    // interaction-resume sub-path interactionFinished() redirects to
    // after login/consent — easy to miss since it only appears mid-flow,
    // not on the initial /auth request.
    for (const path of ['/.well-known/openid-configuration', '/auth', '/auth/:uid', '/token', '/reg', '/jwks', '/me', '/session/end']) {
      oidcScope.all(path, oidcHandler);
    }
  });

  app.get('/.well-known/oauth-protected-resource', async (req, reply) => {
    const resourceUrl = new URL('/mcp', issuer).toString();
    reply.type('application/json').send({
      resource: resourceUrl,
      authorization_servers: [issuer]
    });
  });

  // ---------------------------------------------------------------------
  // Dashboard + REST API, now behind the cookie login above.
  // ---------------------------------------------------------------------

  async function requireDashboardSession(req: FastifyRequest, reply: FastifyReply): Promise<string | null> {
    const userId = await resolveDashboardSession(req.cookies[DASHBOARD_COOKIE_NAME]);
    if (!userId) {
      reply.redirect('/login');
      return null;
    }
    return userId;
  }

  // Standalone Web Dashboard
  app.get('/', async (req, reply) => {
    const userId = await requireDashboardSession(req, reply);
    if (!userId) return;
    reply.type('text/html').send(getDashboardHtml());
  });

  // Connect-a-gateway dashboard pages — session-authenticated, the only
  // place a user ever types their own API key for a gateway. Never
  // reachable from an MCP tool argument (see connect_payment_gateway in
  // server-mcp.ts), only from a link that tool hands back. Every
  // provider here is the plain-API-key kind (Stripe, Chargebee,
  // PayStack) — an OAuth-Connect gateway (Square, PayPal) will need its
  // own authorize-redirect route instead of this paste-a-key form, added
  // when that gateway is built.
  const API_KEY_PROVIDERS: ConnectedProvider[] = ['STRIPE', 'CHARGEBEE', 'PAYSTACK', 'PADDLE', 'BRAINTREE'];

  app.register(async (connectScope) => {
    connectScope.addContentTypeParser('application/x-www-form-urlencoded', (_req, _payload, done) => done(null));

    connectScope.get('/connect/:provider', async (req, reply) => {
      const userId = await requireDashboardSession(req, reply);
      if (!userId) return;
      const provider = (req.params as { provider: string }).provider.toUpperCase();
      if (!API_KEY_PROVIDERS.includes(provider as ConnectedProvider)) {
        reply.type('text/html').send(errorPage(`Unknown or not-yet-supported provider: ${provider}`));
        return;
      }
      const connections = await listConnectionsFor(userId);
      const existing = connections.find((c) => c.provider === provider);
      reply.type('text/html').send(connectFormPage(provider as ConnectedProvider, existing?.status || 'NOT_CONFIGURED'));
    });

    connectScope.post('/connect/:provider', async (req, reply) => {
      const userId = await requireDashboardSession(req, reply);
      if (!userId) return;
      const provider = (req.params as { provider: string }).provider.toUpperCase();
      if (!API_KEY_PROVIDERS.includes(provider as ConnectedProvider)) {
        reply.type('text/html').send(errorPage(`Unknown or not-yet-supported provider: ${provider}`));
        return;
      }
      const body = await readFormBody(req);
      const apiKey = body.get('apiKey');
      const accountId = body.get('accountId') || undefined;
      if (!apiKey) {
        reply.type('text/html').send(errorPage('An API key is required.'));
        return;
      }
      if (provider === 'CHARGEBEE' && !accountId) {
        reply.type('text/html').send(errorPage('Chargebee also needs your site name (e.g. "mycompany" from mycompany.chargebee.com).'));
        return;
      }
      if (provider === 'BRAINTREE' && !accountId) {
        reply.type('text/html').send(errorPage('Braintree also needs your public key (paired with the private key you just entered).'));
        return;
      }
      await setApiKeyFor(userId, provider as ConnectedProvider, apiKey, accountId);
      reply.redirect(`/connect/${provider.toLowerCase()}`);
    });
  });

  // No /.well-known/ai-plugin.json here on purpose. That's the 2023
  // ChatGPT Plugin manifest format (schema_version 'v1', an
  // auth.authorization_content_type: 'application/json' shape) — it
  // predates MCP connectors and doesn't actually match how /auth works
  // (a standard GET-based OAuth2 authorize redirect, not a JSON POST).
  // Modern ChatGPT custom connectors (like Claude's) use the same MCP +
  // OAuth discovery this server already implements: paste the /mcp URL,
  // pick OAuth, and ChatGPT does DCR + PKCE against
  // /.well-known/oauth-protected-resource the same way Claude does — no
  // separate manifest needed. A stale manifest serving mismatched auth
  // details is worse than serving nothing.

  // REST API Endpoints
  app.get('/api/v1/audit/variance', {
    schema: {
      description: 'Audit recognized revenue against Stripe net deposits and bank statements for a period',
      querystring: {
        type: 'object',
        properties: {
          period: { type: 'string', default: '2026-09' },
          minDiscrepancy: { type: 'number', default: 250.00 },
          matchProcessorFees: { type: 'boolean', default: true }
        }
      }
    }
  }, async (req, reply) => {
    const userId = await requireDashboardSession(req, reply);
    if (!userId) return;
    const query = req.query as any;
    return getReconcilerFor(userId).runAudit({
      period: query.period || '2026-09',
      minDiscrepancy: query.minDiscrepancy !== undefined ? Number(query.minDiscrepancy) : 250.00,
      matchProcessorFees: query.matchProcessorFees !== false,
      actor: 'AI_AGENT_CHATGPT'
    });
  });

  app.get('/api/v1/audit/anomalies', {
    schema: {
      description: 'Retrieve detailed transactional anomalies filtered by severity or period',
      querystring: {
        type: 'object',
        properties: {
          period: { type: 'string', default: '2026-09' },
          severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] }
        }
      }
    }
  }, async (req, reply) => {
    const userId = await requireDashboardSession(req, reply);
    if (!userId) return;
    const query = req.query as any;
    const report = await getReconcilerFor(userId).runAudit({
      period: query.period || '2026-09',
      minDiscrepancy: 0.00,
      actor: 'AI_AGENT_CHATGPT'
    });
    let anomalies = report.anomalies;
    if (query.severity) {
      anomalies = anomalies.filter(a => a.severity === query.severity);
    }
    return {
      period: query.period || '2026-09',
      totalAnomalies: anomalies.length,
      anomalies
    };
  });

  app.get('/api/v1/adjustments', {
    schema: {
      description: 'List all dual-entry journal adjustments'
    }
  }, async (req, reply) => {
    const userId = await requireDashboardSession(req, reply);
    if (!userId) return;
    return getJournalServiceFor(userId).listAdjustments();
  });

  // Health Check Endpoint — intentionally NOT behind login, Railway's
  // healthcheckPath needs to reach this unauthenticated.
  app.get('/api/v1/health', {
    schema: {
      description: 'Check service health and engine status'
    }
  }, async () => {
    // Audit trail integrity is now per-user (there's no single global
    // chain to verify here) — this endpoint only needs to confirm the DB
    // itself is reachable, which Railway's healthcheckPath relies on.
    let dbStatus = 'degraded';
    try {
      await pool.query('SELECT 1');
      dbStatus = 'connected';
    } catch {
      // A DB hiccup shouldn't fail the health check itself.
    }
    return {
      status: 'healthy',
      service: 'ledgerguard',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dbStatus
    };
  });

  app.post('/api/v1/adjustments/draft', {
    schema: {
      description: 'Draft a new dual-entry balancing journal adjustment for an anomaly or manual correction',
      body: {
        type: 'object',
        properties: {
          anomalyId: { type: 'string' },
          reference: { type: 'string' },
          memo: { type: 'string' },
          lines: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                accountCode: { type: 'string' },
                accountName: { type: 'string' },
                debit: { type: 'number' },
                credit: { type: 'number' }
              },
              required: ['accountCode', 'accountName', 'debit', 'credit']
            }
          }
        }
      }
    }
  }, async (req, reply) => {
    const userId = await requireDashboardSession(req, reply);
    if (!userId) return;
    const body = (req.body as any) || {};
    const journalService = getJournalServiceFor(userId);
    if (body.anomalyId) {
      return journalService.createDraftFromAnomaly(body.anomalyId, 'AI_AGENT_CHATGPT');
    }
    return journalService.draftAdjustment({
      reference: body.reference || 'ADJ-MANUAL',
      memo: body.memo || 'Manual Adjustment',
      date: '2026-09-30',
      lines: body.lines || []
    }, 'AI_AGENT_CHATGPT');
  });

  app.post('/api/v1/adjustments/approve', {
    schema: {
      description: 'Approve a drafted dual-entry journal entry',
      body: {
        type: 'object',
        required: ['adjustmentId'],
        properties: {
          adjustmentId: { type: 'string' },
          approvedBy: { type: 'string', default: 'Finance Lead' }
        }
      }
    }
  }, async (req, reply) => {
    const userId = await requireDashboardSession(req, reply);
    if (!userId) return;
    const body = (req.body as any) || {};
    if (!body.adjustmentId) {
      return reply.status(400).send({ success: false, error: 'adjustmentId is required' });
    }
    return getJournalServiceFor(userId).approveAdjustment(body.adjustmentId, body.approvedBy || 'Finance Lead');
  });

  app.post('/api/v1/adjustments/commit', {
    schema: {
      description: 'Commit an approved journal adjustment to connected ERP',
      body: {
        type: 'object',
        required: ['adjustmentId'],
        properties: {
          adjustmentId: { type: 'string' },
          targetERP: { type: 'string', enum: ['QUICKBOOKS', 'NETSUITE', 'XERO'], default: 'QUICKBOOKS' }
        }
      }
    }
  }, async (req, reply) => {
    const userId = await requireDashboardSession(req, reply);
    if (!userId) return;
    const body = (req.body as any) || {};
    if (!body.adjustmentId) {
      return reply.status(400).send({ success: false, error: 'adjustmentId is required' });
    }
    return getJournalServiceFor(userId).commitToERP(body.adjustmentId, body.targetERP || 'QUICKBOOKS');
  });

  app.delete('/api/v1/adjustments/:id', {
    schema: {
      description: 'Delete a draft journal adjustment (DRAFT status only)'
    }
  }, async (req, reply) => {
    const userId = await requireDashboardSession(req, reply);
    if (!userId) return;
    const { id } = req.params as { id: string };
    const result = await getJournalServiceFor(userId).deleteAdjustment(id);
    if (!result.success) {
      return reply.status(400).send(result);
    }
    return result;
  });

  app.get('/api/v1/audit-trail', {
    schema: {
      description: 'Get the cryptographic GAAP audit trail and verify chain integrity'
    }
  }, async (req, reply) => {
    const userId = await requireDashboardSession(req, reply);
    if (!userId) return;
    const auditTrail = getAuditTrailFor(userId);
    return {
      integrity: await auditTrail.verifyIntegrity(),
      trail: await auditTrail.getTrail()
    };
  });

  app.post('/api/v1/cron/trigger', {
    schema: {
      description: 'Trigger overnight reconciliation background job and Slack alerts',
      body: {
        type: 'object',
        properties: {
          period: { type: 'string', default: '2026-09' }
        }
      }
    }
  }, async (req, reply) => {
    const userId = await requireDashboardSession(req, reply);
    if (!userId) return;
    const body = (req.body as any) || {};
    return backgroundCron.runOvernightReconciliation(userId, body.period || '2026-09');
  });

  // MCP Streamable HTTP Transport for Remote MCP Clients. Gated on a
  // Bearer access token issued by our own oidc-provider (the 401 +
  // WWW-Authenticate handshake below is what tells Claude/ChatGPT to
  // start the OAuth flow at /.well-known/oauth-protected-resource).
  //
  // Stateless: a fresh MCP server + transport per request, per the SDK's
  // own documented pattern for a server like this one with no state to
  // share between calls. The old SSE version kept ONE shared transport in
  // a module-level variable, so a second client connecting to /sse
  // silently replaced the first client's transport and broke its pending
  // /messages posts — stateless mode has no such shared mutable state to
  // race on.
  app.all('/mcp', async (req, reply) => {
    const userId = await resolveUserIdFromBearer(provider, req.raw);
    if (!userId) {
      reply
        .code(401)
        .header('WWW-Authenticate', `Bearer resource_metadata="${new URL('/.well-known/oauth-protected-resource', issuer).toString()}"`)
        .send({ error: 'unauthorized' });
      return;
    }

    reply.hijack();
    const mcpServer = createLedgerGuardMCPServer(userId);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await mcpServer.connect(transport);
    await transport.handleRequest(req.raw, reply.raw, req.body);
  });

  return app;
}

async function readFormBody(req: FastifyRequest): Promise<Map<string, string>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req.raw) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf-8');
  const params = new URLSearchParams(raw);
  const map = new Map<string, string>();
  for (const [key, value] of params) map.set(key, value);
  return map;
}

function consentPage(uid: string, clientId: string): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Authorize — LedgerGuard</title>
<style>
  body { background:#090d16; color:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
  .card { background:rgba(18,26,43,0.9); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:2.5rem; max-width:380px; width:90%; text-align:center; }
  button { width:100%; padding:0.7rem; border-radius:8px; border:none; background:#3b82f6; color:white; font-weight:600; font-size:0.9rem; cursor:pointer; }
  p { color:#94a3b8; font-size:0.85rem; line-height:1.5; }
</style></head>
<body><div class="card">
  <h1>🛡️ Authorize access</h1>
  <p><strong>${clientId.replace(/</g, '&lt;')}</strong> wants to access your LedgerGuard account — your connected payment gateways and reconciliation data.</p>
  <form method="POST" action="/interaction/${uid}/consent"><button type="submit">Allow</button></form>
</div></body></html>`;
}
