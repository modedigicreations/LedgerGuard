import { AuditTrailEntry } from '../types/index.js';
export declare class AuditTrailManager {
    private readonly userId;
    constructor(userId: string);
    record(actor: AuditTrailEntry['actor'], action: AuditTrailEntry['action'], details: string, evidence: Record<string, unknown>): Promise<AuditTrailEntry>;
    getTrail(): Promise<AuditTrailEntry[]>;
    verifyIntegrity(): Promise<{
        isValid: boolean;
        checkedEntries: number;
        error?: string;
    }>;
}
export declare function getAuditTrailFor(userId: string): AuditTrailManager;
