import { 
  VarianceReport, 
  Anomaly, 
  AnomalyType, 
  AnomalySeverity 
} from '../types/index.js';
import { 
  MOCK_CHARGEBEE_INVOICES, 
  MOCK_STRIPE_TRANSACTIONS, 
  MOCK_STRIPE_PAYOUTS, 
  MOCK_PLAID_TRANSACTIONS, 
  MOCK_ERP_JOURNAL_ENTRIES 
} from '../data/mock-data.js';
import { auditTrail } from './audit-trail.js';

export interface AuditOptions {
  period?: string; // e.g. "2026-09"
  minDiscrepancy?: number; // threshold e.g. $250.00
  matchProcessorFees?: boolean;
  actor?: 'AI_AGENT_CLAUDE' | 'AI_AGENT_CHATGPT' | 'BACKGROUND_CRON' | 'USER_FINANCE_LEAD';
}

export class ReconciliationEngine {
  public async runAudit(options: AuditOptions = {}): Promise<VarianceReport> {
    const period = options.period || '2026-09';
    const minDiscrepancy = options.minDiscrepancy !== undefined ? options.minDiscrepancy : 250.00;
    const matchFees = options.matchProcessorFees !== false;
    const actor = options.actor || 'SYSTEM';

    // 1. Calculate Recognized Revenue from Billing (Chargebee), scoped to
    // the requested period — without this, every field below reflects
    // September's numbers no matter what period is asked for.
    const periodInvoices = MOCK_CHARGEBEE_INVOICES.filter(inv => inv.date.startsWith(period));
    const recognizedRevenue = periodInvoices.reduce(
      (sum, inv) => sum + inv.totalRecognizedRevenue,
      0
    );

    // 2. Calculate Stripe Gross Volume & Processing Fees, scoped to the
    // requested period.
    const periodStripeTx = MOCK_STRIPE_TRANSACTIONS.filter(tx => tx.created.startsWith(period));
    let stripeGrossVolume = 0;
    let stripeProcessingFees = 0;
    let stripeNetCharges = 0;

    for (const tx of periodStripeTx) {
      if (tx.type === 'charge') {
        stripeGrossVolume += tx.amountGross;
        stripeProcessingFees += tx.amountFee;
        stripeNetCharges += tx.amountNet;
      } else if (tx.type === 'dispute') {
        // Disputed amount is deducted from volume
        stripeGrossVolume += tx.amountGross; // negative (-1200)
        stripeProcessingFees += tx.amountFee; // dispute fee (+15)
        stripeNetCharges += tx.amountNet; // negative (-1215)
      } else if (tx.type === 'adjustment') {
        stripeGrossVolume += tx.amountGross;
        stripeProcessingFees += tx.amountFee;
        stripeNetCharges += tx.amountNet;
      }
    }

    // 3. Calculate Stripe Net Deposits Settled in September
    // Exclude in-transit batch 05 which settled in October
    const septemberPayouts = MOCK_STRIPE_PAYOUTS.filter(p => p.arrivalDate.startsWith(period) && p.status === 'paid');
    const stripeNetDeposits = septemberPayouts.reduce((sum, p) => sum + p.amount, 0);

    // 4. Calculate Plaid Bank Feed Settled Deposits, scoped to the
    // requested period.
    const periodPlaidTx = MOCK_PLAID_TRANSACTIONS.filter(tx => tx.date.startsWith(period));
    const plaidBankDeposits = periodPlaidTx.reduce((sum, tx) => sum + tx.amount, 0);

    // 5. Calculate ERP Recorded Cash & Fees from posted journal entries,
    // scoped to the requested period.
    let erpRecordedCash = 0;
    let erpRecordedFees = 0;
    for (const je of MOCK_ERP_JOURNAL_ENTRIES) {
      if (je.status === 'POSTED' && je.date.startsWith(period)) {
        for (const line of je.lines) {
          if (line.accountCode === '1010') { // Cash
            erpRecordedCash += (line.debit - line.credit);
          } else if (line.accountCode === '6030') { // Fees
            erpRecordedFees += (line.debit - line.credit);
          }
        }
      }
    }

    // 6. Detect Anomalies & Discrepancies
    const detectedAnomalies: Anomaly[] = [];

    // Anomaly A: Fee Mismatch in ERP Batch 2 (Fintech Hub fee omitted)
    // Batch 2 payout amount is $49,034.90, but JE-2026-09-002 debited cash for $49,571.70 (diff = $536.80)
    const batch2JE = MOCK_ERP_JOURNAL_ENTRIES.find(je => je.entryNumber === 'JE-2026-09-002');
    const batch2Payout = MOCK_STRIPE_PAYOUTS.find(p => p.id === 'po_stripe_sep_batch_02');
    const batch2CashDebit = batch2JE?.lines.find(l => l.accountCode === '1010')?.debit || 0;
    const batch2ExpectedNet = batch2Payout?.amount || 0;
    
    // Check if an adjustment has already credited Cash / debited Fee for Batch 2:
    const batch2Adjustments = MOCK_ERP_JOURNAL_ENTRIES.filter(je => 
      je.status === 'POSTED' && 
      je.entryNumber !== 'JE-2026-09-002' &&
      (je.externalReference === 'ADJ-FEE-2026-09' || je.entryNumber.startsWith('LG-JE')) &&
      je.lines.some(l => l.accountCode === '6030' && l.debit > 0)
    );
    const feeAdjustedAmount = batch2Adjustments.reduce((sum, je) => {
      const line = je.lines.find(l => l.accountCode === '6030');
      return sum + (line ? line.debit : 0);
    }, 0);

    const batch2Discrepancy = Number(((batch2CashDebit - feeAdjustedAmount) - batch2ExpectedNet).toFixed(2));
    const fintechHubFee = 536.80;

    // This anomaly is specific to Batch 2's actual settlement date — without
    // this guard, auditing any other period would still re-report it
    // (mislabeled under that period) since the lookups above aren't
    // filtered by period themselves.
    const batch2InPeriod = batch2Payout?.arrivalDate.startsWith(period) ?? false;

    if (batch2InPeriod && Math.abs(batch2Discrepancy) >= minDiscrepancy) {
      const isFeeMatch = matchFees && Math.abs(batch2Discrepancy - fintechHubFee) < 0.01;
      detectedAnomalies.push({
        id: 'anom_fee_mismatch_001',
        type: 'FEE_MISMATCH',
        severity: 'HIGH',
        title: 'Unrecorded Payment Processing Fee on Stripe Batch 2',
        description: `QuickBooks posted cash balance is overstated by $${batch2Discrepancy.toFixed(2)}. The Stripe fee of $${fintechHubFee.toFixed(2)} on invoice cb_inv_sep_003 (Fintech Hub) was excluded from JE-2026-09-002, causing cash to overstate and operating expenses to understate.`,
        discrepancyAmount: batch2Discrepancy,
        matchedProcessorFee: isFeeMatch ? fintechHubFee : undefined,
        confidenceScore: 0.98,
        period,
        affectedEntities: {
          stripeChargeId: 'ch_stripe_sep_003',
          stripePayoutId: 'po_stripe_sep_batch_02',
          invoiceId: 'cb_inv_sep_003',
          erpEntryNumber: 'JE-2026-09-002'
        },
        suggestedAction: 'Post adjusting journal entry: Debit 6030 (Payment Processing Fees) $536.80, Credit 1010 (Cash — Chase 4091) $536.80.',
        timestamp: new Date().toISOString()
      });
    }

    // Anomaly B: Unrecorded Dispute / Chargeback on Veloce Logistics
    // Stripe deducted -$1,215.00 ($1,200 chargeback + $15 dispute fee) via Batch 3.
    // Plaid recorded -$50.10 net debit, but QuickBooks has NO journal entry for Batch 3 at all!
    const isDisputeRecorded = MOCK_ERP_JOURNAL_ENTRIES.some(je =>
      je.status === 'POSTED' &&
      (je.externalReference === 'ADJ-CB-2026-09' || je.memo.includes('Veloce Logistics') || je.lines.some(l => l.accountCode === '1250'))
    );
    const disputeDiscrepancy = 1215.00;
    // Tied to the actual dispute transaction's date — same reasoning as
    // batch2InPeriod above.
    const disputeTx = MOCK_STRIPE_TRANSACTIONS.find(tx => tx.id === 'dp_stripe_sep_005_dispute');
    const disputeInPeriod = disputeTx?.created.startsWith(period) ?? false;
    if (disputeInPeriod && !isDisputeRecorded && disputeDiscrepancy >= minDiscrepancy) {
      detectedAnomalies.push({
        id: 'anom_chargeback_002',
        type: 'UNRECORDED_CHARGEBACK',
        severity: 'CRITICAL',
        title: 'Unrecorded Customer Dispute & Chargeback Reserve Leakage',
        description: `Stripe clawed back $1,200.00 for disputed transaction ch_stripe_sep_005 (Veloce Logistics) plus a $15.00 dispute administrative fee. The bank statement reflects a -$50.10 net settlement on Sept 27, but no corresponding journal entry exists in QuickBooks.`,
        discrepancyAmount: disputeDiscrepancy,
        matchedProcessorFee: 15.00,
        confidenceScore: 0.95,
        period,
        affectedEntities: {
          stripeChargeId: 'ch_stripe_sep_005',
          stripePayoutId: 'po_stripe_sep_batch_03',
          plaidTransactionId: 'plaid_tx_sep_03',
          invoiceId: 'cb_inv_sep_005'
        },
        suggestedAction: 'Post adjusting journal entry: Debit 1250 (Allowance for Disputed Accounts) $1,200.00, Debit 6035 (Dispute & Merchant Penalties) $15.00, Credit 1010 (Cash) $50.10, Credit 1200 (Stripe Clearing) $1,164.90.',
        timestamp: new Date().toISOString()
      });
    }

    // Anomaly C: Month-End Timing Difference (Float)
    // Batch 5 ($4,223.55 net) was created on Sept 30, but settles in Plaid on Oct 2.
    const monthEndFloat = 4223.55;
    // Tied to the payout's creation date (the period it was initiated in,
    // not the period it happens to settle in).
    const floatPayout = MOCK_STRIPE_PAYOUTS.find(p => p.id === 'po_stripe_sep_batch_05_float');
    const floatInPeriod = floatPayout?.created.startsWith(period) ?? false;
    if (floatInPeriod && monthEndFloat >= minDiscrepancy) {
      detectedAnomalies.push({
        id: 'anom_timing_float_003',
        type: 'TIMING_DIFFERENCE',
        severity: 'MEDIUM',
        title: 'Month-End Stripe Payout In-Transit (Float)',
        description: `Stripe payout po_stripe_sep_batch_05_float ($4,223.55 net) for Pulse Technologies was initiated Sept 30, 2026 21:40 UTC, but bank settlement date is Oct 2, 2026. This creates a temporary timing difference between Stripe net deposits and bank feed.`,
        discrepancyAmount: monthEndFloat,
        matchedProcessorFee: 126.45,
        confidenceScore: 0.99,
        period,
        affectedEntities: {
          stripeChargeId: 'ch_stripe_sep_007',
          stripePayoutId: 'po_stripe_sep_batch_05_float',
          invoiceId: 'cb_inv_sep_007'
        },
        suggestedAction: 'Classify as in-transit clearing asset. Accrue to 1200 (Undeposited Funds / Stripe Clearing) for September close; reverse upon October bank feed match.',
        timestamp: new Date().toISOString()
      });
    }

    // Minor Anomaly: FX adjustment of $42.10
    const minorFxTx = MOCK_STRIPE_TRANSACTIONS.find(tx => tx.id === 'ch_stripe_sep_minor_fee');
    const minorFxInPeriod = minorFxTx?.created.startsWith(period) ?? false;
    if (minorFxInPeriod && minDiscrepancy <= 45.00) {
      detectedAnomalies.push({
        id: 'anom_minor_fx_004',
        type: 'FEE_MISMATCH',
        severity: 'LOW',
        title: 'Cross-Border FX Conversion Surcharge',
        description: 'Cross-border transaction ch_stripe_sep_minor_fee incurred an extra $42.10 FX processing fee.',
        discrepancyAmount: 42.10,
        matchedProcessorFee: 42.10,
        confidenceScore: 0.90,
        period,
        affectedEntities: {
          stripeChargeId: 'ch_stripe_sep_minor_fee'
        },
        suggestedAction: 'Auto-reconcile to 6040 (Bank & Foreign Currency Conversion Expense).',
        timestamp: new Date().toISOString()
      });
    }

    // Filter anomalies by minDiscrepancy
    const filteredAnomalies = detectedAnomalies.filter(a => a.discrepancyAmount >= minDiscrepancy);

    // Total variance between Recognized Revenue and Net Deposits
    const totalVariance = Math.abs(recognizedRevenue - stripeNetDeposits);
    const variancePercentage = (totalVariance / (recognizedRevenue || 1)) * 100;

    let reconciliationStatus: VarianceReport['summary']['reconciliationStatus'] = 'RECONCILED';
    if (filteredAnomalies.some(a => a.severity === 'CRITICAL' || a.severity === 'HIGH')) {
      reconciliationStatus = 'MATERIAL_DRIFT';
    } else if (filteredAnomalies.length > 0) {
      reconciliationStatus = 'VARIANCE_DETECTED';
    }

    const report: VarianceReport = {
      reportId: `var_rep_${period.replace(/-/g, '')}_${Date.now()}`,
      period,
      generatedAt: new Date().toISOString(),
      currency: 'USD',
      materialityThreshold: minDiscrepancy,
      summary: {
        recognizedRevenue,
        stripeGrossVolume,
        stripeProcessingFees,
        stripeNetDeposits,
        plaidBankDeposits,
        erpRecordedCashAndFees: erpRecordedCash + erpRecordedFees,
        totalVariance,
        variancePercentage: Number(variancePercentage.toFixed(2)),
        reconciliationStatus
      },
      metrics: {
        totalTransactionsAudited: periodStripeTx.length + periodPlaidTx.length + periodInvoices.length,
        matchedTransactionsCount: periodInvoices.length - filteredAnomalies.length,
        anomaliesCount: detectedAnomalies.length,
        materialDiscrepanciesCount: filteredAnomalies.length,
        unmatchedFeesTotal: filteredAnomalies.reduce((sum, a) => sum + (a.matchedProcessorFee || 0), 0)
      },
      anomalies: filteredAnomalies
    };

    // Log to immutable GAAP audit trail
    await auditTrail.record(
      actor,
      'RECONCILIATION_RUN',
      `Audit completed for period ${period}. Found ${filteredAnomalies.length} material discrepancies (threshold: $${minDiscrepancy}). Status: ${reconciliationStatus}.`,
      {
        reportId: report.reportId,
        period,
        materialDiscrepancies: filteredAnomalies.length,
        reconciliationStatus,
        totalVariance
      }
    );

    return report;
  }
}

export const reconciler = new ReconciliationEngine();
