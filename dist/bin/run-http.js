#!/usr/bin/env node
import { buildRestServer } from '../server-rest.js';
import { runMigrations } from '../db/migrate.js';
import { seedDemoData } from '../engine/journal-generator.js';
async function start() {
    await runMigrations();
    // Only in mock mode — seedDemoData() drafts an adjustment for the fixed
    // demo's fee-mismatch anomaly specifically, which has no business
    // showing up in the live site's adjustments list once real providers
    // (or no providers at all) are what's actually being reported.
    if (process.env.LEDGERGUARD_DATA_MODE !== 'live') {
        await seedDemoData();
    }
    const server = await buildRestServer();
    const port = Number(process.env.PORT) || 3333;
    const host = process.env.HOST || '0.0.0.0';
    await server.listen({ port, host });
    console.log(`
========================================================================
🛡️  LEDGERGUARD: Autonomous Cross-Platform Financial Auditor & Engine
========================================================================
• Standalone Web Dashboard : http://localhost:${port}
• OpenAPI / Swagger UI     : http://localhost:${port}/docs
• ChatGPT Plugin Manifest  : http://localhost:${port}/.well-known/ai-plugin.json
• MCP Streamable HTTP      : http://localhost:${port}/mcp
• Data Mode                : ${process.env.LEDGERGUARD_DATA_MODE === 'live' ? 'live (real providers)' : 'mock (fixed Sept 2026 demo scenario)'}
========================================================================
`);
}
start().catch((err) => {
    console.error('[LedgerGuard Server] Error starting HTTP server:', err);
    process.exit(1);
});
//# sourceMappingURL=run-http.js.map