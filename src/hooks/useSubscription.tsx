import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useQuery } from '@tanstack/react-query';

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
  const [subscription, setSubscription] = useState<SubscriptionStatus>(defaultSubscription);
  const [loading, setLoading] = useState(true);

  const checkSubscription = useCallback(async () => {
    // Only check if we have both a user and a valid session
    if (!user || !session?.access_token) {
      setSubscription(defaultSubscription);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');

      if (error) {
        // Don't throw on auth errors, just reset to default
        if (error.message?.includes('Auth') || error.message?.includes('session')) {
          console.warn('[useSubscription] Auth issue, resetting subscription state');
          setSubscription(defaultSubscription);
        } else {
          console.error('[useSubscription] Error:', error);
        }
        return;
      }

      if (data) {
        setSubscription(data);
      }
    } catch (error) {
      console.error('[useSubscription] Failed to check subscription:', error);
    } finally {
      setLoading(false);
    }
  }, [user, session?.access_token]);

  useEffect(() => {
    checkSubscription();

    // Only set up interval if user is authenticated
    if (user && session?.access_token) {
      const interval = setInterval(checkSubscription, 30000);
      return () => clearInterval(interval);
    }
  }, [user, session?.access_token, checkSubscription]);

  // Auto-redeem preference
  const { data: autoRedeemPref } = useQuery({
    queryKey: ["auto-redeem-preference-sub", user?.id],
    queryFn: async () => {
      if (!user?.id) return { enabled: false };
      const { data } = await supabase.from('profiles').select('auto_redeem_mode').eq('id', user.id).single();
      const mode = data?.auto_redeem_mode || 'off';
      return { enabled: mode !== 'off' };
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!user?.id,
  });

  const createCheckout = async (tier: 'basic' | 'plus' = 'basic'): Promise<string | null> => {
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
