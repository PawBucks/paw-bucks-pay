import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds

export const useAutoLogout = (isAuthenticated: boolean) => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const resetTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      logout();
    }, INACTIVITY_TIMEOUT);
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    // Activity events to monitor
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    // Set up activity listeners
    events.forEach(event => {
      document.addEventListener(event, resetTimer);
    });

    // Start initial timer
    resetTimer();

    return () => {
      // Clean up event listeners
      events.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isAuthenticated]);
};
