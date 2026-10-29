import { VarianceReport } from '../types/index.js';
import { FinancialDataSource } from '../datasources/types.js';
export interface AuditOptions {
    period?: string;
    minDiscrepancy?: number;
    matchProcessorFees?: boolean;
    actor?: 'AI_AGENT_CLAUDE' | 'AI_AGENT_CHATGPT' | 'BACKGROUND_CRON' | 'USER_FINANCE_LEAD';
}
export declare class ReconciliationEngine {
    private readonly dataSource;
    constructor(dataSource: FinancialDataSource);
    runAudit(options?: AuditOptions): Promise<VarianceReport>;
}
export declare const reconciler: ReconciliationEngine;
