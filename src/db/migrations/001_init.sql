-- Phase 0: database foundation. Replaces the in-memory audit trail (array)
-- and journal adjustments (Map) with durable storage, and adds the table
-- real provider connections will live in from Phase 1 onward.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS connected_accounts (
	id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	provider                TEXT NOT NULL CHECK (provider IN ('STRIPE', 'CHARGEBEE', 'PLAID', 'QUICKBOOKS')),
	status                  TEXT NOT NULL DEFAULT 'NOT_CONFIGURED' CHECK (status IN ('NOT_CONFIGURED', 'CONNECTED', 'ERROR', 'REVOKED')),
	plaid_item_id           TEXT,
	plaid_access_token      TEXT,
	plaid_institution       TEXT,
	qbo_realm_id            TEXT,
	qbo_access_token        TEXT,
	qbo_refresh_token       TEXT,
	qbo_token_expires_at    TIMESTAMPTZ,
	qbo_refresh_expires_at  TIMESTAMPTZ,
	last_synced_at          TIMESTAMPTZ,
	last_error              TEXT,
	created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
	UNIQUE (provider)
);

CREATE TABLE IF NOT EXISTS journal_adjustments (
	id                  TEXT PRIMARY KEY,
	adjustment_number   TEXT NOT NULL,
	anomaly_id          TEXT,
	reference           TEXT NOT NULL,
	date                DATE NOT NULL,
	memo                TEXT NOT NULL,
	lines               JSONB NOT NULL,
	total_debit         NUMERIC(14, 2) NOT NULL,
	total_credit        NUMERIC(14, 2) NOT NULL,
	is_balanced         BOOLEAN NOT NULL,
	status              TEXT NOT NULL CHECK (status IN ('DRAFT', 'APPROVED', 'POSTED', 'REJECTED')),
	target_erp          TEXT NOT NULL DEFAULT 'QUICKBOOKS',
	created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
	approved_at         TIMESTAMPTZ,
	approved_by         TEXT,
	erp_posted_id       TEXT
);

-- sequence is NOT a SERIAL/IDENTITY: it's assigned in application code
-- (alongside previous_hash/current_hash) inside a transaction that locks
-- audit_trail_lock first, so concurrent appends can't interleave and break
-- the hash chain. See src/db/audit-trail.repo.ts.
CREATE TABLE IF NOT EXISTS audit_trail_entries (
	sequence        BIGINT PRIMARY KEY,
	timestamp       TIMESTAMPTZ NOT NULL,
	action          TEXT NOT NULL,
	actor           TEXT NOT NULL,
	details         TEXT NOT NULL,
	-- json, not jsonb: jsonb normalizes storage and does not preserve
	-- object key order, but the hash chain is computed over the exact
	-- JSON.stringify(evidence) string — a reordered round-trip would make
	-- every entry fail its own hash check. json stores the input text as-is.
	evidence        JSON NOT NULL,
	previous_hash   TEXT NOT NULL,
	current_hash    TEXT NOT NULL
);

-- Singleton row to lock (SELECT ... FOR UPDATE) around each audit trail
-- append, serializing writers without taking a table-level lock.
CREATE TABLE IF NOT EXISTS audit_trail_lock (id BOOLEAN PRIMARY KEY DEFAULT true);
INSERT INTO audit_trail_lock (id) VALUES (true) ON CONFLICT DO NOTHING;
