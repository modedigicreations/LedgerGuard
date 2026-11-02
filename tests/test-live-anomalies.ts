// Exercises the real cross-provider anomaly detector (detectLiveAnomalies)
// directly against constructed Chargebee/Stripe data — this is the logic
// that replaces the fixed September-2026 mock-only checks for any actual
// connected account, so it needs to be proven correct independent of the
// mock fixtures.
import { detectLiveAnomalies } from '../src/engine/reconciler.js';
import { ChargebeeInvoice, GatewayTransaction, GatewayPayout, ProviderResult } from '../src/types/index.js';

function connected<T>(data: T[]): ProviderResult<T> {
  return { status: 'CONNECTED', data };
}

function invoice(overrides: Partial<ChargebeeInvoice> & Pick<ChargebeeInvoice, 'id' | 'totalRecognizedRevenue'>): ChargebeeInvoice {
  return {
    date: '2026-09-15',
    periodStart: '2026-09-15',
    periodEnd: '2026-09-15',
    customerId: 'cus_1',
    customerName: 'cus_1',
    subtotal: overrides.totalRecognizedRevenue,
    tax: 0,
    paymentStatus: 'paid',
    ...overrides,
  };
}

function tx(overrides: Partial<GatewayTransaction> & Pick<GatewayTransaction, 'id' | 'amountGross'>): GatewayTransaction {
  return {
    created: '2026-09-15T10:00:00.000Z',
    amountFee: 0,
    amountNet: overrides.amountGross,
    currency: 'USD',
    type: 'charge',
    status: 'succeeded',
    customerId: 'cus_1',
    customerName: '',
    description: '',
    ...overrides,
  };
}

function payout(overrides: Partial<GatewayPayout> & Pick<GatewayPayout, 'id' | 'amount'>): GatewayPayout {
  return {
    created: '2026-09-30T20:00:00.000Z',
    arrivalDate: '2026-09-30',
    currency: 'USD',
    status: 'paid',
    destinationBankLast4: '1234',
    chargeCount: 1,
    totalGross: overrides.amount,
    totalFees: 0,
    ...overrides,
  };
}

