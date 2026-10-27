import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildRestServer } from '../server-rest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const manifestsDir = resolve(__dirname, '../../manifests');

async function generate() {
  mkdirSync(manifestsDir, { recursive: true });

  const app = await buildRestServer();
  await app.ready();

  // 1. Generate openapi.json for ChatGPT Custom GPT Actions
  const openapiObject = app.swagger();
  const openapiPath = resolve(manifestsDir, 'openapi.json');
  writeFileSync(openapiPath, JSON.stringify(openapiObject, null, 2), 'utf-8');
  console.log(`[Manifests] Generated OpenAPI specification at: ${openapiPath}`);

  // 2. Generate ai-plugin.json for ChatGPT Plugin ecosystem
  const pluginManifest = {
    schema_version: 'v1',
    name_for_human: 'LedgerGuard Financial Auditor',
    name_for_model: 'ledgerguard',
    description_for_human: 'Autonomous Cross-Platform Financial Auditor & Reconciliation Engine.',
    description_for_model: 'Audit recognized revenue from billing platforms (Chargebee) against Stripe net deposits and bank feeds (Plaid). Flag any discrepancy over $250 with matching processor fees, inspect transactional anomalies, and draft dual-entry journal adjustments for user approval before syncing with QuickBooks/NetSuite.',
    auth: {
      type: 'none'
    },
    api: {
      type: 'openapi',
      url: 'http://localhost:3333/docs/json'
    },
    logo_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=128&q=80',
    contact_email: 'support@ledgerguard.ai',
    legal_info_url: 'http://localhost:3333/legal'
  };
  const pluginPath = resolve(manifestsDir, 'ai-plugin.json');
  writeFileSync(pluginPath, JSON.stringify(pluginManifest, null, 2), 'utf-8');
  console.log(`[Manifests] Generated ChatGPT Plugin manifest at: ${pluginPath}`);

  // 3. Generate claude-desktop.json configuration snippet
  const projectRoot = resolve(__dirname, '../..');
  const claudeSnippet = {
    mcpServers: {
      ledgerguard: {
        command: "node",
        args: [
          resolve(projectRoot, "dist/bin/run-stdio.js")
        ],
        env: {
          NODE_ENV: "production"
        }
      }
    }
  };
  const claudePath = resolve(manifestsDir, 'claude-desktop.json');
  writeFileSync(claudePath, JSON.stringify(claudeSnippet, null, 2), 'utf-8');
  console.log(`[Manifests] Generated Claude Desktop config snippet at: ${claudePath}`);

  // 4. Generate manifests/README.md guide
  const guideMd = `# LedgerGuard Integration Guide for Claude and ChatGPT

This directory contains integration manifests and configurations for deploying LedgerGuard inside conversational AI clients and standalone environments.

---

## 1. Setup in Claude Desktop (MCP)

LedgerGuard natively supports the Model Context Protocol (MCP) using stdio or SSE.

### Stdio Transport Configuration:
Add the following snippet to your Claude Desktop configuration file:
- **macOS**: \`~/Library/Application Support/Claude/claude_desktop_config.json\`
- **Windows**: \`%APPDATA%\\Claude\\claude_desktop_config.json\`

\`\`\`json
{
  "mcpServers": {
    "ledgerguard": {
      "command": "node",
      "args": [
        "${resolve(projectRoot, 'dist/bin/run-stdio.js')}"
      ]
    }
  }
}
\`\`\`

### Example Query in Claude:
> *"Audit September revenue recognized against Stripe net deposits. Flag any discrepancy over $250 with matching fees."*

Claude will automatically:
1. Call \`audit_revenue_vs_deposits\` with \`period="2026-09"\`, \`minDiscrepancy=250\`, and \`matchProcessorFees=true\`.
2. Inspect the returned read-only variance reports and anomalies.
3. Call \`draft_journal_adjustment\` to prepare balancing dual-entry lines (e.g. for the unrecorded $536.80 Stripe fee on Fintech Hub).
4. Request your confirmation before calling \`commit_journal_adjustment\` to sync with QuickBooks/NetSuite.

---

## 2. Setup in ChatGPT (Custom GPT Actions)

1. Open **ChatGPT** -> **Explore GPTs** -> **Create a GPT**.
2. Go to the **Configure** tab.
3. Under **Actions**, click **Create new action**.
4. In the **Schema** box, paste the contents of [openapi.json](./openapi.json) (or import from \`http://localhost:3333/docs/json\` when running locally with ngrok/tunnel).
5. Instructions prompt recommendation:
\`\`\`text
You are LedgerGuard CFO Assistant. Whenever the user requests financial audits or asks to reconcile revenue, invoke the LedgerGuard API. Inspect variance reports, highlight any discrepancy exceeding $250 with matching processor fees, explain the GAAP impact, and draft dual-entry balancing journal entries for user sign-off before committing.
\`\`\`

---

## 3. Standalone Web Dashboard & Overnight Cron

### Start Web Server:
\`\`\`bash
npm run dev:http
\`\`\`
Visit **http://localhost:3333** to interact with the high-aesthetic financial dashboard, review anomalies, approve journal adjustments, and inspect the cryptographic GAAP audit chain.

### Run Overnight Background Cron:
\`\`\`bash
npm run dev:cron
\`\`\`
Triggers the background auditor daemon, checks month-end discrepancies, and dispatches automated Slack notifications to \`#finance-ops-alerts\`.
`;

  writeFileSync(resolve(manifestsDir, 'README.md'), guideMd, 'utf-8');
  console.log(`[Manifests] Generated integration documentation at: ${resolve(manifestsDir, 'README.md')}`);

  await app.close();
}

generate().catch((err) => {
  console.error('[Manifests] Error generating manifests:', err);
  process.exit(1);
});
