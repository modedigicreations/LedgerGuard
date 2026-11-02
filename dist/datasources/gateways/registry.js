import { stripeAdapter } from './stripe.js';
import { paystackAdapter } from './paystack.js';
import { paddleAdapter } from './paddle.js';
import { braintreeAdapter } from './braintree.js';
// Square/PayPal each add their own entry here as they're built (Phases
// G-H), with no change needed anywhere that calls getGatewayAdapter.
const GATEWAY_REGISTRY = {
    STRIPE: stripeAdapter,
    PAYSTACK: paystackAdapter,
    PADDLE: paddleAdapter,
    BRAINTREE: braintreeAdapter,
};
export function getGatewayAdapter(provider) {
    return GATEWAY_REGISTRY[provider] ?? null;
}
//# sourceMappingURL=registry.js.map