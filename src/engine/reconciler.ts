import {
  VarianceReport,
  Anomaly,
  AnomalySeverity,
  ChargebeeInvoice,
  GatewayTransaction,
  GatewayPayout,
  ProviderResult,
  ProviderName,
  ProviderStatus
} from '../types/index.js';
import {
  MOCK_STRIPE_TRANSACTIONS,
  MOCK_STRIPE_PAYOUTS,
  MOCK_ERP_JOURNAL_ENTRIES
} from '../data/mock-data.js';
import { getAuditTrailFor } from './audit-trail.js';
import { FinancialDataSource, periodToDateRange } from '../datasources/types.js';
import { MockDataSource } from '../datasources/mock.js';
import { LiveDataSource } from '../datasources/live.js';

export interface AuditOptions {
  period?: string; // e.g. "2026-09"
  minDiscrepancy?: number; // threshold e.g. $250.00
  matchProcessorFees?: boolean;
  actor?: 'AI_AGENT_CLAUDE' | 'AI_AGENT_CHATGPT' | 'BACKGROUND_CRON' | 'USER_FINANCE_LEAD';
}

export class ReconciliationEngine {
  constructor(private readonly userId: string, private readonly dataSource: FinancialDataSource) {}

  public async runAudit(options: AuditOptions = {}): Promise<VarianceReport> {
    const period = options.period || '2026-09';
    const minDiscrepancy = options.minDiscrepancy !== undefined ? options.minDiscrepancy : 250.00;
    const matchFees = options.matchProcessorFees !== false;
    const actor = options.actor || 'SYSTEM';
    const range = periodToDateRange(period);

    const [chargebeeResult, stripeTxResult, stripePayoutResult, plaidResult, qboResult, paystackTxResult, paddleTxResult, braintreeTxResult] = await Promise.all([
      this.dataSource.getChargebeeInvoices(range),
      this.dataSource.getGatewayTransactions('STRIPE', range),
      this.dataSource.getGatewayPayouts('STRIPE', range),
      this.dataSource.getPlaidTransactions(range),
      this.dataSource.getQBOJournalEntries(range),
      // Fetched for an honest providerStatus entry only — PayStack/Paddle/
      // Braintree aren't folded into this report's USD-denominated summary
      // math yet (see VarianceReport.currency's comment), same as Plaid/
      // QuickBooks already being fetched here without feeding the dollar
      // totals. Transactions only, never payouts — Paddle's and
      // Braintree's getPayouts() both throw by design (see their own
      // comments), since neither has a synchronous payout list endpoint
      // to call here.
      this.dataSource.getGatewayTransactions('PAYSTACK', range),
      this.dataSource.getGatewayTransactions('PADDLE', range),
      this.dataSource.getGatewayTransactions('BRAINTREE', range)
    ]);

    const providerStatus: Record<ProviderName, ProviderStatus> = {
      CHARGEBEE: chargebeeResult.status,
      STRIPE: stripeTxResult.status === 'CONNECTED' && stripePayoutResult.status === 'CONNECTED'
        ? 'CONNECTED'
        : stripeTxResult.status === 'ERROR' || stripePayoutResult.status === 'ERROR'
          ? 'ERROR'
          : 'NOT_CONFIGURED',
      PLAID: plaidResult.status,
      QUICKBOOKS: qboResult.status,
      PAYSTACK: paystackTxResult.status,
      PADDLE: paddleTxResult.status,
      BRAINTREE: braintreeTxResult.status
    };

    // 1. Recognized Revenue from Billing (Chargebee). null, not $0, when
    // Chargebee isn't connected — a missing provider must never look like
    // "zero revenue this period."
    const recognizedRevenue = chargebeeResult.status === 'CONNECTED'
      ? chargebeeResult.data.reduce((sum, inv) => sum + inv.totalRecognizedRevenue, 0)
      : null;

    // 2. Stripe Gross Volume & Processing Fees.
    let stripeGrossVolume: number | null = null;
    let stripeProcessingFees: number | null = null;
    if (stripeTxResult.status === 'CONNECTED') {
      stripeGrossVolume = 0;
      stripeProcessingFees = 0;
      for (const tx of stripeTxResult.data) {
        stripeGrossVolume += tx.amountGross;
        stripeProcessingFees += tx.amountFee;
      }
    }

    // 3. Stripe Net Deposits settled within the period (paid payouts only).
    const stripeNetDeposits = stripePayoutResult.status === 'CONNECTED'
      ? stripePayoutResult.data
          .filter(p => p.status === 'paid')
          .reduce((sum, p) => sum + p.amount, 0)
      : null;

    // 4. Plaid Bank Feed settled deposits.
    const plaidBankDeposits = plaidResult.status === 'CONNECTED'
      ? plaidResult.data.reduce((sum, tx) => sum + tx.amount, 0)
      : null;

    // 5. ERP Recorded Cash & Fees from posted journal entries.
    let erpRecordedCashAndFees: number | null = null;
    if (qboResult.status === 'CONNECTED') {
      erpRecordedCashAndFees = 0;
      for (const je of qboResult.data) {
        if (je.status !== 'POSTED') continue;
        for (const line of je.lines) {
          if (line.accountCode === '1010' || line.accountCode === '6030') {
            erpRecordedCashAndFees += (line.debit - line.credit);
          }
        }
      }
    }

    // 6. Detect Anomalies & Discrepancies.
    //
    // This logic is still the fixed September 2026 demo scenario — it
    // matches specific mock record IDs (Phase 2 replaces it with real
    // cross-provider detection: fuzzy amount/date matching against
    // whatever Stripe/Plaid/QuickBooks actually return). It must only run
    // against the mock data source: running it against LiveDataSource
    // would mean a real, connected account could get back fabricated
    // September anomalies just because the requested period happens to
    // be "2026-09" — exactly what the period-scoping fix earlier this
    // project was about preventing.
    const detectedAnomalies: Anomaly[] = this.dataSource instanceof MockDataSource
      ? detectMockAnomalies(period, minDiscrepancy, matchFees)
      : detectLiveAnomalies(chargebeeResult, stripeTxResult, stripePayoutResult, period);

    // Filter anomalies by minDiscrepancy
    const filteredAnomalies = detectedAnomalies.filter(a => a.discrepancyAmount >= minDiscrepancy);

    // Total variance between Recognized Revenue and Net Deposits — only
    // meaningful once both sides of the comparison actually have data.
    const haveCoreData = recognizedRevenue !== null && stripeNetDeposits !== null;
    const totalVariance = haveCoreData ? Math.abs(recognizedRevenue! - stripeNetDeposits!) : null;
    const variancePercentage = haveCoreData
      ? Number(((totalVariance! / (recognizedRevenue! || 1)) * 100).toFixed(2))
      : null;

    let reconciliationStatus: VarianceReport['summary']['reconciliationStatus'];
    if (!haveCoreData) {
      reconciliationStatus = 'INCOMPLETE_DATA';
    } else if (filteredAnomalies.some(a => a.severity === 'CRITICAL' || a.severity === 'HIGH')) {
      reconciliationStatus = 'MATERIAL_DRIFT';
    } else if (filteredAnomalies.length > 0) {
      reconciliationStatus = 'VARIANCE_DETECTED';
    } else {
      reconciliationStatus = 'RECONCILED';
    }

    const report: VarianceReport = {
      reportId: `var_rep_${period.replace(/-/g, '')}_${Date.now()}`,
      period,
      generatedAt: new Date().toISOString(),
      currency: 'USD',
      materialityThreshold: minDiscrepancy,
      providerStatus,
      summary: {
        recognizedRevenue,
        stripeGrossVolume,
        stripeProcessingFees,
        stripeNetDeposits,
        plaidBankDeposits,
        erpRecordedCashAndFees,
        totalVariance,
        variancePercentage,
        reconciliationStatus
      },
      metrics: {
        totalTransactionsAudited: stripeTxResult.data.length + plaidResult.data.length + chargebeeResult.data.length,
        matchedTransactionsCount: Math.max(chargebeeResult.data.length - filteredAnomalies.length, 0),
        anomaliesCount: detectedAnomalies.length,
        materialDiscrepanciesCount: filteredAnomalies.length,
        unmatchedFeesTotal: filteredAnomalies.reduce((sum, a) => sum + (a.matchedProcessorFee || 0), 0)
      },
      anomalies: filteredAnomalies
    };

    // Log to immutable GAAP audit trail
    await getAuditTrailFor(this.userId).record(
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

// The original hardcoded demo-scenario anomaly checks, unchanged from
// before the DataSource refactor — still reading the mock arrays
// directly, since they're tied to specific fixture record IDs rather
// than general cross-provider matching. See the comment at the call site
// in runAudit() for why this only ever runs against MockDataSource.
function detectMockAnomalies(period: string, minDiscrepancy: number, matchFees: boolean): Anomaly[] {
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

  return detectedAnomalies;
}

function fmtUsd(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

// Fixed dollar-magnitude bands, not scaled to minDiscrepancy (a
// user-configurable filter threshold, not a severity scale) — a $6,000
// discrepancy is CRITICAL regardless of whether the audit was run with a
// $50 or $500 materiality threshold.
function severityFor(amount: number): AnomalySeverity {
  const abs = Math.abs(amount);
  if (abs >= 5000) return 'CRITICAL';
  if (abs >= 1000) return 'HIGH';
  if (abs >= 250) return 'MEDIUM';
  return 'LOW';
}

// Real cross-provider anomaly detection, replacing the fixed September
// 2026 demo scenario above for any actual connected account. Scoped
// deliberately to the Chargebee+Stripe pairing only — that's the one
// pairing this report's summary math already treats as USD-denominated
// (see VarianceReport.currency's comment); PayStack/Paddle/Braintree
// aren't folded in here for the same reason they aren't folded into the
// dollar totals. Returns nothing when either side isn't actually
// connected — there's nothing honest to cross-reference otherwise.
export function detectLiveAnomalies(
  chargebeeResult: ProviderResult<ChargebeeInvoice>,
  stripeTxResult: ProviderResult<GatewayTransaction>,
  stripePayoutResult: ProviderResult<GatewayPayout>,
  period: string,
): Anomaly[] {
  if (chargebeeResult.status !== 'CONNECTED' || stripeTxResult.status !== 'CONNECTED') {
    return [];
  }

  const anomalies: Anomaly[] = [];
  const invoices = chargebeeResult.data;
  const transactions = stripeTxResult.data;
  const txById = new Map(transactions.map((tx) => [tx.id, tx]));
  const matchedTxIds = new Set<string>();

  for (const invoice of invoices) {
    if (!invoice.stripeChargeId) continue; // nothing on the Stripe side to cross-check against
    const tx = txById.get(invoice.stripeChargeId);

    if (!tx) {
      // Chargebee claims this invoice was paid via a specific Stripe
      // charge, but that charge doesn't appear anywhere in Stripe's own
      // data for this period — could be a wrong/stale charge ID, or the
      // charge happened outside the requested date range.
      anomalies.push({
        id: `anom_missing_stripe_${invoice.id}`,
        type: 'MISSING_LEDGER_ENTRY',
        severity: severityFor(invoice.totalRecognizedRevenue),
        title: 'Chargebee invoice references a Stripe charge not found in this period',
        description: `Invoice ${invoice.id} (${fmtUsd(invoice.totalRecognizedRevenue)}) references Stripe charge ${invoice.stripeChargeId}, but no matching transaction was found in Stripe's data for ${period}.`,
        discrepancyAmount: invoice.totalRecognizedRevenue,
        confidenceScore: 0.85,
        period,
        affectedEntities: { invoiceId: invoice.id, stripeChargeId: invoice.stripeChargeId },
        suggestedAction: 'Verify the Stripe charge ID is correct and occurred within this period, or confirm the invoice was actually paid.',
        timestamp: new Date().toISOString(),
      });
      continue;
    }

    matchedTxIds.add(tx.id);
    const discrepancy = Number(Math.abs(invoice.totalRecognizedRevenue - tx.amountGross).toFixed(2));
    if (discrepancy > 0.01) {
      anomalies.push({
        id: `anom_fee_mismatch_${invoice.id}`,
        type: 'FEE_MISMATCH',
        severity: severityFor(discrepancy),
        title: "Recognized revenue doesn't match the matching Stripe charge",
        description: `Invoice ${invoice.id} recognized ${fmtUsd(invoice.totalRecognizedRevenue)}, but the matching Stripe charge ${tx.id} was for ${fmtUsd(tx.amountGross)} — a difference of ${fmtUsd(discrepancy)}.`,
        discrepancyAmount: discrepancy,
        matchedProcessorFee: tx.amountFee,
        confidenceScore: 0.9,
        period,
        affectedEntities: { invoiceId: invoice.id, stripeChargeId: tx.id },
        suggestedAction: 'Review for a partial refund, currency conversion, or data entry discrepancy between Chargebee and Stripe.',
        timestamp: new Date().toISOString(),
      });
    }

    if (tx.type === 'dispute') {
      anomalies.push({
        id: `anom_chargeback_${tx.id}`,
        type: 'UNRECORDED_CHARGEBACK',
        severity: 'CRITICAL',
        title: 'Disputed Stripe charge still recognized as revenue',
        description: `Stripe charge ${tx.id} (${fmtUsd(tx.amountGross)}) is disputed, but invoice ${invoice.id} still recognizes it as revenue.`,
        discrepancyAmount: tx.amountGross,
        confidenceScore: 0.9,
        period,
        affectedEntities: { invoiceId: invoice.id, stripeChargeId: tx.id },
        suggestedAction: 'Record a reserve/adjustment for the disputed amount and any dispute fee.',
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Stripe charges that succeeded but were never recognized by any
  // Chargebee invoice at all — confidence is deliberately lower than the
  // matched-pair checks above, since a standalone Stripe charge outside
  // Chargebee's billing can be entirely legitimate, not necessarily an error.
  for (const tx of transactions) {
    if (tx.status !== 'succeeded' || matchedTxIds.has(tx.id)) continue;
    anomalies.push({
      id: `anom_unmatched_stripe_${tx.id}`,
      type: 'REVENUE_LEAKAGE',
      severity: severityFor(tx.amountGross),
      title: 'Stripe charge not recognized as revenue in Chargebee',
      description: `Stripe charge ${tx.id} (${fmtUsd(tx.amountGross)}) succeeded in ${period}, but no Chargebee invoice recognizes it as revenue.`,
      discrepancyAmount: tx.amountGross,
      confidenceScore: 0.75,
      period,
      affectedEntities: { stripeChargeId: tx.id },
      suggestedAction: 'Confirm whether this charge should be reflected as recognized revenue, or whether it is intentionally outside Chargebee billing.',
      timestamp: new Date().toISOString(),
    });
  }

  // Payouts initiated this period that settle in a different one — a
  // real timing/float difference, not an error, computed directly from
  // Stripe's own payout dates rather than a hardcoded fixture.
  if (stripePayoutResult.status === 'CONNECTED') {
    for (const payout of stripePayoutResult.data) {
      const createdMonth = payout.created.slice(0, 7);
      const arrivalMonth = payout.arrivalDate.slice(0, 7);
      if (createdMonth === period && arrivalMonth !== createdMonth) {
        anomalies.push({
          id: `anom_timing_${payout.id}`,
          type: 'TIMING_DIFFERENCE',
          severity: 'MEDIUM',
          title: 'Payout initiated this period settles in a different one',
          description: `Stripe payout ${payout.id} (${fmtUsd(payout.amount)}) was initiated in ${createdMonth} but settles in ${arrivalMonth} — a timing difference between Stripe net deposits and the bank feed.`,
          discrepancyAmount: payout.amount,
          confidenceScore: 0.95,
          period,
          affectedEntities: { stripePayoutId: payout.id },
          suggestedAction: "Classify as in-transit clearing asset for this period; reverse upon next period's bank feed match.",
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  return anomalies;
}

// LEDGERGUARD_DATA_MODE=live selects real provider APIs, scoped to
// whichever user this engine is built for (Railway's deployment sets
// this); anything else (including local dev with no env vars at all)
// defaults to the fixed mock scenario so a fresh checkout still runs
// without any credentials — MockDataSource never touches userId at all.
export function getReconcilerFor(userId: string): ReconciliationEngine {
  const dataSource =
    process.env.LEDGERGUARD_DATA_MODE === 'live' ? new LiveDataSource(userId) : new MockDataSource();
  return new ReconciliationEngine(userId, dataSource);
}
