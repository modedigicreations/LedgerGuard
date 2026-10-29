#!/usr/bin/env node
import { backgroundCron } from '../cron/scheduler.js';
import { runMigrations } from '../db/migrate.js';
import { pool } from '../db/pool.js';

async function runDaemon() {
  await runMigrations();
  const period = process.argv[2] || '2026-09';
  console.log(`[LedgerGuard Cron] Starting overnight financial audit batch for ${period}...`);

  const result = await backgroundCron.runOvernightReconciliation(period);
  console.log(`[LedgerGuard Cron] Completed with status: ${result.status}`);
  console.log(`[LedgerGuard Cron] Material Drift: ${result.reportSummary.reconciliationStatus}`);
  const variance = result.reportSummary.totalVariance;
  console.log(`[LedgerGuard Cron] Total Variance: ${variance === null ? 'N/A (provider not connected)' : `$${variance.toFixed(2)} (${result.reportSummary.variancePercentage}%)`}`);

  if (result.slackAlertDispatched) {
    console.log(`[LedgerGuard Cron] 🚨 Automated Slack alert dispatched to ${result.slackPayload?.channel}`);
    console.log(result.slackPayload?.text);
  }
}

// A one-shot CLI, not a long-running server — close the pool so the pg
// Pool's open connection doesn't keep the process alive after we're done.
runDaemon()
  .catch((err) => {
    console.error('[LedgerGuard Cron] Error during cron execution:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
