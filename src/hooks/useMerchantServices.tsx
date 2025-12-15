import { useQuery } from "@tanstack/react-query";
import { 
  getMerchantActiveServices, 
  getAdMerchants, 
  getSponsoredMerchants,
  getVerifiedProMerchants,
  getSearchBoostedMerchants,
  getMerchantsWithAnyService,
  SERVICE_NAMES,
  type MerchantWithActiveServices,
  type ServiceName
} from "@/services/api/merchantServices.service";

// Cache duration for service queries (5 minutes)
const SERVICE_QUERY_STALE_TIME = 1000 * 60 * 5;

/**
 * Hook to get all active services for a specific merchant
 */
export function useMerchantActiveServices(merchantId: string | undefined) {
  return useQuery({
    queryKey: ['merchant-active-services', merchantId],
    queryFn: () => merchantId ? getMerchantActiveServices(merchantId) : Promise.resolve([]),
    enabled: !!merchantId,
    staleTime: SERVICE_QUERY_STALE_TIME,
  });
}

/**
 * Hook to get merchants with Premium Ad Placement service
 */
export function useAdMerchants() {
  return useQuery<MerchantWithActiveServices[]>({
    queryKey: ['ad-merchants'],
    queryFn: getAdMerchants,
    staleTime: SERVICE_QUERY_STALE_TIME,
  });
}

/**
 * Hook to get sponsored merchants (Sponsored Merchant Placement service)
 */
export function useSponsoredMerchants() {
  return useQuery<MerchantWithActiveServices[]>({
    queryKey: ['sponsored-merchants'],
    queryFn: getSponsoredMerchants,
    staleTime: SERVICE_QUERY_STALE_TIME,
  });
}

/**
 * Hook to get list of merchant IDs with Verified Pro badge
 */
export function useVerifiedProMerchants() {
  return useQuery<string[]>({
    queryKey: ['verified-pro-merchants'],
    queryFn: getVerifiedProMerchants,
    staleTime: SERVICE_QUERY_STALE_TIME,
  });
}

/**
 * Hook to get list of merchant IDs with Search Ranking Booster
 */
export function useSearchBoostedMerchants() {
  return useQuery<string[]>({
    queryKey: ['search-boosted-merchants'],
    queryFn: getSearchBoostedMerchants,
    staleTime: SERVICE_QUERY_STALE_TIME,
  });
}

/**
 * Hook to get set of search boosted merchant IDs (optimized for lookup)
 */
export function useSearchBoostedMerchantSet() {
  const { data: boostedIds = [], ...rest } = useSearchBoostedMerchants();
  return {
    ...rest,
    data: new Set(boostedIds),
  };
}

/**
 * Hook to batch fetch multiple service types at once (more efficient)
 * Use this when you need to check multiple service types on a page
 */
export function useMerchantServicesBatch(serviceNames: ServiceName[]) {
  return useQuery({
    queryKey: ['merchant-services-batch', ...serviceNames],
    queryFn: () => getMerchantsWithAnyService(serviceNames),
    staleTime: SERVICE_QUERY_STALE_TIME,
    enabled: serviceNames.length > 0,
  });
}

/**
 * Hook to get all visibility-related service data at once
 * Optimized for pages like Discover that need multiple service checks
 */
export function useVisibilityServices() {
  return useMerchantServicesBatch([
    SERVICE_NAMES.SPONSORED_PLACEMENT,
    SERVICE_NAMES.VERIFIED_PRO_BADGE,
    SERVICE_NAMES.PREMIUM_AD,
  ]);
}

/**
 * Check if a merchant has a specific service active (helper for component use)
 */
export function merchantHasService(activeServices: string[], serviceName: string): boolean {
  return activeServices.includes(serviceName);
}

/**
 * Check if a merchant ID is in a set of verified merchants
 */
export function isVerifiedPro(merchantId: string, verifiedIds: string[]): boolean {
  return verifiedIds.includes(merchantId);
}

/**
 * Check if a merchant ID is in a set of sponsored merchants
 */
export function isSponsored(merchantId: string, sponsoredMerchants: MerchantWithActiveServices[]): boolean {
  return sponsoredMerchants.some(m => m.id === merchantId);
}

export { SERVICE_NAMES, type ServiceName, type MerchantWithActiveServices };
