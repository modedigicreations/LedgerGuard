#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createLedgerGuardMCPServer } from '../server-mcp.js';
import { runMigrations } from '../db/migrate.js';
import { pool } from '../db/pool.js';

// Stdio mode has no OAuth handshake (Claude Desktop launches this process
// directly, one person per local machine) — there's no Bearer token to
// resolve a userId from the way server-rest.ts does for /mcp. Identity
// here is just "whoever's local machine this is," keyed by an email the
// operator can override; upserted the same way a real magic-link sign-in
// creates a user — a local, deliberate identity, not a server-wide
// default of the kind this whole multi-tenant rework removed.
async function getOrCreateStdioUserId(): Promise<string> {
  const email = (process.env.LEDGERGUARD_STDIO_USER_EMAIL || 'stdio-local@localhost').trim().toLowerCase();
  const { rows } = await pool.query(
    `INSERT INTO users (email) VALUES ($1)
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING id`,
    [email],
  );
  return rows[0].id;
}

async function main() {
  await runMigrations();
  const userId = await getOrCreateStdioUserId();
  const server = createLedgerGuardMCPServer(userId);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr so stdout remains clean for MCP JSON-RPC protocol
  console.error('[LedgerGuard MCP] Server running on stdio for Claude Desktop / CLI');
}

main().catch((error) => {
  console.error('[LedgerGuard MCP] Fatal error in main():', error);
  process.exit(1);
});
