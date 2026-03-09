import { ReactNode, useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { PageLoader } from '@/components/PageLoader';
import { ROUTES } from '@/lib/constants';
import { supabase } from '@/integrations/supabase/client';

type AllowedRole = 'admin' | 'superadmin' | 'merchant' | 'vet' | 'pet_owner';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
  allowedRoles?: AllowedRole[];
  skipPetOnboarding?: boolean;
}

// Module-level cache for role checks - survives across route navigations
const roleCache = new Map<string, { authorized: boolean; timestamp: number }>();
const ROLE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Module-level cache for pet onboarding check
const petOnboardingCache = new Map<string, { hasPets: boolean; timestamp: number }>();
const PET_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

function getCacheKey(userId: string, roles: AllowedRole[]): string {
  return `${userId}:${roles.sort().join(',')}`;
}

// Routes that should NOT enforce pet onboarding (to avoid redirect loops)
const PET_ONBOARDING_EXEMPT_ROUTES = [
  ROUTES.CREATE_PET_PROFILE,
  '/pet-personality-quiz',
  '/merchant-onboarding',
  '/vet-onboarding',
  '/profile',
];

// SECURITY: This is a UX-level check only for routing/navigation purposes.
// All sensitive data operations MUST be validated server-side via edge functions
// that verify auth.uid() and user_roles. Never trust client-supplied role claims
// for authorization of data access or mutations.
export const ProtectedRoute = ({ 
  children, 
  requireAuth = true,
  redirectTo = ROUTES.AUTH,
  allowedRoles,
  skipPetOnboarding = false,
}: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [roleChecked, setRoleChecked] = useState(!allowedRoles);
  const [authorized, setAuthorized] = useState(false);
  const checkingRef = useRef(false);
  
  // Pet onboarding state
  const [petOnboardingChecked, setPetOnboardingChecked] = useState(false);
  const [hasPets, setHasPets] = useState(true); // default true to avoid flash
  const petCheckingRef = useRef(false);

  // Determine if this route is exempt from pet onboarding
  const isExemptRoute = skipPetOnboarding || PET_ONBOARDING_EXEMPT_ROUTES.some(
    route => location.pathname.startsWith(route)
  );

  // Determine if user has a non-pet-owner role (merchants/vets/admins skip pet check)
  const hasNonPetOwnerRole = allowedRoles && allowedRoles.some(
    r => r === 'merchant' || r === 'vet' || r === 'admin' || r === 'superadmin'
  );

  useEffect(() => {
    if (!loading && requireAuth && !user) {
      navigate(redirectTo);
    }
  }, [user, loading, requireAuth, redirectTo, navigate]);

  // Role-based check with caching
  useEffect(() => {
    if (!user || !allowedRoles || loading) return;
    if (checkingRef.current) return;

    const cacheKey = getCacheKey(user.id, allowedRoles);
    const cached = roleCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < ROLE_CACHE_TTL) {
      setAuthorized(cached.authorized);
      setRoleChecked(true);
      return;
    }

    checkingRef.current = true;

    const checkRoles = async () => {
      try {
        let hasAccess = false;

        const systemRoles = allowedRoles.filter(r => r === 'admin' || r === 'superadmin');
        const profileRoles = allowedRoles.filter(r => r !== 'admin' && r !== 'superadmin');

        const checks = await Promise.all([
          systemRoles.length > 0
            ? supabase.from('user_roles').select('role').eq('user_id', user.id).in('role', systemRoles)
            : Promise.resolve({ data: null }),
          profileRoles.includes('merchant')
            ? supabase.from('merchants').select('id').eq('user_id', user.id).limit(1)
            : Promise.resolve({ data: null }),
          profileRoles.includes('vet')
            ? supabase.from('partner_vets').select('id').eq('user_id', user.id).limit(1)
            : Promise.resolve({ data: null }),
          profileRoles.includes('pet_owner')
            ? supabase.from('profiles').select('user_type').eq('id', user.id).single()
            : Promise.resolve({ data: null }),
        ]);

        const [systemResult, merchantResult, vetResult, profileResult] = checks;

        if (systemResult.data && (systemResult.data as any[]).length > 0) hasAccess = true;
        if (!hasAccess && merchantResult.data && (merchantResult.data as any[]).length > 0) hasAccess = true;
        if (!hasAccess && vetResult.data && (vetResult.data as any[]).length > 0) hasAccess = true;
        if (!hasAccess && profileResult.data && (profileResult.data as any).user_type === 'pet_owner') hasAccess = true;

        roleCache.set(cacheKey, { authorized: hasAccess, timestamp: Date.now() });
        setAuthorized(hasAccess);
      } catch (error) {
        console.error('Role check failed:', error);
        setAuthorized(false);
      } finally {
        setRoleChecked(true);
        checkingRef.current = false;
      }
    };

    checkRoles();
  }, [user, allowedRoles, loading]);

  // Pet onboarding check: ensure pet owners have at least one pet
  useEffect(() => {
    // Skip if: no user, still loading, or exempt route
    if (!user || loading || isExemptRoute) {
      setPetOnboardingChecked(true);
      setHasPets(true);
      return;
    }
    if (petCheckingRef.current) return;

    const cached = petOnboardingCache.get(user.id);
    if (cached && Date.now() - cached.timestamp < PET_CACHE_TTL) {
      setHasPets(cached.hasPets);
      setPetOnboardingChecked(true);
      return;
    }

    petCheckingRef.current = true;

    const checkPets = async () => {
      try {
        // Check if user is admin/superadmin, merchant, or vet (they don't need pets)
        const [adminCheck, merchantCheck, vetCheck] = await Promise.all([
          supabase.from('user_roles').select('role').eq('user_id', user.id).in('role', ['admin', 'superadmin']).limit(1),
          supabase.from('merchants').select('id').eq('user_id', user.id).limit(1),
          supabase.from('partner_vets').select('id').eq('user_id', user.id).limit(1),
        ]);

        const isAdminOrMerchantOrVet = 
          (adminCheck.data && adminCheck.data.length > 0) ||
          (merchantCheck.data && merchantCheck.data.length > 0) ||
          (vetCheck.data && vetCheck.data.length > 0);

        if (isAdminOrMerchantOrVet) {
          petOnboardingCache.set(user.id, { hasPets: true, timestamp: Date.now() });
          setHasPets(true);
          setPetOnboardingChecked(true);
          petCheckingRef.current = false;
          return;
        }

        // Check if pet owner has any pets
        const { data, error } = await supabase
          .from('pet_profiles')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);

        const ownerHasPets = !error && !!data && data.length > 0;
        petOnboardingCache.set(user.id, { hasPets: ownerHasPets, timestamp: Date.now() });
        setHasPets(ownerHasPets);
      } catch (error) {
        console.error('Pet onboarding check failed:', error);
        setHasPets(true); // fail open to avoid blocking
      } finally {
        setPetOnboardingChecked(true);
        petCheckingRef.current = false;
      }
    };

    checkPets();
  }, [user, loading, isExemptRoute]);

  if (loading || !roleChecked || !petOnboardingChecked) {
    return <PageLoader message="Authenticating..." />;
  }

  if (requireAuth && !user) {
    return null;
  }

  if (allowedRoles && !authorized) {
    navigate(ROUTES.DASHBOARD, { replace: true });
    return null;
  }

  // Redirect pet owners without pets to create-pet-profile
  if (!hasPets && !isExemptRoute) {
    navigate(ROUTES.CREATE_PET_PROFILE, { replace: true });
    return null;
  }

  return <>{children}</>;
};

// Clear role cache on sign out
export const clearRoleCache = () => {
  roleCache.clear();
  petOnboardingCache.clear();
};

// Clear pet onboarding cache (call after creating first pet)
export const clearPetOnboardingCache = () => petOnboardingCache.clear();
