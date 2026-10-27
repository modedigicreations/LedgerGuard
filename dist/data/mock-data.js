export const MOCK_CHARGEBEE_INVOICES = [
    {
        id: 'cb_inv_sep_001',
        date: '2026-09-02',
        periodStart: '2026-09-01',
        periodEnd: '2026-09-30',
        customerId: 'cus_acme_corp',
        customerName: 'Acme Corporation',
        subtotal: 25000.00,
        tax: 0.00,
        totalRecognizedRevenue: 25000.00,
        paymentStatus: 'paid',
        stripeChargeId: 'ch_stripe_sep_001'
    },
    {
        id: 'cb_inv_sep_002',
        date: '2026-09-05',
        periodStart: '2026-09-01',
        periodEnd: '2026-09-30',
        customerId: 'cus_nexus_ai',
        customerName: 'Nexus AI Labs',
        subtotal: 14200.00,
        tax: 0.00,
        totalRecognizedRevenue: 14200.00,
        paymentStatus: 'paid',
        stripeChargeId: 'ch_stripe_sep_002'
    },
    {
        id: 'cb_inv_sep_003',
        date: '2026-09-12',
        periodStart: '2026-09-01',
        periodEnd: '2026-09-30',
        customerId: 'cus_fintech_hub',
        customerName: 'Fintech Hub UK',
        subtotal: 18500.00,
        tax: 0.00,
        totalRecognizedRevenue: 18500.00,
        paymentStatus: 'paid',
        stripeChargeId: 'ch_stripe_sep_003'
    },
    {
        id: 'cb_inv_sep_004',
        date: '2026-09-18',
        periodStart: '2026-09-01',
        periodEnd: '2026-09-30',
        customerId: 'cus_omni_retail',
        customerName: 'OmniRetail Global',
        subtotal: 32000.00,
        tax: 0.00,
        totalRecognizedRevenue: 32000.00,
        paymentStatus: 'paid',
        stripeChargeId: 'ch_stripe_sep_004'
    },
    {
        id: 'cb_inv_sep_005',
        date: '2026-09-22',
        periodStart: '2026-09-01',
        periodEnd: '2026-09-30',
        customerId: 'cus_disputed_client',
        customerName: 'Veloce Logistics',
        subtotal: 1200.00,
        tax: 0.00,
        totalRecognizedRevenue: 1200.00,
        paymentStatus: 'paid',
        stripeChargeId: 'ch_stripe_sep_005'
    },
    {
        id: 'cb_inv_sep_006',
        date: '2026-09-28',
        periodStart: '2026-09-01',
        periodEnd: '2026-09-30',
        customerId: 'cus_zenith_media',
        customerName: 'Zenith Media Cloud',
        subtotal: 29750.00,
        tax: 0.00,
        totalRecognizedRevenue: 29750.00,
        paymentStatus: 'paid',
        stripeChargeId: 'ch_stripe_sep_006'
    },
    {
        id: 'cb_inv_sep_007',
        date: '2026-09-30',
        periodStart: '2026-09-01',
        periodEnd: '2026-09-30',
        customerId: 'cus_pulse_tech',
        customerName: 'Pulse Technologies',
        subtotal: 4350.00,
        tax: 0.00,
        totalRecognizedRevenue: 4350.00,
        paymentStatus: 'paid',
        stripeChargeId: 'ch_stripe_sep_007'
    }
];
export const MOCK_STRIPE_TRANSACTIONS = [
    {
        id: 'ch_stripe_sep_001',
        created: '2026-09-02T10:15:00Z',
        amountGross: 25000.00,
        amountFee: 725.30,
        amountNet: 24274.70,
        currency: 'USD',
        type: 'charge',
        status: 'succeeded',
        customerId: 'cus_acme_corp',
        customerName: 'Acme Corporation',
        payoutId: 'po_stripe_sep_batch_01',
        description: 'SaaS Enterprise Annual Tier — Acme Corp'
    },
    {
        id: 'ch_stripe_sep_002',
        created: '2026-09-05T14:22:00Z',
        amountGross: 14200.00,
        amountFee: 412.10,
        amountNet: 13787.90,
        currency: 'USD',
        type: 'charge',
        status: 'succeeded',
        customerId: 'cus_nexus_ai',
        customerName: 'Nexus AI Labs',
        payoutId: 'po_stripe_sep_batch_01',
        description: 'SaaS Platform License — Nexus AI'
    },
    {
        id: 'ch_stripe_sep_003',
        created: '2026-09-12T09:00:00Z',
        amountGross: 18500.00,
        amountFee: 536.80,
        amountNet: 17963.20,
        currency: 'USD',
        type: 'charge',
        status: 'succeeded',
        customerId: 'cus_fintech_hub',
        customerName: 'Fintech Hub UK',
        payoutId: 'po_stripe_sep_batch_02',
        description: 'Enterprise Integration Cluster — Fintech Hub'
    },
    {
        id: 'ch_stripe_sep_004',
        created: '2026-09-18T16:45:00Z',
        amountGross: 32000.00,
        amountFee: 928.30,
        amountNet: 31071.70,
        currency: 'USD',
        type: 'charge',
        status: 'succeeded',
        customerId: 'cus_omni_retail',
        customerName: 'OmniRetail Global',
        payoutId: 'po_stripe_sep_batch_02',
        description: 'Scale Infrastructure License — OmniRetail'
    },
    {
        id: 'ch_stripe_sep_005',
        created: '2026-09-22T11:10:00Z',
        amountGross: 1200.00,
        amountFee: 35.10,
        amountNet: 1164.90,
        currency: 'USD',
        type: 'charge',
        status: 'succeeded',
        customerId: 'cus_disputed_client',
        customerName: 'Veloce Logistics',
        payoutId: 'po_stripe_sep_batch_03',
        description: 'Custom Reporting Addon — Veloce'
    },
    {
        id: 'dp_stripe_sep_005_dispute',
        created: '2026-09-24T18:00:00Z',
        amountGross: -1200.00,
        amountFee: 15.00, // $15 Stripe Dispute Fee
        amountNet: -1215.00,
        currency: 'USD',
        type: 'dispute',
        status: 'succeeded',
        customerId: 'cus_disputed_client',
        customerName: 'Veloce Logistics',
        payoutId: 'po_stripe_sep_batch_03',
        description: 'Dispute Chargeback Clawback + $15 Fee for ch_stripe_sep_005'
    },
    {
        id: 'ch_stripe_sep_006',
        created: '2026-09-28T13:30:00Z',
        amountGross: 29750.00,
        amountFee: 863.05,
        amountNet: 28886.95,
        currency: 'USD',
        type: 'charge',
        status: 'succeeded',
        customerId: 'cus_zenith_media',
        customerName: 'Zenith Media Cloud',
        payoutId: 'po_stripe_sep_batch_04',
        description: 'Multi-Tenant Cloud Suite — Zenith'
    },
    {
        id: 'ch_stripe_sep_minor_fee',
        created: '2026-09-29T10:00:00Z',
        amountGross: 500.00,
        amountFee: 42.10, // Non-standard micro FX fee adjustment
        amountNet: 457.90,
        currency: 'USD',
        type: 'adjustment',
        status: 'succeeded',
        customerId: 'cus_minor',
        customerName: 'Minor Cross-Border Entity',
        payoutId: 'po_stripe_sep_batch_04',
        description: 'Cross-border currency conversion settlement'
    },
    {
        id: 'ch_stripe_sep_007',
        created: '2026-09-30T21:40:00Z',
        amountGross: 4350.00,
        amountFee: 126.45,
        amountNet: 4223.55,
        currency: 'USD',
        type: 'charge',
        status: 'succeeded',
        customerId: 'cus_pulse_tech',
        customerName: 'Pulse Technologies',
        payoutId: 'po_stripe_sep_batch_05_float',
        description: 'Pulse Tech Month-End Expansion Tier'
    }
];
export const MOCK_STRIPE_PAYOUTS = [
    {
        id: 'po_stripe_sep_batch_01',
        created: '2026-09-06T00:00:00Z',
        arrivalDate: '2026-09-08',
        amount: 38062.60, // 24274.70 + 13787.90
        currency: 'USD',
        status: 'paid',
        destinationBankLast4: '4091',
        chargeCount: 2,
        totalGross: 39200.00,
        totalFees: 1137.40
    },
    {
        id: 'po_stripe_sep_batch_02',
        created: '2026-09-20T00:00:00Z',
        arrivalDate: '2026-09-22',
        amount: 49034.90, // 17963.20 + 31071.70
        currency: 'USD',
        status: 'paid',
        destinationBankLast4: '4091',
        chargeCount: 2,
        totalGross: 50500.00,
        totalFees: 1465.10
    },
    {
        id: 'po_stripe_sep_batch_03',
        created: '2026-09-25T00:00:00Z',
        arrivalDate: '2026-09-27',
        amount: -50.10, // 1164.90 net - 1215.00 dispute deduction = -$50.10 debit from Stripe reserve
        currency: 'USD',
        status: 'paid',
        destinationBankLast4: '4091',
        chargeCount: 2,
        totalGross: 0.00,
        totalFees: 50.10
    },
    {
        id: 'po_stripe_sep_batch_04',
        created: '2026-09-29T00:00:00Z',
        arrivalDate: '2026-09-30',
        amount: 29344.85, // 28886.95 + 457.90
        currency: 'USD',
        status: 'paid',
        destinationBankLast4: '4091',
        chargeCount: 2,
        totalGross: 30250.00,
        totalFees: 905.15
    },
    {
        id: 'po_stripe_sep_batch_05_float',
        created: '2026-09-30T23:59:00Z',
        arrivalDate: '2026-10-02', // Settles in October! Timing difference
        amount: 4223.55,
        currency: 'USD',
        status: 'in_transit',
        destinationBankLast4: '4091',
        chargeCount: 1,
        totalGross: 4350.00,
        totalFees: 126.45
    }
];
export const MOCK_PLAID_TRANSACTIONS = [
    {
        id: 'plaid_tx_sep_01',
        accountId: 'acc_chase_operating_4091',
        date: '2026-09-08',
        amount: 38062.60,
        description: 'STRIPE PAYOUT *po_stripe_sep_batch_01',
        name: 'Stripe Payments Deposit',
        category: ['Transfer', 'Deposit'],
        pending: false,
        matchReference: 'po_stripe_sep_batch_01'
    },
    {
        id: 'plaid_tx_sep_02',
        accountId: 'acc_chase_operating_4091',
        date: '2026-09-22',
        amount: 49034.90,
        description: 'STRIPE PAYOUT *po_stripe_sep_batch_02',
        name: 'Stripe Payments Deposit',
        category: ['Transfer', 'Deposit'],
        pending: false,
        matchReference: 'po_stripe_sep_batch_02'
    },
    {
        id: 'plaid_tx_sep_03',
        accountId: 'acc_chase_operating_4091',
        date: '2026-09-27',
        amount: -50.10,
        description: 'STRIPE DISPUTE BALANCING DEBIT *po_stripe_sep_batch_03',
        name: 'Stripe Debit Adjustment',
        category: ['Bank Fee', 'Merchant Fee'],
        pending: false,
        matchReference: 'po_stripe_sep_batch_03'
    },
    {
        id: 'plaid_tx_sep_04',
        accountId: 'acc_chase_operating_4091',
        date: '2026-09-30',
        amount: 29344.85,
        description: 'STRIPE PAYOUT *po_stripe_sep_batch_04',
        name: 'Stripe Payments Deposit',
        category: ['Transfer', 'Deposit'],
        pending: false,
        matchReference: 'po_stripe_sep_batch_04'
    }
    // Note: Batch 5 ($4,223.55) settled on Oct 2, so it is absent from September Plaid statement!
];
export const MOCK_ERP_JOURNAL_ENTRIES = [
    {
        id: 'erp_je_sep_001',
        entryNumber: 'JE-2026-09-001',
        date: '2026-09-08',
        memo: 'Stripe Payout Batch 1 Reconciliation — Sept 8',
        status: 'POSTED',
        sourceSystem: 'QUICKBOOKS',
        createdAt: '2026-09-08T18:00:00Z',
        lines: [
            { accountCode: '1010', accountName: 'Cash — Operating (Chase 4091)', debit: 38062.60, credit: 0.00 },
            { accountCode: '6030', accountName: 'Payment Processing Fees', debit: 1137.40, credit: 0.00 },
            { accountCode: '1200', accountName: 'Undeposited Funds / Stripe Clearing', debit: 0.00, credit: 39200.00 }
        ]
    },
    {
        id: 'erp_je_sep_002',
        entryNumber: 'JE-2026-09-002',
        date: '2026-09-22',
        memo: 'Stripe Payout Batch 2 Booking (INCORRECT: Omnitted Fee on Fintech Hub)',
        status: 'POSTED',
        sourceSystem: 'QUICKBOOKS',
        createdAt: '2026-09-22T19:30:00Z',
        lines: [
            // Error in QuickBooks: Junior accountant only booked $928.30 fee instead of full $1,465.10!
            // Missing $536.80 fee on Fintech Hub! Cash debited incorrectly as $49,571.70 vs actual deposit $49,034.90
            { accountCode: '1010', accountName: 'Cash — Operating (Chase 4091)', debit: 49571.70, credit: 0.00 },
            { accountCode: '6030', accountName: 'Payment Processing Fees', debit: 928.30, credit: 0.00 },
            { accountCode: '1200', accountName: 'Undeposited Funds / Stripe Clearing', debit: 0.00, credit: 50500.00 }
        ]
    },
    {
        id: 'erp_je_sep_003',
        entryNumber: 'JE-2026-09-003',
        date: '2026-09-30',
        memo: 'Stripe Payout Batch 4 Reconciliation — Sept 30',
        status: 'POSTED',
        sourceSystem: 'QUICKBOOKS',
        createdAt: '2026-09-30T22:00:00Z',
        lines: [
            { accountCode: '1010', accountName: 'Cash — Operating (Chase 4091)', debit: 29344.85, credit: 0.00 },
            { accountCode: '6030', accountName: 'Payment Processing Fees', debit: 905.15, credit: 0.00 },
            { accountCode: '1200', accountName: 'Undeposited Funds / Stripe Clearing', debit: 0.00, credit: 30250.00 }
        ]
    }
];
//# sourceMappingURL=mock-data.js.map