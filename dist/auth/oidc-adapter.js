import { pool } from '../db/pool.js';
// oidc-provider's default adapter is in-memory — useless across Railway
// restarts/redeploys, since every signed-in session, access token, and
// registered client would vanish. This backs it with the generic
// oidc_model_payloads table (one row per object the library persists,
// keyed by (model_name, id)), implementing exactly the Adapter interface
// oidc-provider expects: https://github.com/panva/node-oidc-provider/blob/main/example/my_adapter.js
export class PostgresAdapter {
    name;
    constructor(name) {
        this.name = name;
    }
    async upsert(id, payload, expiresIn) {
        const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
        await pool.query(`INSERT INTO oidc_model_payloads (model_name, id, grant_id, user_code, uid, payload, expires_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)
			 ON CONFLICT (model_name, id) DO UPDATE
			 SET grant_id = $3, user_code = $4, uid = $5, payload = $6, expires_at = $7, consumed_at = NULL`, [this.name, id, payload.grantId ?? null, payload.userCode ?? null, payload.uid ?? null, JSON.stringify(payload), expiresAt]);
    }
    async find(id) {
        const { rows } = await pool.query(`SELECT payload, consumed_at FROM oidc_model_payloads
			 WHERE model_name = $1 AND id = $2 AND (expires_at IS NULL OR expires_at > now())`, [this.name, id]);
        if (rows.length === 0)
            return undefined;
        const payload = rows[0].payload;
        if (rows[0].consumed_at)
            payload.consumed = Math.floor(new Date(rows[0].consumed_at).getTime() / 1000);
        return payload;
    }
    async findByUserCode(userCode) {
        const { rows } = await pool.query(`SELECT payload FROM oidc_model_payloads
			 WHERE model_name = $1 AND user_code = $2 AND (expires_at IS NULL OR expires_at > now())`, [this.name, userCode]);
        return rows[0]?.payload;
    }
    async findByUid(uid) {
        const { rows } = await pool.query(`SELECT payload FROM oidc_model_payloads
			 WHERE model_name = $1 AND uid = $2 AND (expires_at IS NULL OR expires_at > now())`, [this.name, uid]);
        return rows[0]?.payload;
    }
    async consume(id) {
        await pool.query(`UPDATE oidc_model_payloads SET consumed_at = now() WHERE model_name = $1 AND id = $2`, [this.name, id]);
    }
    async destroy(id) {
        await pool.query(`DELETE FROM oidc_model_payloads WHERE model_name = $1 AND id = $2`, [this.name, id]);
    }
    async revokeByGrantId(grantId) {
        await pool.query(`DELETE FROM oidc_model_payloads WHERE grant_id = $1`, [grantId]);
    }
}
//# sourceMappingURL=oidc-adapter.js.map