import Provider from 'oidc-provider';
export interface OidcAccount {
    accountId: string;
    claims(): {
        sub: string;
        email: string;
    };
    [key: string]: unknown;
}
export declare function createOidcProvider(issuer: string): Promise<Provider>;
