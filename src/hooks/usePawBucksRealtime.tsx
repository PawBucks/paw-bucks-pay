import { useEffect, useRef } from"react";
import { useQueryClient } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";

/**
 * Hook that subscribes to realtime updates for PawBucks wallet and activity.
 * Automatically invalidates relevant queries when changes are detected.
 * 
 * @param userId - The user ID to subscribe to updates for
 */
export function usePawBucksRealtime(userId: string | undefined) {
 const queryClient = useQueryClient();
 const pendingRef = useRef<Set<string>>(new Set());
 const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

 // Coalesce bursts of realtime events into a single invalidation pass.
 // Previously every row change fired 4-7 invalidateQueries calls, each
 // triggering its own refetch cascade and re-render storm.
 const queueInvalidate = (keys: string[]) => {
 keys.forEach((k) => pendingRef.current.add(k));
 if (timerRef.current) return;
 timerRef.current = setTimeout(() => {
 const keys = Array.from(pendingRef.current);
 pendingRef.current.clear();
 timerRef.current = null;
 keys.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
 }, 400);
 };

 useEffect(() => {
 if (!userId) return;

 // Subscribe to PawBucks wallet changes for this user
 const channel = supabase
 .channel(`pawbucks-realtime-${userId}`)
 .on(
'postgres_changes',
 {
 event:'*',
 schema:'public',
 table:'pawbucks_wallet',
 filter: `user_id=eq.${userId}`,
 },
 (payload) => {
 queueInvalidate(['pawbucks_wallet','pawbucks-wallet','wallet']);
 }
 )
 .on(
'postgres_changes',
 {
 event:'INSERT',
 schema:'public',
 table:'pawbucks_activity',
 filter: `user_id=eq.${userId}`,
 },
 (payload) => {
 queueInvalidate(['pawbucks_activity','pawbucks-activity']);
 }
 )
 .on(
'postgres_changes',
 {
 event:'*', // Listen to all events (INSERT, UPDATE, DELETE)
 schema:'public',
 table:'transactions',
 filter: `user_id=eq.${userId}`,
 },
 (payload) => {
 queueInvalidate([
 'transactions',
 'budget-transactions',
 'wallet',
 'pawbucks_wallet',
 'pawbucks-wallet',
 'pawbucks_activity',
 'pawbucks-activity',
 ]);
 }
 )
 .subscribe();

 return () => {
 if (timerRef.current) clearTimeout(timerRef.current);
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
 event:'*',
 schema:'public',
 table:'merchant_pawbucks_wallet',
 filter: `merchant_id=eq.${merchantId}`,
 },
 (payload) => {
 queueInvalidate(['merchant-pawbucks-wallet','merchant-analytics']);
 }
 )
 .on(
'postgres_changes',
 {
 event:'INSERT',
 schema:'public',
 table:'merchant_pawbucks_activity',
 filter: `merchant_id=eq.${merchantId}`,
 },
 (payload) => {
 queueInvalidate(['merchant-pawbucks-activity']);
 }
 )
 .on(
'postgres_changes',
 {
 event:'*', // Listen to all events (INSERT, UPDATE, DELETE)
 schema:'public',
 table:'transactions',
 filter: `merchant_id=eq.${merchantId}`,
 },
 (payload) => {
 queueInvalidate([
 'merchant-transactions',
 'merchant-analytics',
 'merchant-dashboard',
 ]);
 }
 )
 .subscribe();

 return () => {
 if (timerRef.current) clearTimeout(timerRef.current);
 supabase.removeChannel(channel);
 };
 }, [merchantId, queryClient]);
}
