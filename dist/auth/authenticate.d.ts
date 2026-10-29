import type { IncomingMessage } from 'http';
import type Provider from 'oidc-provider';
export declare function resolveUserIdFromBearer(provider: Provider, req: IncomingMessage): Promise<string | null>;