function runTests() {
  console.log('🧪 Starting Live Anomaly Detection Test Suite...\n');

  // Test 1: nothing is detected when Chargebee or Stripe isn't connected
  // — there's nothing honest to cross-reference.
  console.log("Test 1: Returns empty when either side isn't CONNECTED");
  const notConnected: ProviderResult<ChargebeeInvoice> = { status: 'NOT_CONFIGURED', data: [] };
  const result1 = detectLiveAnomalies(notConnected, connected([]), connected([]), '2026-09');
  if (result1.length !== 0) throw new Error(`Expected 0 anomalies when Chargebee isn't connected, got ${result1.length}`);
  console.log('  ✓ Correctly returns nothing rather than fabricating a comparison with no real data.');

  // Test 2: matched invoice + charge with matching amounts produces no
  // FEE_MISMATCH anomaly.
  console.log('\nTest 2: Matched invoice and charge with equal amounts produces no anomaly');
  const cleanInvoice = invoice({ id: 'inv_1', totalRecognizedRevenue: 500, stripeChargeId: 'ch_1' });
  const cleanTx = tx({ id: 'ch_1', amountGross: 500 });
  const result2 = detectLiveAnomalies(connected([cleanInvoice]), connected([cleanTx]), connected([]), '2026-09');
  if (result2.length !== 0) throw new Error(`Expected 0 anomalies for a clean match, got ${result2.length}: ${JSON.stringify(result2)}`);
  console.log('  ✓ No false positive when the invoice and charge amounts genuinely match.');

  // Test 3: a real amount mismatch between invoice and matched charge is
  // flagged as FEE_MISMATCH.
  console.log('\nTest 3: Mismatched amounts flag FEE_MISMATCH');
  const mismatchedInvoice = invoice({ id: 'inv_2', totalRecognizedRevenue: 1000, stripeChargeId: 'ch_2' });
  const mismatchedTx = tx({ id: 'ch_2', amountGross: 940, amountFee: 29, amountNet: 911 });
  const result3 = detectLiveAnomalies(connected([mismatchedInvoice]), connected([mismatchedTx]), connected([]), '2026-09');
  const feeMismatch = result3.find((a) => a.type === 'FEE_MISMATCH');
  if (!feeMismatch) throw new Error('Expected a FEE_MISMATCH anomaly for the $60 discrepancy');
  if (feeMismatch.discrepancyAmount !== 60) throw new Error(`Expected discrepancy 60, got ${feeMismatch.discrepancyAmount}`);
  console.log(`  ✓ Found FEE_MISMATCH with discrepancy $${feeMismatch.discrepancyAmount}, severity ${feeMismatch.severity}.`);

  // Test 4: an invoice referencing a Stripe charge ID with no matching
  // transaction flags MISSING_LEDGER_ENTRY.
  console.log('\nTest 4: Invoice referencing a nonexistent Stripe charge flags MISSING_LEDGER_ENTRY');
  const orphanInvoice = invoice({ id: 'inv_3', totalRecognizedRevenue: 300, stripeChargeId: 'ch_does_not_exist' });
  const result4 = detectLiveAnomalies(connected([orphanInvoice]), connected([]), connected([]), '2026-09');
  const missingEntry = result4.find((a) => a.type === 'MISSING_LEDGER_ENTRY');
  if (!missingEntry) throw new Error('Expected a MISSING_LEDGER_ENTRY anomaly');
  console.log('  ✓ Correctly flagged a Chargebee invoice whose referenced Stripe charge is nowhere in Stripe data.');

  // Test 5: a succeeded Stripe charge with no Chargebee invoice at all
  // flags REVENUE_LEAKAGE.
  console.log('\nTest 5: Unmatched succeeded Stripe charge flags REVENUE_LEAKAGE');
  const unmatchedTx = tx({ id: 'ch_unmatched', amountGross: 750, status: 'succeeded' });
  const result5 = detectLiveAnomalies(connected([]), connected([unmatchedTx]), connected([]), '2026-09');
  const leakage = result5.find((a) => a.type === 'REVENUE_LEAKAGE');
  if (!leakage) throw new Error('Expected a REVENUE_LEAKAGE anomaly');
  console.log('  ✓ Correctly flagged a Stripe charge never recognized as revenue in Chargebee.');

  // Test 6: a failed/pending Stripe transaction never triggers REVENUE_LEAKAGE
  // (nothing was actually collected).
  console.log('\nTest 6: Failed/pending Stripe transactions never flag REVENUE_LEAKAGE');
  const failedTx = tx({ id: 'ch_failed', amountGross: 400, status: 'failed' });
  const result6 = detectLiveAnomalies(connected([]), connected([failedTx]), connected([]), '2026-09');
  if (result6.some((a) => a.type === 'REVENUE_LEAKAGE')) throw new Error('Did not expect REVENUE_LEAKAGE for a failed transaction');
  console.log('  ✓ Correctly ignored a failed transaction — nothing was actually collected.');

  // Test 7: a disputed Stripe charge still recognized by an invoice flags
  // UNRECORDED_CHARGEBACK.
  console.log('\nTest 7: Disputed charge still recognized as revenue flags UNRECORDED_CHARGEBACK');
  const disputedInvoice = invoice({ id: 'inv_4', totalRecognizedRevenue: 200, stripeChargeId: 'ch_disputed' });
  const disputedTx = tx({ id: 'ch_disputed', amountGross: 200, type: 'dispute' });
  const result7 = detectLiveAnomalies(connected([disputedInvoice]), connected([disputedTx]), connected([]), '2026-09');
  const chargeback = result7.find((a) => a.type === 'UNRECORDED_CHARGEBACK');
  if (!chargeback) throw new Error('Expected an UNRECORDED_CHARGEBACK anomaly');
  if (chargeback.severity !== 'CRITICAL') throw new Error(`Expected CRITICAL severity for a dispute, got ${chargeback.severity}`);
  console.log('  ✓ Correctly flagged a disputed charge still being recognized as revenue, at CRITICAL severity.');

  // Test 8: a payout initiated in the requested period but settling in a
  // different month flags TIMING_DIFFERENCE; one that settles the same
  // month does not.
  console.log('\nTest 8: Cross-month payout settlement flags TIMING_DIFFERENCE; same-month does not');
  const floatPayout = payout({ id: 'po_float', amount: 4000, created: '2026-09-30T21:00:00.000Z', arrivalDate: '2026-10-02' });
  const sameMonthPayout = payout({ id: 'po_same', amount: 3000, created: '2026-09-15T10:00:00.000Z', arrivalDate: '2026-09-17' });
  const result8 = detectLiveAnomalies(connected([]), connected([]), connected([floatPayout, sameMonthPayout]), '2026-09');
  const timing = result8.filter((a) => a.type === 'TIMING_DIFFERENCE');
  if (timing.length !== 1) throw new Error(`Expected exactly 1 TIMING_DIFFERENCE anomaly, got ${timing.length}`);
  if (timing[0].affectedEntities.stripePayoutId !== 'po_float') throw new Error('Expected the timing anomaly to be for the cross-month payout');
  console.log('  ✓ Correctly flagged only the payout whose settlement crosses into a different month.');

  console.log('\n🎉 ALL LIVE ANOMALY DETECTION TESTS PASSED!\n');
}

try {
  runTests();
} catch (err) {
  console.error('\n❌ Test failure:', err);
  process.exitCode = 1;
}
