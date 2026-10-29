export interface SendMagicLinkOptions {
    email: string;
    interactionUid?: string;
    baseUrl: string;
}
export declare function sendMagicLink(options: SendMagicLinkOptions): Promise<string>;
export interface VerifiedMagicLink {
    userId: string;
    email: string;
    interactionUid: string | null;
}
export declare function verifyMagicLink(rawToken: string): Promise<VerifiedMagicLink | null>;
