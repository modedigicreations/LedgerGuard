// Exercises the Braintree field-mapping logic directly against sample
// data shaped exactly like Braintree's own documented GraphQL response
// (verified via https://developer.paypal.com/braintree/graphql/reference/
// types/transaction, /payment-status, and /monetary-amount — not
// guessed). No sandbox credential is available in this environment to
// drive the real HTTP call path, so this is what stands in for that.
import { mapBraintreeTransaction } from '../src/datasources/gateways/braintree.js';

function runTests() {
  console.log('🧪 Starting Braintree Mapping Test Suite...\n');

  // Test 1: a SETTLED transaction maps correctly. amount.value is a
  // major-unit decimal string (NOT cents, unlike Stripe/Paystack/Paddle)
  // — confirmed directly against Braintree's docs, not assumed.
  console.log('Test 1: SETTLED transaction (major-unit decimal, not minor units)');
  const settledTx = mapBraintreeTransaction({
    id: 'txn_abc123',
    status: 'SETTLED',
    createdAt: '2026-09-15T10:30:00.000Z',
    amount: { value: '652.15', currencyCode: 'USD' },
  });
  if (!settledTx) throw new Error('Expected a mapped transaction, got null');
  if (settledTx.amountGross !== 652.15) throw new Error(`Expected amountGross 652.15 (no /100 — major units), got ${settledTx.amountGross}`);
  if (settledTx.status !== 'succeeded') throw new Error(`Expected status 'succeeded', got ${settledTx.status}`);
  if (settledTx.currency !== 'USD') throw new Error(`Expected currency USD, got ${settledTx.currency}`);
  console.log('  ✓ Amount read as major-unit decimal (not divided by 100), status mapped.');

  // Test 2: fee is honestly 0/unknown, never fabricated — Braintree's
  // GraphQL API doesn't expose a per-transaction fee field at all.
  console.log('\nTest 2: Fee is honestly reported as unknown (0), not fabricated');
  if (settledTx.amountFee !== 0) throw new Error(`Expected amountFee 0 (unknown, not exposed by the API), got ${settledTx.amountFee}`);
  if (settledTx.amountNet !== settledTx.amountGross) throw new Error('Expected amountNet to equal amountGross since fee is unknown');
  console.log('  ✓ amountFee is 0 (honestly unknown) and amountNet equals amountGross as a direct consequence.');

  // Test 3: intermediate "money already collected" statuses map to
  // 'succeeded', not 'pending' — the customer was charged even though
  // Braintree's own settlement batch hasn't finished.
  console.log('\nTest 3: SETTLING/SUBMITTED_FOR_SETTLEMENT read as succeeded, not pending');
  for (const status of ['SETTLING', 'SUBMITTED_FOR_SETTLEMENT', 'SETTLEMENT_CONFIRMED', 'SETTLEMENT_PENDING']) {
    const tx = mapBraintreeTransaction({
      id: `txn_${status}`,
      status,
      createdAt: '2026-09-16T08:00:00.000Z',
      amount: { value: '100.00', currencyCode: 'USD' },
    });
    if (!tx || tx.status !== 'succeeded') {
      throw new Error(`Expected ${status} to map to 'succeeded', got ${tx?.status}`);
    }
  }
  console.log('  ✓ All in-progress-settlement statuses correctly read as succeeded.');

  // Test 4: AUTHORIZED/AUTHORIZING map to pending — captured hasn't happened.
  console.log('\nTest 4: AUTHORIZED/AUTHORIZING read as pending');
  for (const status of ['AUTHORIZED', 'AUTHORIZING']) {
    const tx = mapBraintreeTransaction({
      id: `txn_${status}`,
      status,
      createdAt: '2026-09-17T08:00:00.000Z',
      amount: { value: '50.00', currencyCode: 'USD' },
    });
    if (!tx || tx.status !== 'pending') {
      throw new Error(`Expected ${status} to map to 'pending', got ${tx?.status}`);
    }
  }
  console.log('  ✓ Not-yet-captured statuses correctly read as pending.');

  // Test 5: terminal failure statuses map to failed.
  console.log('\nTest 5: VOIDED/FAILED/GATEWAY_REJECTED/PROCESSOR_DECLINED read as failed');
  for (const status of ['VOIDED', 'FAILED', 'GATEWAY_REJECTED', 'PROCESSOR_DECLINED', 'AUTHORIZATION_EXPIRED', 'SETTLEMENT_DECLINED']) {
    const tx = mapBraintreeTransaction({
      id: `txn_${status}`,
      status,
      createdAt: '2026-09-18T08:00:00.000Z',
      amount: { value: '25.00', currencyCode: 'USD' },
    });
    if (!tx || tx.status !== 'failed') {
      throw new Error(`Expected ${status} to map to 'failed', got ${tx?.status}`);
    }
  }
  console.log('  ✓ All terminal-failure statuses correctly read as failed.');

  // Test 6: a transaction with no amount at all is skipped.
  console.log('\nTest 6: Transaction with no amount is skipped');
  const noAmount = mapBraintreeTransaction({
    id: 'txn_no_amount',
    status: 'SETTLED',
    createdAt: '2026-09-19T08:00:00.000Z',
    amount: null,
  });
  if (noAmount !== null) throw new Error('Expected a transaction with no amount to be skipped (returned null)');
  console.log('  ✓ Correctly skipped when there is no usable amount at all.');

  console.log('\n🎉 ALL BRAINTREE MAPPING TESTS PASSED!\n');
}

try {
  runTests();
} catch (err) {
  console.error('\n❌ Test failure:', err);
  process.exitCode = 1;
}
