---
name: audit-month-end
description: Audit recognized revenue against Stripe net deposits, Plaid bank feeds, and the ERP ledger for an accounting period. Use when the user asks to audit or reconcile revenue, investigate a cash/deposit discrepancy, review flagged financial anomalies or chargebacks, or wants to draft, approve, or post a journal adjustment.
---

To audit a period and act on what's found:

1. Call `audit_revenue_vs_deposits` with the requested `period` (YYYY-MM,
   e.g. "2026-09") and `minDiscrepancy` (default $250). Read
   `summary.reconciliationStatus` and `summary.totalVariance` first — if
   status is `RECONCILED`, say so and stop; there's nothing to review.
2. If there's variance, call `get_transaction_anomalies` for the same
   period to get the full list with severities. Summarize each anomaly in
   plain language: what's wrong, the dollar amount, and which records it
   touches (`affectedEntities`) — don't just paste the raw JSON back.
3. For each anomaly the user wants to fix, call `draft_journal_adjustment`
   with that `anomalyId`. Show the resulting dual-entry lines and confirm
   `isBalanced` is true before going further.
4. Only call `approve_journal_adjustment` and then `commit_journal_adjustment`
   after the user explicitly confirms the draft — these post directly to
   the connected ERP (QuickBooks, NetSuite, or Xero) and aren't reversible
   through this tool. Never chain straight from draft to commit on your
   own initiative.
5. If asked for compliance/audit evidence, call `get_gaap_audit_trail` and
   report `chainVerification.isValid` along with the entry count, not the
   full raw trail unless asked for it.

Notes:
- A period with no underlying data returns zero revenue and zero
  anomalies — that's a correct "nothing here" result, not an error.
- `trigger_reconciliation_batch` simulates the overnight cron run
  (including a mock Slack alert) for the given period; use it only when
  the user specifically asks to run the background auditor manually.
