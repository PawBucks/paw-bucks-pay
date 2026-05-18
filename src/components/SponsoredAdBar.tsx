import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdMerchants } from "@/hooks/useMerchantServices";
import { ChevronRight, Store } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { getSubscriptionTier } from "@/lib/constants";

// Shared ticker so multiple SponsoredAdBar instances rotate in lockstep,
// while per-variant offsets keep top/bottom showing different merchants.
let __adTick = 0;
const __adTickListeners = new Set<() => void>();
let __adTickInterval: ReturnType<typeof setInterval> | null = null;

function useAdTick() {
  const [, force] = useState(0);
  useEffect(() => {
    const listener = () => force((n) => n + 1);
    __adTickListeners.add(listener);
    if (!__adTickInterval) {
      __adTickInterval = setInterval(() => {
        __adTick += 1;
        __adTickListeners.forEach((l) => l());
      }, 15000);
    }
    return () => {
      __adTickListeners.delete(listener);
      if (__adTickListeners.size === 0 && __adTickInterval) {
        clearInterval(__adTickInterval);
        __adTickInterval = null;
      }
    };
  }, []);
  return __adTick;
}

interface SponsoredAdBarProps {
  variant: "top" | "bottom";
  authed?: boolean;
  /** Extra px to lift the bottom bar above an additional fixed element (e.g. a sticky CTA bar). */
  ctaBarHeight?: number;
}

export function SponsoredAdBar({ variant, authed = false, ctaBarHeight = 0 }: SponsoredAdBarProps) {
  const navigate = useNavigate();
  const { data: adMerchants = [] } = useAdMerchants();
  const { subscription } = useSubscription();
  const tick = useAdTick();
  const [dismissed, setDismissed] = useState(false);

  const tier = getSubscriptionTier(subscription.product_id, subscription.subscription_tier);
  if (tier === "pawpass_plus") return null;
  if (dismissed || adMerchants.length === 0) return null;

  const n = adMerchants.length;
  const offset = variant === "bottom" ? Math.max(1, Math.floor(n / 2)) : 0;
  const m = adMerchants[(tick + offset) % n];
  if (!m) return null;

  const card = (
    <button
      type="button"
      onClick={() => navigate(`/merchant/${m.id}`)}
      className="w-full flex items-center gap-3 h-14 pl-2 pr-3 rounded-xl bg-card/95 backdrop-blur border border-border shadow-lg hover:shadow-xl transition text-left"
    >
      {m.logo_url ? (
        <img
          src={m.logo_url}
          alt=""
          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
          loading="lazy"
        />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Store className="w-5 h-5 text-primary" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Sponsored
          </span>
          <span className="text-muted-foreground/40 text-[10px]">·</span>
          <span className="text-[10px] font-semibold text-success">
            {m.cashback_rate}x points
          </span>
        </div>
        <p className="text-sm font-semibold text-foreground truncate leading-tight">
          {m.business_name}
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    </button>
  );

  if (variant === "top") {
    return <div className="max-w-4xl mx-auto">{card}</div>;
  }

  const navHeight = authed ? 64 : 0;
  const bottomStyle = {
    bottom: `calc(${navHeight + ctaBarHeight}px + env(safe-area-inset-bottom) + 12px)`,
  };
  // On desktop (md+), BottomNav is hidden, so drop the nav offset there.
  const mdBottomStyle = {
    bottom: `calc(${ctaBarHeight}px + env(safe-area-inset-bottom) + 16px)`,
  } as React.CSSProperties;

  return (
    <div
      className="fixed inset-x-0 z-40 px-3 pointer-events-none"
      style={bottomStyle}
    >
      <div className="max-w-4xl mx-auto pointer-events-auto">{card}</div>
    </div>
  );
}

export default SponsoredAdBar;
