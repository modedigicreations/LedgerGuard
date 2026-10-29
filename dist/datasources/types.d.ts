import { StripeTransaction, StripePayout, ChargebeeInvoice, PlaidBankTransaction, ERPJournalEntry, ProviderResult, DateRange } from '../types/index.js';
export interface FinancialDataSource {
    getStripeTransactions(range: DateRange): Promise<ProviderResult<StripeTransaction>>;
    getStripePayouts(range: DateRange): Promise<ProviderResult<StripePayout>>;
    getChargebeeInvoices(range: DateRange): Promise<ProviderResult<ChargebeeInvoice>>;
    getPlaidTransactions(range: DateRange): Promise<ProviderResult<PlaidBankTransaction>>;
    getQBOJournalEntries(range: DateRange): Promise<ProviderResult<ERPJournalEntry>>;
}
export declare function periodToDateRange(period: string): DateRange;
