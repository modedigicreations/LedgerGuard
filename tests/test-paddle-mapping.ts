// Exercises the Paddle field-mapping logic directly against sample JSON
// shaped exactly like Paddle's own documented response (verified via
// https://developer.paddle.com/api-reference/transactions/list-transactions,
// including a real sample response body — not guessed). No sandbox
// credential is available in this environment to drive the real HTTP
// call path, so this is what stands in for that.
import { mapPaddleTransaction } from '../src/datasources/gateways/paddle.js';

function runTests() {
  console.log('🧪 Starting Paddle Mapping Test Suite...\n');

  // Test 1: a completed transaction with fee/earnings present maps
  // correctly, including the cents -> dollars conversion.
  console.log('Test 1: Completed transaction with fee/earnings present');
  const completedTx = mapPaddleTransaction({
    id: 'txn_01hv8wptq8987qeep44cyrewp9',
    status: 'completed',
    currency_code: 'USD',
    customer_id: 'ctm_abc123',
    created_at: '2026-09-15T10:30:00.000Z',
    details: {
      totals: { total: '65215', fee: '3311', earnings: '56589' },
    },
  });
  if (!completedTx) throw new Error('Expected a mapped transaction, got null');
  if (completedTx.amountGross !== 652.15) throw new Error(`Expected amountGross 652.15, got ${completedTx.amountGross}`);
  if (completedTx.amountFee !== 33.11) throw new Error(`Expected amountFee 33.11, got ${completedTx.amountFee}`);
  if (completedTx.amountNet !== 565.89) throw new Error(`Expected amountNet 565.89, got ${completedTx.amountNet}`);
  if (completedTx.status !== 'succeeded') throw new Error(`Expected status 'succeeded', got ${completedTx.status}`);
  console.log('  ✓ Gross/fee/net correctly converted from cents to dollars, status mapped.');

  // Test 2: a draft transaction (fee/earnings null, as Paddle's docs say
  // is normal pre-completion) is still mapped, with an honest $0 fee
  // rather than a crash or a skipped record.
  console.log('\nTest 2: Draft transaction with null fee/earnings is mapped with honest $0 fee');
  const draftTx = mapPaddleTransaction({
    id: 'txn_01hv8xxw3etar07vaxsqbyqasy',
    status: 'draft',
    currency_code: 'USD',
    customer_id: null,
    created_at: '2026-09-16T08:00:00.000Z',
    details: {
      totals: { total: '57509', fee: null, earnings: null },
    },
  });
  if (!draftTx) throw new Error('Expected a mapped draft transaction, got null');
  if (draftTx.status !== 'pending') throw new Error(`Expected status 'pending' for draft, got ${draftTx.status}`);
  if (draftTx.amountFee !== 0) throw new Error(`Expected amountFee 0 for a not-yet-completed transaction, got ${draftTx.amountFee}`);
  if (draftTx.amountNet !== draftTx.amountGross) throw new Error('Expected amountNet to equal amountGross when no fee has been assessed yet');
  console.log('  ✓ Draft transaction mapped with honest $0 fee (nothing assessed yet), not skipped.');

  // Test 3: a 'completed' transaction with unexpectedly null fee/earnings
  // (the one genuinely anomalous case per Paddle's own docs) must be
  // skipped, not reported with a fabricated $0 fee.
  console.log("\nTest 3: 'completed' transaction with unexpectedly null fee is skipped entirely");
  const weirdTx = mapPaddleTransaction({
    id: 'txn_weird',
    status: 'completed',
    currency_code: 'USD',
    customer_id: 'ctm_xyz',
    created_at: '2026-09-17T08:00:00.000Z',
    details: {
      totals: { total: '10000', fee: null, earnings: null },
    },
  });
  if (weirdTx !== null) throw new Error('Expected a completed transaction with null fee to be skipped (returned null)');
  console.log('  ✓ Correctly skipped rather than fabricating a $0 fee for a completed charge.');

  // Test 4: a canceled transaction maps to 'failed', not 'succeeded' or 'pending'.
  console.log('\nTest 4: Canceled transaction maps to failed status');
  const canceledTx = mapPaddleTransaction({
    id: 'txn_canceled',
    status: 'canceled',
    currency_code: 'EUR',
    customer_id: 'ctm_def',
    created_at: '2026-09-18T08:00:00.000Z',
    details: {
      totals: { total: '5000', fee: null, earnings: null },
    },
  });
  if (!canceledTx) throw new Error('Expected canceled transaction to still be mapped');
  if (canceledTx.status !== 'failed') throw new Error(`Expected status 'failed' for canceled, got ${canceledTx.status}`);
  console.log('  ✓ Canceled transaction correctly maps to failed, not succeeded.');

  // Test 5: a transaction with no usable totals at all is skipped.
  console.log('\nTest 5: Transaction with no totals.total at all is skipped');
  const noTotals = mapPaddleTransaction({
    id: 'txn_no_totals',
    status: 'draft',
    currency_code: 'USD',
    customer_id: null,
    created_at: '2026-09-19T08:00:00.000Z',
    details: null,
  });
  if (noTotals !== null) throw new Error('Expected a transaction with no details/totals to be skipped (returned null)');
  console.log('  ✓ Correctly skipped when there is no usable total at all.');

  console.log('\n🎉 ALL PADDLE MAPPING TESTS PASSED!\n');
}

try {
  runTests();
} catch (err) {
  console.error('\n❌ Test failure:', err);
  process.exitCode = 1;
}
