import { loadStripe, Stripe } from "@stripe/stripe-js";

// Platform Stripe publishable key (PawBucks, Inc.)
// This key is used for all payment flows with destination charges
export const STRIPE_PUBLISHABLE_KEY = "pk_live_51Snl7cHn6eXqpJI7GrG6XKh4qN9lj2BMZkWeQHCBRROppaLfoMw3iAbUtndatH1vv2uTRbRY5l9WBwXCKVti5mYy00o2sjffnd";

// Lazy-loaded Stripe instance - only loads when actually needed
let stripePromiseCache: Promise<Stripe | null> | null = null;

export const getStripePromise = (): Promise<Stripe | null> => {
  if (!stripePromiseCache) {
    stripePromiseCache = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromiseCache;
};
