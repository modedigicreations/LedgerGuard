import Provider from 'oidc-provider';
import { generateKeyPair, exportJWK } from 'jose';
import { randomUUID } from 'crypto';
import { pool } from '../db/pool.js';
import { PostgresAdapter } from './oidc-adapter.js';
// Generated once on first boot, persisted in Postgres (see
// 002_identity.sql's oidc_jwks table) rather than an env var — see that
// migration's comment for why.
async function ensureJwks() {
    const existing = await pool.query('SELECT keys FROM oidc_jwks WHERE id = true');
    if (existing.rows.length > 0) {
        return existing.rows[0].keys;
    }
    const { privateKey } = await generateKeyPair('RS256', { extractable: true, modulusLength: 2048 });
    const jwk = await exportJWK(privateKey);
    jwk.kid = randomUUID();
    jwk.alg = 'RS256';
    jwk.use = 'sig';
    const jwks = { keys: [jwk] };
    // ON CONFLICT in case two instances race on first boot — whichever
    // wins, everyone ends up reading the same row back out.
    await pool.query('INSERT INTO oidc_jwks (id, keys) VALUES (true, $1) ON CONFLICT (id) DO NOTHING', [JSON.stringify(jwks)]);
    const { rows } = await pool.query('SELECT keys FROM oidc_jwks WHERE id = true');
    return rows[0].keys;
}
export async function createOidcProvider(issuer) {
    const jwks = await ensureJwks();
    const cookieKeys = (process.env.LEDGERGUARD_OIDC_COOKIE_KEYS || '').split(',').filter(Boolean);
    if (cookieKeys.length === 0) {
        throw new Error('LEDGERGUARD_OIDC_COOKIE_KEYS is not set (comma-separated signing secrets).');
    }
    const provider = new Provider(issuer, {
        adapter: (name) => new PostgresAdapter(name),
        jwks,
        cookies: { keys: cookieKeys },
        // We render our own magic-link page instead of oidc-provider's
        // built-in dev-only login screen.
        features: {
            devInteractions: { enabled: false },
            // Open DCR, no pre-shared token — this is exactly what Claude's
            // oauth_dcr auth type expects: it registers itself the first
            // time someone connects, with no setup on our side.
            registration: { enabled: true, initialAccessToken: false },
        },
        claims: {
            openid: ['sub'],
            email: ['email'],
        },
        scopes: ['openid', 'email', 'offline_access'],
        async findAccount(_ctx, sub) {
            const { rows } = await pool.query('SELECT id, email FROM users WHERE id = $1', [sub]);
            if (rows.length === 0)
                return undefined;
            return {
                accountId: sub,
                claims: () => ({ sub, email: rows[0].email }),
            };
        },
        interactions: {
            url(_ctx, interaction) {
                return `/interaction/${interaction.uid}`;
            },
        },
        // Opaque access tokens (oidc-provider's default) rather than JWT:
        // validating one means one indexed lookup through the adapter
        // (see authenticate.ts), which is simpler than wiring up Resource
        // Indicators just to get JWT-formatted tokens, and still well
        // within every latency budget this app works under.
    });
    // Provider extends Koa — Railway (and any reverse proxy) terminates TLS
    // and forwards to this container over plain HTTP, so without this every
    // endpoint oidc-provider advertises in its discovery document (and
    // every redirect it issues) gets built as http:// instead of https://,
    // since Koa infers the protocol from the connection it actually sees
    // unless told to trust X-Forwarded-Proto.
    provider.proxy = true;
    return provider;
}
//# sourceMappingURL=oidc-provider.js.map