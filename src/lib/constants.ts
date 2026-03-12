// Platform-wide constants for consistency and maintainability

export const PAWBUCKS_CONVERSION = {
  // Pet Owner rates: 1 PawBuck = $0.001 USD
  PET_OWNER_TO_USD: 1000, // 1000 PawBucks = $1 USD when pet owners redeem
  PAWBUCKS_USD_VALUE: 0.001, // Direct multiplier: PawBucks × 0.001 = USD
  // Merchant rates (for platform services like marketing/advertising): 1 PawBuck = $0.005 USD
  MERCHANT_TO_USD: 200, // 200 PawBucks = $1 USD when merchants spend on platform
  // Quarter-Million Sign Up Bonus (Pet Fund)
  PET_FUND_TOTAL: 250000, // 250k PawBucks total ($250)
  PET_FUND_IMMEDIATE: 20000, // 20k PawBucks on signup ($20)
  PET_FUND_MONTHLY: 10000, // 10k PawBucks per month ($10)
  PET_FUND_ESCROW: 230000, // 230k PawBucks in escrow ($230)
  PET_FUND_MONTHS: 24, // 24 months total (1 immediate + 23 monthly)
  PET_FUND_INITIAL_MIN_USD: 40, // $40 min transaction for initial credit
  PET_FUND_MONTHLY_MIN_USD: 20, // $20 min transaction for monthly credits
  // Legacy (deprecated)
  WELCOME_CREDIT_PHASE_1: 30000,
  WELCOME_CREDIT_PHASE_2: 20000,
  WELCOME_CREDIT_TOTAL: 50000,
  REWARD_THRESHOLD: 10000, // PawBucks needed for $10 credit (1000 * 10)
} as const;

export const POINTS_MULTIPLIER = {
  FREE: 10, // 10x points in PawBucks for free accounts
  PAWPASS: 20, // 20x points in PawBucks for PawPass subscribers
  PAWPASS_PLUS: 30, // 30x points in PawBucks for PawPass+ subscribers
} as const;

// Backwards compatibility alias
export const CASHBACK_RATES = POINTS_MULTIPLIER;

// Map Stripe product IDs to subscription tiers
export const SUBSCRIPTION_TIERS = {
  PAWPASS_PLUS_PRODUCT_ID: 'prod_TQyZjYzt9DwoIK', // PawPass+ $20/month
  PAWPASS_PRODUCT_ID: 'prod_TJVK9ZhLiJnnpm', // PawPass $10/month
  // Manual subscription product IDs (set by admin upgrades)
  MANUAL_PAWPASS_PLUS_PRODUCT_ID: 'manual_pawpass_plus',
  MANUAL_PAWPASS_PRODUCT_ID: 'manual_pawpass',
} as const;

export const getSubscriptionTier = (productId: string | null, subscriptionTier?: string | null): 'free' | 'pawpass' | 'pawpass_plus' => {
  // First check direct subscription_tier if provided (most reliable for manual upgrades)
  if (subscriptionTier === 'pawpass_plus') return 'pawpass_plus';
  if (subscriptionTier === 'pawpass') return 'pawpass';
  
  // Then check product_id
  if (!productId) return 'free';
  
  if (
    productId === SUBSCRIPTION_TIERS.PAWPASS_PLUS_PRODUCT_ID ||
    productId === SUBSCRIPTION_TIERS.MANUAL_PAWPASS_PLUS_PRODUCT_ID ||
    productId.toLowerCase().includes('plus')
  ) {
    return 'pawpass_plus';
  }
  
  if (
    productId === SUBSCRIPTION_TIERS.PAWPASS_PRODUCT_ID ||
    productId === SUBSCRIPTION_TIERS.MANUAL_PAWPASS_PRODUCT_ID ||
    (productId.toLowerCase().includes('pawpass') && !productId.toLowerCase().includes('plus'))
  ) {
    return 'pawpass';
  }
  
  return 'free';
};

export const SUBSCRIPTION = {
  TRIAL_DAYS: 7,
  PAWPASS_PRICE: 10,
  PAWPASS_PLUS_PRICE: 20,
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
  CREATE_PET_PROFILE: '/create-pet-profile',
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
