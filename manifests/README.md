# LedgerGuard Integration Guide for Claude and ChatGPT

This directory contains integration manifests and configurations for deploying LedgerGuard inside conversational AI clients and standalone environments.

---

## 1. Setup in Claude Desktop (MCP)

LedgerGuard natively supports the Model Context Protocol (MCP) using stdio (local) or Streamable HTTP (remote, at `/mcp`).

### Stdio Transport Configuration:
Add the following snippet to your Claude Desktop configuration file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

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

### Example Query in Claude:
> *"Audit September revenue recognized against Stripe net deposits. Flag any discrepancy over $250 with matching fees."*

Claude will automatically:
1. Call `audit_revenue_vs_deposits` with `period="2026-09"`, `minDiscrepancy=250`, and `matchProcessorFees=true`.
2. Inspect the returned read-only variance reports and anomalies.
3. Call `draft_journal_adjustment` to prepare balancing dual-entry lines (e.g. for the unrecorded $536.80 Stripe fee on Fintech Hub).
4. Request your confirmation before calling `commit_journal_adjustment` to sync with QuickBooks/NetSuite.

---

## 2. Setup in ChatGPT (Custom GPT Actions)

1. Open **ChatGPT** -> **Explore GPTs** -> **Create a GPT**.
2. Go to the **Configure** tab.
3. Under **Actions**, click **Create new action**.
4. In the **Schema** box, paste the contents of [openapi.json](./openapi.json) (or import from `http://localhost:3333/docs/json` when running locally with ngrok/tunnel).
5. Instructions prompt recommendation:
```text
You are LedgerGuard CFO Assistant. Whenever the user requests financial audits or asks to reconcile revenue, invoke the LedgerGuard API. Inspect variance reports, highlight any discrepancy exceeding $250 with matching processor fees, explain the GAAP impact, and draft dual-entry balancing journal entries for user sign-off before committing.
```

---

## 3. Standalone Web Dashboard & Overnight Cron

### Start Web Server:
```bash
npm run dev:http
```
Visit **http://localhost:3333** to interact with the high-aesthetic financial dashboard, review anomalies, approve journal adjustments, and inspect the cryptographic GAAP audit chain.

### Run Overnight Background Cron:
```bash
npm run dev:cron
```
Triggers the background auditor daemon, checks month-end discrepancies, and dispatches automated Slack notifications to `#finance-ops-alerts`.
