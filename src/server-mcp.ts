import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { reconciler } from './engine/reconciler.js';
import { journalService } from './engine/journal-generator.js';
import { auditTrail } from './engine/audit-trail.js';
import { backgroundCron } from './cron/scheduler.js';

export function createLedgerGuardMCPServer(): Server {
  const server = new Server(
    {
      name: 'ledgerguard-mcp',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      }
    }
  );

  // 1. MCP Tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'audit_revenue_vs_deposits',
          description: 'Audit recognized revenue from billing (Chargebee) against Stripe net deposits, Plaid bank statements, and ERP ledger. Flags any discrepancy over the specified threshold (default $250) with matching processor fees.',
          inputSchema: {
            type: 'object',
            properties: {
              period: {
                type: 'string',
                description: 'The accounting period to audit in YYYY-MM format, e.g. "2026-09"',
                default: '2026-09'
              },
              minDiscrepancy: {
                type: 'number',
                description: 'Minimum dollar discrepancy threshold to flag (e.g. 250 for discrepancies over $250)',
                default: 250.00
              },
              matchProcessorFees: {
                type: 'boolean',
                description: 'Whether to correlate unexplained variances with underlying payment processor (Stripe) fees',
                default: true
              }
            }
          }
        },
        {
          name: 'get_transaction_anomalies',
          description: 'Query specific transaction anomalies and variances (fee mismatches, unrecorded chargebacks, timing float) detected during reconciliation.',
          inputSchema: {
            type: 'object',
            properties: {
              period: {
                type: 'string',
                description: 'Accounting period, e.g. "2026-09"',
                default: '2026-09'
              },
              severity: {
                type: 'string',
                description: 'Filter by anomaly severity',
                enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
              }
            }
          }
        },
        {
          name: 'draft_journal_adjustment',
          description: 'Draft a GAAP-compliant dual-entry balancing journal adjustment for user review and approval before pushing to ERP.',
          inputSchema: {
            type: 'object',
            properties: {
              anomalyId: {
                type: 'string',
                description: 'ID of the anomaly to auto-generate an adjusting entry for (e.g. "anom_fee_mismatch_001", "anom_chargeback_002")'
              },
              memo: {
                type: 'string',
                description: 'Explanation and business rationale for the adjusting entry'
              },
              lines: {
                type: 'array',
                description: 'Optional custom dual-entry lines (Account Code, Debit, Credit)',
                items: {
                  type: 'object',
                  properties: {
                    accountCode: { type: 'string' },
                    accountName: { type: 'string' },
                    debit: { type: 'number' },
                    credit: { type: 'number' },
                    description: { type: 'string' }
                  },
                  required: ['accountCode', 'accountName', 'debit', 'credit']
                }
              }
            }
          }
        },
        {
          name: 'approve_journal_adjustment',
          description: 'Approve a drafted dual-entry journal adjustment. Validates that Debits === Credits before marking approved for ERP sync.',
          inputSchema: {
            type: 'object',
            properties: {
              adjustmentId: {
                type: 'string',
                description: 'The unique ID of the draft adjustment (e.g. "adj_...")'
              },
              approvedBy: {
                type: 'string',
                description: 'Name or title of fractional CFO / finance lead approving the entry',
                default: 'Finance Lead'
              }
            },
            required: ['adjustmentId']
          }
        },
        {
          name: 'commit_journal_adjustment',
          description: 'Commit an approved journal adjustment directly to the connected ERP (QuickBooks Online, NetSuite, or Xero).',
          inputSchema: {
            type: 'object',
            properties: {
              adjustmentId: {
                type: 'string',
                description: 'The unique ID of the approved adjustment'
              },
              targetERP: {
                type: 'string',
                enum: ['QUICKBOOKS', 'NETSUITE', 'XERO'],
                default: 'QUICKBOOKS'
              }
            },
            required: ['adjustmentId']
          }
        },
        {
          name: 'get_gaap_audit_trail',
          description: 'Retrieve the immutable cryptographic audit trail and verify hash-chain integrity for GAAP compliance reporting.',
          inputSchema: {
            type: 'object',
            properties: {
              verifyIntegrity: {
                type: 'boolean',
                description: 'Whether to perform full SHA-256 hash-chain validation across all entries',
                default: true
              }
            }
          }
        },
        {
          name: 'trigger_reconciliation_batch',
          description: 'Manually trigger an overnight background reconciliation batch run, generating variance alerts and mock Slack notifications.',
          inputSchema: {
            type: 'object',
            properties: {
              period: {
                type: 'string',
                default: '2026-09'
              }
            }
          }
        }
      ]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === 'audit_revenue_vs_deposits') {
        const period = (args?.period as string) || '2026-09';
        const minDiscrepancy = typeof args?.minDiscrepancy === 'number' ? args.minDiscrepancy : 250.00;
        const matchProcessorFees = args?.matchProcessorFees !== false;

        const report = reconciler.runAudit({
          period,
          minDiscrepancy,
          matchProcessorFees,
          actor: 'AI_AGENT_CLAUDE'
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(report, null, 2)
            }
          ]
        };
      }

      if (name === 'get_transaction_anomalies') {
        const period = (args?.period as string) || '2026-09';
        const severity = args?.severity as string | undefined;

        const report = reconciler.runAudit({
          period,
          minDiscrepancy: 0.00, // get all
          matchProcessorFees: true,
          actor: 'AI_AGENT_CLAUDE'
        });

        let anomalies = report.anomalies;
        if (severity) {
          anomalies = anomalies.filter(a => a.severity === severity);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                period,
                totalAnomalies: anomalies.length,
                anomalies
              }, null, 2)
            }
          ]
        };
      }

      if (name === 'draft_journal_adjustment') {
        const anomalyId = args?.anomalyId as string | undefined;
        let adjustment;

        if (anomalyId) {
          adjustment = journalService.createDraftFromAnomaly(anomalyId, 'AI_AGENT_CLAUDE');
        } else {
          adjustment = journalService.draftAdjustment({
            reference: 'ADJ-MANUAL',
            memo: (args?.memo as string) || 'Manual adjusting entry',
            date: '2026-09-30',
            lines: (args?.lines as any) || []
          }, 'AI_AGENT_CLAUDE');
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(adjustment, null, 2)
            }
          ]
        };
      }

      if (name === 'approve_journal_adjustment') {
        const adjustmentId = args?.adjustmentId as string;
        const approvedBy = (args?.approvedBy as string) || 'Finance Lead';
        const result = journalService.approveAdjustment(adjustmentId, approvedBy);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      if (name === 'commit_journal_adjustment') {
        const adjustmentId = args?.adjustmentId as string;
        const targetERP = (args?.targetERP as any) || 'QUICKBOOKS';
        const result = journalService.commitToERP(adjustmentId, targetERP);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      if (name === 'get_gaap_audit_trail') {
        const verify = args?.verifyIntegrity !== false;
        const trail = auditTrail.getTrail();
        const verification = verify ? auditTrail.verifyIntegrity() : null;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                totalEntries: trail.length,
                chainVerification: verification,
                trail
              }, null, 2)
            }
          ]
        };
      }

      if (name === 'trigger_reconciliation_batch') {
        const period = (args?.period as string) || '2026-09';
        const result = backgroundCron.runOvernightReconciliation(period);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      throw new Error(`Unknown tool: ${name}`);
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error executing ${name}: ${err?.message || String(err)}`
          }
        ]
      };
    }
  });

  // 2. MCP Resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: 'ledgerguard://reports/variance-latest',
          name: 'Latest Variance & Reconciliation Report',
          mimeType: 'application/json',
          description: 'Live read-only variance report showing recognized revenue vs Stripe net deposits and Plaid bank statement.'
        },
        {
          uri: 'ledgerguard://reports/gaap-audit-trail',
          name: 'GAAP Immutable Audit Trail',
          mimeType: 'application/json',
          description: 'Cryptographically linked compliance audit trail for external auditors and CFO review.'
        },
        {
          uri: 'ledgerguard://rules/reconciliation-policy',
          name: 'Accounting Policy & Materiality Guidelines',
          mimeType: 'text/markdown',
          description: 'Standard materiality threshold rules ($250), ASC 606 revenue recognition criteria, and standard chart of accounts.'
        }
      ]
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    if (uri === 'ledgerguard://reports/variance-latest') {
      const report = reconciler.runAudit({ period: '2026-09', minDiscrepancy: 250.00 });
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(report, null, 2)
          }
        ]
      };
    }

    if (uri === 'ledgerguard://reports/gaap-audit-trail') {
      const trail = auditTrail.getTrail();
      const verification = auditTrail.verifyIntegrity();
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ integrity: verification, trail }, null, 2)
          }
        ]
      };
    }

    if (uri === 'ledgerguard://rules/reconciliation-policy') {
      const policyMd = `# LedgerGuard Accounting Policy & Governance Rules

## 1. Materiality Threshold
- Standard Variance Tolerance: $250.00 USD.
- Any discrepancy equal to or exceeding $250.00 USD MUST be flagged as MATERIAL_DRIFT or VARIANCE_DETECTED.
- Discrepancies under $250.00 USD may be grouped into micro-fee / foreign exchange tolerance pools.

## 2. GAAP ASC 606 Revenue Recognition
- Revenue is recognized when service obligations are satisfied (Chargebee invoice schedules).
- Payment processing fees (Stripe 2.9% + $0.30 or negotiated interchange) MUST NOT be netted against gross revenue.
- Gross revenue must be credited to 4010 (SaaS Subscription Revenue); processing fees must be debited to 6030 (Payment Processing Fees).

## 3. Dual-Entry Balancing Requirement
- All proposed adjusting journal entries must strictly satisfy: \`SUM(Debits) === SUM(Credits)\`.
- No one-sided adjustments are permitted.

## 4. Standard Chart of Accounts Mapping
- \`1010\` — Cash Operating (Chase 4091) [Asset]
- \`1200\` — Undeposited Funds / Stripe Clearing [Asset]
- \`1250\` — Allowance for Disputed Accounts & Chargebacks [Contra-Asset]
- \`4010\` — SaaS Subscription Revenue [Revenue]
- \`6030\` — Payment Processing Fees [Operating Expense]
- \`6035\` — Merchant Dispute & Regulatory Surcharges [Operating Expense]
- \`6040\` — Bank & Foreign Currency Conversion Expense [Operating Expense]
`;

      return {
        contents: [
          {
            uri,
            mimeType: 'text/markdown',
            text: policyMd
          }
        ]
      };
    }

    throw new Error(`Resource not found: ${uri}`);
  });

  // 3. MCP Prompts
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        {
          name: 'audit_month_end',
          description: 'Step-by-step month-end audit of recognized revenue vs Stripe net deposits and bank feeds.',
          arguments: [
            {
              name: 'period',
              description: 'Target month in YYYY-MM format (e.g. 2026-09)',
              required: true
            },
            {
              name: 'threshold',
              description: 'Materiality threshold in dollars (default: 250)',
              required: false
            }
          ]
        }
      ]
    };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (name === 'audit_month_end') {
      const period = args?.period || '2026-09';
      const threshold = args?.threshold || '250';

      return {
        description: `Month-End Financial Audit for ${period}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Audit ${period} revenue recognized against Stripe net deposits. Flag any discrepancy over $${threshold} with matching fees. Review variance reports, query specific transactional anomalies, and draft dual-entry journal adjustments for my approval.`
            }
          }
        ]
      };
    }

    throw new Error(`Prompt not found: ${name}`);
  });

  return server;
}
