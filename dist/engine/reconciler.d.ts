import { VarianceReport } from '../types/index.js';
export interface AuditOptions {
    period?: string;
    minDiscrepancy?: number;
    matchProcessorFees?: boolean;
    actor?: 'AI_AGENT_CLAUDE' | 'AI_AGENT_CHATGPT' | 'BACKGROUND_CRON' | 'USER_FINANCE_LEAD';
}
export declare class ReconciliationEngine {
    runAudit(options?: AuditOptions): Promise<VarianceReport>;
}
export declare const reconciler: ReconciliationEngine;
