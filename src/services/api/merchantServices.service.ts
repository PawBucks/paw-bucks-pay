import { supabase } from "@/integrations/supabase/client";

// Service name constants - must match exactly with database values
export const SERVICE_NAMES = {
  // Visibility & Promotion
  VERIFIED_PRO_BADGE: '"Verified Pro" Badge',
  SPONSORED_PLACEMENT: 'Sponsored Merchant Placement',
  PREMIUM_AD: 'Premium Ad Placement',
  SEARCH_RANKING_BOOSTER: 'Search Ranking Booster',
  MERCHANT_SPOTLIGHT: 'Merchant Spotlight Feature',
  FEATURED_PARTNER: 'Featured Partner Status',
  // Analytics & Insights
  PREMIUM_ANALYTICS: 'Premium Analytics Dashboard',
  COHORT_ANALYSIS: 'Customer Cohort Analysis',
  DEMAND_FORECASTING: 'Predictive Demand Forecasting',
  KEYWORD_INSIGHTS: 'Keyword Performance Insights',
  // Growth & Optimization
  PROFILE_OPTIMIZATION: 'Merchant Profile Optimization',
  STRATEGY_CONSULTATION: 'Dedicated Strategy Consultation',
  TRAINING_COURSE: 'Exclusive Training Course',
  PRIORITY_SUPPORT: 'Priority Merchant Support',
  REVIEW_CAMPAIGN: 'Review Generation Campaign',
  POS_API_INTEGRATION: 'POS & API Integration',
} as const;

export type ServiceName = typeof SERVICE_NAMES[keyof typeof SERVICE_NAMES];

export type ActiveMerchantService = {
  merchant_id: string;
  service_id: string;
  service_name: string;
  expires_at: string | null;
  status: string;
};

export type MerchantWithActiveServices = {
  id: string;
  business_name: string;
  business_type: string;
  description: string | null;
  address: string | null;
  cashback_rate: number;
  logo_url: string | null;
  latitude: number | null;
  longitude: number | null;
  accepts_pawbucks: boolean;
  price_range: number | null;
  phone: string | null;
  active_services: string[];
};

// Note: The getServiceId and getNow functions are no longer needed since we
// now use the merchant_active_services_public view which handles filtering

/**
 * Get all merchants with a specific active service
 * Uses the secure public view that doesn't expose payment amounts
 */
export async function getMerchantsWithActiveService(serviceName: ServiceName): Promise<MerchantWithActiveServices[]> {
  // Get active services from the secure public view
  const { data: activeServices, error: servicesError } = await supabase
    .from('merchant_active_services_public')
    .select('merchant_id, service_name')
    .eq('service_name', serviceName);

  if (servicesError) {
    console.error('Error fetching active services:', servicesError);
    return [];
  }
  
  if (!activeServices || activeServices.length === 0) {
    return [];
  }

  const merchantIds = [...new Set(activeServices.map(s => s.merchant_id))];

  // Batch fetch: merchant details and all their active services in parallel
  const [merchantsResult, allServicesResult] = await Promise.all([
    supabase
      .from('merchants_public')
      .select('*')
      .in('id', merchantIds),
    supabase
      .from('merchant_active_services_public')
      .select('merchant_id, service_name')
      .in('merchant_id', merchantIds)
  ]);

  if (merchantsResult.error || !merchantsResult.data) {
    console.error('Error fetching merchants:', merchantsResult.error);
    return [];
  }

  // Build a map of merchant_id -> service names
  const servicesMap: Record<string, string[]> = {};
  if (allServicesResult.data) {
    for (const svc of allServicesResult.data) {
      const merchantId = svc.merchant_id;
      const svcName = svc.service_name;
      if (svcName) {
        if (!servicesMap[merchantId]) {
          servicesMap[merchantId] = [];
        }
        if (!servicesMap[merchantId].includes(svcName)) {
          servicesMap[merchantId].push(svcName);
        }
      }
    }
  }

  return merchantsResult.data.map(m => ({
    id: m.id!,
    business_name: m.business_name!,
    business_type: m.business_type!,
    description: m.description,
    address: m.address,
    cashback_rate: m.cashback_rate!,
    logo_url: m.logo_url,
    latitude: m.latitude,
    longitude: m.longitude,
    accepts_pawbucks: m.accepts_pawbucks ?? false,
    price_range: m.price_range,
    phone: m.phone,
    active_services: servicesMap[m.id!] || [],
  }));
}

/**
 * Check if a specific merchant has an active service
 * Uses the secure public view that doesn't expose payment amounts
 */
export async function merchantHasActiveService(merchantId: string, serviceName: ServiceName): Promise<boolean> {
  const { data: activeService } = await supabase
    .from('merchant_active_services_public')
    .select('merchant_id')
    .eq('merchant_id', merchantId)
    .eq('service_name', serviceName)
    .limit(1)
    .maybeSingle();

  return !!activeService;
}

