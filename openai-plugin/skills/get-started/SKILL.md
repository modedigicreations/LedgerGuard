---
name: get-started
description: Get a new LedgerGuard user connected and oriented — sign in, connect a payment gateway, and run their first audit. Use this the first time a user interacts with LedgerGuard, or whenever audit_revenue_vs_deposits comes back with every providerStatus entry NOT_CONFIGURED.
---

LedgerGuard is multi-tenant: every user signs in with their own email and connects their own payment gateway accounts. Nothing is shared across users.

1. The first tool call (e.g. `audit_revenue_vs_deposits`) triggers LedgerGuard's own OAuth sign-in automatically — the user signs in with their email and a 6-digit code (no password). This happens outside the conversation; just wait for it to complete.
2. If `providerStatus` comes back with everything `NOT_CONFIGURED`, the user hasn't connected a payment gateway yet. Call `connect_payment_gateway` with the provider they want (`STRIPE`, `CHARGEBEE`, `PAYSTACK`, or `PADDLE` — mention that `BRAINTREE` needs both a public and a private key) and give them the returned link. Never ask the user to paste an API key into chat — this tool exists specifically so they never have to; the key is entered directly on LedgerGuard's own dashboard.
3. Once connected, call `audit_revenue_vs_deposits` with a period (YYYY-MM) to run their first audit. Summarize the result in plain language: recognized revenue, net deposits, and any flagged anomalies — don't just paste raw JSON back.
4. If there's variance, call `get_transaction_anomalies` for the details, and offer to `draft_journal_adjustment` for any anomaly the user wants to address. Only call `approve_journal_adjustment` or `commit_journal_adjustment` after the user's own explicit confirmation of that specific step — never chain these automatically.

See the audit-month-end skill for the full ongoing audit workflow once a user is set up.
