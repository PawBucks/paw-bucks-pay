import { useState, useEffect, useCallback, useMemo } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Cache session to avoid redundant checks
let cachedSession: Session | null = null;
let sessionChecked = false;

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(() => cachedSession?.user ?? null);
  const [session, setSession] = useState<Session | null>(() => cachedSession);
  const [loading, setLoading] = useState(!sessionChecked);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        cachedSession = newSession;
        sessionChecked = true;
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
      }
    );

    // Only check session if not already cached
    if (!sessionChecked) {
      supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
        cachedSession = existingSession;
        sessionChecked = true;
        setSession(existingSession);
        setUser(existingSession?.user ?? null);
        setLoading(false);
      });
    }

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Error signing out:", error);
      }
    } catch (error) {
      console.error("Unexpected sign-out error:", error);
    } finally {
      cachedSession = null;
      sessionChecked = false;
      setUser(null);
      setSession(null);

      // Hard clear any persisted auth token in case the backend session is already gone
      try {
        const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        if (typeof window !== "undefined" && projectRef) {
          const storageKey = `sb-${projectRef}-auth-token`;
          window.localStorage.removeItem(storageKey);
          window.sessionStorage.removeItem(storageKey);
        }
      } catch (storageError) {
        console.error("Error clearing local auth storage:", storageError);
      }
    }
  }, []);

  // Memoize return object to prevent unnecessary re-renders
  return useMemo(() => ({ user, session, loading, signOut }), [user, session, loading, signOut]);
};