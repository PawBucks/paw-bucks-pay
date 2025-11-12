// Platform-wide constants for consistency and maintainability

export const PAWBUCKS_CONVERSION = {
  EARN_RATE: 10, // 10 PawBucks per $1 spent
  USD_CONVERSION: 10, // 10 PawBucks = $1 USD
  REWARD_THRESHOLD: 100, // PawBucks needed for $10 credit
} as const;

export const CASHBACK_RATES = {
  STANDARD: 10, // 10% cashback for regular users
  PREMIUM: 25, // 25% cashback for premium subscribers
} as const;

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
  PAWBUCKS_BUY: '/pawbucks/buy',
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
