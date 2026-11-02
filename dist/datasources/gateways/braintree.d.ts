import { DateRange, GatewayTransaction, GatewayPayout, PaymentGatewayAdapter } from '../../types/index.js';
interface BraintreeTransactionNode {
    id: string;
    status: string;
    createdAt: string;
    amount: {
        value: string;
        currencyCode: string;
    } | null;
}
export declare function mapBraintreeTransaction(node: BraintreeTransactionNode): GatewayTransaction | null;
declare class BraintreeGatewayAdapter implements PaymentGatewayAdapter {
    getTransactions(privateKey: string, range: DateRange, accountId?: string): Promise<GatewayTransaction[]>;
    getPayouts(_apiKey: string, _range: DateRange, _accountId?: string): Promise<GatewayPayout[]>;
}
export declare const braintreeAdapter: BraintreeGatewayAdapter;
export {};
