import { reconciler } from '../engine/reconciler.js';
import { auditTrail } from '../engine/audit-trail.js';
import { VarianceReport } from '../types/index.js';

function fmtUsd(value: number | null): string {
  return value === null ? 'N/A (provider not connected)' : `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export interface CronExecutionResult {
  executionId: string;
  runAt: string;
  periodAudited: string;
  status: 'SUCCESS' | 'ALERT_TRIGGERED' | 'FAILED';
  reportSummary: VarianceReport['summary'];
  slackAlertDispatched: boolean;
  slackPayload?: {
    channel: string;
    text: string;
    blocks: Array<Record<string, unknown>>;
  };
}

class BackgroundReconciliationCron {
  private executionHistory: CronExecutionResult[] = [];
  private isRunning: boolean = false;

  public async runOvernightReconciliation(period: string = '2026-09'): Promise<CronExecutionResult> {
    const runAt = new Date().toISOString();
    const executionId = `cron_exec_${Date.now()}`;

    // Run reconciliation with default threshold ($250.00)
    const report = await reconciler.runAudit({
      period,
      minDiscrepancy: 250.00,
      matchProcessorFees: true,
      actor: 'BACKGROUND_CRON'
    });

    const hasCriticalOrHigh = report.anomalies.some(a => a.severity === 'CRITICAL' || a.severity === 'HIGH');
    const status: CronExecutionResult['status'] = hasCriticalOrHigh ? 'ALERT_TRIGGERED' : 'SUCCESS';

    let slackPayload: CronExecutionResult['slackPayload'];
    let slackAlertDispatched = false;

    if (hasCriticalOrHigh) {
      slackAlertDispatched = true;
      slackPayload = {
        channel: '#finance-ops-alerts',
        text: `⚠️ *LedgerGuard Alert: Material Financial Drift Detected in ${period} Reconciliation*`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `🚨 LedgerGuard Overnight Auditor: ${report.summary.reconciliationStatus}`
            }
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Period:* ${period}` },
              { type: 'mrkdwn', text: `*Recognized Revenue:* ${fmtUsd(report.summary.recognizedRevenue)}` },
              { type: 'mrkdwn', text: `*Stripe Net Deposits:* ${fmtUsd(report.summary.stripeNetDeposits)}` },
              { type: 'mrkdwn', text: `*Total Variance:* ${fmtUsd(report.summary.totalVariance)} (${report.summary.variancePercentage ?? 'N/A'}%)` }
            ]
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Material Discrepancies (> $250):* Found *${report.anomalies.length}* anomalies requiring review:\n` +
                report.anomalies.map(a => `• *[${a.severity}] ${a.title}*: $${a.discrepancyAmount.toFixed(2)} (${a.suggestedAction})`).join('\n')
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Open LedgerGuard Dashboard' },
                style: 'primary',
                url: 'http://localhost:3333'
              }
            ]
          }
        ]
      };

      await auditTrail.record(
        'BACKGROUND_CRON',
        'ANOMALY_FLAGGED',
        `Automated Slack alert dispatched to #finance-ops-alerts for ${report.anomalies.length} material anomalies.`,
        { executionId, anomaliesCount: report.anomalies.length, channel: '#finance-ops-alerts' }
      );
    }

    const result: CronExecutionResult = {
      executionId,
      runAt,
      periodAudited: period,
      status,
      reportSummary: report.summary,
      slackAlertDispatched,
      slackPayload
    };

    this.executionHistory.unshift(result);
    return result;
  }

  public getHistory(): CronExecutionResult[] {
    return this.executionHistory;
  }
}

export const backgroundCron = new BackgroundReconciliationCron();