/**
 * Get all active services for a merchant
 * Uses the secure public view that doesn't expose payment amounts
 */
export async function getMerchantActiveServices(merchantId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('merchant_active_services_public')
    .select('service_name')
    .eq('merchant_id', merchantId);

  if (error || !data) {
    console.error('Error fetching merchant services:', error);
    return [];
  }

  return data.map(d => d.service_name).filter(Boolean);
}

/**
 * Batch fetch: get all merchants with ANY of the specified services
 * More efficient when checking multiple services
 * Uses the secure public view that doesn't expose payment amounts
 */
export async function getMerchantsWithAnyService(serviceNames: ServiceName[]): Promise<Record<string, MerchantWithActiveServices[]>> {
  if (serviceNames.length === 0) return {};

  // Get all active services for the requested service names from secure view
  const { data: activeServices, error } = await supabase
    .from('merchant_active_services_public')
    .select('merchant_id, service_name')
    .in('service_name', serviceNames);

  if (error || !activeServices || activeServices.length === 0) {
    return {};
  }

  // Get unique merchant IDs
  const merchantIds = [...new Set(activeServices.map(s => s.merchant_id))];

  // Fetch all merchant details
  const { data: merchants, error: merchantsError } = await supabase
    .from('merchants_public')
    .select('*')
    .in('id', merchantIds);

  if (merchantsError || !merchants) {
    return {};
  }

  // Build result grouped by service name
  const result: Record<string, MerchantWithActiveServices[]> = {};
  
  for (const serviceName of serviceNames) {
    result[serviceName] = [];
  }

  // Map services and merchants
  const merchantMap = new Map(merchants.map(m => [m.id, m]));
  const merchantServicesMap: Record<string, string[]> = {};
  
  // Build services map for each merchant
  for (const svc of activeServices) {
    const svcName = svc.service_name;
    if (!merchantServicesMap[svc.merchant_id]) {
      merchantServicesMap[svc.merchant_id] = [];
    }
    if (svcName && !merchantServicesMap[svc.merchant_id].includes(svcName)) {
      merchantServicesMap[svc.merchant_id].push(svcName);
    }
  }

  // Group merchants by service
  for (const svc of activeServices) {
    const svcName = svc.service_name as ServiceName;
    const merchant = merchantMap.get(svc.merchant_id);
    
    if (merchant && svcName && result[svcName]) {
      // Check if we already added this merchant to this service
      const exists = result[svcName].some(m => m.id === merchant.id);
      if (!exists) {
        result[svcName].push({
          id: merchant.id!,
          business_name: merchant.business_name!,
          business_type: merchant.business_type!,
          description: merchant.description,
          address: merchant.address,
          cashback_rate: merchant.cashback_rate!,
          logo_url: merchant.logo_url,
          latitude: merchant.latitude,
          longitude: merchant.longitude,
          accepts_pawbucks: merchant.accepts_pawbucks ?? false,
          price_range: merchant.price_range,
          phone: merchant.phone,
          active_services: merchantServicesMap[merchant.id!] || [],
        });
      }
    }
  }

  return result;
}

/**
 * Get all merchant IDs that have a specific service active
 * Optimized version that only returns IDs
 * Uses the secure public view that doesn't expose payment amounts
 */
export async function getMerchantIdsWithService(serviceName: ServiceName): Promise<string[]> {
  const { data, error } = await supabase
    .from('merchant_active_services_public')
    .select('merchant_id')
    .eq('service_name', serviceName);

  if (error || !data) {
    return [];
  }

  return [...new Set(data.map(d => d.merchant_id))];
}

// ============ Convenience functions for specific services ============

/**
 * Get merchants for ad placements (Premium Ad Placement service)
 */
export async function getAdMerchants(): Promise<MerchantWithActiveServices[]> {
  return getMerchantsWithActiveService(SERVICE_NAMES.PREMIUM_AD);
}

/**
 * Get sponsored merchants (Sponsored Merchant Placement service)
 */
export async function getSponsoredMerchants(): Promise<MerchantWithActiveServices[]> {
  return getMerchantsWithActiveService(SERVICE_NAMES.SPONSORED_PLACEMENT);
}

/**
 * Get merchants with Verified Pro badge - returns IDs only for efficiency
 */
export async function getVerifiedProMerchants(): Promise<string[]> {
  return getMerchantIdsWithService(SERVICE_NAMES.VERIFIED_PRO_BADGE);
}

/**
 * Get merchants with Search Ranking Booster service
 */
export async function getSearchBoostedMerchants(): Promise<string[]> {
  return getMerchantIdsWithService(SERVICE_NAMES.SEARCH_RANKING_BOOSTER);
}

/**
 * Check if a merchant has Verified Pro badge
 */
export async function hasVerifiedProBadge(merchantId: string): Promise<boolean> {
  return merchantHasActiveService(merchantId, SERVICE_NAMES.VERIFIED_PRO_BADGE);
}
