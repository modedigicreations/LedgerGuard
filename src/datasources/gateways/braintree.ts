import { DateRange, GatewayTransaction, GatewayPayout, PaymentGatewayAdapter } from '../../types/index.js';

const BRAINTREE_LIVE_URL = 'https://payments.braintree-api.com/graphql';
const BRAINTREE_SANDBOX_URL = 'https://payments.sandbox.braintree-api.com/graphql';
const BRAINTREE_API_VERSION = '2019-01-01';

// Braintree authenticates with a public/private key pair (Basic auth of
// publicKey:privateKey), not a single secret — accountId carries the
// public key here the same way it carries Chargebee's site name
// elsewhere (a non-secret identifier alongside the real secret, apiKey).
// Braintree has no environment marker baked into the keys themselves the
// way Paddle's sdbx_/live_ prefix does, so environment is an explicit,
// documented convention instead of a guess: a "sandbox:" prefix on the
// public key (set via the dashboard connect form's accountId field)
// selects the sandbox host; anything else is production.
function resolveEnvironment(accountId: string): { baseUrl: string; publicKey: string } {
	if (accountId.startsWith('sandbox:')) {
		return { baseUrl: BRAINTREE_SANDBOX_URL, publicKey: accountId.slice('sandbox:'.length) };
	}
	return { baseUrl: BRAINTREE_LIVE_URL, publicKey: accountId };
}

// Raw shape from Braintree's GraphQL API (confirmed against
// https://developer.paypal.com/braintree/graphql/reference/types/transaction,
// /payment-status, /monetary-amount, and /disbursement-details, plus the
// official search guide's example query — not guessed). `amount.value`
// is a major-unit decimal string (e.g. "10.00"), unlike Stripe/Paystack/
// Paddle's minor-unit integers — confirmed directly, not assumed from
// pattern-matching the other three.
interface BraintreeTransactionNode {
	id: string;
	status: string;
	createdAt: string;
	amount: { value: string; currencyCode: string } | null;
}

interface BraintreeSearchResponse {
	data?: {
		search?: {
			transactions?: {
				pageInfo: { hasNextPage: boolean; endCursor: string | null };
				edges: { node: BraintreeTransactionNode }[];
			};
		};
	};
	errors?: { message: string }[];
}

async function braintreeGraphQL(
	baseUrl: string,
	publicKey: string,
	privateKey: string,
	query: string,
	variables: Record<string, unknown>,
): Promise<BraintreeSearchResponse> {
	const auth = Buffer.from(`${publicKey}:${privateKey}`).toString('base64');
	const res = await fetch(baseUrl, {
		method: 'POST',
		headers: {
			Authorization: `Basic ${auth}`,
			'Content-Type': 'application/json',
			'Braintree-Version': BRAINTREE_API_VERSION,
		},
		body: JSON.stringify({ query, variables }),
	});
	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(`Braintree API error ${res.status}: ${body.slice(0, 300)}`);
	}
	const json = (await res.json()) as BraintreeSearchResponse;
	if (json.errors?.length) {
		throw new Error(`Braintree GraphQL error: ${json.errors.map((e) => e.message).join('; ')}`);
	}
	return json;
}

const SEARCH_QUERY = `
	query Search($input: TransactionSearchInput!, $after: String) {
		search {
			transactions(input: $input, first: 50, after: $after) {
				pageInfo { hasNextPage endCursor }
				edges {
					node {
						id
						status
						createdAt
						amount { value currencyCode }
					}
				}
			}
		}
	}
`;

function mapTransactionStatus(status: string): GatewayTransaction['status'] {
	// Disbursement/fee data is only ever available once status reaches
	// SETTLED specifically (confirmed in Braintree's own docs) — but the
	// customer's money was already successfully captured at SETTLING/
	// SUBMITTED_FOR_SETTLEMENT/SETTLEMENT_CONFIRMED/SETTLEMENT_PENDING
	// too, same as a Stripe charge reading 'succeeded' well before its
	// payout clears. Treating only SETTLED as 'succeeded' would under-
	// report real revenue that's already been collected.
	if (
		status === 'SETTLED' ||
		status === 'SETTLING' ||
		status === 'SUBMITTED_FOR_SETTLEMENT' ||
		status === 'SETTLEMENT_CONFIRMED' ||
		status === 'SETTLEMENT_PENDING'
	) {
		return 'succeeded';
	}
	if (status === 'AUTHORIZED' || status === 'AUTHORIZING') return 'pending';
	// AUTHORIZATION_EXPIRED, VOIDED, FAILED, GATEWAY_REJECTED,
	// PROCESSOR_DECLINED, SETTLEMENT_DECLINED — nothing was collected.
	return 'failed';
}

