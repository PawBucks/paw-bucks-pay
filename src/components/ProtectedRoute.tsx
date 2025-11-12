import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { PageLoader } from '@/components/PageLoader';
import { ROUTES } from '@/lib/constants';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
}

// Protected route wrapper for authentication checks
export const ProtectedRoute = ({ 
  children, 
  requireAuth = true,
  redirectTo = ROUTES.AUTH
}: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && requireAuth && !user) {
      navigate(redirectTo);
    }
  }, [user, loading, requireAuth, redirectTo, navigate]);

  if (loading) {
    return <PageLoader message="Authenticating..." />;
  }

  if (requireAuth && !user) {
    return null;
  }

  return <>{children}</>;
};
