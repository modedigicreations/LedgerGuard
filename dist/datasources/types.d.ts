import { GatewayTransaction, GatewayPayout, ChargebeeInvoice, PlaidBankTransaction, ERPJournalEntry, ProviderResult, ProviderName, DateRange } from '../types/index.js';
export interface FinancialDataSource {
    getGatewayTransactions(provider: ProviderName, range: DateRange): Promise<ProviderResult<GatewayTransaction>>;
    getGatewayPayouts(provider: ProviderName, range: DateRange): Promise<ProviderResult<GatewayPayout>>;
    getChargebeeInvoices(range: DateRange): Promise<ProviderResult<ChargebeeInvoice>>;
    getPlaidTransactions(range: DateRange): Promise<ProviderResult<PlaidBankTransaction>>;
    getQBOJournalEntries(range: DateRange): Promise<ProviderResult<ERPJournalEntry>>;
}
export declare function periodToDateRange(period: string): DateRange;