// Exported so the mapping logic can be exercised directly against fixed
// sample data shaped like Braintree's own documented response — see
// tests/test-braintree-mapping.ts (no sandbox credential available in
// this environment to drive the real HTTP call path).
export function mapBraintreeTransaction(node: BraintreeTransactionNode): GatewayTransaction | null {
	if (!node.amount) return null; // nothing usable at all

	return {
		id: node.id,
		created: node.createdAt,
		amountGross: Number(node.amount.value),
		// Braintree's GraphQL API doesn't expose a per-transaction fee
		// field the way Stripe/Paystack/Paddle do — DisbursementDetails
		// (the closest related type) carries only amount/date/exchangeRate/
		// fundsHeld, no fee breakdown. Reporting a fabricated fee here
		// would be exactly the kind of invented number this project is
		// built to avoid, so it's honestly 0 (unknown), not guessed —
		// amountNet equals amountGross as a direct consequence, not a
		// separate assumption.
		amountFee: 0,
		amountNet: Number(node.amount.value),
		currency: node.amount.currencyCode.toUpperCase(),
		// Braintree models refunds/credits via a separate `type` field on
		// the legacy REST Transaction, not surfaced in this GraphQL query —
		// not modeled here yet, consistent with the Paystack/Paddle
		// adapters' same scoping decision.
		type: 'charge',
		status: mapTransactionStatus(node.status),
		customerId: '',
		customerName: '',
		description: '',
	};
}

class BraintreeGatewayAdapter implements PaymentGatewayAdapter {
	async getTransactions(privateKey: string, range: DateRange, accountId?: string): Promise<GatewayTransaction[]> {
		if (!accountId) {
			throw new Error('Braintree requires a public key (set via the "accountId" field on the connect form) alongside the private key.');
		}
		const { baseUrl, publicKey } = resolveEnvironment(accountId);

		const data: GatewayTransaction[] = [];
		let after: string | null = null;
		let hasNextPage = true;

		while (hasNextPage) {
			const input = {
				createdAt: {
					greaterThanOrEqualTo: range.start.toISOString(),
					lessThanOrEqualTo: range.end.toISOString(),
				},
			};
			const result = await braintreeGraphQL(baseUrl, publicKey, privateKey, SEARCH_QUERY, { input, after });
			const page = result.data?.search?.transactions;
			if (!page) break;

			for (const edge of page.edges) {
				const mapped = mapBraintreeTransaction(edge.node);
				if (mapped) data.push(mapped);
			}
			hasNextPage = page.pageInfo.hasNextPage;
			after = page.pageInfo.endCursor;
		}
		return data;
	}

	// Braintree has no "list payouts" query — disbursement data lives per-
	// transaction (DisbursementDetails on each settled Transaction, only
	// populated for eligible merchant accounts), not as a standalone
	// payout resource. Reconstructing payout totals would mean searching
	// every transaction, grouping by disbursement date, and trusting an
	// aggregation this adapter doesn't do — not implemented, same honest
	// "throw rather than fabricate empty data" choice the Paddle adapter
	// makes for its own async-report payout gap. Nothing in this phase
	// calls this method (reconciler.ts only fetches BRAINTREE
	// transactions, same as PAYSTACK/PADDLE).
	async getPayouts(_apiKey: string, _range: DateRange, _accountId?: string): Promise<GatewayPayout[]> {
		throw new Error(
			'Braintree has no payout-listing endpoint — disbursement data is only available per-transaction (DisbursementDetails), not implemented yet.',
		);
	}
}

export const braintreeAdapter = new BraintreeGatewayAdapter();
