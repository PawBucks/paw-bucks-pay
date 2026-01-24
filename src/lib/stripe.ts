import { loadStripe } from "@stripe/stripe-js";

// Platform Stripe publishable key (PawBucks, Inc.)
// This key is used for all payment flows with destination charges
export const STRIPE_PUBLISHABLE_KEY = "pk_live_51Snl7cHn6eXqpJI7GrG6XKh4qN9lj2BMZkWeQHCBRROppaLfoMw3iAbUtndatH1vv2uTRbRY5l9WBwXCKVti5mYy00o2sjffnd";

// Singleton Stripe instance for consistent initialization
export const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
