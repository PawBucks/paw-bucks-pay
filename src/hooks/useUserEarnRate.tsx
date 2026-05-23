import { useSubscription } from "./useSubscription";
import { POINTS_MULTIPLIER } from "@/lib/constants";

/**
 * Returns the PawBucks earn multiplier (PawBucks per $1) for the current user
 * based on their active subscription tier. This mirrors the server-side logic
 * used by create-direct-charge / create-payment-intent / create-combined-payment,
 * so the UI shows the same earn rate the backend will actually credit.
 *
 * Free       => 10x
 * PawPass    => 20x
 * PawPass+   => 30x
 */
export function useUserEarnRate(): { rate: number; tierLabel: "Free" | "PawPass" | "PawPass+"; loading: boolean } {
  const { subscription, loading } = useSubscription();

  const tier = (subscription?.subscription_tier || "").toLowerCase();
  const productId = subscription?.product_id || "";

  if (
    tier === "pawpass_plus" ||
    tier === "plus" ||
    productId === "prod_TQyZjYzt9DwoIK" ||
    productId === "manual_pawpass_plus" ||
    productId.toLowerCase().includes("plus")
  ) {
    return { rate: POINTS_MULTIPLIER.PAWPASS_PLUS, tierLabel: "PawPass+", loading };
  }

  if (
    tier === "pawpass" ||
    tier === "basic" ||
    productId === "prod_TJVK9ZhLiJnnpm" ||
    productId === "manual_pawpass" ||
    (productId.toLowerCase().includes("pawpass") && !productId.toLowerCase().includes("plus"))
  ) {
    return { rate: POINTS_MULTIPLIER.PAWPASS, tierLabel: "PawPass", loading };
  }

  return { rate: POINTS_MULTIPLIER.FREE, tierLabel: "Free", loading };
}