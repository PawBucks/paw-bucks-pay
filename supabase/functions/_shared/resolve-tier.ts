// Shared tier resolution for pet-owner subscriptions.
//
// PROBLEM THIS SOLVES: Stripe product IDs for PawPass / PawPass+ have changed
// over time (e.g. legacy prod_TJVK9ZhLiJnnpm vs current prod_Tqkqck5HwVvbgw),
// so hard-coded ID checks silently fall back to the Free tier and quietly
// underpay subscribers (e.g. a paying PawPass member earning 10x instead of
// 20x). Resolve tier by PRODUCT NAME, not hard-coded IDs, so new products
// added in Stripe Just Work.

export type ResolvedTier = {
  multiplier: 10 | 20 | 30;
  label: "Free" | "PawPass" | "PawPass+";
  tierKey: "free" | "pawpass" | "pawpass_plus";
};

const FREE: ResolvedTier = { multiplier: 10, label: "Free", tierKey: "free" };
const PAWPASS: ResolvedTier = { multiplier: 20, label: "PawPass", tierKey: "pawpass" };
const PAWPASS_PLUS: ResolvedTier = { multiplier: 30, label: "PawPass+", tierKey: "pawpass_plus" };

function tierFromKey(key?: string | null): ResolvedTier | null {
  const k = (key || "").toLowerCase();
  if (k === "pawpass_plus" || k === "plus") return PAWPASS_PLUS;
  if (k === "pawpass" || k === "basic") return PAWPASS;
  if (k === "free") return FREE;
  return null;
}

function tierFromProductName(name?: string | null): ResolvedTier | null {
  const n = (name || "").toLowerCase();
  if (!n) return null;
  if (n.includes("plus") || n.includes("+")) return PAWPASS_PLUS;
  if (n.includes("pawpass") || n.includes("paw pass")) return PAWPASS;
  return null;
}

/**
 * Resolve a user's earning tier given a DB `subscriptions` row plus a Stripe
 * client. Falls back to live Stripe lookup so that a stale/unfilled
 * `subscription_tier` column never causes a paying user to silently earn at
 * the Free rate.
 */
export async function resolveUserEarnTier(
  stripe: any,
  subscription: {
    stripe_subscription_id?: string | null;
    subscription_tier?: string | null;
    is_manual_upgrade?: boolean | null;
    expires_at?: string | null;
    status?: string | null;
  } | null | undefined,
): Promise<ResolvedTier> {
  if (!subscription) return FREE;

  // Honor expiry on manual upgrades
  const expiresAt = subscription.expires_at ? new Date(subscription.expires_at) : null;
  const stillValid = !expiresAt || expiresAt > new Date();

  if (subscription.is_manual_upgrade && stillValid) {
    const t = tierFromKey(subscription.subscription_tier);
    if (t) return t;
  }

  // Trust DB tier if it's already pawpass/pawpass_plus (status filter is the
  // caller's responsibility — they should query .in('status', ['active','trialing'])).
  if (stillValid) {
    const t = tierFromKey(subscription.subscription_tier);
    if (t && t.tierKey !== "free") return t;
  }

  // DB tier is missing/free — fall back to Stripe so we don't silently underpay.
  if (subscription.stripe_subscription_id && stripe) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
      if (sub && (sub.status === "active" || sub.status === "trialing")) {
        const productId = sub.items?.data?.[0]?.price?.product as string | undefined;
        if (productId) {
          try {
            const product = await stripe.products.retrieve(productId);
            const t = tierFromProductName(product?.name);
            if (t) return t;
          } catch (_err) {
            // ignore — fall through to FREE
          }
        }
      }
    } catch (_err) {
      // ignore — fall through to FREE
    }
  }

  return FREE;
}

/**
 * Map a Stripe Product object to a tier key for persisting in the DB.
 * Used by the webhook so `subscriptions.subscription_tier` is always
 * populated correctly on insert/update.
 */
export function tierKeyFromProductName(name?: string | null): "pawpass_plus" | "pawpass" | null {
  const t = tierFromProductName(name);
  if (!t) return null;
  return t.tierKey === "pawpass_plus" ? "pawpass_plus" : t.tierKey === "pawpass" ? "pawpass" : null;
}