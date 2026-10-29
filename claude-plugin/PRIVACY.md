# LedgerGuard Privacy Policy

This plugin connects Claude to a LedgerGuard MCP server
(`https://ledgerguard-production-8bc4.up.railway.app/mcp`) operated by
LedgerGuard Team.

## What it sends

When you ask Claude to audit a period, draft a journal adjustment, or
check the audit trail, the plugin sends the accounting period, materiality
threshold, and any adjustment details (account codes, memo text, amounts)
you or Claude specify. It does not send your Claude conversation history
beyond what's needed to make that one tool call.

## What the server stores

The server computes variance reports and anomalies from its own connected
financial data sources (Stripe, Plaid, Chargebee, and an ERP). It stores
the dual-entry journal adjustments drafted through it and an append-only,
cryptographically hash-chained audit trail of actions taken through this
plugin (who/what triggered each action, and a summary — not full
transaction payloads).

## What it does not do

The server does not sell, share, or forward any data to a third party
beyond the financial systems it's explicitly connected to. It does not use
data sent through this plugin for advertising or model training.

## Contact

Questions about this policy or a data request: open an issue at
https://github.com/modedigicreations/LedgerGuard/issues.
