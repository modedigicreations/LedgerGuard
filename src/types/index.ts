// A plain ISO 4217 code (e.g. "USD", "NGN", "AUD"), not a closed
// enum — Paddle alone supports 30+ currencies, and more gateways with
// more markets (Square, PayPal, Braintree) are still to come. An earlier
// version of this type enumerated just the currencies each gateway
// happened to need as it was added (USD/EUR/GBP, then NGN/GHS/ZAR/KES
// for PayStack); that doesn't scale, and worse, every mapping site cast
// the gateway's raw currency string into that union with `as Currency`,
// which gave zero actual runtime safety — any code not in the union
// would still have been silently mistyped rather than caught. Widening
// to `string` is the honest fix: nothing here was ever really validated
// against a closed set, so nothing is lost by saying so in the type.
// Mixed-currency reconciliation math (converting a PayStack NGN
// transaction into the same report as a Stripe USD one) is explicitly
// out of scope here — see VarianceReport.currency's own comment.
export type Currency = string;

// Provider-agnostic shape every raw-processor payment gateway (Stripe,
// PayStack, Square, Braintree, ...) reports through — a single charge or
// refund with its gross/fee/net split. Already generic in its field
// names; the PaymentGatewayAdapter registry (src/datasources/gateways/)
// is what maps a specific provider's own API response onto this shape.
export interface GatewayTransaction {
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

export interface GatewayPayout {
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

export type ProviderName = 'STRIPE' | 'CHARGEBEE' | 'PLAID' | 'QUICKBOOKS' | 'PAYSTACK' | 'PADDLE';
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

// What every "raw processor" payment gateway's adapter implements
// (src/datasources/gateways/*.ts), dispatched through the registry in
// src/datasources/gateways/registry.ts. Only STRIPE has an adapter so
// far (Phase C proves the pattern with the one gateway already built);
// PayStack/Paddle/Braintree/Square/PayPal each get their own adapter
// file as they're built, with no change needed here or in
// LiveDataSource/MockDataSource beyond adding their registry entry.
export interface PaymentGatewayAdapter {
  getTransactions(apiKey: string, range: DateRange): Promise<GatewayTransaction[]>;
  getPayouts(apiKey: string, range: DateRange): Promise<GatewayPayout[]>;
}

export interface VarianceReport {
  reportId: string;
  period: string; // e.g. "2026-09" or "2026-09-01 to 2026-09-30"
  generatedAt: string;
  // The summary math below (recognizedRevenue, stripeGrossVolume, etc.)
  // is still Stripe+Chargebee-specific and assumes this one currency —
  // reconciling a NGN PayStack balance against a USD Chargebee invoice
  // in the same totals would need real FX conversion, not implemented
  // here. A connected PayStack account's own transactions/payouts are
  // still honestly reported in their own currency wherever they're read
  // directly (GatewayTransaction/GatewayPayout.currency), just not
  // folded into this report's single-currency summary yet.
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
