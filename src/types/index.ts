export type Currency = 'USD' | 'EUR' | 'GBP';

export interface StripeTransaction {
  id: string;
  created: string; // ISO date
  amountGross: number; // in dollars (e.g. 500.00)
  amountFee: number; // in dollars (e.g. 14.80)
  amountNet: number; // in dollars (e.g. 485.20)
  currency: Currency;
  type: 'charge' | 'refund' | 'dispute' | 'adjustment';
  status: 'succeeded' | 'pending' | 'failed';
  customerId: string;
  customerName: string;
  payoutId?: string;
  description: string;
}

export interface StripePayout {
  id: string;
  created: string;
  arrivalDate: string;
  amount: number; // net payout amount deposited
  currency: Currency;
  status: 'paid' | 'pending' | 'in_transit' | 'canceled';
  destinationBankLast4: string;
  chargeCount: number;
  totalGross: number;
  totalFees: number;
}

export interface ChargebeeInvoice {
  id: string;
  date: string;
  periodStart: string;
  periodEnd: string;
  customerId: string;
  customerName: string;
  subtotal: number;
  tax: number;
  totalRecognizedRevenue: number;
  paymentStatus: 'paid' | 'payment_due' | 'not_paid' | 'voided';
  stripeChargeId?: string;
}

export interface PlaidBankTransaction {
  id: string;
  accountId: string;
  date: string; // Settlement date
  amount: number; // positive = credit/deposit, negative = debit/withdrawal
  description: string;
  name: string;
  category: string[];
  pending: boolean;
  matchReference?: string; // e.g. Stripe Payout ID
}

export interface ERPJournalLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface ERPJournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  memo: string;
  lines: ERPJournalLine[];
  status: 'DRAFT' | 'POSTED' | 'VOID';
  sourceSystem: 'QUICKBOOKS' | 'NETSUITE' | 'XERO' | 'LEDGERGUARD';
  externalReference?: string;
  createdAt: string;
}

export type AnomalyType = 
  | 'FEE_MISMATCH'
  | 'UNRECORDED_CHARGEBACK'
  | 'TIMING_DIFFERENCE'
  | 'UNMATCHED_DEPOSIT'
  | 'MISSING_LEDGER_ENTRY'
  | 'REVENUE_LEAKAGE';

export type AnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  title: string;
  description: string;
  discrepancyAmount: number;
  matchedProcessorFee?: number;
  confidenceScore: number; // 0.0 - 1.0
  period: string;
  affectedEntities: {
    stripeChargeId?: string;
    stripePayoutId?: string;
    plaidTransactionId?: string;
    invoiceId?: string;
    erpEntryNumber?: string;
  };
  suggestedAction: string;
  timestamp: string;
}

export type ProviderName = 'STRIPE' | 'CHARGEBEE' | 'PLAID' | 'QUICKBOOKS';
export type ProviderStatus = 'CONNECTED' | 'NOT_CONFIGURED' | 'ERROR';

export interface ProviderResult<T> {
  status: ProviderStatus;
  data: T[];
  error?: string;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface VarianceReport {
  reportId: string;
  period: string; // e.g. "2026-09" or "2026-09-01 to 2026-09-30"
  generatedAt: string;
  currency: Currency;
  materialityThreshold: number; // e.g. $250.00
  // Per-provider connection state for this report. A metric fed by a
  // provider that isn't CONNECTED is reported as null below — never
  // silently backfilled with $0 or fabricated data.
  providerStatus: Record<ProviderName, ProviderStatus>;
  summary: {
    recognizedRevenue: number | null;
    stripeGrossVolume: number | null;
    stripeProcessingFees: number | null;
    stripeNetDeposits: number | null;
    plaidBankDeposits: number | null;
    // Net Debit - Credit summed across accounts 1010 (Cash) and 6030 (Fees)
    // on posted ERP entries for the period — NOT revenue. The mock ledger
    // here never posts to a revenue account (4010), so there's nothing
    // honestly callable "ERP posted revenue" to compute; this field used to
    // be named that despite summing a cash/expense total, which is not a
    // meaningful "revenue" figure under any accounting definition.
    erpRecordedCashAndFees: number | null;
    totalVariance: number | null;
    variancePercentage: number | null;
    reconciliationStatus: 'RECONCILED' | 'VARIANCE_DETECTED' | 'MATERIAL_DRIFT' | 'INCOMPLETE_DATA';
  };
  metrics: {
    totalTransactionsAudited: number;
    matchedTransactionsCount: number;
    anomaliesCount: number;
    materialDiscrepanciesCount: number;
    unmatchedFeesTotal: number;
  };
  anomalies: Anomaly[];
}

export interface JournalAdjustmentRequest {
  anomalyId?: string;
  reference: string;
  memo: string;
  date: string;
  lines: ERPJournalLine[];
}

export interface JournalAdjustment {
  id: string;
  adjustmentNumber: string;
  anomalyId?: string;
  reference: string;
  date: string;
  memo: string;
  lines: ERPJournalLine[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  status: 'DRAFT' | 'APPROVED' | 'POSTED' | 'REJECTED';
  targetERP: 'QUICKBOOKS' | 'NETSUITE' | 'XERO';
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  erpPostedId?: string;
}

export interface AuditTrailEntry {
  sequence: number;
  timestamp: string;
  action: 
    | 'RECONCILIATION_RUN'
    | 'VARIANCE_DETECTED'
    | 'ANOMALY_FLAGGED'
    | 'JOURNAL_DRAFTED'
    | 'JOURNAL_APPROVED'
    | 'JOURNAL_REJECTED'
    | 'ERP_SYNCED';
  actor: 'AI_AGENT_CLAUDE' | 'AI_AGENT_CHATGPT' | 'BACKGROUND_CRON' | 'USER_FINANCE_LEAD' | 'SYSTEM';
  details: string;
  evidence: Record<string, unknown>;
  previousHash: string;
  currentHash: string;
}
