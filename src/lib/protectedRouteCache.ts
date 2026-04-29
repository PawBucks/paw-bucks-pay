const roleCache = new Map<string, { authorized: boolean; timestamp: number }>();
const petOnboardingCache = new Map<string, { hasPets: boolean; timestamp: number }>();

const ROLE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const PET_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

const clearRoleCache = () => {
 roleCache.clear();
 petOnboardingCache.clear();
};

const clearPetOnboardingCache = () => {
 petOnboardingCache.clear();
};

export {
 roleCache,
 petOnboardingCache,
 ROLE_CACHE_TTL,
 PET_CACHE_TTL,
 clearRoleCache,
 clearPetOnboardingCache,
};
