import { MOCK_CHARGEBEE_INVOICES, MOCK_STRIPE_TRANSACTIONS, MOCK_STRIPE_PAYOUTS, MOCK_PLAID_TRANSACTIONS, MOCK_ERP_JOURNAL_ENTRIES, } from '../data/mock-data.js';
function inRange(date, range) {
    const d = new Date(date).getTime();
    return d >= range.start.getTime() && d <= range.end.getTime();
}
function connected(data) {
    return { status: 'CONNECTED', data };
}
// The fixed September 2026 demo scenario, as a FinancialDataSource. Used
// by tests/test-reconciler.ts and local dev — never selected in
// production (see LEDGERGUARD_DATA_MODE in reconciler.ts).
export class MockDataSource {
    async getStripeTransactions(range) {
        return connected(MOCK_STRIPE_TRANSACTIONS.filter((tx) => inRange(tx.created, range)));
    }
    async getStripePayouts(range) {
        return connected(MOCK_STRIPE_PAYOUTS.filter((p) => inRange(p.created, range)));
    }
    async getChargebeeInvoices(range) {
        return connected(MOCK_CHARGEBEE_INVOICES.filter((inv) => inRange(inv.date, range)));
    }
    async getPlaidTransactions(range) {
        return connected(MOCK_PLAID_TRANSACTIONS.filter((tx) => inRange(tx.date, range)));
    }
    async getQBOJournalEntries(range) {
        return connected(MOCK_ERP_JOURNAL_ENTRIES.filter((je) => inRange(je.date, range)));
    }
}
//# sourceMappingURL=mock.js.map