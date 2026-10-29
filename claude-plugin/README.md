# LedgerGuard

Audit recognized revenue against Stripe net deposits, Plaid bank feeds, and
your ERP ledger from a conversation with Claude. LedgerGuard flags any
discrepancy over a materiality threshold (default $250), matches it against
the underlying payment-processor fee where one exists, and drafts a
GAAP-compliant dual-entry journal adjustment for you to review before it's
posted to QuickBooks, NetSuite, or Xero.

## Use it

Ask Claude to audit a period, e.g. "Audit September revenue recognized
against Stripe net deposits, flag anything over $250." Claude runs the
audit, explains each flagged anomaly (fee mismatches, unrecorded
chargebacks, month-end timing float) in plain language, and — only on your
explicit confirmation — drafts, and then posts, the balancing journal
entry. You can also ask for the cryptographic GAAP audit trail to confirm
nothing in the compliance log has been tampered with.

## Data

This plugin connects to a LedgerGuard server you run. It sends the
accounting period and threshold you specify, and receives back variance
reports, anomalies, and journal adjustments computed from that server's
connected Stripe, Plaid, Chargebee, and ERP data sources. LedgerGuard
itself stores the dual-entry journal adjustments it drafts and an
append-only audit trail of actions taken through it; it does not share
data with any destination beyond the server operator's own connected
financial systems.

## Before you submit this plugin

`.mcp.json` now points at a real, running server
(`https://ledgerguard-production-8bc4.up.railway.app/mcp`, deployed on
Railway, serving current MCP Streamable HTTP) rather than a placeholder.
Still outstanding before submitting:

- Run `claude plugin validate ./claude-plugin` (no `claude` CLI was
  available in the environment this was built in).
- This demo deployment serves mock September 2026 data only — decide
  whether that's the intended public-facing behavior or whether it should
  be gated/relabeled before a real audience can reach it from the
  directory.
- The remaining `zod` memory-exhaustion CVE in the server's dependency
  tree (fixed in zod v4; left alone during the transport migration since
  it's a breaking change across every schema in this codebase) is worth
  resolving before wide distribution.
