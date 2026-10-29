export type Currency = 'USD' | 'EUR' | 'GBP';
export interface StripeTransaction {
    id: string;
    created: string;
    amountGross: number;
    amountFee: number;
    amountNet: number;
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
    amount: number;
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
    date: string;
    amount: number;
    description: string;
    name: string;
    category: string[];
    pending: boolean;
    matchReference?: string;
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
export type AnomalyType = 'FEE_MISMATCH' | 'UNRECORDED_CHARGEBACK' | 'TIMING_DIFFERENCE' | 'UNMATCHED_DEPOSIT' | 'MISSING_LEDGER_ENTRY' | 'REVENUE_LEAKAGE';
export type AnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export interface Anomaly {
    id: string;
    type: AnomalyType;
    severity: AnomalySeverity;
    title: string;
    description: string;
    discrepancyAmount: number;
    matchedProcessorFee?: number;
    confidenceScore: number;
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
    period: string;
    generatedAt: string;
    currency: Currency;
    materialityThreshold: number;
    providerStatus: Record<ProviderName, ProviderStatus>;
    summary: {
        recognizedRevenue: number | null;
        stripeGrossVolume: number | null;
        stripeProcessingFees: number | null;
        stripeNetDeposits: number | null;
        plaidBankDeposits: number | null;
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
    action: 'RECONCILIATION_RUN' | 'VARIANCE_DETECTED' | 'ANOMALY_FLAGGED' | 'JOURNAL_DRAFTED' | 'JOURNAL_APPROVED' | 'JOURNAL_REJECTED' | 'ERP_SYNCED';
    actor: 'AI_AGENT_CLAUDE' | 'AI_AGENT_CHATGPT' | 'BACKGROUND_CRON' | 'USER_FINANCE_LEAD' | 'SYSTEM';
    details: string;
    evidence: Record<string, unknown>;
    previousHash: string;
    currentHash: string;
}
