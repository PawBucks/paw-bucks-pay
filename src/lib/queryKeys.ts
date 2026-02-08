/**
 * Centralized query keys for consistent caching and invalidation
 * Using a factory pattern for type safety and autocompletion
 */

export const queryKeys = {
  // User & Auth
  profile: (userId: string) => ['profile', userId] as const,
  userRoles: (userId: string) => ['user-roles', userId] as const,
  
  // Pets
  pets: (userId: string) => ['pets', userId] as const,
  pet: (petId: string) => ['pet', petId] as const,
  petHealth: (petId: string) => ['pet-health', petId] as const,
  
  // Wallet & Transactions
  pawbucksWallet: (userId: string) => ['pawbucks-wallet', userId] as const,
  pawbucksActivity: (userId: string) => ['pawbucks-activity', userId] as const,
  spendablePawbucks: (userId: string) => ['spendable-pawbucks', userId] as const,
  transactions: (userId: string) => ['transactions', userId] as const,
  
  // Merchants
  merchants: () => ['merchants'] as const,
  merchantsWithRatings: () => ['merchants-with-ratings'] as const,
  merchant: (merchantId: string) => ['merchant', merchantId] as const,
  merchantProducts: (merchantId: string) => ['merchant-products', merchantId] as const,
  merchantOffers: (merchantId: string) => ['merchant-offers', merchantId] as const,
  merchantTransactions: (merchantId: string) => ['merchant-transactions', merchantId] as const,
  merchantAnalytics: (merchantId: string) => ['merchant-analytics', merchantId] as const,
  
  // Loyalty
  loyaltySummary: (userId: string) => ['loyalty-summary', userId] as const,
  tierDefinitions: () => ['tier-definitions'] as const,
  userTierStatus: (userId: string) => ['user-tier-status', userId] as const,
  userMilestones: (userId: string) => ['user-milestones', userId] as const,
  userCredits: (userId: string) => ['user-credits', userId] as const,
  userStreaks: (userId: string) => ['user-streaks', userId] as const,
  loyaltyWarnings: (userId: string) => ['loyalty-warnings', userId] as const,
  
  // Badges
  badgeDefinitions: () => ['badge-definitions'] as const,
  userBadges: (userId: string) => ['user-badges', userId] as const,
  badgeProgress: (userId: string) => ['badge-progress', userId] as const,
  
  // Notifications
  notifications: (userId: string) => ['notifications', userId] as const,
  unreadNotificationsCount: (userId: string) => ['unread-notifications-count', userId] as const,
  
  // Subscriptions
  userSubscriptions: (userId: string) => ['user-subscriptions', userId] as const,
  
  // Offers
  partnerOffers: () => ['partner-offers'] as const,
  offer: (offerId: string) => ['offer', offerId] as const,
  
  // Discovery & Search
  searchResults: (query: string) => ['search-results', query] as const,
  categoryMerchants: (category: string) => ['category-merchants', category] as const,
} as const;

/**
 * Invalidation helpers for common patterns
 */
export const invalidationPatterns = {
  allUserData: (userId: string) => [
    queryKeys.profile(userId),
    queryKeys.pawbucksWallet(userId),
    queryKeys.pets(userId),
    queryKeys.transactions(userId),
    queryKeys.loyaltySummary(userId),
    queryKeys.userBadges(userId),
    queryKeys.notifications(userId),
  ],
  
  allMerchantData: (merchantId: string) => [
    queryKeys.merchant(merchantId),
    queryKeys.merchantProducts(merchantId),
    queryKeys.merchantOffers(merchantId),
    queryKeys.merchantTransactions(merchantId),
    queryKeys.merchantAnalytics(merchantId),
  ],
  
  allWalletData: (userId: string) => [
    queryKeys.pawbucksWallet(userId),
    queryKeys.pawbucksActivity(userId),
    queryKeys.spendablePawbucks(userId),
  ],
};