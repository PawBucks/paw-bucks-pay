import { useCallback } from'react';
import { supabase } from'@/integrations/supabase/client';
import { useAuth } from'./useAuth';
import { useQuery, useQueryClient } from'@tanstack/react-query';

type SubscriptionStatus = {
 subscribed: boolean;
 product_id: string | null;
 subscription_end: string | null;
 status: string | null;
 trial_end: string | null;
 is_manual: boolean;
 subscription_tier: string | null;
};

const defaultSubscription: SubscriptionStatus = {
 subscribed: false,
 product_id: null,
 subscription_end: null,
 status: null,
 trial_end: null,
 is_manual: false,
 subscription_tier: null,
};

export const useSubscription = () => {
 const { user, session } = useAuth();
 const queryClient = useQueryClient();

 // Single shared query for the whole app: every component that calls
 // useSubscription() now reads the same cache entry instead of firing its own
 // `check-subscription` edge function call (and its own 30s interval).
 const { data: subscription = defaultSubscription, isLoading } = useQuery({
 queryKey: ["subscription-status", user?.id],
 enabled: !!user?.id && !!session?.access_token,
 // Kept fresh long enough that navigating between pages never refetches.
 staleTime: 1000 * 60 * 5,
 gcTime: 1000 * 60 * 30,
 refetchOnMount: false,
 refetchOnWindowFocus: false,
 retry: false,
 queryFn: async (): Promise<SubscriptionStatus> => {
 // Short-circuit for admin/superadmin users — they don't have subscriptions
 const { data: roles } = await supabase
 .from('user_roles')
 .select('role')
 .eq('user_id', user!.id);
 const isAdmin = roles?.some((r: any) => r.role ==='admin' || r.role ==='superadmin');
 if (isAdmin) return defaultSubscription;

 const { data, error } = await supabase.functions.invoke('check-subscription');
 if (error) {
 console.warn('[useSubscription] check-subscription failed:', error.message);
 return defaultSubscription;
 }
 return (data as SubscriptionStatus) ?? defaultSubscription;
 },
 });

 const loading = !!user?.id && !!session?.access_token ? isLoading : false;

 // Explicit refresh (after checkout, cancel, upgrade, etc.)
 const checkSubscription = useCallback(async () => {
 await queryClient.invalidateQueries({ queryKey: ["subscription-status", user?.id] });
 }, [queryClient, user?.id]);

 // Auto-redeem preference
 const { data: autoRedeemPref } = useQuery({
 queryKey: ["auto-redeem-preference-sub", user?.id],
 queryFn: async () => {
 if (!user?.id) return { enabled: false };
 const { data } = await supabase.from('profiles').select('auto_redeem_mode').eq('id', user.id).single();
 const mode = data?.auto_redeem_mode ||'off';
 return { enabled: mode !=='off' };
 },
 staleTime: 1000 * 60 * 5,
 enabled: !!user?.id,
 });

 const createCheckout = async (tier:'basic' |'plus' ='basic'): Promise<string | null> => {
 try {
 console.log('[useSubscription] Creating checkout session for tier:', tier);
 const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
 body: { tier, autoRedeem: autoRedeemPref?.enabled ?? false }
 });

 if (error) throw error;

 if (data?.url) {
 // Return the URL for the caller to handle the redirect
 return data.url;
 }
 
 throw new Error('No checkout URL returned');
 } catch (error) {
 console.error('[useSubscription] Failed to create checkout:', error);
 throw error;
 }
 };

 const manageSubscription = async () => {
 try {
 console.log('[useSubscription] Opening customer portal');
 const { data, error } = await supabase.functions.invoke('customer-portal');

 if (error) throw error;

 if (data?.url) {
 // Use window.location.href for more reliable navigation (avoids popup blockers)
 window.location.href = data.url;
 } else {
 throw new Error('No portal URL returned');
 }
 } catch (error) {
 console.error('[useSubscription] Failed to open customer portal:', error);
 throw error;
 }
 };

 return {
 subscription,
 loading,
 checkSubscription,
 createCheckout,
 manageSubscription,
 };
};
