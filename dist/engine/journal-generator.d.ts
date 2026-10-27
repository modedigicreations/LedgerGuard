import { JournalAdjustment, JournalAdjustmentRequest } from '../types/index.js';
declare class JournalAdjustmentService {
    private adjustments;
    constructor();
    createDraftFromAnomaly(anomalyId: string, actor?: 'AI_AGENT_CLAUDE' | 'AI_AGENT_CHATGPT' | 'USER_FINANCE_LEAD' | 'SYSTEM'): JournalAdjustment;
    draftAdjustment(req: JournalAdjustmentRequest, actor?: 'AI_AGENT_CLAUDE' | 'AI_AGENT_CHATGPT' | 'USER_FINANCE_LEAD' | 'SYSTEM'): JournalAdjustment;
    approveAdjustment(id: string, approvedBy?: string): {
        success: boolean;
        adjustment?: JournalAdjustment;
        error?: string;
    };
    commitToERP(id: string, targetERP?: 'QUICKBOOKS' | 'NETSUITE' | 'XERO'): {
        success: boolean;
        adjustment?: JournalAdjustment;
        erpPostedId?: string;
        error?: string;
    };
    getAdjustment(id: string): JournalAdjustment | undefined;
    listAdjustments(): JournalAdjustment[];
}
export declare const journalService: JournalAdjustmentService;
export {};
