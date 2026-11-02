import { FinancialDataSource } from './types.js';
import { DateRange, GatewayTransaction, GatewayPayout, ChargebeeInvoice, PlaidBankTransaction, ERPJournalEntry, ProviderResult, ProviderName } from '../types/index.js';
export declare class LiveDataSource implements FinancialDataSource {
    private readonly userId;
    constructor(userId: string);
    getGatewayTransactions(provider: ProviderName, range: DateRange): Promise<ProviderResult<GatewayTransaction>>;
    getGatewayPayouts(provider: ProviderName, range: DateRange): Promise<ProviderResult<GatewayPayout>>;
    private chargebeeClientPromise;
    private getChargebeeClient;
    getChargebeeInvoices(range: DateRange): Promise<ProviderResult<ChargebeeInvoice>>;
    getPlaidTransactions(_range: DateRange): Promise<ProviderResult<PlaidBankTransaction>>;
    getQBOJournalEntries(_range: DateRange): Promise<ProviderResult<ERPJournalEntry>>;
}
