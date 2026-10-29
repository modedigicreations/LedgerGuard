import { JournalAdjustment, JournalAdjustmentRequest } from '../types/index.js';
declare class JournalAdjustmentService {
    createDraftFromAnomaly(anomalyId: string, actor?: 'AI_AGENT_CLAUDE' | 'AI_AGENT_CHATGPT' | 'USER_FINANCE_LEAD' | 'SYSTEM'): Promise<JournalAdjustment>;
    draftAdjustment(req: JournalAdjustmentRequest, actor?: 'AI_AGENT_CLAUDE' | 'AI_AGENT_CHATGPT' | 'USER_FINANCE_LEAD' | 'SYSTEM'): Promise<JournalAdjustment>;
    approveAdjustment(id: string, approvedBy?: string): Promise<{
        success: boolean;
        adjustment?: JournalAdjustment;
        error?: string;
    }>;
    commitToERP(id: string, targetERP?: 'QUICKBOOKS' | 'NETSUITE' | 'XERO'): Promise<{
        success: boolean;
        adjustment?: JournalAdjustment;
        erpPostedId?: string;
        error?: string;
    }>;
    getAdjustment(id: string): Promise<JournalAdjustment | undefined>;
    listAdjustments(): Promise<JournalAdjustment[]>;
}
export declare const journalService: JournalAdjustmentService;
export declare function seedDemoData(): Promise<void>;
export {};
