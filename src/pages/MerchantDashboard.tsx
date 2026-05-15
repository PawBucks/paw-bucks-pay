import { Navigate, useSearchParams } from "react-router-dom";

/**
 * Legacy /merchant-dashboard route.
 *
 * The standalone dashboard has been retired in favor of the unified
 * Merchant Workspace. Every legacy ?tab=... value is mapped to its
 * dedicated workspace route so deep links continue to work.
 */
const TAB_REDIRECTS: Record<string, string> = {
  overview: "/merchant/workspace",
  analytics: "/merchant/total-earnings",
  reports: "/merchant/sales-report",
  history: "/merchant/daily-history",
  confirmations: "/merchant/sale-confirmations",
  checkins: "/merchant/check-ins",
  subscribers: "/merchant/subscribers",
  loyalty: "/merchant/loyalty",
  premium: "/merchant/premium-services",
  actions: "/merchant/business-profile",
  messages: "/merchant/messages",
  "brand-campaigns": "/merchant/brand-campaigns",
  promotions: "/merchant/promotions",
  support: "/merchant/support",
  profile: "/merchant/business-profile",
  transactions: "/merchant/transactions",
  "tax-vault": "/merchant/tax-vault",
};

const MerchantDashboard = () => {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab");
  const target = (tab && TAB_REDIRECTS[tab]) || "/merchant/workspace";
  return <Navigate to={target} replace />;
};

export default MerchantDashboard;