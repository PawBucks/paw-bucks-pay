import { ReactNode, useEffect, useState } from 'react';
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
  /** If set, checks user_roles table for admin/superadmin, or profiles.user_type for merchant/vet/pet_owner */
  allowedRoles?: AllowedRole[];
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

  useEffect(() => {
    if (!loading && requireAuth && !user) {
      navigate(redirectTo);
    }
  }, [user, loading, requireAuth, redirectTo, navigate]);

  // Role-based check
  useEffect(() => {
    if (!user || !allowedRoles || loading) return;

    const checkRoles = async () => {
      try {
        let hasAccess = false;

        // Check admin/superadmin roles via user_roles table
        const systemRoles = allowedRoles.filter(r => r === 'admin' || r === 'superadmin');
        if (systemRoles.length > 0) {
          const { data } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .in('role', systemRoles);
          if (data && data.length > 0) hasAccess = true;
        }

        // Check profile-based roles (merchant, vet, pet_owner)
        const profileRoles = allowedRoles.filter(r => r !== 'admin' && r !== 'superadmin');
        if (!hasAccess && profileRoles.length > 0) {
          // Check merchant
          if (profileRoles.includes('merchant')) {
            const { data } = await supabase
              .from('merchants')
              .select('id')
              .eq('user_id', user.id)
              .limit(1);
            if (data && data.length > 0) hasAccess = true;
          }
          // Check vet
          if (!hasAccess && profileRoles.includes('vet')) {
            const { data } = await supabase
              .from('partner_vets')
              .select('id')
              .eq('user_id', user.id)
              .limit(1);
            if (data && data.length > 0) hasAccess = true;
          }
          // Check pet_owner via profiles
          if (!hasAccess && profileRoles.includes('pet_owner')) {
            const { data } = await supabase
              .from('profiles')
              .select('user_type')
              .eq('id', user.id)
              .single();
            if (data?.user_type === 'pet_owner') hasAccess = true;
          }
        }

        setAuthorized(hasAccess);
      } catch (error) {
        console.error('Role check failed:', error);
        setAuthorized(false);
      } finally {
        setRoleChecked(true);
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
    // Redirect unauthorized users to their appropriate dashboard
    navigate(ROUTES.DASHBOARD, { replace: true });
    return null;
  }

  return <>{children}</>;
};
