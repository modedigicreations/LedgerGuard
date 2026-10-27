# 🛡️ LedgerGuard: Autonomous Cross-Platform Financial Auditor & Reconciliation Engine

> **Refined from:** *Financial Auditor & Schema Governance*  
> **Target Audience:** Fractional CFOs, Bookkeepers, Tech Founders & Finance Leads.  
> **Dual Form-Factor:** Native **Claude & ChatGPT Plugin** (MCP & OpenAPI Action) + **Standalone Web Dashboard & Background Daemon**.

---

## 📌 Executive Summary & Core Value Proposition

Finance teams spend days manually cross-referencing **Stripe/Adyen**, billing platforms (**Chargebee**), bank feeds (**Plaid**), and ERP general ledgers (**QuickBooks, NetSuite, Xero**). Existing accounting software flags errors only *after* bad ledger entries have already settled into books.

**LedgerGuard** solves this by operating continuously across two key interfaces:
1. **Conversational AI Plugin (Claude & ChatGPT)**:
   - Responds to conversational prompts like:  
     *"Audit September revenue recognized against Stripe net deposits. Flag any discrepancy over $250 with matching fees."*
   - Uses **MCP Resources** to stream read-only variance reports.
   - Queries specific transactional anomalies.
   - Automatically drafts balancing **GAAP dual-entry journal adjustments** (Debits = Credits) for user approval before pushing directly to ERP.
2. **Standalone Headless Auditor & Web Dashboard**:
   - Automated **overnight background cron engine** monitoring month-end drift.
   - **Modern Web Dashboard** with real-time KPI cards, waterfall variance breakdowns, and 1-click journal approvals.
   - **Cryptographic GAAP Audit Chain** with SHA-256 hash validation for external auditors.
   - Automated **Slack alerts** dispatched to `#finance-ops-alerts` when material drift is detected.

---

## 🏛️ System Architecture

```
                       ┌────────────────────────────────────────────────────────┐
                       │            LedgerGuard Orchestrator                    │
                       └───────────────────┬────────────────────────────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         ▼                                 ▼                                 ▼
┌──────────────────┐             ┌──────────────────┐             ┌──────────────────┐
│  Claude Desktop  │             │     ChatGPT      │             │  Standalone Web  │
│  & Claude Code   │             │ Custom GPT Action│             │    & Background  │
│ (MCP over stdio) │             │  (OpenAPI 3.1)   │             │   (Dashboard/API)│
└────────┬─────────┘             └────────┬─────────┘             └────────┬─────────┘
         │                                │                                │
         └────────────────────────────────┼────────────────────────────────┘
                                          │
                                          ▼
                   ┌──────────────────────────────────────────────┐
                   │        Core Multi-Way Reconciliation         │
                   │               & Auditing Engine              │
                   └──────┬───────────────┬───────────────┬───────┘
                          │               │               │
       ┌──────────────────┴──┐     ┌──────┴──────┐  ┌─────┴─────────────────┐
       │ Multi-Source Feeds  │     │ Anomaly &   │  │ Dual-Entry Generator  │
       │ - Stripe / Adyen    │     │ Fee Matcher │  │ - Debits = Credits    │
       │ - Chargebee Billing │     │ - Threshold │  │ - GAAP ASC-606        │
       │ - Plaid Bank Feeds  │     │   (> $250)  │  │ - User Sign-Off       │
       │ - QuickBooks Ledger │     │ - Drift ID  │  │ - Direct ERP Push     │
       └─────────────────────┘     └─────────────┘  └───────────────────────┘
```

---

## 🚀 Quick Start

### 1. Installation & Build

```bash
cd /Users/modewebhostdailymedia/mode-ops/ledgerguard
npm install
npm run build
npm test
```

### 2. Run the Standalone Web Dashboard & REST Server

