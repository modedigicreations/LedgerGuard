export type ConnectedProvider = 'STRIPE' | 'CHARGEBEE' | 'PLAID' | 'QUICKBOOKS' | 'PAYSTACK' | 'PAYPAL' | 'SQUARE' | 'BRAINTREE' | 'PADDLE';
export declare function getApiKeyFor(userId: string, provider: ConnectedProvider): Promise<{
    apiKey: string;
    accountId: string | null;
} | null>;
export declare function setApiKeyFor(userId: string, provider: ConnectedProvider, apiKey: string, accountId?: string): Promise<void>;
export declare function disconnectProvider(userId: string, provider: ConnectedProvider): Promise<void>;
export interface ConnectionStatus {
    provider: ConnectedProvider;
    status: 'NOT_CONFIGURED' | 'CONNECTED' | 'ERROR' | 'REVOKED';
    lastSyncedAt: string | null;
    lastError: string | null;
}
export declare function listConnectionsFor(userId: string): Promise<ConnectionStatus[]>;
