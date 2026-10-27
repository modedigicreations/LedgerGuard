#!/usr/bin/env node
import { backgroundCron } from '../cron/scheduler.js';

async function runDaemon() {
  const period = process.argv[2] || '2026-09';
  console.log(`[LedgerGuard Cron] Starting overnight financial audit batch for ${period}...`);
  
  const result = backgroundCron.runOvernightReconciliation(period);
  console.log(`[LedgerGuard Cron] Completed with status: ${result.status}`);
  console.log(`[LedgerGuard Cron] Material Drift: ${result.reportSummary.reconciliationStatus}`);
  console.log(`[LedgerGuard Cron] Total Variance: $${result.reportSummary.totalVariance.toFixed(2)} (${result.reportSummary.variancePercentage}%)`);

  if (result.slackAlertDispatched) {
    console.log(`[LedgerGuard Cron] 🚨 Automated Slack alert dispatched to ${result.slackPayload?.channel}`);
    console.log(result.slackPayload?.text);
  }
}

runDaemon().catch((err) => {
  console.error('[LedgerGuard Cron] Error during cron execution:', err);
  process.exit(1);
});
