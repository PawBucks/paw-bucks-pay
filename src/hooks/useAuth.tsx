import { useState, useEffect } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Error signing out:", error);
      }
    } catch (error) {
      console.error("Unexpected sign-out error:", error);
    } finally {
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
  };

  return { user, session, loading, signOut };
};