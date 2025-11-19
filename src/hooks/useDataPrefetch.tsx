import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Enhanced data prefetching for critical routes
 */
export const useDataPrefetch = () => {
  const queryClient = useQueryClient();

  const prefetchDashboard = useCallback(async () => {
    // Prefetch common dashboard queries
    await queryClient.prefetchQuery({
      queryKey: ['dashboard'],
      staleTime: 1000 * 60 * 5,
    });
  }, [queryClient]);

  const prefetchMerchants = useCallback(async () => {
    // Prefetch merchants list
    await queryClient.prefetchQuery({
      queryKey: ['merchants'],
      staleTime: 1000 * 60 * 10,
    });
  }, [queryClient]);

  useEffect(() => {
    // Prefetch on idle
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        prefetchMerchants();
      }, { timeout: 5000 });
    }
  }, [prefetchMerchants]);

  return {
    prefetchDashboard,
    prefetchMerchants,
  };
};
