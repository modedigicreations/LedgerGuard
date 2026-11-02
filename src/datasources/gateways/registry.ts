import { PaymentGatewayAdapter, ProviderName } from '../../types/index.js';
import { stripeAdapter } from './stripe.js';

// Only STRIPE is registered so far — PayStack/Paddle/Braintree/Square/
// PayPal each add their own entry here as they're built (Phases D-H),
// with no change needed anywhere that calls getGatewayAdapter.
const GATEWAY_REGISTRY: Partial<Record<ProviderName, PaymentGatewayAdapter>> = {
	STRIPE: stripeAdapter,
};

export function getGatewayAdapter(provider: ProviderName): PaymentGatewayAdapter | null {
	return GATEWAY_REGISTRY[provider] ?? null;
}
