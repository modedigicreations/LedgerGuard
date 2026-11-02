---
name: audit-month-end
description: Audit recognized revenue against payment-processor net deposits for an accounting period. Use when the user asks to audit or reconcile revenue, connect a payment gateway, investigate a cash/deposit discrepancy, review flagged financial anomalies or chargebacks, or wants to draft, approve, or post a journal adjustment.
---

0. If the user hasn't connected anything yet (or `audit_revenue_vs_deposits`
   comes back with every `providerStatus` entry `NOT_CONFIGURED`), call
   `connect_payment_gateway` with the provider they want (`STRIPE`,
   `CHARGEBEE`, `PAYSTACK`, or `PADDLE` — `BRAINTREE` needs both a public
   and a private key, mention that if they pick it) and give them the
   link it returns. Never ask the user to paste an API key into chat —
   this tool exists specifically so they never have to.

To audit a period and act on what's found:

1. Call `audit_revenue_vs_deposits` with the requested `period` (YYYY-MM,
   e.g. "2026-09") and `minDiscrepancy` (default $250). Read
   `summary.reconciliationStatus` and `summary.totalVariance` first — if
   status is `RECONCILED`, say so and stop; there's nothing to review. If
   it's `INCOMPLETE_DATA`, check `providerStatus` and tell the user which
   gateway(s) still need connecting.
2. If there's variance, call `get_transaction_anomalies` for the same
   period to get the full list with severities. Summarize each anomaly in
   plain language: what's wrong, the dollar amount, and which records it
   touches (`affectedEntities`) — don't just paste the raw JSON back.
3. For each anomaly the user wants to fix, call `draft_journal_adjustment`
   with that `anomalyId`. Show the resulting dual-entry lines and confirm
   `isBalanced` is true before going further.
4. Only call `approve_journal_adjustment` and then `commit_journal_adjustment`
   after the user explicitly confirms the draft, and never chain straight
   from draft to commit on your own initiative. Tell the user plainly that
   "commit" currently records the entry in LedgerGuard's own ledger and
   audit trail — it does not yet post to a real external QuickBooks,
   NetSuite, or Xero account (that write-back integration isn't built
   yet), so don't imply it already left LedgerGuard.
5. If asked for compliance/audit evidence, call `get_gaap_audit_trail` and
   report `chainVerification.isValid` along with the entry count, not the
   full raw trail unless asked for it.

Notes:
- A period with no underlying data returns zero revenue and zero
  anomalies — that's a correct "nothing here" result, not an error.
- Live gateways today: Stripe, PayStack, Paddle, Braintree (transactions),
  plus Chargebee for recognized revenue. Plaid and Square/PayPal aren't
  connected yet — if the user asks about bank-feed or Square/PayPal data,
  say so rather than implying it's available.
- `trigger_reconciliation_batch` runs the same audit as an overnight batch
  job (with a simulated Slack alert, not a real one) for the given period;
  use it only when the user specifically asks to run the background
  auditor manually.
