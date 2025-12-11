import { useQuery } from "@tanstack/react-query";
import { 
  getMerchantActiveServices, 
  getAdMerchants, 
  getSponsoredMerchants,
  getVerifiedProMerchants,
  SERVICE_NAMES,
  type MerchantWithActiveServices 
} from "@/services/api/merchantServices.service";

/**
 * Hook to get all active services for a specific merchant
 */
export function useMerchantActiveServices(merchantId: string | undefined) {
  return useQuery({
    queryKey: ['merchant-active-services', merchantId],
    queryFn: () => merchantId ? getMerchantActiveServices(merchantId) : Promise.resolve([]),
    enabled: !!merchantId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to get merchants with Premium Ad Placement service
 */
export function useAdMerchants() {
  return useQuery<MerchantWithActiveServices[]>({
    queryKey: ['ad-merchants'],
    queryFn: getAdMerchants,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to get sponsored merchants (Sponsored Merchant Placement service)
 */
export function useSponsoredMerchants() {
  return useQuery<MerchantWithActiveServices[]>({
    queryKey: ['sponsored-merchants'],
    queryFn: getSponsoredMerchants,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to get list of merchant IDs with Verified Pro badge
 */
export function useVerifiedProMerchants() {
  return useQuery<string[]>({
    queryKey: ['verified-pro-merchants'],
    queryFn: getVerifiedProMerchants,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Check if a merchant has a specific service active
 */
export function merchantHasService(activeServices: string[], serviceName: string): boolean {
  return activeServices.includes(serviceName);
}

export { SERVICE_NAMES };
