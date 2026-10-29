import { AuditTrailEntry } from '../types/index.js';
declare class AuditTrailManager {
    private genesisReady;
    private ensureGenesis;
    private appendEntry;
    record(actor: AuditTrailEntry['actor'], action: AuditTrailEntry['action'], details: string, evidence: Record<string, unknown>): Promise<AuditTrailEntry>;
    getTrail(): Promise<AuditTrailEntry[]>;
    verifyIntegrity(): Promise<{
        isValid: boolean;
        checkedEntries: number;
        error?: string;
    }>;
}
export declare const auditTrail: AuditTrailManager;
export {};
