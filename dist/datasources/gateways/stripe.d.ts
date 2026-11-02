import { DateRange, GatewayTransaction, GatewayPayout, PaymentGatewayAdapter } from '../../types/index.js';
declare class StripeGatewayAdapter implements PaymentGatewayAdapter {
    getTransactions(apiKey: string, range: DateRange): Promise<GatewayTransaction[]>;
    getPayouts(apiKey: string, range: DateRange): Promise<GatewayPayout[]>;
}
export declare const stripeAdapter: StripeGatewayAdapter;
export {};
