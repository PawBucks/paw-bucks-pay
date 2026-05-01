/**
 * Unified user access cache — stores the result of get_user_access_info RPC
 * so ProtectedRoute never makes redundant DB calls.
 */
import { supabase } from"@/integrations/supabase/client";

export interface UserAccessInfo {
 user_type: string | null;
 system_roles: string[];
 is_merchant: boolean;
 is_vet: boolean;
 has_pets: boolean;
 has_shared_pets: boolean;
}

interface CacheEntry {
 data: UserAccessInfo;
 timestamp: number;
}

const ACCESS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let cache: Map<string, CacheEntry> = new Map();
let inflight: Map<string, Promise<UserAccessInfo>> = new Map();

/**
 * Fetch user access info via a single RPC call, with dedup and caching.
 */
export async function getUserAccessInfo(userId: string): Promise<UserAccessInfo> {
 const cached = cache.get(userId);
 if (cached && Date.now() - cached.timestamp < ACCESS_CACHE_TTL) {
 return cached.data;
 }

 // Deduplicate in-flight requests
 const existing = inflight.get(userId);
 if (existing) return existing;

 const promise = (async () => {
 try {
 const { data, error } = await supabase.rpc("get_user_access_info", {
 p_user_id: userId,
 });

 if (error) throw error;

 const d = data as Record<string, unknown> | null;

 const info: UserAccessInfo = {
 user_type: (d?.user_type as string) ?? null,
 system_roles: Array.isArray(d?.system_roles) ? (d.system_roles as string[]) : [],
 is_merchant: !!d?.is_merchant,
 is_vet: !!d?.is_vet,
 has_pets: !!d?.has_pets,
 has_shared_pets: !!d?.has_shared_pets,
 };

 cache.set(userId, { data: info, timestamp: Date.now() });
 return info;
 } finally {
 inflight.delete(userId);
 }
 })();

 inflight.set(userId, promise);
 return promise;
}

export function clearUserAccessCache(userId?: string) {
 if (userId) {
 cache.delete(userId);
 } else {
 cache.clear();
 }
}

export function invalidatePetCache(userId: string) {
 cache.delete(userId);
}

/**
 * Canonical persona → auth-page route mapping.
 * Single source of truth for role-specific logout/login redirects.
 */
export type AuthPersona ="admin" |"brand" |"vet" |"merchant" |"pet_owner";

export const AUTH_ROUTE_BY_PERSONA: Record<AuthPersona, string> = {
  admin:"/admin",
  brand:"/auth?role=brand",
  vet:"/auth?role=vet",
  merchant:"/auth?role=merchant",
  pet_owner:"/auth?role=pet_owner",
};

/**
 * Resolve the persona for a user from cached access info.
 *
 * Resolution order (most specific → least specific):
 *  1. system_roles contains 'admin' or 'superadmin'           → admin
 *  2. user_type explicitly set ('brand' | 'vet' | 'merchant'  → that persona
 *     | 'pet_owner')
 *  3. capability flags (is_vet, is_merchant)                  → vet / merchant
 *  4. fallback                                                → pet_owner
 */
export function resolveAuthPersona(info: UserAccessInfo | null | undefined): AuthPersona | null {
  if (!info) return null;

  if (
    info.system_roles?.includes("admin") ||
    info.system_roles?.includes("superadmin")
  ) {
    return"admin";
  }

  // Explicit user_type wins — it's the canonical persona field.
  switch (info.user_type) {
    case"brand":
      return"brand";
    case"vet":
      return"vet";
    case"merchant":
      return"merchant";
    case"pet_owner":
      return"pet_owner";
  }

  // Fall back to capability flags when user_type is missing/unknown.
  if (info.is_vet) return"vet";
  if (info.is_merchant) return"merchant";

  return"pet_owner";
}

/**
 * Determine the role-specific auth/login URL for a user based on their
 * cached access info. Falls back to the generic /auth page when no cache
 * entry exists.
 */
export function getAuthRedirectForUser(userId: string): string {
  const entry = cache.get(userId);
  const persona = resolveAuthPersona(entry?.data);
  if (!persona) return"/auth";
  return AUTH_ROUTE_BY_PERSONA[persona];
}

/**
 * Canonical persona → post-login dashboard route mapping.
 * Single source of truth for where each persona lands after authenticating.
 */
export const DASHBOARD_ROUTE_BY_PERSONA: Record<AuthPersona, string> = {
  admin:"/admin",
  brand:"/brand-dashboard",
  vet:"/merchant-dashboard", // vets are stored as merchants
  merchant:"/merchant-dashboard",
  pet_owner:"/dashboard",
};

/**
 * Resolve the post-login dashboard route for a user using the unified
 * access-info RPC (with caching/dedup). This is the AUTHORITATIVE answer —
 * never guess or fall back to the pet-owner dashboard for unknown personas.
 *
 * Order of precedence:
 *   1. system_roles admin/superadmin → /admin
 *   2. user_type explicit (brand/vet/merchant/pet_owner)
 *   3. capability flags (is_vet, is_merchant)
 *   4. fallback → pet_owner
 *
 * If the lookup fails entirely we throw — callers should NOT silently
 * default to /dashboard.
 */
export async function resolvePostLoginRoute(userId: string): Promise<string> {
  const info = await getUserAccessInfo(userId);
  const persona = resolveAuthPersona(info) ??"pet_owner";
  return DASHBOARD_ROUTE_BY_PERSONA[persona];
}
