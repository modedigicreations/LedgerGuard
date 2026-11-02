-- Phase B: connected_accounts, journal_adjustments, and the audit trail
-- all predate the identity work in 002_identity.sql — they're still
-- global/single-tenant. This makes every one of them per-user.

-- connected_accounts: was UNIQUE(provider) — one row per provider for the
-- whole deployment. Becomes UNIQUE(user_id, provider). Any pre-auth rows
-- (there's no legitimate owner to assign them to — /mcp had zero auth
-- until Phase A) are discarded, not migrated to a fake owner.
DELETE FROM connected_accounts WHERE user_id IS NULL;
ALTER TABLE connected_accounts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE connected_accounts ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE connected_accounts DROP CONSTRAINT IF EXISTS connected_accounts_provider_key;
ALTER TABLE connected_accounts DROP CONSTRAINT IF EXISTS connected_accounts_user_id_provider_key;
ALTER TABLE connected_accounts ADD CONSTRAINT connected_accounts_user_id_provider_key UNIQUE (user_id, provider);

ALTER TABLE connected_accounts DROP CONSTRAINT IF EXISTS connected_accounts_provider_check;
ALTER TABLE connected_accounts ADD CONSTRAINT connected_accounts_provider_check
	CHECK (provider IN ('STRIPE', 'CHARGEBEE', 'PLAID', 'QUICKBOOKS', 'PAYSTACK', 'PAYPAL', 'SQUARE', 'BRAINTREE', 'PADDLE'));

-- Generic credential columns covering both shapes a provider might need:
-- a single encrypted API key (Stripe/Chargebee/PayStack/Paddle) or an
-- OAuth token pair (Plaid/QuickBooks/PayPal/Square). All encrypted at
-- rest via AES-256-GCM (see src/auth/crypto.ts), keyed by
-- LEDGERGUARD_TOKEN_ENCRYPTION_KEY. Plaid/QBO keep using their existing
-- bespoke columns from 001_init.sql (plaid_access_token, qbo_*) — those
-- predate this migration and are left alone per the earlier decision not
-- to touch Plaid/QBO's design in this pass.
ALTER TABLE connected_accounts ADD COLUMN IF NOT EXISTS encrypted_api_key      TEXT;
ALTER TABLE connected_accounts ADD COLUMN IF NOT EXISTS oauth_access_token     TEXT;
ALTER TABLE connected_accounts ADD COLUMN IF NOT EXISTS oauth_refresh_token    TEXT;
ALTER TABLE connected_accounts ADD COLUMN IF NOT EXISTS oauth_token_expires_at TIMESTAMPTZ;
ALTER TABLE connected_accounts ADD COLUMN IF NOT EXISTS oauth_account_id       TEXT;

-- journal_adjustments: had no user_id at all.
DELETE FROM journal_adjustments WHERE user_id IS NULL;
ALTER TABLE journal_adjustments ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE journal_adjustments ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_journal_adjustments_user_id ON journal_adjustments (user_id);

-- audit_trail_entries: one hash chain PER USER, not retrofitted from the
-- old global one — a compliance audit trail should be "here is customer
-- X's complete, independently verifiable chain," not interleaved entries
-- from strangers. The old table is kept (renamed) rather than dropped,
-- since it's real history, just not owned by any current user.
ALTER TABLE audit_trail_entries RENAME TO audit_trail_entries_legacy_global;
DROP TABLE IF EXISTS audit_trail_lock;

CREATE TABLE audit_trail_entries (
	user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	sequence      BIGINT NOT NULL,
	timestamp     TIMESTAMPTZ NOT NULL,
	action        TEXT NOT NULL,
	actor         TEXT NOT NULL,
	details       TEXT NOT NULL,
	evidence      JSON NOT NULL,
	previous_hash TEXT NOT NULL,
	current_hash  TEXT NOT NULL,
	PRIMARY KEY (user_id, sequence)
);
