// Platform-wide constants for consistency and maintainability

export const PAWBUCKS_CONVERSION = {
  // Pet Owner rates
  PET_OWNER_TO_USD: 100, // 100 PawBucks = $1 USD when pet owners spend
  // Merchant rates (for platform services like marketing/advertising)
  MERCHANT_TO_USD: 50, // 50 PawBucks = $1 USD when merchants spend on platform
  REWARD_THRESHOLD: 1000, // PawBucks needed for $10 credit (100 * 10)
} as const;

export const CASHBACK_RATES = {
  FREE: 10, // 10% cashback in PawBucks for free accounts
  PAWPASS: 20, // 20% cashback in PawBucks for PawPass subscribers
  PAWPASS_PLUS: 30, // 30% cashback in PawBucks for PawPass+ subscribers
} as const;

// Map Stripe product IDs to subscription tiers
// These would be actual Stripe product IDs in production
export const SUBSCRIPTION_TIERS = {
  PAWPASS_PLUS_PRODUCT_ID: 'prod_pawpass_plus', // Replace with actual Stripe product ID
  PAWPASS_PRODUCT_ID: 'prod_pawpass', // Replace with actual Stripe product ID
} as const;

export const getSubscriptionTier = (productId: string | null): 'free' | 'pawpass' | 'pawpass_plus' => {
  if (!productId) return 'free';
  if (productId === SUBSCRIPTION_TIERS.PAWPASS_PLUS_PRODUCT_ID) return 'pawpass_plus';
  if (productId === SUBSCRIPTION_TIERS.PAWPASS_PRODUCT_ID) return 'pawpass';
  return 'free';
};

export const SUBSCRIPTION = {
  TRIAL_DAYS: 7,
  PRICE: 9.99,
  CURRENCY: 'USD',
} as const;

export const PAGINATION = {
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
} as const;

export const QUERY_STALE_TIMES = {
  SHORT: 1000 * 30, // 30 seconds
  MEDIUM: 1000 * 60 * 5, // 5 minutes
  LONG: 1000 * 60 * 10, // 10 minutes
} as const;

export const ROUTES = {
  HOME: '/',
  AUTH: '/auth',
  DASHBOARD: '/dashboard',
  ADMIN: '/admin',
  DISCOVER: '/discover',
  WALLET: '/wallet',
  PROFILE: '/profile',
  PET_STORE: '/pet-store',
  PAWBUCKS: '/pawbucks',
  PAWBUCKS_REDEEM: '/pawbucks/redeem',
  MERCHANT_ONBOARDING: '/merchant-onboarding',
  MERCHANT_DASHBOARD: '/merchant-dashboard',
} as const;

export const ERROR_MESSAGES = {
  GENERIC: 'Something went wrong. Please try again.',
  NETWORK: 'Network error. Please check your connection.',
  AUTH_REQUIRED: 'Please sign in to continue.',
  INSUFFICIENT_BALANCE: 'Insufficient PawBucks balance.',
  PAYMENT_FAILED: 'Payment failed. Please try again.',
  LOAD_FAILED: 'Failed to load data. Please refresh.',
} as const;

export const SUCCESS_MESSAGES = {
  PAYMENT: 'Payment successful!',
  PURCHASE: 'Purchase completed!',
  UPDATE: 'Updated successfully!',
  CREATE: 'Created successfully!',
  DELETE: 'Deleted successfully!',
} as const;
