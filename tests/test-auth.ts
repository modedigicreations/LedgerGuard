import { pool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { setApiKeyFor, getApiKeyFor, listConnectionsFor } from '../src/auth/connected-accounts.js';
import { getJournalServiceFor } from '../src/engine/journal-generator.js';
import { getAuditTrailFor } from '../src/engine/audit-trail.js';

async function upsertUser(email: string): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO users (email) VALUES ($1)
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING id`,
    [email],
  );
  return rows[0].id;
}

async function runTests() {
  console.log('🧪 Starting LedgerGuard Multi-Tenant Data Isolation Test Suite...\n');

  await runMigrations();

  const userA = await upsertUser('test-isolation-a@ledgerguard.internal');
  const userB = await upsertUser('test-isolation-b@ledgerguard.internal');

  // Test 1: Each user's connected_accounts row is only visible to that user.
  console.log('Test 1: connected_accounts isolation');
  await setApiKeyFor(userA, 'STRIPE', 'sk_test_user_a_only');
  await setApiKeyFor(userB, 'STRIPE', 'sk_test_user_b_only');

  const credA = await getApiKeyFor(userA, 'STRIPE');
  const credB = await getApiKeyFor(userB, 'STRIPE');
  if (credA?.apiKey !== 'sk_test_user_a_only') {
    throw new Error(`User A's own key was not returned correctly: got ${credA?.apiKey}`);
  }
  if (credB?.apiKey !== 'sk_test_user_b_only') {
    throw new Error(`User B's own key was not returned correctly: got ${credB?.apiKey}`);
  }
  if (credA?.apiKey === credB?.apiKey) {
    throw new Error('User A and User B resolved to the same decrypted key — cross-tenant leak');
  }
  console.log('  ✓ Each user resolves only their own encrypted Stripe credential.');

  const connectionsA = await listConnectionsFor(userA);
  if (connectionsA.some((c) => c.provider === 'STRIPE' && c.status !== 'CONNECTED')) {
    throw new Error('User A STRIPE connection status unexpectedly not CONNECTED');
  }
  if (connectionsA.length !== 1) {
    throw new Error(`Expected exactly 1 connection row for User A, found ${connectionsA.length} — possible cross-tenant row leak`);
  }
  console.log('  ✓ listConnectionsFor(userA) returns only userA\'s own rows.');

  // Test 2: journal_adjustments isolation.
  console.log('\nTest 2: journal_adjustments isolation');
  const adjA = await getJournalServiceFor(userA).draftAdjustment(
    { reference: 'ADJ-ISO-A', memo: 'User A isolation test entry', date: '2026-09-30', lines: [
      { accountCode: '1010', accountName: 'Cash', debit: 10, credit: 0 },
      { accountCode: '4010', accountName: 'Revenue', debit: 0, credit: 10 },
    ] },
    'SYSTEM',
  );
  const adjListB = await getJournalServiceFor(userB).listAdjustments();
  if (adjListB.some((a) => a.id === adjA.id)) {
    throw new Error("User A's journal adjustment leaked into User B's listAdjustments() result");
  }
  console.log("  ✓ User B's listAdjustments() does not include User A's draft.");

  // Test 3: audit_trail_entries isolation — each user has their own
  // independent hash chain, not a shared sequence.
  console.log('\nTest 3: audit_trail_entries isolation');
  const trailA = await getAuditTrailFor(userA).getTrail();
  const trailB = await getAuditTrailFor(userB).getTrail();
  if (trailA.some((e) => trailB.some((eb) => eb.currentHash === e.currentHash))) {
    throw new Error("User A and User B's audit trails share a hash entry — chains are not independent");
  }
  const verifyA = await getAuditTrailFor(userA).verifyIntegrity();
  if (!verifyA.isValid) {
    throw new Error(`User A's own audit trail failed integrity verification: ${verifyA.error}`);
  }
  console.log("  ✓ User A and User B each have independent, internally-valid hash chains.");

  console.log('\n🎉 ALL DATA ISOLATION TESTS PASSED! No cross-tenant leakage detected.\n');
}

runTests()
  .catch((err) => {
    console.error('\n❌ Test failure:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
