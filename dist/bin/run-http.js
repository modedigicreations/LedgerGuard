#!/usr/bin/env node
import { buildRestServer } from '../server-rest.js';
import { runMigrations } from '../db/migrate.js';
import { seedDemoData } from '../engine/journal-generator.js';
async function start() {
    await runMigrations();
    await seedDemoData();
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
• Audit Scenario           : September 2026 ($250 threshold & fee matching)
========================================================================
`);
}
start().catch((err) => {
    console.error('[LedgerGuard Server] Error starting HTTP server:', err);
    process.exit(1);
});
//# sourceMappingURL=run-http.js.map