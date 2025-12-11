import { supabase } from "@/integrations/supabase/client";

// Service name constants for consistency
export const SERVICE_NAMES = {
  VERIFIED_PRO_BADGE: '"Verified Pro" Badge',
  SPONSORED_PLACEMENT: 'Sponsored Merchant Placement',
  PREMIUM_AD: 'Premium Ad Placement',
  SEARCH_RANKING_BOOSTER: 'Search Ranking Booster',
  MERCHANT_SPOTLIGHT: 'Merchant Spotlight Feature',
  FEATURED_PARTNER: 'Featured Partner Status',
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

/**
 * Get all merchants with a specific active service
 */
export async function getMerchantsWithActiveService(serviceName: ServiceName): Promise<MerchantWithActiveServices[]> {
  // First get the service ID
  const { data: service, error: serviceError } = await supabase
    .from('merchant_market_services')
    .select('id')
    .eq('name', serviceName)
    .single();

  if (serviceError || !service) {
    console.error(`Service not found: ${serviceName}`, serviceError);
    return [];
  }

  // Get active purchases for this service
  const now = new Date().toISOString();
  const { data: purchases, error: purchasesError } = await supabase
    .from('merchant_service_purchases')
    .select('merchant_id')
    .eq('service_id', service.id)
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${now}`);

  if (purchasesError || !purchases || purchases.length === 0) {
    return [];
  }

  const merchantIds = purchases.map(p => p.merchant_id);

  // Get merchant details from public view
  const { data: merchants, error: merchantsError } = await supabase
    .from('merchants_public')
    .select('*')
    .in('id', merchantIds);

  if (merchantsError || !merchants) {
    console.error('Error fetching merchants:', merchantsError);
    return [];
  }

  // Get all active services for these merchants
  const { data: allServices } = await supabase
    .from('merchant_service_purchases')
    .select(`
      merchant_id,
      merchant_market_services!inner(name)
    `)
    .in('merchant_id', merchantIds)
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${now}`);

  // Build a map of merchant_id -> service names
  const servicesMap: Record<string, string[]> = {};
  if (allServices) {
    for (const svc of allServices) {
      const merchantId = svc.merchant_id;
      const serviceName = (svc.merchant_market_services as any)?.name;
      if (serviceName) {
        if (!servicesMap[merchantId]) {
          servicesMap[merchantId] = [];
        }
        if (!servicesMap[merchantId].includes(serviceName)) {
          servicesMap[merchantId].push(serviceName);
        }
      }
    }
  }

  return merchants.map(m => ({
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
 */
export async function merchantHasActiveService(merchantId: string, serviceName: ServiceName): Promise<boolean> {
  const { data: service } = await supabase
    .from('merchant_market_services')
    .select('id')
    .eq('name', serviceName)
    .single();

  if (!service) return false;

  const now = new Date().toISOString();
  const { data: purchase } = await supabase
    .from('merchant_service_purchases')
    .select('id')
    .eq('merchant_id', merchantId)
    .eq('service_id', service.id)
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .limit(1)
    .maybeSingle();

  return !!purchase;
}

/**
 * Get all active services for a merchant
 */
export async function getMerchantActiveServices(merchantId: string): Promise<string[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('merchant_service_purchases')
    .select(`
      merchant_market_services!inner(name)
    `)
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${now}`);

  if (error || !data) {
    console.error('Error fetching merchant services:', error);
    return [];
  }

  return data.map(d => (d.merchant_market_services as any)?.name).filter(Boolean);
}

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
 * Get merchants with Verified Pro badge
 */
export async function getVerifiedProMerchants(): Promise<string[]> {
  const merchants = await getMerchantsWithActiveService(SERVICE_NAMES.VERIFIED_PRO_BADGE);
  return merchants.map(m => m.id);
}
