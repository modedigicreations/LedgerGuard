export interface SendMagicLinkOptions {
    email: string;
    interactionUid?: string;
    baseUrl: string;
}
export interface SendMagicLinkResult {
    userId: string;
    challengeId: string;
}
export declare function sendMagicLink(options: SendMagicLinkOptions): Promise<SendMagicLinkResult>;
export interface VerifiedMagicLink {
    userId: string;
    email: string;
}
export declare function verifyCode(challengeId: string, code: string): Promise<VerifiedMagicLink | null>;
