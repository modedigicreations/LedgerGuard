import Stripe from 'stripe';
import Chargebee from 'chargebee';
function toUnixSeconds(d) {
    return Math.floor(d.getTime() / 1000);
}
function errorResult(err) {
    return { status: 'ERROR', data: [], error: err instanceof Error ? err.message : String(err) };
}
function mapChargebeeStatus(status) {
    switch (status) {
        case 'paid':
        case 'not_paid':
        case 'voided':
            return status;
        default:
            // 'posted' and 'pending' (and anything new Chargebee adds later) don't
            // have a direct equivalent in our narrower union — "payment_due" is
            // the honest closest fit: the invoice exists and isn't settled yet.
            return 'payment_due';
    }
}
// Real Stripe + Chargebee API calls, gated on the relevant env vars being
// set. Plaid and QuickBooks aren't built yet (Phases 3-4) — both always
// report NOT_CONFIGURED here rather than guessing.
export class LiveDataSource {
    stripeClient;
    chargebeeClient;
    constructor() {
        this.stripeClient = process.env.STRIPE_SECRET_KEY
            ? new Stripe(process.env.STRIPE_SECRET_KEY)
            : null;
        this.chargebeeClient =
            process.env.CHARGEBEE_SITE && process.env.CHARGEBEE_API_KEY
                ? new Chargebee({ site: process.env.CHARGEBEE_SITE, apiKey: process.env.CHARGEBEE_API_KEY })
                : null;
    }
    async getStripeTransactions(range) {
        if (!this.stripeClient)
            return { status: 'NOT_CONFIGURED', data: [] };
        try {
            const data = [];
            const charges = this.stripeClient.charges.list({
                created: { gte: toUnixSeconds(range.start), lte: toUnixSeconds(range.end) },
                expand: ['data.balance_transaction'],
            });
            for await (const charge of charges) {
                const bt = charge.balance_transaction;
                // Only a real BalanceTransaction (not a bare id string) carries the
                // gross/fee/net split — skip anything the expand didn't resolve
                // rather than reporting a wrong $0 fee.
                if (!bt || typeof bt === 'string')
                    continue;
                data.push({
                    id: charge.id,
                    created: new Date(charge.created * 1000).toISOString(),
                    amountGross: bt.amount / 100,
                    amountFee: bt.fee / 100,
                    amountNet: bt.net / 100,
                    currency: charge.currency.toUpperCase(),
                    type: charge.disputed ? 'dispute' : charge.refunded ? 'refund' : 'charge',
                    status: charge.status === 'succeeded' ? 'succeeded' : charge.status === 'pending' ? 'pending' : 'failed',
                    customerId: typeof charge.customer === 'string' ? charge.customer : charge.customer?.id || '',
                    // Stripe's Charge object doesn't carry a display name directly
                    // (that lives on the Customer) — left blank rather than an N+1
                    // customer lookup per charge until something actually needs it.
                    customerName: '',
                    description: charge.description || '',
                });
            }
            return { status: 'CONNECTED', data };
        }
        catch (err) {
            return errorResult(err);
        }
    }
    async getStripePayouts(range) {
        if (!this.stripeClient)
            return { status: 'NOT_CONFIGURED', data: [] };
        try {
            const data = [];
            const payouts = this.stripeClient.payouts.list({
                created: { gte: toUnixSeconds(range.start), lte: toUnixSeconds(range.end) },
                expand: ['data.destination'],
            });
            for await (const payout of payouts) {
                // totalGross/totalFees/chargeCount aren't native Payout fields in
                // the real API — they're the sum of whatever balance transactions
                // actually settled into this specific payout.
                let totalGross = 0;
                let totalFees = 0;
                let chargeCount = 0;
                const items = this.stripeClient.balanceTransactions.list({ payout: payout.id });
                for await (const bt of items) {
                    if (bt.type === 'charge' || bt.type === 'payment') {
                        totalGross += bt.amount / 100;
                        totalFees += bt.fee / 100;
                        chargeCount += 1;
                    }
                }
                const destination = payout.destination;
                const destinationBankLast4 = destination && typeof destination !== 'string' && 'last4' in destination
                    ? destination.last4
                    : '';
                data.push({
                    id: payout.id,
                    created: new Date(payout.created * 1000).toISOString(),
                    arrivalDate: new Date(payout.arrival_date * 1000).toISOString().split('T')[0],
                    amount: payout.amount / 100,
                    currency: payout.currency.toUpperCase(),
                    status: payout.status,
                    destinationBankLast4,
                    chargeCount,
                    totalGross,
                    totalFees,
                });
            }
            return { status: 'CONNECTED', data };
        }
        catch (err) {
            return errorResult(err);
        }
    }
    async getChargebeeInvoices(range) {
        if (!this.chargebeeClient)
            return { status: 'NOT_CONFIGURED', data: [] };
        try {
            const data = [];
            let offset;
            do {
                const result = await this.chargebeeClient.invoice.list({
                    date: { between: [toUnixSeconds(range.start), toUnixSeconds(range.end)] },
                    limit: 100,
                    offset,
                });
                for (const { invoice } of result.list) {
                    const dateIso = new Date((invoice.date || 0) * 1000).toISOString().split('T')[0];
                    const firstLine = invoice.line_items?.[0];
                    data.push({
                        id: invoice.id,
                        date: dateIso,
                        periodStart: firstLine ? new Date(firstLine.date_from * 1000).toISOString().split('T')[0] : dateIso,
                        periodEnd: firstLine ? new Date(firstLine.date_to * 1000).toISOString().split('T')[0] : dateIso,
                        customerId: invoice.customer_id,
                        // Chargebee's invoice object doesn't carry a display name
                        // directly (that lives on the Customer) — same tradeoff as
                        // Stripe's charge.customerName above.
                        customerName: invoice.customer_id,
                        subtotal: (invoice.sub_total || 0) / 100,
                        tax: (invoice.tax || 0) / 100,
                        totalRecognizedRevenue: (invoice.sub_total ?? invoice.total ?? 0) / 100,
                        paymentStatus: mapChargebeeStatus(invoice.status),
                    });
                }
                offset = result.next_offset;
            } while (offset);
            return { status: 'CONNECTED', data };
        }
        catch (err) {
            return errorResult(err);
        }
    }
    // Plaid Link isn't built yet (Phase 3) — there's no access token to
    // fetch transactions with regardless of env vars being set.
    async getPlaidTransactions(_range) {
        return { status: 'NOT_CONFIGURED', data: [] };
    }
    // QuickBooks OAuth isn't built yet (Phase 4) — same reasoning.
    async getQBOJournalEntries(_range) {
        return { status: 'NOT_CONFIGURED', data: [] };
    }
}
//# sourceMappingURL=live.js.map