import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Enhanced data prefetching for critical routes - optimized for speed
 */
export const useDataPrefetch = () => {
  const queryClient = useQueryClient();

  const prefetchMerchants = useCallback(async () => {
    // Prefetch merchants list with optimized query
    await queryClient.prefetchQuery({
      queryKey: ['merchants-with-ratings'],
      queryFn: async () => {
        const [merchantsResult, reviewsResult] = await Promise.all([
          supabase
            .from('merchants_public')
            .select('id, business_name, business_type, description, address, latitude, longitude, cashback_rate, logo_url, accepts_pawbucks, price_range')
            .order('business_name')
            .limit(50),
          supabase
            .from('merchant_reviews')
            .select('merchant_id, rating')
        ]);
        
        if (merchantsResult.error) return [];
        
        const ratingsByMerchant = (reviewsResult.data || []).reduce((acc, review) => {
          if (!acc[review.merchant_id]) {
            acc[review.merchant_id] = { total: 0, count: 0 };
          }
          acc[review.merchant_id].total += review.rating;
          acc[review.merchant_id].count += 1;
          return acc;
        }, {} as Record<string, { total: number; count: number }>);

        return merchantsResult.data.map(merchant => ({
          ...merchant,
          avg_rating: ratingsByMerchant[merchant.id] 
            ? ratingsByMerchant[merchant.id].total / ratingsByMerchant[merchant.id].count 
            : 0,
          review_count: ratingsByMerchant[merchant.id]?.count || 0
        }));
      },
      staleTime: 1000 * 60 * 10, // 10 minutes
    });
  }, [queryClient]);

  useEffect(() => {
    // Prefetch on idle with short timeout for faster perceived performance
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        prefetchMerchants();
      }, { timeout: 2000 });
    } else {
      setTimeout(prefetchMerchants, 1000);
    }
  }, [prefetchMerchants]);

  return {
    prefetchMerchants,
  };
};
