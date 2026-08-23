import { useState, useEffect, useCallback, useMemo } from"react";
import { User, Session } from"@supabase/supabase-js";
import { supabase } from"@/integrations/supabase/client";
import { getPreHydratedSession } from"@/lib/authPreHydrate";
import { toast } from"sonner";
import { claimPetFestBonus, readPetFestBonus } from"@/lib/petfestBonus";

import {
  clearUserAccessCache,
  getAuthRedirectForUser,
  getUserAccessInfo,
} from"@/lib/userAccessCache";

// Pre-hydrate from localStorage synchronously — instant first render
const preHydrated = getPreHydratedSession();
let cachedSession: Session | null = preHydrated;
let sessionChecked = !!preHydrated;

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

  // Auto-detect timezone + enforce ban check on sign-in / refresh
  if (newSession?.user && (_event ==='SIGNED_IN' || _event ==='TOKEN_REFRESHED')) {
  const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (detectedTz) {
  supabase
  .from('profiles')
  .update({ timezone: detectedTz })
  .eq('id', newSession.user.id)
  .then(() => {});
  }

  // Grant any reserved PetFest sign-up bonus (server enforces the 5-min window)
  if (_event ==='SIGNED_IN' && readPetFestBonus()) {
  setTimeout(async () => {
  const result = await claimPetFestBonus();
  if (result?.success) {
  toast.success(`${result.amount.toLocaleString()} PetFest PawBucks added to your wallet!`);
  } else if (result && !result.success && result.reason ==='expired') {
  toast.info("Your PetFest bonus window closed, but you'll still earn PawBucks on every purchase.");
  }
  }, 0);
  }


 // Defer ban check to avoid blocking auth callback
 setTimeout(async () => {
 try {
 const { data: banned } = await supabase.rpc('is_user_banned', {
 _user_id: newSession.user.id,
 });
 if (banned === true) {
 await supabase.auth.signOut();
 if (typeof window !=='undefined') {
 window.location.href ='/auth?banned=1';
 }
 }
 } catch (err) {
 console.error('Ban check failed:', err);
 }
 }, 0);
 }
 }
 );

 // Only check session if not already cached (includes pre-hydration)
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
    // Capture the role-specific auth URL BEFORE clearing user state/cache.
    // Warm the access cache first so we never fall back to the generic
    // /auth page when the cached entry has expired.
    let redirectTarget ="/auth";
    const userId = cachedSession?.user?.id;
    if (userId) {
      try {
        await getUserAccessInfo(userId);
      } catch (err) {
        console.error("Failed to refresh access info before sign-out:", err);
      }
      redirectTarget = getAuthRedirectForUser(userId);
    }
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
 clearUserAccessCache();
 setUser(null);
 setSession(null);

 // Hard clear any persisted auth token
 try {
 const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;
 if (typeof window !=="undefined" && projectRef) {
 const storageKey = `sb-${projectRef}-auth-token`;
 window.localStorage.removeItem(storageKey);
 window.sessionStorage.removeItem(storageKey);
 }
 } catch (storageError) {
 console.error("Error clearing local auth storage:", storageError);
 }

      // Redirect to the persona-specific auth/login page
      if (typeof window !=="undefined") {
        window.location.href = redirectTarget;
      }
 }
 }, []);

 return useMemo(() => ({ user, session, loading, signOut }), [user, session, loading, signOut]);
};
