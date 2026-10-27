import { MOCK_ERP_JOURNAL_ENTRIES } from '../data/mock-data.js';
import { auditTrail } from './audit-trail.js';
class JournalAdjustmentService {
    adjustments = new Map();
    constructor() {
        // Pre-populate with drafted adjustments ready for review based on known anomalies
        this.createDraftFromAnomaly('anom_fee_mismatch_001', 'SYSTEM');
    }
    createDraftFromAnomaly(anomalyId, actor = 'AI_AGENT_CLAUDE') {
        // Check if a draft already exists for this anomaly
        for (const existing of this.adjustments.values()) {
            if (existing.anomalyId === anomalyId && (existing.status === 'DRAFT' || existing.status === 'APPROVED')) {
                return existing;
            }
        }
        let lines = [];
        let memo = '';
        let reference = '';
        if (anomalyId === 'anom_fee_mismatch_001') {
            reference = 'ADJ-FEE-2026-09';
            memo = 'Adjusting Entry: Recognize omitted Stripe processing fee for Batch 2 (Fintech Hub cb_inv_sep_003)';
            lines = [
                {
                    accountCode: '6030',
                    accountName: 'Payment Processing Fees (Operating Expense)',
                    debit: 536.80,
                    credit: 0.00,
                    description: 'Stripe fee omitted on invoice cb_inv_sep_003'
                },
                {
                    accountCode: '1010',
                    accountName: 'Cash — Operating (Chase 4091)',
                    debit: 0.00,
                    credit: 536.80,
                    description: 'Correct overstated cash balance to match Plaid bank statement'
                }
            ];
        }
        else if (anomalyId === 'anom_chargeback_002') {
            reference = 'ADJ-CB-2026-09';
            memo = 'Adjusting Entry: Record Veloce Logistics chargeback dispute clawback and administrative fee';
            lines = [
                {
                    accountCode: '1250',
                    accountName: 'Allowance for Disputed Accounts & Chargebacks',
                    debit: 1200.00,
                    credit: 0.00,
                    description: 'Reserve for customer dispute on ch_stripe_sep_005'
                },
                {
                    accountCode: '6035',
                    accountName: 'Merchant Dispute & Regulatory Surcharges',
                    debit: 15.00,
                    credit: 0.00,
                    description: 'Stripe $15 dispute assessment fee'
                },
                {
                    accountCode: '1010',
                    accountName: 'Cash — Operating (Chase 4091)',
                    debit: 0.00,
                    credit: 50.10,
                    description: 'Net bank deduction from Plaid settlement Sept 27'
                },
                {
                    accountCode: '1200',
                    accountName: 'Undeposited Funds / Stripe Clearing',
                    debit: 0.00,
                    credit: 1164.90,
                    description: 'Reverse clearing asset balance'
                }
            ];
        }
        else {
            reference = `ADJ-${Date.now()}`;
            memo = `General adjusting entry for anomaly ${anomalyId}`;
            lines = [
                { accountCode: '6030', accountName: 'Payment Processing Fees', debit: 250.00, credit: 0.00 },
                { accountCode: '1010', accountName: 'Cash — Operating (Chase 4091)', debit: 0.00, credit: 250.00 }
            ];
        }
        return this.draftAdjustment({
            anomalyId,
            reference,
            memo,
            date: '2026-09-30',
            lines
        }, actor);
    }
    draftAdjustment(req, actor = 'AI_AGENT_CLAUDE') {
        const totalDebit = Number(req.lines.reduce((sum, l) => sum + (l.debit || 0), 0).toFixed(2));
        const totalCredit = Number(req.lines.reduce((sum, l) => sum + (l.credit || 0), 0).toFixed(2));
        const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001;
        const id = `adj_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const adjustmentNumber = `LG-JE-${Date.now().toString().slice(-6)}`;
        const adjustment = {
            id,
            adjustmentNumber,
            anomalyId: req.anomalyId,
            reference: req.reference,
            date: req.date || new Date().toISOString().split('T')[0],
            memo: req.memo,
            lines: req.lines,
            totalDebit,
            totalCredit,
            isBalanced,
            status: 'DRAFT',
            targetERP: 'QUICKBOOKS',
            createdAt: new Date().toISOString()
        };
        this.adjustments.set(id, adjustment);
        auditTrail.record(actor, 'JOURNAL_DRAFTED', `Dual-entry adjustment ${adjustmentNumber} drafted ($${totalDebit.toFixed(2)} Debits / $${totalCredit.toFixed(2)} Credits). Balanced: ${isBalanced}.`, {
            adjustmentId: id,
            adjustmentNumber,
            isBalanced,
            totalDebit,
            linesCount: req.lines.length
        });
        return adjustment;
    }
    approveAdjustment(id, approvedBy = 'Fractional CFO / Finance Lead') {
        const adj = this.adjustments.get(id);
        if (!adj) {
            return { success: false, error: `Adjustment ${id} not found.` };
        }
        if (!adj.isBalanced) {
            return {
                success: false,
                error: `Cannot approve unbalanced journal entry. Total Debits ($${adj.totalDebit}) do not equal Total Credits ($${adj.totalCredit}).`
            };
        }
        adj.status = 'APPROVED';
        adj.approvedAt = new Date().toISOString();
        adj.approvedBy = approvedBy;
        auditTrail.record('USER_FINANCE_LEAD', 'JOURNAL_APPROVED', `Journal adjustment ${adj.adjustmentNumber} approved by ${approvedBy}. Ready for direct ERP bi-directional sync.`, {
            adjustmentId: id,
            adjustmentNumber: adj.adjustmentNumber,
            approvedBy,
            targetERP: adj.targetERP
        });
        return { success: true, adjustment: adj };
    }
    commitToERP(id, targetERP = 'QUICKBOOKS') {
        const adj = this.adjustments.get(id);
        if (!adj) {
            return { success: false, error: `Adjustment ${id} not found.` };
        }
        if (adj.status !== 'APPROVED') {
            return {
                success: false,
                error: `Adjustment ${id} must be in APPROVED status before committing to ${targetERP}. Current status: ${adj.status}.`
            };
        }
        const erpPostedId = `${targetERP.substring(0, 2)}_JE_${Date.now()}`;
        adj.status = 'POSTED';
        adj.targetERP = targetERP;
        adj.erpPostedId = erpPostedId;
        // Synchronize bi-directionally to ERP ledger
        MOCK_ERP_JOURNAL_ENTRIES.push({
            id: erpPostedId,
            entryNumber: adj.adjustmentNumber,
            date: adj.date,
            memo: adj.memo,
            lines: adj.lines,
            status: 'POSTED',
            sourceSystem: targetERP,
            externalReference: adj.reference,
            createdAt: new Date().toISOString()
        });
        auditTrail.record('SYSTEM', 'ERP_SYNCED', `Journal adjustment ${adj.adjustmentNumber} successfully synchronized with ${targetERP} as ${erpPostedId}.`, {
            adjustmentId: id,
            adjustmentNumber: adj.adjustmentNumber,
            targetERP,
            erpPostedId
        });
        return { success: true, adjustment: adj, erpPostedId };
    }
    getAdjustment(id) {
        return this.adjustments.get(id);
    }
    listAdjustments() {
        return Array.from(this.adjustments.values());
    }
}
export const journalService = new JournalAdjustmentService();
//# sourceMappingURL=journal-generator.js.map