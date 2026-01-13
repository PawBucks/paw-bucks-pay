import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook that subscribes to realtime updates for PawBucks wallet and activity.
 * Automatically invalidates relevant queries when changes are detected.
 * 
 * @param userId - The user ID to subscribe to updates for
 */
export function usePawBucksRealtime(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    // Subscribe to PawBucks wallet changes for this user
    const channel = supabase
      .channel(`pawbucks-realtime-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pawbucks_wallet',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('[Realtime] PawBucks wallet update:', payload);
          // Invalidate all PawBucks-related queries with various key formats
          queryClient.invalidateQueries({ queryKey: ['pawbucks_wallet', userId] });
          queryClient.invalidateQueries({ queryKey: ['pawbucks-wallet', userId] });
          queryClient.invalidateQueries({ queryKey: ['pawbucks_wallet'] });
          queryClient.invalidateQueries({ queryKey: ['pawbucks-wallet'] });
          queryClient.invalidateQueries({ queryKey: ['wallet', userId] });
          queryClient.invalidateQueries({ queryKey: ['wallet'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pawbucks_activity',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('[Realtime] PawBucks activity:', payload);
          // Invalidate activity queries with various key formats
          queryClient.invalidateQueries({ queryKey: ['pawbucks_activity', userId] });
          queryClient.invalidateQueries({ queryKey: ['pawbucks-activity', userId] });
          queryClient.invalidateQueries({ queryKey: ['pawbucks_activity'] });
          queryClient.invalidateQueries({ queryKey: ['pawbucks-activity'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('[Realtime] Transaction:', payload);
          // Invalidate transaction queries
          queryClient.invalidateQueries({ queryKey: ['transactions', userId] });
          queryClient.invalidateQueries({ queryKey: ['wallet', userId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}

/**
 * Hook for merchant to receive realtime updates on PawBucks received from customers.
 * 
 * @param merchantId - The merchant ID to subscribe to updates for
 */
export function useMerchantPawBucksRealtime(merchantId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!merchantId) return;

    const channel = supabase
      .channel(`merchant-pawbucks-${merchantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'merchant_pawbucks_wallet',
          filter: `merchant_id=eq.${merchantId}`,
        },
        (payload) => {
          console.log('[Realtime] Merchant PawBucks wallet update:', payload);
          queryClient.invalidateQueries({ queryKey: ['merchant-pawbucks-wallet', merchantId] });
          queryClient.invalidateQueries({ queryKey: ['merchant-pawbucks-wallet'] });
          queryClient.invalidateQueries({ queryKey: ['merchant-analytics'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'merchant_pawbucks_activity',
          filter: `merchant_id=eq.${merchantId}`,
        },
        (payload) => {
          console.log('[Realtime] Merchant PawBucks activity:', payload);
          queryClient.invalidateQueries({ queryKey: ['merchant-pawbucks-activity', merchantId] });
          queryClient.invalidateQueries({ queryKey: ['merchant-pawbucks-activity'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `merchant_id=eq.${merchantId}`,
        },
        (payload) => {
          console.log('[Realtime] Merchant transaction:', payload);
          queryClient.invalidateQueries({ queryKey: ['merchant-transactions', merchantId] });
          queryClient.invalidateQueries({ queryKey: ['merchant-analytics'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [merchantId, queryClient]);
}
