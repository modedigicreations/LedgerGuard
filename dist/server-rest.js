import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createLedgerGuardMCPServer } from './server-mcp.js';
import { reconciler } from './engine/reconciler.js';
import { journalService } from './engine/journal-generator.js';
import { auditTrail } from './engine/audit-trail.js';
import { backgroundCron } from './cron/scheduler.js';
import { getDashboardHtml } from './dashboard/html.js';
export async function buildRestServer() {
    const app = Fastify({
        logger: false
    });
    await app.register(cors, {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
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
    // Standalone Web Dashboard
    app.get('/', async (req, reply) => {
        reply.type('text/html').send(getDashboardHtml());
    });
    // ChatGPT Plugin Manifest
    app.get('/.well-known/ai-plugin.json', async (req, reply) => {
        reply.type('application/json').send({
            schema_version: 'v1',
            name_for_human: 'LedgerGuard Financial Auditor',
            name_for_model: 'ledgerguard',
            description_for_human: 'Autonomous Cross-Platform Financial Auditor & Reconciliation Engine.',
            description_for_model: 'Audit recognized revenue from billing (Chargebee) against Stripe net deposits and bank feeds. Flag variances over thresholds with matching fees, review anomalies, and draft balancing dual-entry journal adjustments for user approval.',
            auth: {
                type: 'none'
            },
            api: {
                type: 'openapi',
                url: 'http://localhost:3333/docs/json'
            },
            logo_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=128&q=80',
            contact_email: 'support@ledgerguard.ai',
            legal_info_url: 'http://localhost:3333/legal'
        });
    });
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
    }, async (req) => {
        const query = req.query;
        return reconciler.runAudit({
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
    }, async (req) => {
        const query = req.query;
        const report = await reconciler.runAudit({
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
    }, async () => {
        return journalService.listAdjustments();
    });
    // Health Check Endpoint
    app.get('/api/v1/health', {
        schema: {
            description: 'Check service health and engine status'
        }
    }, async () => {
        let auditTrailStatus = 'degraded';
        try {
            auditTrailStatus = (await auditTrail.verifyIntegrity()).isValid ? 'verified' : 'degraded';
        }
        catch {
            // A DB hiccup shouldn't fail the health check itself — Railway's
            // healthcheckPath only needs this endpoint to respond.
        }
        return {
            status: 'healthy',
            service: 'ledgerguard',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            auditTrailStatus
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
    }, async (req) => {
        const body = req.body || {};
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
        const body = req.body || {};
        if (!body.adjustmentId) {
            return reply.status(400).send({ success: false, error: 'adjustmentId is required' });
        }
        return journalService.approveAdjustment(body.adjustmentId, body.approvedBy || 'Finance Lead');
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
        const body = req.body || {};
        if (!body.adjustmentId) {
            return reply.status(400).send({ success: false, error: 'adjustmentId is required' });
        }
        return journalService.commitToERP(body.adjustmentId, body.targetERP || 'QUICKBOOKS');
    });
    app.get('/api/v1/audit-trail', {
        schema: {
            description: 'Get the cryptographic GAAP audit trail and verify chain integrity'
        }
    }, async () => {
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
    }, async (req) => {
        const body = req.body || {};
        return backgroundCron.runOvernightReconciliation(body.period || '2026-09');
    });
    // MCP Streamable HTTP Transport for Remote MCP Clients (the current MCP
    // transport — the legacy HTTP+SSE transport this used to implement, with
    // a separate GET /sse + POST /messages pair, is deprecated and isn't
    // what the Claude plugin directory's `.mcp.json` expects).
    //
    // Stateless: a fresh MCP server + transport per request, per the SDK's
    // own documented pattern for a server like this one with no state to
    // share between calls. The old SSE version kept ONE shared transport in
    // a module-level variable, so a second client connecting to /sse
    // silently replaced the first client's transport and broke its pending
    // /messages posts — stateless mode has no such shared mutable state to
    // race on.
    app.all('/mcp', async (req, reply) => {
        reply.hijack();
        const mcpServer = createLedgerGuardMCPServer();
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        await mcpServer.connect(transport);
        await transport.handleRequest(req.raw, reply.raw, req.body);
    });
    return app;
}
//# sourceMappingURL=server-rest.js.map