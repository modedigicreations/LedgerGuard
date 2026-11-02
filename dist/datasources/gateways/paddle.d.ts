import { DateRange, GatewayTransaction, GatewayPayout, PaymentGatewayAdapter } from '../../types/index.js';
interface PaddleTransaction {
    id: string;
    status: string;
    currency_code: string;
    customer_id: string | null;
    created_at: string;
    details: {
        totals: {
            total: string;
            fee: string | null;
            earnings: string | null;
        } | null;
    } | null;
}
export declare function mapPaddleTransaction(tx: PaddleTransaction): GatewayTransaction | null;
declare class PaddleGatewayAdapter implements PaymentGatewayAdapter {
    getTransactions(apiKey: string, range: DateRange): Promise<GatewayTransaction[]>;
    getPayouts(_apiKey: string, _range: DateRange): Promise<GatewayPayout[]>;
}
export declare const paddleAdapter: PaddleGatewayAdapter;
export {};
