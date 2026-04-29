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
 * Determine the role-specific auth/login URL for a user based on their
 * cached access info. Falls back to the generic /auth page.
 *
 * Priority: admin/superadmin → /admin
 *           brand           → /auth?role=brand
 *           vet             → /auth?role=vet
 *           merchant        → /auth?role=merchant
 *           pet_owner       → /auth?role=pet_owner
 *           default         → /auth
 */
export function getAuthRedirectForUser(userId: string): string {
  const entry = cache.get(userId);
  const info = entry?.data;
  if (!info) return"/auth";

  if (
    info.system_roles?.includes("admin") ||
    info.system_roles?.includes("superadmin")
  ) {
    return"/admin";
  }
  if (info.user_type ==="brand") return"/auth?role=brand";
  if (info.is_vet || info.user_type ==="vet") return"/auth?role=vet";
  if (info.is_merchant || info.user_type ==="merchant") return"/auth?role=merchant";
  if (info.user_type ==="pet_owner") return"/auth?role=pet_owner";
  return"/auth";
}
