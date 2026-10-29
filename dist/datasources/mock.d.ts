import { FinancialDataSource } from './types.js';
import { DateRange, StripeTransaction, StripePayout, ChargebeeInvoice, PlaidBankTransaction, ERPJournalEntry, ProviderResult } from '../types/index.js';
export declare class MockDataSource implements FinancialDataSource {
    getStripeTransactions(range: DateRange): Promise<ProviderResult<StripeTransaction>>;
    getStripePayouts(range: DateRange): Promise<ProviderResult<StripePayout>>;
    getChargebeeInvoices(range: DateRange): Promise<ProviderResult<ChargebeeInvoice>>;
    getPlaidTransactions(range: DateRange): Promise<ProviderResult<PlaidBankTransaction>>;
    getQBOJournalEntries(range: DateRange): Promise<ProviderResult<ERPJournalEntry>>;
}
