import { PaymentGatewayAdapter, ProviderName } from '../../types/index.js';
import { stripeAdapter } from './stripe.js';
import { paystackAdapter } from './paystack.js';

// Paddle/Braintree/Square/PayPal each add their own entry here as
// they're built (Phases E-H), with no change needed anywhere that calls
// getGatewayAdapter.
const GATEWAY_REGISTRY: Partial<Record<ProviderName, PaymentGatewayAdapter>> = {
	STRIPE: stripeAdapter,
	PAYSTACK: paystackAdapter,
};

export function getGatewayAdapter(provider: ProviderName): PaymentGatewayAdapter | null {
	return GATEWAY_REGISTRY[provider] ?? null;
}
