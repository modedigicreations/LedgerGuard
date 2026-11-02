import Stripe from 'stripe';
import { DateRange, GatewayTransaction, GatewayPayout, PaymentGatewayAdapter, Currency } from '../../types/index.js';

function toUnixSeconds(d: Date): number {
	return Math.floor(d.getTime() / 1000);
}

class StripeGatewayAdapter implements PaymentGatewayAdapter {
	async getTransactions(apiKey: string, range: DateRange): Promise<GatewayTransaction[]> {
		const stripe = new Stripe(apiKey);
		const data: GatewayTransaction[] = [];
		const charges = stripe.charges.list({
			created: { gte: toUnixSeconds(range.start), lte: toUnixSeconds(range.end) },
			expand: ['data.balance_transaction'],
		});
		for await (const charge of charges) {
			const bt = charge.balance_transaction;
			// Only a real BalanceTransaction (not a bare id string) carries the
			// gross/fee/net split — skip anything the expand didn't resolve
			// rather than reporting a wrong $0 fee.
			if (!bt || typeof bt === 'string') continue;

			data.push({
				id: charge.id,
				created: new Date(charge.created * 1000).toISOString(),
				amountGross: bt.amount / 100,
				amountFee: bt.fee / 100,
				amountNet: bt.net / 100,
				currency: charge.currency.toUpperCase() as Currency,
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
		return data;
	}

	async getPayouts(apiKey: string, range: DateRange): Promise<GatewayPayout[]> {
		const stripe = new Stripe(apiKey);
		const data: GatewayPayout[] = [];
		const payouts = stripe.payouts.list({
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
			const items = stripe.balanceTransactions.list({ payout: payout.id });
			for await (const bt of items) {
				if (bt.type === 'charge' || bt.type === 'payment') {
					totalGross += bt.amount / 100;
					totalFees += bt.fee / 100;
					chargeCount += 1;
				}
			}

			const destination = payout.destination;
			const destinationBankLast4 =
				destination && typeof destination !== 'string' && 'last4' in destination
					? (destination.last4 as string)
					: '';

			data.push({
				id: payout.id,
				created: new Date(payout.created * 1000).toISOString(),
				arrivalDate: new Date(payout.arrival_date * 1000).toISOString().split('T')[0],
				amount: payout.amount / 100,
				currency: payout.currency.toUpperCase() as Currency,
				status: payout.status as GatewayPayout['status'],
				destinationBankLast4,
				chargeCount,
				totalGross,
				totalFees,
			});
		}
		return data;
	}
}

export const stripeAdapter = new StripeGatewayAdapter();
