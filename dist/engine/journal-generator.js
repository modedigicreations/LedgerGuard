import { MOCK_ERP_JOURNAL_ENTRIES } from '../data/mock-data.js';
import { auditTrail } from './audit-trail.js';
import { pool } from '../db/pool.js';
function rowToAdjustment(row) {
    return {
        id: row.id,
        adjustmentNumber: row.adjustment_number,
        anomalyId: row.anomaly_id ?? undefined,
        reference: row.reference,
        date: row.date.toISOString().split('T')[0],
        memo: row.memo,
        lines: row.lines,
        totalDebit: Number(row.total_debit),
        totalCredit: Number(row.total_credit),
        isBalanced: row.is_balanced,
        status: row.status,
        targetERP: row.target_erp,
        createdAt: row.created_at.toISOString(),
        approvedAt: row.approved_at?.toISOString(),
        approvedBy: row.approved_by ?? undefined,
        erpPostedId: row.erp_posted_id ?? undefined,
    };
}
class JournalAdjustmentService {
    async createDraftFromAnomaly(anomalyId, actor = 'AI_AGENT_CLAUDE') {
        const { rows } = await pool.query(`SELECT * FROM journal_adjustments WHERE anomaly_id = $1 AND status IN ('DRAFT', 'APPROVED') LIMIT 1`, [anomalyId]);
        if (rows.length > 0)
            return rowToAdjustment(rows[0]);
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
                    debit: 536.8,
                    credit: 0.0,
                    description: 'Stripe fee omitted on invoice cb_inv_sep_003',
                },
                {
                    accountCode: '1010',
                    accountName: 'Cash — Operating (Chase 4091)',
                    debit: 0.0,
                    credit: 536.8,
                    description: 'Correct overstated cash balance to match Plaid bank statement',
                },
            ];
        }
        else if (anomalyId === 'anom_chargeback_002') {
            reference = 'ADJ-CB-2026-09';
            memo = 'Adjusting Entry: Record Veloce Logistics chargeback dispute clawback and administrative fee';
            lines = [
                {
                    accountCode: '1250',
                    accountName: 'Allowance for Disputed Accounts & Chargebacks',
                    debit: 1200.0,
                    credit: 0.0,
                    description: 'Reserve for customer dispute on ch_stripe_sep_005',
                },
                {
                    accountCode: '6035',
                    accountName: 'Merchant Dispute & Regulatory Surcharges',
                    debit: 15.0,
                    credit: 0.0,
                    description: 'Stripe $15 dispute assessment fee',
                },
                {
                    accountCode: '1010',
                    accountName: 'Cash — Operating (Chase 4091)',
                    debit: 0.0,
                    credit: 50.1,
                    description: 'Net bank deduction from Plaid settlement Sept 27',
                },
                {
                    accountCode: '1200',
                    accountName: 'Undeposited Funds / Stripe Clearing',
                    debit: 0.0,
                    credit: 1164.9,
                    description: 'Reverse clearing asset balance',
                },
            ];
        }
        else {
            reference = `ADJ-${Date.now()}`;
            memo = `General adjusting entry for anomaly ${anomalyId}`;
            lines = [
                { accountCode: '6030', accountName: 'Payment Processing Fees', debit: 250.0, credit: 0.0 },
                { accountCode: '1010', accountName: 'Cash — Operating (Chase 4091)', debit: 0.0, credit: 250.0 },
            ];
        }
        return this.draftAdjustment({ anomalyId, reference, memo, date: '2026-09-30', lines }, actor);
    }
    async draftAdjustment(req, actor = 'AI_AGENT_CLAUDE') {
        const totalDebit = Number(req.lines.reduce((sum, l) => sum + (l.debit || 0), 0).toFixed(2));
        const totalCredit = Number(req.lines.reduce((sum, l) => sum + (l.credit || 0), 0).toFixed(2));
        const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001;
        const id = `adj_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const adjustmentNumber = `LG-JE-${Date.now().toString().slice(-6)}`;
        const date = req.date || new Date().toISOString().split('T')[0];
        const createdAt = new Date().toISOString();
        await pool.query(`INSERT INTO journal_adjustments
			 (id, adjustment_number, anomaly_id, reference, date, memo, lines, total_debit, total_credit, is_balanced, status, target_erp, created_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'DRAFT', 'QUICKBOOKS', $11)`, [id, adjustmentNumber, req.anomalyId ?? null, req.reference, date, req.memo, JSON.stringify(req.lines), totalDebit, totalCredit, isBalanced, createdAt]);
        await auditTrail.record(actor, 'JOURNAL_DRAFTED', `Dual-entry adjustment ${adjustmentNumber} drafted ($${totalDebit.toFixed(2)} Debits / $${totalCredit.toFixed(2)} Credits). Balanced: ${isBalanced}.`, { adjustmentId: id, adjustmentNumber, isBalanced, totalDebit, linesCount: req.lines.length });
        return {
            id,
            adjustmentNumber,
            anomalyId: req.anomalyId,
            reference: req.reference,
            date,
            memo: req.memo,
            lines: req.lines,
            totalDebit,
            totalCredit,
            isBalanced,
            status: 'DRAFT',
            targetERP: 'QUICKBOOKS',
            createdAt,
        };
    }
    async approveAdjustment(id, approvedBy = 'Fractional CFO / Finance Lead') {
        const { rows } = await pool.query('SELECT * FROM journal_adjustments WHERE id = $1', [id]);
        if (rows.length === 0) {
            return { success: false, error: `Adjustment ${id} not found.` };
        }
        const adj = rowToAdjustment(rows[0]);
        if (!adj.isBalanced) {
            return {
                success: false,
                error: `Cannot approve unbalanced journal entry. Total Debits ($${adj.totalDebit}) do not equal Total Credits ($${adj.totalCredit}).`,
            };
        }
        const approvedAt = new Date().toISOString();
        await pool.query(`UPDATE journal_adjustments SET status = 'APPROVED', approved_at = $1, approved_by = $2 WHERE id = $3`, [approvedAt, approvedBy, id]);
        await auditTrail.record('USER_FINANCE_LEAD', 'JOURNAL_APPROVED', `Journal adjustment ${adj.adjustmentNumber} approved by ${approvedBy}. Ready for direct ERP bi-directional sync.`, { adjustmentId: id, adjustmentNumber: adj.adjustmentNumber, approvedBy, targetERP: adj.targetERP });
        return { success: true, adjustment: { ...adj, status: 'APPROVED', approvedAt, approvedBy } };
    }
    async commitToERP(id, targetERP = 'QUICKBOOKS') {
        const { rows } = await pool.query('SELECT * FROM journal_adjustments WHERE id = $1', [id]);
        if (rows.length === 0) {
            return { success: false, error: `Adjustment ${id} not found.` };
        }
        const adj = rowToAdjustment(rows[0]);
        if (adj.status !== 'APPROVED') {
            return {
                success: false,
                error: `Adjustment ${id} must be in APPROVED status before committing to ${targetERP}. Current status: ${adj.status}.`,
            };
        }
        // TODO(Phase 4): replace with a real QuickBooks Online JournalEntry
        // post. Until then this fakes the sync the same way the in-memory
        // version did, including mutating the mock ERP ledger the
        // reconciler still reads from (Phase 1 replaces that data source).
        const erpPostedId = `${targetERP.substring(0, 2)}_JE_${Date.now()}`;
        await pool.query(`UPDATE journal_adjustments SET status = 'POSTED', target_erp = $1, erp_posted_id = $2 WHERE id = $3`, [targetERP, erpPostedId, id]);
        MOCK_ERP_JOURNAL_ENTRIES.push({
            id: erpPostedId,
            entryNumber: adj.adjustmentNumber,
            date: adj.date,
            memo: adj.memo,
            lines: adj.lines,
            status: 'POSTED',
            sourceSystem: targetERP,
            externalReference: adj.reference,
            createdAt: new Date().toISOString(),
        });
        await auditTrail.record('SYSTEM', 'ERP_SYNCED', `Journal adjustment ${adj.adjustmentNumber} successfully synchronized with ${targetERP} as ${erpPostedId}.`, { adjustmentId: id, adjustmentNumber: adj.adjustmentNumber, targetERP, erpPostedId });
        return { success: true, adjustment: { ...adj, status: 'POSTED', targetERP, erpPostedId }, erpPostedId };
    }
    async getAdjustment(id) {
        const { rows } = await pool.query('SELECT * FROM journal_adjustments WHERE id = $1', [id]);
        return rows.length > 0 ? rowToAdjustment(rows[0]) : undefined;
    }
    async listAdjustments() {
        const { rows } = await pool.query('SELECT * FROM journal_adjustments ORDER BY created_at ASC');
        return rows.map(rowToAdjustment);
    }
    // Only a DRAFT can be deleted — once something is APPROVED or POSTED,
    // removing it would mean the audit trail references an adjustment that
    // no longer exists, which defeats the point of keeping that trail.
    async deleteAdjustment(id) {
        const { rows } = await pool.query('SELECT * FROM journal_adjustments WHERE id = $1', [id]);
        if (rows.length === 0) {
            return { success: false, error: `Adjustment ${id} not found.` };
        }
        const adj = rowToAdjustment(rows[0]);
        if (adj.status !== 'DRAFT') {
            return { success: false, error: `Only a DRAFT adjustment can be deleted. Current status: ${adj.status}.` };
        }
        await pool.query('DELETE FROM journal_adjustments WHERE id = $1', [id]);
        await auditTrail.record('USER_FINANCE_LEAD', 'JOURNAL_REJECTED', `Draft adjustment ${adj.adjustmentNumber} deleted before approval.`, { adjustmentId: id, adjustmentNumber: adj.adjustmentNumber });
        return { success: true };
    }
}
export const journalService = new JournalAdjustmentService();
// Seeds one drafted adjustment for the demo's known fee-mismatch anomaly,
// so the dashboard doesn't start out empty. Call once at server boot,
// after migrations — not from the constructor, since seeding needs the DB
// and constructors can't await.
export async function seedDemoData() {
    await journalService.createDraftFromAnomaly('anom_fee_mismatch_001', 'SYSTEM');
}
//# sourceMappingURL=journal-generator.js.map