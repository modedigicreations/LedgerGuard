import { randomBytes, createHash } from 'crypto';
import { Resend } from 'resend';
import { pool } from '../db/pool.js';
const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
function hashToken(rawToken) {
    return createHash('sha256').update(rawToken).digest('hex');
}
function getResend() {
    if (!process.env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY is not set — magic-link sign-in cannot send email.');
    }
    return new Resend(process.env.RESEND_API_KEY);
}
async function findOrCreateUser(email) {
    const normalized = email.trim().toLowerCase();
    const { rows } = await pool.query(`INSERT INTO users (email) VALUES ($1)
		 ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
		 RETURNING id`, [normalized]);
    return rows[0].id;
}
// Generates a single-use token (stored only as a hash — never in
// plaintext), emails the raw token as a link via Resend, and returns the
// userId it was issued for.
export async function sendMagicLink(options) {
    const userId = await findOrCreateUser(options.email);
    const rawToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    await pool.query(`INSERT INTO magic_link_tokens (user_id, token_hash, interaction_uid, expires_at)
		 VALUES ($1, $2, $3, $4)`, [userId, hashToken(rawToken), options.interactionUid ?? null, expiresAt]);
    // oidc-provider scopes its interaction cookie to the /interaction/:uid
    // path specifically — a verify link at any other path, even with the
    // right cookie jar, would never actually receive that cookie (a real
    // browser hits the exact same wall curl did while testing this). The
    // dashboard-only case (no interaction to resume) has no such
    // constraint and uses a plain top-level path.
    const verifyPath = options.interactionUid
        ? `/interaction/${options.interactionUid}/verify`
        : '/magic-link/verify';
    const verifyUrl = new URL(verifyPath, options.baseUrl);
    verifyUrl.searchParams.set('token', rawToken);
    if (!process.env.RESEND_API_KEY) {
        // No email provider configured — print the link instead of failing
        // outright, so local dev (and testing this flow before Resend is
        // set up) still works end to end. Never falls back silently in a
        // way that hides the missing config: it's loud, in logs an
        // operator would see.
        console.warn(`[magic-link] RESEND_API_KEY not set — sign-in link for ${options.email}: ${verifyUrl.toString()}`);
        return userId;
    }
    const resend = getResend();
    await resend.emails.send({
        from: process.env.EMAIL_FROM || 'LedgerGuard <noreply@ledgerguard.app>',
        to: options.email,
        subject: 'Sign in to LedgerGuard',
        html: `<p>Click below to sign in to LedgerGuard. This link expires in 15 minutes and can only be used once.</p><p><a href="${verifyUrl.toString()}">Sign in to LedgerGuard</a></p><p>If you didn't request this, you can ignore this email.</p>`,
        text: `Sign in to LedgerGuard: ${verifyUrl.toString()} (expires in 15 minutes, single use)`,
    });
    return userId;
}
// Consumes a single-use token. Returns null for anything invalid, expired,
// or already-used rather than distinguishing why — no reason to help an
// attacker enumerate which failure mode they hit.
export async function verifyMagicLink(rawToken) {
    const tokenHash = hashToken(rawToken);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(`SELECT magic_link_tokens.id, magic_link_tokens.user_id, magic_link_tokens.interaction_uid, users.email
			 FROM magic_link_tokens
			 JOIN users ON users.id = magic_link_tokens.user_id
			 WHERE magic_link_tokens.token_hash = $1
			   AND magic_link_tokens.consumed_at IS NULL
			   AND magic_link_tokens.expires_at > now()
			 FOR UPDATE OF magic_link_tokens`, [tokenHash]);
        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return null;
        }
        await client.query('UPDATE magic_link_tokens SET consumed_at = now() WHERE id = $1', [rows[0].id]);
        await client.query('COMMIT');
        return { userId: rows[0].user_id, email: rows[0].email, interactionUid: rows[0].interaction_uid };
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
}
//# sourceMappingURL=magic-link.js.map