import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { PageLoader } from "@/components/PageLoader";

interface PublicOrAuthRouteProps {
  authedElement: ReactNode;
  publicElement: ReactNode;
}

/**
 * Renders one element for authenticated users, another for guests.
 * Used so public landing/discovery pages don't blank-redirect to /auth.
 */
export const PublicOrAuthRoute = ({ authedElement, publicElement }: PublicOrAuthRouteProps) => {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader message="Loading..." />;
  return <>{user ? authedElement : publicElement}</>;
};