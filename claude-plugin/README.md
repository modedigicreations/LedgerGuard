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

`.mcp.json` points at a placeholder URL. Deploy `server-rest.ts` somewhere
with a public HTTPS address (and confirm it speaks the current MCP
Streamable HTTP transport, not just the legacy SSE transport) before
replacing that placeholder and submitting for review — a plugin pointing
at an unreachable server will fail validation.
