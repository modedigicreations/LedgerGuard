import { pool } from '../db/pool.js';
import { encryptSecret, decryptSecret } from './crypto.js';

export type ConnectedProvider =
	| 'STRIPE'
	| 'CHARGEBEE'
	| 'PLAID'
	| 'QUICKBOOKS'
	| 'PAYSTACK'
	| 'PAYPAL'
	| 'SQUARE'
	| 'BRAINTREE'
	| 'PADDLE';

// Looks up and decrypts a user's stored API key for a simple-API-key
// provider (Stripe, Chargebee, PayStack, Paddle). Returns null when
// nothing is connected — callers treat that as NOT_CONFIGURED, never as
// "fall back to some other credential." accountId is the one non-secret
// identifier a provider might need alongside the key (Chargebee's "site"
// name) — null for providers that don't need one.
export async function getApiKeyFor(
	userId: string,
	provider: ConnectedProvider,
): Promise<{ apiKey: string; accountId: string | null } | null> {
	const { rows } = await pool.query(
		`SELECT encrypted_api_key, oauth_account_id FROM connected_accounts WHERE user_id = $1 AND provider = $2 AND status = 'CONNECTED'`,
		[userId, provider],
	);
	if (rows.length === 0 || !rows[0].encrypted_api_key) return null;
	return { apiKey: decryptSecret(rows[0].encrypted_api_key), accountId: rows[0].oauth_account_id };
}

export async function setApiKeyFor(
	userId: string,
	provider: ConnectedProvider,
	apiKey: string,
	accountId?: string,
): Promise<void> {
	const encrypted = encryptSecret(apiKey);
	await pool.query(
		`INSERT INTO connected_accounts (user_id, provider, status, encrypted_api_key, oauth_account_id, last_synced_at, updated_at)
		 VALUES ($1, $2, 'CONNECTED', $3, $4, now(), now())
		 ON CONFLICT (user_id, provider) DO UPDATE
		 SET status = 'CONNECTED', encrypted_api_key = $3, oauth_account_id = $4, last_error = NULL, updated_at = now()`,
		[userId, provider, encrypted, accountId ?? null],
	);
}

export async function disconnectProvider(userId: string, provider: ConnectedProvider): Promise<void> {
	await pool.query(
		`UPDATE connected_accounts SET status = 'REVOKED', encrypted_api_key = NULL, updated_at = now()
		 WHERE user_id = $1 AND provider = $2`,
		[userId, provider],
	);
}

export interface ConnectionStatus {
	provider: ConnectedProvider;
	status: 'NOT_CONFIGURED' | 'CONNECTED' | 'ERROR' | 'REVOKED';
	lastSyncedAt: string | null;
	lastError: string | null;
}

export async function listConnectionsFor(userId: string): Promise<ConnectionStatus[]> {
	const { rows } = await pool.query(
		`SELECT provider, status, last_synced_at, last_error FROM connected_accounts WHERE user_id = $1`,
		[userId],
	);
	return rows.map((r) => ({
		provider: r.provider,
		status: r.status,
		lastSyncedAt: r.last_synced_at ? new Date(r.last_synced_at).toISOString() : null,
		lastError: r.last_error,
	}));
}
