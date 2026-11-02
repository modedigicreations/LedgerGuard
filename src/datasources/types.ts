import {
	GatewayTransaction,
	GatewayPayout,
	ChargebeeInvoice,
	PlaidBankTransaction,
	ERPJournalEntry,
	ProviderResult,
	ProviderName,
	DateRange,
} from '../types/index.js';

// Replaces reconciler.ts's direct MOCK_* imports. Two implementations:
// MockDataSource (today's fixed September 2026 scenario — used by tests
// and local dev, never in production) and LiveDataSource (real provider
// APIs, reporting NOT_CONFIGURED per provider rather than ever falling
// back to fabricated numbers).
//
// getGatewayTransactions/getGatewayPayouts cover every "raw processor"
// gateway (Stripe today; PayStack/Paddle/Braintree/Square/PayPal as each
// is built) through one provider-dispatched pair of methods instead of a
// separate getXTransactions/getXPayouts per gateway. Chargebee stays its
// own dedicated method — it's billing/invoicing, not a raw payment
// processor, and was explicitly kept as-is rather than folded into this
// registry.
export interface FinancialDataSource {
	getGatewayTransactions(provider: ProviderName, range: DateRange): Promise<ProviderResult<GatewayTransaction>>;
	getGatewayPayouts(provider: ProviderName, range: DateRange): Promise<ProviderResult<GatewayPayout>>;
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