```bash
npm run dev:http
# Or after build:
npm run start:http
```
Visit **[http://localhost:3333](http://localhost:3333)** to open the financial dashboard.  
Visit **[http://localhost:3333/docs](http://localhost:3333/docs)** for interactive OpenAPI / Swagger UI.

### 3. Run the Overnight Background Auditor Cron

```bash
npm run dev:cron
# Or for a specific period:
node dist/bin/run-cron.js 2026-09
```

---

## 🤖 Living Inside Claude (MCP Server)

LedgerGuard implements the official **Model Context Protocol (MCP)** specification.

### 1. Claude Desktop Configuration
Add this to your `claude_desktop_config.json`:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ledgerguard": {
      "command": "node",
      "args": [
        "/Users/modewebhostdailymedia/mode-ops/ledgerguard/dist/bin/run-stdio.js"
      ]
    }
  }
}
```

### 2. Available MCP Tools
- `audit_revenue_vs_deposits`: Audits recognized revenue against Stripe net deposits with threshold & fee matching.
- `get_transaction_anomalies`: Queries specific anomalies (unrecorded chargebacks, fee mismatches, timing differences).
- `draft_journal_adjustment`: Automatically builds balancing GAAP dual-entry adjustments.
- `approve_journal_adjustment`: User approval gate prior to posting.
- `commit_journal_adjustment`: Directly commits approved entry to connected ERP.
- `get_gaap_audit_trail`: Fetches immutable cryptographically chained audit log.
- `trigger_reconciliation_batch`: Dispatches overnight background audit and simulated Slack alerts.

### 3. Available MCP Resources
- `ledgerguard://reports/variance-latest`: Read-only JSON stream of live variance report.
- `ledgerguard://reports/gaap-audit-trail`: Immutable audit chain log.
- `ledgerguard://rules/reconciliation-policy`: ASC-606 revenue recognition & materiality threshold ($250).

---

## 🧠 Living Inside ChatGPT (Custom GPT Action & Plugin)

1. Navigate to **ChatGPT** -> **Explore GPTs** -> **Create**.
2. Under **Actions**, select **Create new action**.
3. Copy and paste the pre-built specification from:  
   `manifests/openapi.json`
4. Set the Base URL to your LedgerGuard instance (or public tunnel like Cloudflare / ngrok).
5. Paste the recommended instructions:
```text
You are LedgerGuard, an autonomous financial auditor and reconciliation engine. When the user requests a financial audit, query the LedgerGuard endpoints. Flag any discrepancy over $250 with matching payment processor fees, explain the underlying root cause, and draft balancing dual-entry journal adjustments for user sign-off before committing to ERP.
```

---

## 🧪 Verified September 2026 Audit Scenario

In the included sample dataset matching the spec:
1. **Billing Recognized Revenue**: `$125,000.00` across 7 Chargebee customer invoices.
2. **Stripe Net Deposits Settled**: `$116,392.25` across settled payout batches.
3. **Plaid Bank Statement**: `$116,392.25` settled in operating account.
4. **Flagged Material Anomalies (> $250 threshold)**:
   - **Anomaly 1 (`FEE_MISMATCH`)**: Unrecorded `$536.80` Stripe processing fee on Fintech Hub (`cb_inv_sep_003`). Cash was overstated in QuickBooks by `$536.80`.
   - **Anomaly 2 (`UNRECORDED_CHARGEBACK`)**: `$1,200.00` dispute clawback + `$15.00` dispute fee (`$1,215.00` total) for Veloce Logistics missing from ledger.
   - **Anomaly 3 (`TIMING_DIFFERENCE`)**: `$4,223.55` month-end payout initiated Sept 30 that settled in bank on Oct 2 (float).
5. **GAAP Dual-Entry Balancing Adjustment**:
   - `Dr. 6030 Payment Processing Fees`: `$536.80`
   - `Cr. 1010 Cash — Operating`: `$536.80`
   - **Balanced**: Total Debits (`$536.80`) == Total Credits (`$536.80`).

---

## 📦 Directory Structure

```
ledgerguard/
├── package.json
├── tsconfig.json
├── README.md
├── manifests/
│   ├── ai-plugin.json          # ChatGPT Plugin manifest
│   ├── openapi.json            # OpenAPI 3.1 schema for Custom GPT Actions
│   ├── claude-desktop.json     # Claude Desktop MCP configuration snippet
│   └── README.md               # Step-by-step setup guide
├── src/
│   ├── index.ts                # Package exports
│   ├── types/index.ts          # Core domain models (Stripe, Plaid, ERP, Journals)
│   ├── data/mock-data.ts       # Realistic multi-platform dataset for Sept 2026
│   ├── engine/
│   │   ├── reconciler.ts       # 4-way matching, variance & fee correlation engine
│   │   ├── journal-generator.ts# GAAP dual-entry balancing adjuster
│   │   └── audit-trail.ts      # SHA-256 cryptographic compliance log
│   ├── cron/scheduler.ts       # Overnight background daemon & Slack dispatcher
│   ├── server-mcp.ts           # MCP Server (Tools, Resources, Prompts)
│   ├── server-rest.ts          # Fastify HTTP server (OpenAPI, SSE transport)
│   ├── dashboard/html.ts       # Standalone modern web dashboard UI
│   ├── bin/
│   │   ├── run-stdio.ts        # Claude Desktop stdio runner
│   │   ├── run-http.ts         # Standalone HTTP & dashboard runner
│   │   └── run-cron.ts         # Background daemon runner
│   └── scripts/
│       └── generate-manifests.ts # Automated manifest generator
└── tests/
    └── test-reconciler.ts      # End-to-end test suite
```
