-- Phase A: identity foundation. LedgerGuard becomes its own OAuth 2.1
-- authorization server (oidc-provider, backing Claude/ChatGPT's
-- oauth_dcr) so each person who connects gets their own account instead
-- of sharing one deployment-wide identity.

CREATE TABLE IF NOT EXISTS users (
	id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	email       TEXT NOT NULL UNIQUE,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A magic-link token is never stored in plaintext — only its hash. The
-- link itself (with the raw token) exists only in the email we send.
CREATE TABLE IF NOT EXISTS magic_link_tokens (
	id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	token_hash       TEXT NOT NULL UNIQUE,
	-- Set when this link is finishing an oidc-provider OAuth interaction
	-- (an MCP client signing someone in); NULL for a dashboard-only login,
	-- which just sets a cookie instead of resuming an OAuth flow.
	interaction_uid  TEXT,
	expires_at       TIMESTAMPTZ NOT NULL,
	consumed_at      TIMESTAMPTZ,
	created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_expires_at ON magic_link_tokens (expires_at);

CREATE TABLE IF NOT EXISTS dashboard_sessions (
	id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	expires_at  TIMESTAMPTZ NOT NULL,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dashboard_sessions_expires_at ON dashboard_sessions (expires_at);

-- oidc-provider's own persistence layer: one generic table backs every
-- model it needs to store (AccessToken, RefreshToken, AuthorizationCode,
-- Client, Grant, Interaction, Session, DeviceCode, ...), matching the
-- shape its Adapter interface expects (upsert/find/findByUid/
-- findByUserCode/consume/destroy/revokeByGrantId). See
-- src/auth/oidc-adapter.ts.
CREATE TABLE IF NOT EXISTS oidc_model_payloads (
	model_name   TEXT NOT NULL,
	id           TEXT NOT NULL,
	grant_id     TEXT,
	user_code    TEXT,
	uid          TEXT,
	payload      JSONB NOT NULL,
	expires_at   TIMESTAMPTZ,
	consumed_at  TIMESTAMPTZ,
	PRIMARY KEY (model_name, id)
);
CREATE INDEX IF NOT EXISTS idx_oidc_model_grant_id   ON oidc_model_payloads (grant_id)  WHERE grant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_oidc_model_uid        ON oidc_model_payloads (uid)       WHERE uid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_oidc_model_user_code  ON oidc_model_payloads (user_code) WHERE user_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_oidc_model_expires_at ON oidc_model_payloads (expires_at);

-- The JWT signing keypair for issued access/ID tokens. Generated once on
-- first boot (see src/auth/oidc-provider.ts) and persisted here rather
-- than as an env var — it's infrastructure we generate ourselves, not a
-- third-party credential, and keeping it in the same DB as everything
-- else avoids a manual copy-paste round trip through Railway's dashboard.
-- Singleton row, same pattern as the old audit_trail_lock row.
CREATE TABLE IF NOT EXISTS oidc_jwks (
	id    BOOLEAN PRIMARY KEY DEFAULT true,
	keys  JSONB NOT NULL
);
