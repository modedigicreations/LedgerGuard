import { FinancialDataSource } from './types.js';
import { DateRange, StripeTransaction, StripePayout, ChargebeeInvoice, PlaidBankTransaction, ERPJournalEntry, ProviderResult } from '../types/index.js';
export declare class LiveDataSource implements FinancialDataSource {
    private stripeClient;
    private chargebeeClient;
    constructor();
    getStripeTransactions(range: DateRange): Promise<ProviderResult<StripeTransaction>>;
    getStripePayouts(range: DateRange): Promise<ProviderResult<StripePayout>>;
    getChargebeeInvoices(range: DateRange): Promise<ProviderResult<ChargebeeInvoice>>;
    getPlaidTransactions(_range: DateRange): Promise<ProviderResult<PlaidBankTransaction>>;
    getQBOJournalEntries(_range: DateRange): Promise<ProviderResult<ERPJournalEntry>>;
}
