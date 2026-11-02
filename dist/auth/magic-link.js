import { randomBytes, randomInt, createHash } from 'crypto';
import { Resend } from 'resend';
import { pool } from '../db/pool.js';
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;
function hashCode(code) {
    return createHash('sha256').update(code).digest('hex');
}
function generateCode() {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
}
async function findOrCreateUser(email) {
    const normalized = email.trim().toLowerCase();
    const { rows } = await pool.query(`INSERT INTO users (email) VALUES ($1)
		 ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
		 RETURNING id`, [normalized]);
    return rows[0].id;
}
function getResend() {
    if (!process.env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY is not set — magic-link sign-in cannot send email.');
    }
    return new Resend(process.env.RESEND_API_KEY);
}
// Sends a 6-digit one-time code the user types in by hand, rather than a
// clickable link. A link that silently completes sign-in on load is
// exactly what mail security gateways (Safe Links, Proofpoint, Mimecast)
// and some senders' own click-tracking are built to visit automatically
// — which was burning the single-use credential before a real person
// ever saw it. A typed code has no URL for anything automated to act on.
export async function sendMagicLink(options) {
    const userId = await findOrCreateUser(options.email);
    const challengeId = options.interactionUid ?? randomBytes(16).toString('base64url');
    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);
    // A fresh code invalidates any still-pending one for the same
    // challenge, so only ever the latest code is a valid guess target —
    // otherwise hitting "resend" a few times would leave several codes
    // simultaneously live for the same login.
    await pool.query(`UPDATE magic_link_tokens SET consumed_at = now() WHERE interaction_uid = $1 AND consumed_at IS NULL`, [challengeId]);
    await pool.query(`INSERT INTO magic_link_tokens (user_id, token_hash, interaction_uid, expires_at)
		 VALUES ($1, $2, $3, $4)`, [userId, hashCode(code), challengeId, expiresAt]);
    if (!process.env.RESEND_API_KEY) {
        // No email provider configured — print the code instead of failing
        // outright, so local dev still works end to end. Loud on purpose,
        // in logs an operator would see, never a silent fallback.
        console.warn(`[magic-link] RESEND_API_KEY not set — sign-in code for ${options.email}: ${code}`);
        return { userId, challengeId };
    }
    const resend = getResend();
    await resend.emails.send({
        from: process.env.EMAIL_FROM || 'LedgerGuard <noreply@ledgerguard.app>',
        to: options.email,
        subject: `Your LedgerGuard sign-in code: ${code}`,
        html: `<p>Your LedgerGuard sign-in code is:</p><p style="font-size:32px;font-weight:700;letter-spacing:6px;">${code}</p><p>Type it into the page where you requested it. It expires in 10 minutes and works once. Do not share this code, and ignore this email if you didn't request it — there is no link here to click.</p>`,
        text: `Your LedgerGuard sign-in code is: ${code}\n\nType it into the page where you requested it. It expires in 10 minutes and works once. There is no link to click.`,
    });
    return { userId, challengeId };
}
// Consumes a one-time code for the given challenge. Returns null for
// anything invalid, expired, locked out, or wrong — no reason to
// distinguish why, same reasoning as before: don't help an attacker
// enumerate which failure mode they hit. A wrong guess increments the
// attempt count and locks the code out entirely after MAX_ATTEMPTS,
// since a 6-digit space is only ~1M wide and worth guarding directly
// rather than relying on TTL alone.
export async function verifyCode(challengeId, code) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(`SELECT magic_link_tokens.id, magic_link_tokens.user_id, magic_link_tokens.token_hash, magic_link_tokens.attempts, users.email
			 FROM magic_link_tokens
			 JOIN users ON users.id = magic_link_tokens.user_id
			 WHERE magic_link_tokens.interaction_uid = $1
			   AND magic_link_tokens.consumed_at IS NULL
			   AND magic_link_tokens.expires_at > now()
			 ORDER BY magic_link_tokens.created_at DESC
			 LIMIT 1
			 FOR UPDATE OF magic_link_tokens`, [challengeId]);
        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return null;
        }
        const row = rows[0];
        if (row.attempts >= MAX_ATTEMPTS) {
            await client.query('UPDATE magic_link_tokens SET consumed_at = now() WHERE id = $1', [row.id]);
            await client.query('COMMIT');
            return null;
        }
        if (hashCode(code) !== row.token_hash) {
            await client.query('UPDATE magic_link_tokens SET attempts = attempts + 1 WHERE id = $1', [row.id]);
            await client.query('COMMIT');
            return null;
        }
        await client.query('UPDATE magic_link_tokens SET consumed_at = now() WHERE id = $1', [row.id]);
        await client.query('COMMIT');
        return { userId: row.user_id, email: row.email };
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