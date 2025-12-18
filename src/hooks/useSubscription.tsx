import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

type SubscriptionStatus = {
  subscribed: boolean;
  product_id: string | null;
  subscription_end: string | null;
  status: string | null;
  trial_end: string | null;
};

const defaultSubscription: SubscriptionStatus = {
  subscribed: false,
  product_id: null,
  subscription_end: null,
  status: null,
  trial_end: null,
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

  const createCheckout = async (tier: 'basic' | 'plus' = 'basic') => {
    try {
      console.log('[useSubscription] Creating checkout session for tier:', tier);
      const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
        body: { tier }
      });

      if (error) throw error;

      if (data?.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      }
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
        window.open(data.url, '_blank');
        // Refresh after a delay to catch any updates
        setTimeout(checkSubscription, 3000);
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
