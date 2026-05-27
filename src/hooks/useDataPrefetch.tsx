import { useEffect, useCallback, useRef } from'react';
import { useQueryClient } from'@tanstack/react-query';
import { supabase } from'@/integrations/supabase/client';
import { useAuth } from'@/hooks/useAuth';

/**
 * Enhanced data prefetching for critical routes - optimized for speed
 * Prefetches data on idle and on route hover for instant navigation
 */
export const useDataPrefetch = () => {
 const queryClient = useQueryClient();
 const { user } = useAuth();
 const prefetchedRef = useRef<Set<string>>(new Set());

 // Prefetch merchants with ratings - optimized query
 const prefetchMerchants = useCallback(async () => {
 if (prefetchedRef.current.has('merchants')) return;
 prefetchedRef.current.add('merchants');

 await queryClient.prefetchQuery({
 queryKey: ['merchants-with-ratings'],
 queryFn: async () => {
 // Use parallel queries for speed
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
 
 // Fast rating calculation using Map
 const ratingsByMerchant = new Map<string, { total: number; count: number }>();
 for (const review of reviewsResult.data || []) {
 const existing = ratingsByMerchant.get(review.merchant_id);
 if (existing) {
 existing.total += review.rating;
 existing.count += 1;
 } else {
 ratingsByMerchant.set(review.merchant_id, { total: review.rating, count: 1 });
 }
 }

 return merchantsResult.data.map(merchant => {
 const ratings = ratingsByMerchant.get(merchant.id);
        const avg = ratings ? ratings.total / ratings.count : 0;
        const count = ratings?.count || 0;
 return {
 ...merchant,
          avg_rating: avg,
          average_rating: avg,
          review_count: count,
 };
 });
 },
 staleTime: 1000 * 60 * 10, // 10 minutes
 });
 }, [queryClient]);

 // Prefetch user-specific data when authenticated
 const prefetchUserData = useCallback(async () => {
 if (!user?.id || prefetchedRef.current.has('user-data')) return;
 prefetchedRef.current.add('user-data');

 // Parallel prefetch of critical user data — all queries fire simultaneously
 const sharedOpts = { staleTime: 1000 * 60 * 5 };
 
 await Promise.allSettled([
 // PawBucks wallet
 queryClient.prefetchQuery({
 queryKey: ['pawbucks-wallet', user.id],
 queryFn: async () => {
 const { data } = await supabase
 .from('pawbucks_wallet')
 .select('balance')
 .eq('user_id', user.id)
 .maybeSingle();
 return data;
 },
 ...sharedOpts,
 }),
 // User profile
 queryClient.prefetchQuery({
 queryKey: ['dashboard-profile', user.id],
 queryFn: async () => {
 const { data } = await supabase
 .from('profiles')
 .select('user_type, full_name')
 .eq('id', user.id)
 .single();
 return data;
 },
 staleTime: 1000 * 60 * 10,
 }),
 // Pet profiles
 queryClient.prefetchQuery({
 queryKey: ['pets', user.id],
 queryFn: async () => {
 const { data } = await supabase
 .from('pet_profiles')
 .select('id, name, type, breed, birthday, photo_url, personality_type, personality_quiz_completed')
 .eq('user_id', user.id)
 .order('created_at', { ascending: false })
 .limit(10);
 return data || [];
 },
 ...sharedOpts,
 }),
 // Unread notifications count
 queryClient.prefetchQuery({
 queryKey: ['unread-notifications-count', user.id],
 queryFn: async () => {
 const { count } = await supabase
 .from('notifications')
 .select('*', { count:'exact', head: true })
 .eq('user_id', user.id)
 .eq('is_read', false);
 return count || 0;
 },
 staleTime: 1000 * 30,
 }),
 ]);
 }, [queryClient, user?.id]);

 // Prefetch on idle with high priority
 useEffect(() => {
 const prefetchAll = () => {
 prefetchMerchants();
 if (user?.id) {
 prefetchUserData();
 }
 };

 if ('requestIdleCallback' in window) {
 const id = requestIdleCallback(prefetchAll, { timeout: 1500 });
 return () => cancelIdleCallback(id);
 } else {
 const timer = setTimeout(prefetchAll, 500);
 return () => clearTimeout(timer);
 }
 }, [prefetchMerchants, prefetchUserData, user?.id]);

 return {
 prefetchMerchants,
 prefetchUserData,
 };
};

/**
 * Hook for route-specific prefetching
 */
export const useRoutePrefetch = () => {
 const queryClient = useQueryClient();
 const prefetchedRef = useRef<Set<string>>(new Set());

 const prefetchRouteData = useCallback((route: string) => {
 if (prefetchedRef.current.has(route)) return;
 prefetchedRef.current.add(route);

 // Route-specific prefetch logic
 switch (route) {
 case'/discover':
 queryClient.prefetchQuery({
 queryKey: ['merchants-with-ratings'],
 staleTime: 1000 * 60 * 10,
 });
 break;
 case'/wallet':
 case'/pawbucks/wallet':
 // Will use cached user data
 break;
 default:
 break;
 }
 }, [queryClient]);

 return { prefetchRouteData };
};