import { ReactNode, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
}

// Module-level cache for role checks - survives across route navigations
const roleCache = new Map<string, { authorized: boolean; timestamp: number }>();
const ROLE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(userId: string, roles: AllowedRole[]): string {
  return `${userId}:${roles.sort().join(',')}`;
}

// SECURITY: This is a UX-level check only for routing/navigation purposes.
// All sensitive data operations MUST be validated server-side via edge functions
// that verify auth.uid() and user_roles. Never trust client-supplied role claims
// for authorization of data access or mutations.
export const ProtectedRoute = ({ 
  children, 
  requireAuth = true,
  redirectTo = ROUTES.AUTH,
  allowedRoles,
}: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [roleChecked, setRoleChecked] = useState(!allowedRoles);
  const [authorized, setAuthorized] = useState(false);
  const checkingRef = useRef(false);

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
    
    // Use cache if fresh
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

        // Run ALL checks in parallel instead of sequential
        const checks = await Promise.all([
          // System roles check
          systemRoles.length > 0
            ? supabase.from('user_roles').select('role').eq('user_id', user.id).in('role', systemRoles)
            : Promise.resolve({ data: null }),
          // Merchant check
          profileRoles.includes('merchant')
            ? supabase.from('merchants').select('id').eq('user_id', user.id).limit(1)
            : Promise.resolve({ data: null }),
          // Vet check
          profileRoles.includes('vet')
            ? supabase.from('partner_vets').select('id').eq('user_id', user.id).limit(1)
            : Promise.resolve({ data: null }),
          // Pet owner check
          profileRoles.includes('pet_owner')
            ? supabase.from('profiles').select('user_type').eq('id', user.id).single()
            : Promise.resolve({ data: null }),
        ]);

        const [systemResult, merchantResult, vetResult, profileResult] = checks;

        if (systemResult.data && (systemResult.data as any[]).length > 0) hasAccess = true;
        if (!hasAccess && merchantResult.data && (merchantResult.data as any[]).length > 0) hasAccess = true;
        if (!hasAccess && vetResult.data && (vetResult.data as any[]).length > 0) hasAccess = true;
        if (!hasAccess && profileResult.data && (profileResult.data as any).user_type === 'pet_owner') hasAccess = true;

        // Cache the result
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

  if (loading || !roleChecked) {
    return <PageLoader message="Authenticating..." />;
  }

  if (requireAuth && !user) {
    return null;
  }

  if (allowedRoles && !authorized) {
    navigate(ROUTES.DASHBOARD, { replace: true });
    return null;
  }

  return <>{children}</>;
};

// Clear role cache on sign out
export const clearRoleCache = () => roleCache.clear();
