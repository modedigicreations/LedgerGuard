import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'crypto';

// AES-256-GCM for anything stored in connected_accounts: a user's own
// Stripe/Chargebee/PayStack/Paddle API key, or an OAuth token pair for
// providers that use one. One key for the whole deployment
// (LEDGERGUARD_TOKEN_ENCRYPTION_KEY) — hashed with SHA-256 to get exactly
// 32 bytes regardless of what the operator actually sets it to.
function getKey(): Buffer {
	const secret = process.env.LEDGERGUARD_TOKEN_ENCRYPTION_KEY;
	if (!secret) {
		throw new Error('LEDGERGUARD_TOKEN_ENCRYPTION_KEY is not set — cannot store or read provider credentials.');
	}
	return createHash('sha256').update(secret).digest();
}

// iv:authTag:ciphertext, all base64 — stored as a single TEXT column.
export function encryptSecret(plaintext: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
	const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
	const authTag = cipher.getAuthTag();
	return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptSecret(stored: string): string {
	const [ivB64, authTagB64, ciphertextB64] = stored.split(':');
	if (!ivB64 || !authTagB64 || !ciphertextB64) {
		throw new Error('Malformed encrypted credential value.');
	}
	const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
	decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
	const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, 'base64')), decipher.final()]);
	return plaintext.toString('utf-8');
}
