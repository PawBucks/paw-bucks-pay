import { useEffect, useRef, useCallback } from'react';
import { supabase } from'@/integrations/supabase/client';
import {
  getAuthRedirectForUser,
  getUserAccessInfo,
  clearUserAccessCache,
} from'@/lib/userAccessCache';

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes

export const useAutoLogout = (isAuthenticated: boolean) => {
 const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
 const lastResetRef = useRef(0);

 const logout = useCallback(async () => {
    // Resolve the persona-specific redirect BEFORE signing out so that an
    // expired access cache doesn't cause us to fall back to the generic
    // /auth page. We warm the cache first if necessary.
    let redirect ="/auth";
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (userId) {
        // Ensure cache is populated/refreshed so getAuthRedirectForUser
        // can read the persona synchronously even after TTL expiry.
        try {
          await getUserAccessInfo(userId);
        } catch (err) {
          console.error('Failed to refresh access info before logout:', err);
        }
        redirect = getAuthRedirectForUser(userId);
      }
    } catch (err) {
      console.error('Failed to resolve logout redirect:', err);
    }

    await supabase.auth.signOut();
    clearUserAccessCache();
    if (typeof window !=="undefined") {
      window.location.href = redirect;
    }
 }, []);

 const resetTimer = useCallback(() => {
 // Throttle resets to once per 30 seconds - prevents excessive timer churn
 const now = Date.now();
 if (now - lastResetRef.current < 30_000) return;
 lastResetRef.current = now;

 if (timeoutRef.current) {
 clearTimeout(timeoutRef.current);
 }

 timeoutRef.current = setTimeout(logout, INACTIVITY_TIMEOUT);
 }, [logout]);

 useEffect(() => {
 if (!isAuthenticated) return;

 // Use passive listeners and fewer events -'scroll' is the noisiest
 const events: Array<[string, AddEventListenerOptions?]> = [
 ['mousedown'],
 ['keydown'],
 ['touchstart', { passive: true }],
 ['scroll', { passive: true, capture: true }],
 ];

 events.forEach(([event, options]) => {
 document.addEventListener(event, resetTimer, options);
 });

 resetTimer();

 return () => {
 events.forEach(([event, options]) => {
 document.removeEventListener(event, resetTimer, options as EventListenerOptions);
 });
 if (timeoutRef.current) {
 clearTimeout(timeoutRef.current);
 }
 };
 }, [isAuthenticated, resetTimer]);
};
