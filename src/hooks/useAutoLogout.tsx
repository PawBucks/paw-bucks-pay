import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes

export const useAutoLogout = (isAuthenticated: boolean) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastResetRef = useRef(0);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
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

    // Use passive listeners and fewer events - 'scroll' is the noisiest
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
