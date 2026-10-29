import {
	StripeTransaction,
	StripePayout,
	ChargebeeInvoice,
	PlaidBankTransaction,
	ERPJournalEntry,
	ProviderResult,
	DateRange,
} from '../types/index.js';

// Replaces reconciler.ts's direct MOCK_* imports. Two implementations:
// MockDataSource (today's fixed September 2026 scenario — used by tests
// and local dev, never in production) and LiveDataSource (real provider
// APIs, reporting NOT_CONFIGURED per provider rather than ever falling
// back to fabricated numbers).
export interface FinancialDataSource {
	getStripeTransactions(range: DateRange): Promise<ProviderResult<StripeTransaction>>;
	getStripePayouts(range: DateRange): Promise<ProviderResult<StripePayout>>;
	getChargebeeInvoices(range: DateRange): Promise<ProviderResult<ChargebeeInvoice>>;
	getPlaidTransactions(range: DateRange): Promise<ProviderResult<PlaidBankTransaction>>;
	getQBOJournalEntries(range: DateRange): Promise<ProviderResult<ERPJournalEntry>>;
}

// "2026-09" -> the UTC start/end-of-day bounds of that calendar month.
export function periodToDateRange(period: string): DateRange {
	const [year, month] = period.split('-').map(Number);
	const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
	const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
	return { start, end };
}
