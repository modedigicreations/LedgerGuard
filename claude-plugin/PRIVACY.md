# LedgerGuard Privacy Policy

This plugin connects Claude to a LedgerGuard MCP server
(`https://ledgerguard-production-8bc4.up.railway.app/mcp`) operated by
LedgerGuard Team.

## Accounts

LedgerGuard is multi-tenant. The first time you use it, you sign in with
your own email address (a 6-digit code sent to your inbox — no password).
This creates an account scoped to you alone. Every other user of this
same server has their own separate account; your data, connected
credentials, journal adjustments, and audit trail are never visible to
them, and theirs are never visible to you.

## What it sends

When you ask Claude to connect a payment gateway, audit a period, draft a
journal adjustment, or check the audit trail, the plugin sends the
accounting period, materiality threshold, provider name, and any
adjustment details (account codes, memo text, amounts) you or Claude
specify. It does not send your Claude conversation history beyond what's
needed to make that one tool call.

Your payment-gateway API key is never sent through Claude or the MCP tool
call at all. The `connect_payment_gateway` tool only returns a link to
LedgerGuard's own dashboard; you enter your key there directly, over a
session-authenticated page, not through chat.

## What the server stores, scoped to your account

- Your email address (used for sign-in only).
- Your connected gateway credentials (Stripe, Chargebee, PayStack,
  Paddle, Braintree), encrypted at rest (AES-256-GCM).
- The dual-entry journal adjustments drafted through your account.
- An append-only, cryptographically hash-chained audit trail of actions
  taken through your account (who/what triggered each action, and a
  summary — not full transaction payloads).

Variance reports and anomalies are computed on demand from your own
connected gateway accounts; LedgerGuard does not retain a separate copy
of your raw transaction history beyond what a gateway's own API already
returns for the period you asked about.

## What it does not do

The server does not sell, share, or forward your data to a third party
beyond the financial systems you've explicitly connected. It does not use
data sent through this plugin for advertising or model training, and it
does not expose any user's data to any other user.

## Contact

Questions about this policy or a data request: open an issue at
https://github.com/modedigicreations/LedgerGuard/issues.
