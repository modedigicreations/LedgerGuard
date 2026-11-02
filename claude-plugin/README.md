# LedgerGuard

Audit recognized revenue against payment-processor net deposits from a
conversation with Claude. LedgerGuard flags any discrepancy over a
materiality threshold (default $250), matches it against the underlying
processor fee where one exists, and drafts a GAAP-compliant dual-entry
journal adjustment for you to review before it's posted.

LedgerGuard is multi-tenant: you sign in with your own email (a 6-digit
code, no password) and connect your own payment gateway accounts — Stripe,
Chargebee, PayStack, Paddle, or Braintree. Your credentials are encrypted
and your data is isolated from every other user; nothing is shared across
accounts.

## Use it

The first time, ask Claude to connect a gateway, e.g. "Connect my Stripe
account to LedgerGuard" — Claude calls `connect_payment_gateway` and hands
you a link to LedgerGuard's own dashboard, where you paste your API key
directly (never through the chat).

Once connected, ask Claude to audit a period, e.g. "Audit September
revenue recognized against Stripe net deposits, flag anything over $250."
Claude runs the audit, explains each flagged anomaly (fee mismatches,
unmatched revenue, unrecorded chargebacks, month-end timing float) in
plain language, and — only on your explicit confirmation — drafts, and
then posts, the balancing journal entry. You can also ask for the
cryptographic GAAP audit trail to confirm nothing in your compliance log
has been tampered with.

## Data

This plugin connects to a LedgerGuard server. The first time you use it,
you sign in with your own email and the server creates an account scoped
to you alone — your connected gateway credentials, journal adjustments,
and audit trail are never visible to any other user. It sends the
accounting period and threshold you specify, and receives back variance
reports, anomalies, and journal adjustments computed from your own
connected data sources. LedgerGuard stores the dual-entry journal
adjustments it drafts and an append-only, cryptographically hash-chained
audit trail of actions taken through it; it does not share your data with
any destination beyond the financial systems you've explicitly connected.

## Status

Live gateways: Stripe, PayStack, Paddle, Braintree (API-key based — paste
a key through the dashboard). Chargebee is supported for recognized
revenue specifically. Square, PayPal, Plaid, and QuickBooks write-back are
not yet built (each needs its own OAuth app registration first).
