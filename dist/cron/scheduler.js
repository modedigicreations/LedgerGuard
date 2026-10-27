import { reconciler } from '../engine/reconciler.js';
import { auditTrail } from '../engine/audit-trail.js';
class BackgroundReconciliationCron {
    executionHistory = [];
    isRunning = false;
    runOvernightReconciliation(period = '2026-09') {
        const runAt = new Date().toISOString();
        const executionId = `cron_exec_${Date.now()}`;
        // Run reconciliation with default threshold ($250.00)
        const report = reconciler.runAudit({
            period,
            minDiscrepancy: 250.00,
            matchProcessorFees: true,
            actor: 'BACKGROUND_CRON'
        });
        const hasCriticalOrHigh = report.anomalies.some(a => a.severity === 'CRITICAL' || a.severity === 'HIGH');
        const status = hasCriticalOrHigh ? 'ALERT_TRIGGERED' : 'SUCCESS';
        let slackPayload;
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
                            { type: 'mrkdwn', text: `*Recognized Revenue:* $${report.summary.recognizedRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
                            { type: 'mrkdwn', text: `*Stripe Net Deposits:* $${report.summary.stripeNetDeposits.toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
                            { type: 'mrkdwn', text: `*Total Variance:* $${report.summary.totalVariance.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${report.summary.variancePercentage}%)` }
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
            auditTrail.record('BACKGROUND_CRON', 'ANOMALY_FLAGGED', `Automated Slack alert dispatched to #finance-ops-alerts for ${report.anomalies.length} material anomalies.`, { executionId, anomaliesCount: report.anomalies.length, channel: '#finance-ops-alerts' });
        }
        const result = {
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
    getHistory() {
        return this.executionHistory;
    }
}
export const backgroundCron = new BackgroundReconciliationCron();
//# sourceMappingURL=scheduler.js.map