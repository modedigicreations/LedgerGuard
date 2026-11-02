const PAYSTACK_API_BASE = 'https://api.paystack.co';
async function paystackGet(apiKey, path, params) {
    const url = new URL(`${PAYSTACK_API_BASE}${path}`);
    for (const [key, value] of Object.entries(params))
        url.searchParams.set(key, value);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Paystack API error ${res.status}: ${body.slice(0, 300)}`);
    }
    return (await res.json());
}
function mapTransactionStatus(status) {
    if (status === 'success')
        return 'succeeded';
    if (status === 'pending' || status === 'ongoing' || status === 'queued' || status === 'processing')
        return 'pending';
    return 'failed'; // abandoned, reversed, failed, etc.
}
function mapTransferStatus(status) {
    if (status === 'success')
        return 'paid';
    if (status === 'pending' || status === 'otp')
        return 'pending';
    if (status === 'received')
        return 'in_transit';
    return 'canceled'; // failed, reversed, etc. — never actually delivered the funds
}
// Exported (not just used internally) so the field-mapping logic can be
// exercised directly against fixed sample JSON shaped like Paystack's
// own documented response — this is what tests/test-paystack-mapping.ts
// verifies, since there's no sandbox credential available to drive the
// real HTTP call path in this environment.
export function mapPaystackTransaction(tx) {
    const status = mapTransactionStatus(tx.status);
    // Paystack's List Transactions endpoint frequently omits `fees` for
    // non-success transactions (confirmed in their own docs' sample data)
    // — reporting those as $0 fee would be a fabricated number for a
    // transaction that was never actually charged. Skip rather than guess,
    // same rule the Stripe adapter follows for an unresolved balance
    // transaction.
    if (status === 'succeeded' && tx.fees === null)
        return null;
    return {
        id: tx.reference,
        created: tx.created_at,
        amountGross: tx.amount / 100,
        amountFee: (tx.fees ?? 0) / 100,
        amountNet: (tx.amount - (tx.fees ?? 0)) / 100,
        currency: tx.currency.toUpperCase(),
        type: 'charge',
        status,
        customerId: tx.customer?.customer_code || '',
        customerName: [tx.customer?.first_name, tx.customer?.last_name].filter(Boolean).join(' '),
        description: '',
    };
}
export function mapPaystackTransfer(transfer) {
    const accountNumber = transfer.recipient?.details?.account_number || '';
    return {
        id: transfer.transfer_code,
        created: transfer.createdAt,
        // Paystack doesn't expose a separate bank-settlement timestamp
        // distinct from the transfer record's own last-update time — this
        // is the closest honest approximation, not a true arrival date.
        arrivalDate: transfer.updatedAt.split('T')[0],
        amount: transfer.amount / 100,
        currency: transfer.currency.toUpperCase(),
        status: mapTransferStatus(transfer.status),
        destinationBankLast4: accountNumber.slice(-4),
        // Paystack has no equivalent of Stripe's "list the balance
        // transactions that settled into this specific payout" endpoint,
        // so there's no honest way to break a transfer back down into the
        // individual charges that funded it. Left at 0 rather than
        // guessed — and nothing in reconciler.ts's summary math currently
        // reads these three fields anyway (only .amount and .status are).
        chargeCount: 0,
        totalGross: 0,
        totalFees: 0,
    };
}
class PaystackGatewayAdapter {
    async getTransactions(apiKey, range) {
        const data = [];
        let page = 1;
        let pageCount = 1;
        do {
            const result = await paystackGet(apiKey, '/transaction', {
                from: range.start.toISOString(),
                to: range.end.toISOString(),
                perPage: '100',
                page: String(page),
            });
            for (const tx of result.data) {
                const mapped = mapPaystackTransaction(tx);
                if (mapped)
                    data.push(mapped);
            }
            pageCount = result.meta.pageCount;
            page += 1;
        } while (page <= pageCount);
        return data;
    }
    async getPayouts(apiKey, range) {
        const data = [];
        let page = 1;
        let pageCount = 1;
        do {
            const result = await paystackGet(apiKey, '/transfer', {
                from: range.start.toISOString(),
                to: range.end.toISOString(),
                perPage: '100',
                page: String(page),
            });
            for (const transfer of result.data) {
                data.push(mapPaystackTransfer(transfer));
            }
            pageCount = result.meta.pageCount;
            page += 1;
        } while (page <= pageCount);
        return data;
    }
}
export const paystackAdapter = new PaystackGatewayAdapter();
//# sourceMappingURL=paystack.js.map