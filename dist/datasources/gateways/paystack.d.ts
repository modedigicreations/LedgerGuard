import { DateRange, GatewayTransaction, GatewayPayout, PaymentGatewayAdapter } from '../../types/index.js';
interface PaystackTransaction {
    id: number;
    reference: string;
    status: string;
    amount: number;
    fees: number | null;
    currency: string;
    created_at: string;
    customer: {
        customer_code?: string;
        first_name?: string;
        last_name?: string;
        email?: string;
    } | null;
}
interface PaystackTransfer {
    id: number;
    transfer_code: string;
    status: string;
    amount: number;
    currency: string;
    createdAt: string;
    updatedAt: string;
    recipient: {
        details?: {
            account_number?: string;
        } | null;
    } | null;
}
export declare function mapPaystackTransaction(tx: PaystackTransaction): GatewayTransaction | null;
export declare function mapPaystackTransfer(transfer: PaystackTransfer): GatewayPayout;
declare class PaystackGatewayAdapter implements PaymentGatewayAdapter {
    getTransactions(apiKey: string, range: DateRange): Promise<GatewayTransaction[]>;
    getPayouts(apiKey: string, range: DateRange): Promise<GatewayPayout[]>;
}
export declare const paystackAdapter: PaystackGatewayAdapter;
export {};
