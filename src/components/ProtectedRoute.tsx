import { ReactNode, useEffect, useState, useRef } from'react';
import { Navigate, useNavigate, useLocation } from'react-router-dom';
import { useAuth } from'@/hooks/useAuth';
import { PageLoader } from'@/components/PageLoader';
import { ROUTES } from'@/lib/constants';
import {
 getUserAccessInfo,
 resolveAuthPersona,
 DASHBOARD_ROUTE_BY_PERSONA,
 type UserAccessInfo,
} from'@/lib/userAccessCache';

type AllowedRole ='admin' |'superadmin' |'merchant' |'vet' |'pet_owner' |'brand';

interface ProtectedRouteProps {
 children: ReactNode;
 requireAuth?: boolean;
 redirectTo?: string;
 allowedRoles?: AllowedRole[];
 skipPetOnboarding?: boolean;
}

// Routes that should NOT enforce pet onboarding
const PET_ONBOARDING_EXEMPT_ROUTES = [
 ROUTES.CREATE_PET_PROFILE,
'/pet-personality-quiz',
'/merchant-onboarding',
'/vet-onboarding',
'/profile',
];

/**
 * Check if user has the required role based on unified access info.
 */
function checkRoleAccess(info: UserAccessInfo, allowedRoles: AllowedRole[]): boolean {
 for (const role of allowedRoles) {
 if (role ==='admin' || role ==='superadmin') {
 if (info.system_roles.includes(role)) return true;
 } else if (role ==='merchant') {
 if (info.is_merchant || info.user_type ==='merchant') return true;
 } else if (role ==='vet') {
 if (info.is_vet || info.user_type ==='vet') return true;
 } else if (role ==='pet_owner') {
 if (info.user_type ==='pet_owner') return true;
 } else if (role ==='brand') {
 if (info.user_type ==='brand') return true;
 }
 }
 return false;
}

/**
 * Check if user needs pet onboarding.
 */
function needsPetOnboarding(info: UserAccessInfo): boolean {
 // Non-pet-owners never need pet onboarding
 if (
 info.system_roles.includes('admin') ||
 info.system_roles.includes('superadmin') ||
 info.is_merchant ||
 info.is_vet ||
 info.user_type ==='merchant' ||
 info.user_type ==='admin' ||
 info.user_type ==='brand'
 ) {
 return false;
 }
 return !info.has_pets && !info.has_shared_pets;
}

// SECURITY: This is a UX-level check only for routing/navigation purposes.
// All sensitive data operations MUST be validated server-side.
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
 const [checkDone, setCheckDone] = useState(false);
 const [authorized, setAuthorized] = useState(false);
 const [hasPets, setHasPets] = useState(true);
 const [roleRedirectTo, setRoleRedirectTo] = useState(ROUTES.DASHBOARD);
 const checkingRef = useRef(false);

 const isExemptRoute = skipPetOnboarding || PET_ONBOARDING_EXEMPT_ROUTES.some(
 route => location.pathname.startsWith(route)
 );

 useEffect(() => {
 if (!loading && requireAuth && !user) {
 navigate(redirectTo);
 }
 }, [user, loading, requireAuth, redirectTo, navigate]);

 // Single unified access check
 useEffect(() => {
 if (!user || loading) return;
 if (checkingRef.current) return;

 // If no role check and exempt from pet check, skip everything
 if (!allowedRoles && isExemptRoute) {
 setAuthorized(true);
 setHasPets(true);
 setCheckDone(true);
 return;
 }

 checkingRef.current = true;

 getUserAccessInfo(user.id)
 .then((info) => {
 // Role check
 const roleOk = allowedRoles ? checkRoleAccess(info, allowedRoles) : true;
 setAuthorized(roleOk);

  const persona = resolveAuthPersona(info);
  setRoleRedirectTo(persona ? DASHBOARD_ROUTE_BY_PERSONA[persona] : ROUTES.AUTH);

 // Pet onboarding check
 if (isExemptRoute) {
 setHasPets(true);
 } else {
 setHasPets(!needsPetOnboarding(info));
 }
 })
 .catch((err) => {
 console.error('Access check failed:', err);
 setAuthorized(!allowedRoles); // fail open for non-role routes
 setHasPets(true);
 })
 .finally(() => {
 setCheckDone(true);
 checkingRef.current = false;
 });
 }, [user, loading, allowedRoles, isExemptRoute]);

 if (loading || !checkDone) {
 return <PageLoader message="Authenticating..." />;
 }

 if (requireAuth && !user) {
 return null;
 }

 if (allowedRoles && !authorized) {
  return <Navigate to={roleRedirectTo} replace />;
 }

 if (!hasPets && !isExemptRoute) {
 navigate(ROUTES.CREATE_PET_PROFILE, { replace: true });
 return null;
 }

 return <>{children}</>;
};
