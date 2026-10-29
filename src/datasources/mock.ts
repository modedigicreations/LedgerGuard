import { FinancialDataSource } from './types.js';
import {
	DateRange,
	StripeTransaction,
	StripePayout,
	ChargebeeInvoice,
	PlaidBankTransaction,
	ERPJournalEntry,
	ProviderResult,
} from '../types/index.js';
import {
	MOCK_CHARGEBEE_INVOICES,
	MOCK_STRIPE_TRANSACTIONS,
	MOCK_STRIPE_PAYOUTS,
	MOCK_PLAID_TRANSACTIONS,
	MOCK_ERP_JOURNAL_ENTRIES,
} from '../data/mock-data.js';

function inRange(date: string, range: DateRange): boolean {
	const d = new Date(date).getTime();
	return d >= range.start.getTime() && d <= range.end.getTime();
}

function connected<T>(data: T[]): ProviderResult<T> {
	return { status: 'CONNECTED', data };
}

// The fixed September 2026 demo scenario, as a FinancialDataSource. Used
// by tests/test-reconciler.ts and local dev — never selected in
// production (see LEDGERGUARD_DATA_MODE in reconciler.ts).
export class MockDataSource implements FinancialDataSource {
	async getStripeTransactions(range: DateRange): Promise<ProviderResult<StripeTransaction>> {
		return connected(MOCK_STRIPE_TRANSACTIONS.filter((tx) => inRange(tx.created, range)));
	}

	async getStripePayouts(range: DateRange): Promise<ProviderResult<StripePayout>> {
		return connected(MOCK_STRIPE_PAYOUTS.filter((p) => inRange(p.created, range)));
	}

	async getChargebeeInvoices(range: DateRange): Promise<ProviderResult<ChargebeeInvoice>> {
		return connected(MOCK_CHARGEBEE_INVOICES.filter((inv) => inRange(inv.date, range)));
	}

	async getPlaidTransactions(range: DateRange): Promise<ProviderResult<PlaidBankTransaction>> {
		return connected(MOCK_PLAID_TRANSACTIONS.filter((tx) => inRange(tx.date, range)));
	}

	async getQBOJournalEntries(range: DateRange): Promise<ProviderResult<ERPJournalEntry>> {
		return connected(MOCK_ERP_JOURNAL_ENTRIES.filter((je) => inRange(je.date, range)));
	}
}
