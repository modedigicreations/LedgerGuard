import { FinancialDataSource } from './types.js';
import { DateRange, GatewayTransaction, GatewayPayout, ChargebeeInvoice, PlaidBankTransaction, ERPJournalEntry, ProviderResult, ProviderName } from '../types/index.js';
export declare class MockDataSource implements FinancialDataSource {
    getGatewayTransactions(provider: ProviderName, range: DateRange): Promise<ProviderResult<GatewayTransaction>>;
    getGatewayPayouts(provider: ProviderName, range: DateRange): Promise<ProviderResult<GatewayPayout>>;
    getChargebeeInvoices(range: DateRange): Promise<ProviderResult<ChargebeeInvoice>>;
    getPlaidTransactions(range: DateRange): Promise<ProviderResult<PlaidBankTransaction>>;
    getQBOJournalEntries(range: DateRange): Promise<ProviderResult<ERPJournalEntry>>;
}
