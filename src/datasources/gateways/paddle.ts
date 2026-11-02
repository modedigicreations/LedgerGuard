import { DateRange, GatewayTransaction, GatewayPayout, PaymentGatewayAdapter, Currency } from '../../types/index.js';

const PADDLE_LIVE_BASE = 'https://api.paddle.com';
const PADDLE_SANDBOX_BASE = 'https://sandbox-api.paddle.com';

// Paddle API keys are self-describing and environment-locked — a sandbox
// key only works against the sandbox host, a live key only against the
// live one (confirmed via Paddle's own docs, not guessed). Newer keys
// contain `sdbx_`; legacy live keys predating May 2025 may lack an
// explicit `live_` marker, so the safe default for anything that isn't
// clearly sandbox is live, not an unverifiable guess either way.
function paddleBaseUrl(apiKey: string): string {
	return apiKey.includes('sdbx_') ? PADDLE_SANDBOX_BASE : PADDLE_LIVE_BASE;
}

// Raw shape from Paddle's own API (confirmed against
// https://developer.paddle.com/api-reference/transactions/list-transactions,
// including a real sample response body — not guessed), narrowed to
// only the fields this adapter reads.
interface PaddleTransaction {
	id: string;
	status: string;
	currency_code: string;
	customer_id: string | null;
	created_at: string;
	details: {
		totals: {
			total: string; // minor units, e.g. cents, as a numeric string
			fee: string | null; // null until status reaches 'completed'
			earnings: string | null; // total minus fee; same null-until-completed rule
		} | null;
	} | null;
}

interface PaddleListResponse<T> {
	data: T[];
	meta?: { pagination?: { next?: string | null } };
}

async function paddleFetch<T>(url: string, apiKey: string): Promise<PaddleListResponse<T>> {
	const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(`Paddle API error ${res.status}: ${body.slice(0, 300)}`);
	}
	return (await res.json()) as PaddleListResponse<T>;
}

function mapTransactionStatus(status: string): GatewayTransaction['status'] {
	// fee/earnings are only guaranteed non-null once status is
	// 'completed' (confirmed in Paddle's docs) — 'paid' sits between
	// 'billed' and 'completed' in Paddle's own lifecycle and doesn't carry
	// that guarantee either, so it's treated as still-settling rather than
	// assumed equivalent to 'completed'.
	if (status === 'completed') return 'succeeded';
	if (status === 'canceled') return 'failed';
	return 'pending'; // draft, ready, billed, paid, past_due
}

// Exported so the mapping logic can be exercised directly against fixed
// sample JSON shaped like Paddle's own documented response — see
// tests/test-paddle-mapping.ts.
export function mapPaddleTransaction(tx: PaddleTransaction): GatewayTransaction | null {
	const status = mapTransactionStatus(tx.status);
	const totals = tx.details?.totals;
	if (!totals?.total) return null; // nothing usable at all

	// A 'succeeded' transaction with no fee/earnings yet would be an
	// honest data anomaly (the docs say this pairing shouldn't happen) —
	// skip rather than guess, same rule the Stripe/Paystack adapters
	// follow for their own unresolved-fee cases.
	if (status === 'succeeded' && (totals.fee === null || totals.earnings === null)) return null;

	const amountGross = Number(totals.total) / 100;
	// Not yet completed: Paddle hasn't assessed a fee yet, which is a
	// genuinely accurate $0 (nothing has been charged against this
	// transaction by Paddle so far), not a fabricated placeholder.
	const amountFee = totals.fee !== null ? Number(totals.fee) / 100 : 0;
	const amountNet = totals.earnings !== null ? Number(totals.earnings) / 100 : amountGross;

	return {
		id: tx.id,
		created: tx.created_at,
		amountGross,
		amountFee,
		amountNet,
		currency: tx.currency_code.toUpperCase() as Currency,
		// Paddle models refunds as separate "adjustments," not a flag on
		// the transaction itself — not modeled here yet, so every mapped
		// record reads as a plain charge.
		type: 'charge',
		status,
		customerId: tx.customer_id || '',
		// No display name without a separate Customer lookup — same
		// N+1-avoidance tradeoff the Stripe/Paystack adapters already make.
		customerName: '',
		description: '',
	};
}

class PaddleGatewayAdapter implements PaymentGatewayAdapter {
	async getTransactions(apiKey: string, range: DateRange): Promise<GatewayTransaction[]> {
		const base = paddleBaseUrl(apiKey);
		const data: GatewayTransaction[] = [];
		let url: string | null =
			`${base}/transactions?created_at[GTE]=${encodeURIComponent(range.start.toISOString())}` +
			`&created_at[LTE]=${encodeURIComponent(range.end.toISOString())}` +
			`&per_page=30&order_by=created_at[ASC]`;

		while (url) {
			const result: PaddleListResponse<PaddleTransaction> = await paddleFetch<PaddleTransaction>(url, apiKey);
			for (const tx of result.data) {
				const mapped = mapPaddleTransaction(tx);
				if (mapped) data.push(mapped);
			}
			url = result.meta?.pagination?.next || null;
		}
		return data;
	}

	// Paddle has no synchronous "list payouts" endpoint — payout data only
	// comes through their async Reports API (create a `payout_reconciliation`
	// report, poll until it's ready, then download its rows), which
	// doesn't fit a single request/response call the way this method's
	// signature implies. Returning an empty array here would silently
	// read as "connected, zero payouts" — a fabricated answer. Throwing
	// surfaces honestly as providerStatus: 'ERROR' with a clear reason,
	// via LiveDataSource's existing try/catch, rather than lying by
	// omission. Nothing in this phase calls this method (reconciler.ts
	// doesn't fetch PADDLE payouts, same as it doesn't for PAYSTACK) —
	// this is a correct contract for whoever wires it in later, not an
	// active runtime gap today.
	async getPayouts(_apiKey: string, _range: DateRange): Promise<GatewayPayout[]> {
		throw new Error(
			"Paddle payout data requires their asynchronous Reports API (a payout_reconciliation report job, not a list endpoint) — not implemented yet.",
		);
	}
}

export const paddleAdapter = new PaddleGatewayAdapter();
