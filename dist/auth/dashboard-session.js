import { randomUUID } from 'crypto';
import { pool } from '../db/pool.js';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const DASHBOARD_COOKIE_NAME = 'lg_session';
export async function createDashboardSession(userId) {
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await pool.query('INSERT INTO dashboard_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)', [id, userId, expiresAt]);
    return { id, expiresAt };
}
export async function resolveDashboardSession(sessionId) {
    if (!sessionId)
        return null;
    const { rows } = await pool.query('SELECT user_id FROM dashboard_sessions WHERE id = $1 AND expires_at > now()', [sessionId]);
    return rows[0]?.user_id ?? null;
}
export async function destroyDashboardSession(sessionId) {
    if (!sessionId)
        return;
    await pool.query('DELETE FROM dashboard_sessions WHERE id = $1', [sessionId]);
}
//# sourceMappingURL=dashboard-session.js.map