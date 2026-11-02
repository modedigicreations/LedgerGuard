import Chargebee from 'chargebee';
import { getApiKeyFor } from '../auth/connected-accounts.js';
import { getGatewayAdapter } from './gateways/registry.js';
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
// Real provider API calls, using the calling user's OWN stored
// credentials — never a server-wide key. Raw-processor gateways
// (Stripe today; PayStack/Paddle/Braintree/Square/PayPal as each is
// built) go through the PaymentGatewayAdapter registry so adding one
// doesn't touch this class at all — it only needs to know a provider's
// apiKey exists, not how to call that provider's API. Chargebee is its
// own method (billing/invoicing, not a raw processor — kept as-is).
// Plaid and QuickBooks aren't built yet — both always report
// NOT_CONFIGURED rather than guessing.
export class LiveDataSource {
    userId;
    constructor(userId) {
        this.userId = userId;
    }
    async getGatewayTransactions(provider, range) {
        const adapter = getGatewayAdapter(provider);
        if (!adapter)
            return { status: 'NOT_CONFIGURED', data: [] };
        const cred = await getApiKeyFor(this.userId, provider);
        if (!cred)
            return { status: 'NOT_CONFIGURED', data: [] };
        try {
            const data = await adapter.getTransactions(cred.apiKey, range);
            return { status: 'CONNECTED', data };
        }
        catch (err) {
            return errorResult(err);
        }
    }
    async getGatewayPayouts(provider, range) {
        const adapter = getGatewayAdapter(provider);
        if (!adapter)
            return { status: 'NOT_CONFIGURED', data: [] };
        const cred = await getApiKeyFor(this.userId, provider);
        if (!cred)
            return { status: 'NOT_CONFIGURED', data: [] };
        try {
            const data = await adapter.getPayouts(cred.apiKey, range);
            return { status: 'CONNECTED', data };
        }
        catch (err) {
            return errorResult(err);
        }
    }
    chargebeeClientPromise = null;
    getChargebeeClient() {
        if (!this.chargebeeClientPromise) {
            this.chargebeeClientPromise = getApiKeyFor(this.userId, 'CHARGEBEE').then((cred) => cred && cred.accountId ? new Chargebee({ site: cred.accountId, apiKey: cred.apiKey }) : null);
        }
        return this.chargebeeClientPromise;
    }
    async getChargebeeInvoices(range) {
        const chargebeeClient = await this.getChargebeeClient();
        if (!chargebeeClient)
            return { status: 'NOT_CONFIGURED', data: [] };
        try {
            const data = [];
            let offset;
            do {
                const result = await chargebeeClient.invoice.list({
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
                        // a gateway charge's customerName above.
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
    // Plaid Link isn't built yet — there's no access token to fetch
    // transactions with regardless of what's connected.
    async getPlaidTransactions(_range) {
        return { status: 'NOT_CONFIGURED', data: [] };
    }
    // QuickBooks OAuth isn't built yet — same reasoning.
    async getQBOJournalEntries(_range) {
        return { status: 'NOT_CONFIGURED', data: [] };
    }
}
//# sourceMappingURL=live.js.map