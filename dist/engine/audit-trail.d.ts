import { AuditTrailEntry } from '../types/index.js';
declare class AuditTrailManager {
    private entries;
    constructor();
    record(actor: AuditTrailEntry['actor'], action: AuditTrailEntry['action'], details: string, evidence: Record<string, unknown>): AuditTrailEntry;
    getTrail(): AuditTrailEntry[];
    verifyIntegrity(): {
        isValid: boolean;
        checkedEntries: number;
        error?: string;
    };
}
export declare const auditTrail: AuditTrailManager;
export {};
