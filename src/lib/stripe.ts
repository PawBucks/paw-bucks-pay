import { loadStripe, Stripe } from"@stripe/stripe-js";

// Platform Stripe publishable key (PawBucks, Inc.)
// This key is used for platform payments (subscriptions, platform-only transactions)
export const STRIPE_PUBLISHABLE_KEY ="pk_live_51Snl7cHn6eXqpJI7GrG6XKh4qN9lj2BMZkWeQHCBRROppaLfoMw3iAbUtndatH1vv2uTRbRY5l9WBwXCKVti5mYy00o2sjffnd";

// Cache for platform Stripe instance
let stripePromiseCache: Promise<Stripe | null> | null = null;

// Cache for connected account Stripe instances
const connectedAccountStripeCache: Map<string, Promise<Stripe | null>> = new Map();

/**
 * Get the platform Stripe instance (for subscriptions, platform-only payments)
 */
export const getStripePromise = (): Promise<Stripe | null> => {
 if (!stripePromiseCache) {
 stripePromiseCache = loadStripe(STRIPE_PUBLISHABLE_KEY);
 }
 return stripePromiseCache;
};

/**
 * Get a Stripe instance for a connected account (for Direct Charges)
 * 
 * CRITICAL: When using Direct Charges, PaymentIntents are created ON the connected
 * account. To confirm payments with Stripe.js, we must pass the stripeAccount option.
 * 
 * @param connectedAccountId - The Stripe Connect account ID (acct_xxx)
 */
export const getStripeForConnectedAccount = (connectedAccountId: string): Promise<Stripe | null> => {
 // Check cache first
 if (connectedAccountStripeCache.has(connectedAccountId)) {
 return connectedAccountStripeCache.get(connectedAccountId)!;
 }
 
 // Create new Stripe instance with connected account context
 const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY, {
 stripeAccount: connectedAccountId,
 });
 
 // Cache it for future use
 connectedAccountStripeCache.set(connectedAccountId, stripePromise);
 
 return stripePromise;
};
