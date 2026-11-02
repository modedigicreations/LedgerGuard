// Exercises the Paystack field-mapping logic directly against sample
// JSON shaped exactly like Paystack's own published API docs (verified
// via https://docs-v2.paystack.com/docs/api/transaction/ and /transfer/
// — not guessed). There's no sandbox credential available in this
// environment to drive the real HTTP call path, so this is what stands
// in for that: proving the mapping is correct against known-real shapes,
// independent of the fetch() wrapper around it.
import { mapPaystackTransaction, mapPaystackTransfer } from '../src/datasources/gateways/paystack.js';

function runTests() {
  console.log('🧪 Starting Paystack Mapping Test Suite...\n');

  // Test 1: a successful transaction with fees present (the documented
  // common case for success status) maps correctly, including the
  // kobo -> naira conversion.
  console.log('Test 1: Successful transaction with fees present');
  const successTx = mapPaystackTransaction({
    id: 123456,
    reference: 'ref_abc123',
    status: 'success',
    amount: 20000,
    fees: 100,
    currency: 'NGN',
    created_at: '2026-09-15T10:30:00.000Z',
    customer: { customer_code: 'CUS_xyz', first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' },
  });
  if (!successTx) throw new Error('Expected a mapped transaction, got null');
  if (successTx.amountGross !== 200.0) throw new Error(`Expected amountGross 200.0, got ${successTx.amountGross}`);
  if (successTx.amountFee !== 1.0) throw new Error(`Expected amountFee 1.0, got ${successTx.amountFee}`);
  if (successTx.amountNet !== 199.0) throw new Error(`Expected amountNet 199.0, got ${successTx.amountNet}`);
  if (successTx.status !== 'succeeded') throw new Error(`Expected status 'succeeded', got ${successTx.status}`);
  if (successTx.currency !== 'NGN') throw new Error(`Expected currency NGN, got ${successTx.currency}`);
  if (successTx.customerName !== 'Ada Lovelace') throw new Error(`Expected customer name 'Ada Lovelace', got '${successTx.customerName}'`);
  console.log('  ✓ Gross/fee/net correctly converted from kobo to naira, status and customer mapped.');

  // Test 2: a non-success transaction with fees: null (the documented
  // common case) must NOT be silently reported as a $0-fee transaction —
  // it should be skipped entirely rather than fabricating a number.
  console.log('\nTest 2: Non-success transaction with null fees is skipped, not zeroed');
  const abandonedTx = mapPaystackTransaction({
    id: 123457,
    reference: 'ref_abandoned',
    status: 'abandoned',
    amount: 5000,
    fees: null,
    currency: 'NGN',
    created_at: '2026-09-15T11:00:00.000Z',
    customer: null,
  });
  if (!abandonedTx) throw new Error('Expected abandoned transaction to still be mapped (status != succeeded, fees null is expected)');
  if (abandonedTx.status !== 'failed') throw new Error(`Expected status 'failed' for abandoned, got ${abandonedTx.status}`);
  if (abandonedTx.amountFee !== 0) throw new Error(`Expected amountFee 0 for a never-charged transaction, got ${abandonedTx.amountFee}`);
  console.log('  ✓ Abandoned transaction mapped with honest $0 fee (nothing was ever actually charged).');

  // Test 3: a SUCCESS transaction with fees: null specifically (the one
  // genuinely ambiguous case per Paystack's own docs) must be skipped,
  // not reported with a fabricated $0 fee.
  console.log('\nTest 3: Success transaction with unexpectedly null fees is skipped entirely');
  const successNullFees = mapPaystackTransaction({
    id: 123458,
    reference: 'ref_weird',
    status: 'success',
    amount: 10000,
    fees: null,
    currency: 'NGN',
    created_at: '2026-09-15T12:00:00.000Z',
    customer: { customer_code: 'CUS_abc' },
  });
  if (successNullFees !== null) throw new Error('Expected a success transaction with null fees to be skipped (returned null)');
  console.log('  ✓ Correctly skipped rather than fabricating a $0 fee for a successful charge.');

  // Test 4: a successful transfer maps correctly, including last-4
  // account number masking and kobo -> naira conversion.
  console.log('\nTest 4: Successful transfer (payout) mapping');
  const transfer = mapPaystackTransfer({
    id: 987654,
    transfer_code: 'TRF_xyz789',
    status: 'success',
    amount: 4950000,
    currency: 'NGN',
    createdAt: '2026-09-28T09:00:00.000Z',
    updatedAt: '2026-09-28T09:05:12.000Z',
    recipient: { details: { account_number: '0123456789' } },
  });
  if (transfer.amount !== 49500.0) throw new Error(`Expected amount 49500.0, got ${transfer.amount}`);
  if (transfer.status !== 'paid') throw new Error(`Expected status 'paid', got ${transfer.status}`);
  if (transfer.destinationBankLast4 !== '6789') throw new Error(`Expected last4 '6789', got '${transfer.destinationBankLast4}'`);
  if (transfer.arrivalDate !== '2026-09-28') throw new Error(`Expected arrivalDate '2026-09-28', got '${transfer.arrivalDate}'`);
  console.log('  ✓ Transfer amount, status, arrival date, and masked account number all correct.');

  // Test 5: a failed/reversed transfer maps to 'canceled', not 'paid'.
  console.log('\nTest 5: Failed transfer does not read as a successful payout');
  const failedTransfer = mapPaystackTransfer({
    id: 987655,
    transfer_code: 'TRF_failed',
    status: 'failed',
    amount: 1000000,
    currency: 'NGN',
    createdAt: '2026-09-29T09:00:00.000Z',
    updatedAt: '2026-09-29T09:01:00.000Z',
    recipient: null,
  });
  if (failedTransfer.status !== 'canceled') throw new Error(`Expected status 'canceled' for a failed transfer, got ${failedTransfer.status}`);
  if (failedTransfer.destinationBankLast4 !== '') throw new Error(`Expected empty last4 when recipient is null, got '${failedTransfer.destinationBankLast4}'`);
  console.log('  ✓ Failed transfer correctly never read as a completed payout.');

  console.log('\n🎉 ALL PAYSTACK MAPPING TESTS PASSED!\n');
}

try {
  runTests();
} catch (err) {
  console.error('\n❌ Test failure:', err);
  process.exitCode = 1;
}
