import { reconciler } from '../src/engine/reconciler.js';
import { journalService } from '../src/engine/journal-generator.js';
import { auditTrail } from '../src/engine/audit-trail.js';
import { backgroundCron } from '../src/cron/scheduler.js';
import { runMigrations } from '../src/db/migrate.js';
import { pool } from '../src/db/pool.js';

async function runTests() {
  console.log('🧪 Starting LedgerGuard Verification Test Suite...\n');

  await runMigrations();

  // Test 1: Run September Audit with $250 Materiality Threshold
  console.log('Test 1: Audit September Revenue vs Stripe Net Deposits (Threshold > $250)');
  const report = await reconciler.runAudit({
    period: '2026-09',
    minDiscrepancy: 250.00,
    matchProcessorFees: true,
    actor: 'AI_AGENT_CLAUDE'
  });

  console.log(`  ✓ Recognized Revenue: $${report.summary.recognizedRevenue.toLocaleString()}`);
  console.log(`  ✓ Stripe Net Deposits: $${report.summary.stripeNetDeposits.toLocaleString()}`);
  console.log(`  ✓ Total Variance: $${report.summary.totalVariance.toLocaleString()}`);
  console.log(`  ✓ Reconciliation Status: ${report.summary.reconciliationStatus}`);
  console.log(`  ✓ Flagged Material Anomalies: ${report.anomalies.length}`);

  if (report.anomalies.length < 2) {
    throw new Error(`Expected at least 2 material anomalies, got ${report.anomalies.length}`);
  }

  // Test 2: Verify Fee Matching Logic
  console.log('\nTest 2: Verifying Stripe Fee Matching');
  const feeAnomaly = report.anomalies.find(a => a.type === 'FEE_MISMATCH');
  if (!feeAnomaly) {
    throw new Error('Expected FEE_MISMATCH anomaly for Fintech Hub omitted fee');
  }
  console.log(`  ✓ Found Fee Mismatch: "${feeAnomaly.title}"`);
  console.log(`  ✓ Discrepancy Amount: $${feeAnomaly.discrepancyAmount.toFixed(2)}`);
  console.log(`  ✓ Matched Processor Fee: $${feeAnomaly.matchedProcessorFee?.toFixed(2)}`);
  if (Math.abs((feeAnomaly.matchedProcessorFee || 0) - 536.80) > 0.01) {
    throw new Error(`Expected matched fee of 536.80, got ${feeAnomaly.matchedProcessorFee}`);
  }

  // Test 3: Verify Threshold Excludes Minor (< $250) Discrepancies
  console.log('\nTest 3: Threshold Filtering Excludes Sub-$250 Minor Discrepancy');
  const minorInDefault = report.anomalies.find(a => a.id === 'anom_minor_fx_004');
  if (minorInDefault) {
    throw new Error('Minor $42.10 FX anomaly should be filtered out by $250 threshold');
  }
  console.log('  ✓ Minor $42.10 FX anomaly was properly filtered out.');

  // Test 4: GAAP Dual-Entry Balancing Journal Adjustment
  console.log('\nTest 4: GAAP Dual-Entry Balancing Journal Generation');
  const draftAdj = await journalService.createDraftFromAnomaly('anom_fee_mismatch_001', 'AI_AGENT_CLAUDE');
  console.log(`  ✓ Draft Adjustment Created: ${draftAdj.adjustmentNumber}`);
  console.log(`  ✓ Total Debits: $${draftAdj.totalDebit.toFixed(2)}, Total Credits: $${draftAdj.totalCredit.toFixed(2)}`);
  console.log(`  ✓ Is Balanced: ${draftAdj.isBalanced}`);
  if (!draftAdj.isBalanced || draftAdj.totalDebit !== draftAdj.totalCredit) {
    throw new Error('Journal entry must balance Debits === Credits exactly');
  }

  // Test 5: Approval Workflow and ERP Sync
  console.log('\nTest 5: User Approval & QuickBooks Sync Workflow');
  const approvalRes = await journalService.approveAdjustment(draftAdj.id, 'Fractional CFO');
  if (!approvalRes.success || approvalRes.adjustment?.status !== 'APPROVED') {
    throw new Error('Approval workflow failed');
  }
  console.log(`  ✓ Adjustment approved by: ${approvalRes.adjustment.approvedBy}`);

  const commitRes = await journalService.commitToERP(draftAdj.id, 'QUICKBOOKS');
  if (!commitRes.success || commitRes.adjustment?.status !== 'POSTED') {
    throw new Error('ERP sync commit failed');
  }
  console.log(`  ✓ Committed to QuickBooks Online: ${commitRes.erpPostedId}`);

  // Test 6: Cryptographic Audit Trail Verification
  console.log('\nTest 6: GAAP Cryptographic Audit Trail Integrity');
  const integrity = await auditTrail.verifyIntegrity();
  console.log(`  ✓ Chain Valid: ${integrity.isValid}`);
  console.log(`  ✓ Audited Entries: ${integrity.checkedEntries}`);
  if (!integrity.isValid) {
    throw new Error(`Audit trail verification failed: ${integrity.error}`);
  }

  // Test 7: Background Cron & Slack Alert Dispatching
  console.log('\nTest 7: Overnight Background Cron & Slack Notification Dispatch');
  const cronRes = await backgroundCron.runOvernightReconciliation('2026-09');
  console.log(`  ✓ Cron Status: ${cronRes.status}`);
  console.log(`  ✓ Slack Alert Dispatched: ${cronRes.slackAlertDispatched}`);
  if (!cronRes.slackAlertDispatched) {
    throw new Error('Expected Slack alert to be dispatched for material drift');
  }
  console.log(`  ✓ Target Slack Channel: ${cronRes.slackPayload?.channel}`);

  // Test 8: Post-Sync Re-Audit Confirms Batch 2 Fee Anomaly is Resolved
  console.log('\nTest 8: Post-Sync Re-Audit Confirms Batch 2 Fee Anomaly Resolved');
  const postReport = await reconciler.runAudit({ period: '2026-09', minDiscrepancy: 250.00 });
  const stillHasFeeAnom = postReport.anomalies.some(a => a.id === 'anom_fee_mismatch_001');
  if (stillHasFeeAnom) {
    throw new Error('Committed journal entry should have resolved anom_fee_mismatch_001');
  }
  console.log('  ✓ Batch 2 fee discrepancy was eliminated after posting adjusting entry to QuickBooks.');

  console.log('\n🎉 ALL 8 TESTS PASSED SUCCESSFULLY! LedgerGuard workflow is verified.\n');
}

// A one-shot script, not a long-running server — close the pool so the pg
// Pool's open connection doesn't keep the process alive after we're done.
runTests()
  .catch((err) => {
    console.error('\n❌ Test failure:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
