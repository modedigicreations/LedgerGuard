#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createLedgerGuardMCPServer } from '../server-mcp.js';

async function main() {
  const server = createLedgerGuardMCPServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr so stdout remains clean for MCP JSON-RPC protocol
  console.error('[LedgerGuard MCP] Server running on stdio for Claude Desktop / CLI');
}

main().catch((error) => {
  console.error('[LedgerGuard MCP] Fatal error in main():', error);
  process.exit(1);
});
