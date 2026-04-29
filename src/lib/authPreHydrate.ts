/**
 * Synchronous pre-hydration of auth state from localStorage.
 * Avoids the network roundtrip to getSession() on page reload,
 * giving us instant user state on first render.
 */
import type { Session, User } from"@supabase/supabase-js";

interface StoredSession {
 access_token: string;
 refresh_token: string;
 expires_at?: number;
 user: User;
}

/**
 * Try to read the cached Supabase session from localStorage synchronously.
 * Returns null if unavailable or expired.
 */
export function getPreHydratedSession(): Session | null {
 try {
 const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;
 if (!projectRef || typeof window ==="undefined") return null;

 const storageKey = `sb-${projectRef}-auth-token`;
 const raw = localStorage.getItem(storageKey);
 if (!raw) return null;

 const parsed: StoredSession = JSON.parse(raw);
 if (!parsed?.access_token || !parsed?.user) return null;

 // Check if token is expired (with 60s buffer)
 if (parsed.expires_at && parsed.expires_at < Date.now() / 1000 - 60) {
 return null;
 }

 return parsed as unknown as Session;
 } catch {
 return null;
 }
}
