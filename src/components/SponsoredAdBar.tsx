import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdMerchants } from "@/hooks/useMerchantServices";
import { ArrowRight, Star, Store } from "lucide-react";
import { PawBucksIcon } from "@/components/PawBucksIcon";
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
  /** Kept for backwards compat; no longer used (component is always inline). */
  authed?: boolean;
  ctaBarHeight?: number;
}

interface AdContent {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  ctaLabel: string;
  onCta: () => void;
}

export function SponsoredAdBar({ variant }: SponsoredAdBarProps) {
  const navigate = useNavigate();
  const { data: adMerchants = [] } = useAdMerchants();
  const { subscription, loading: subscriptionLoading } = useSubscription();
  const tick = useAdTick();

  // Don't render anything until subscription status is confirmed —
  // prevents a flash of ads for PawPass+ subscribers on initial load.
  if (subscriptionLoading) return null;

  const tier = getSubscriptionTier(subscription.product_id, subscription.subscription_tier);
  // PawPass+ subscribers don't see ads at all
  if (tier === "pawpass_plus") return null;

  // Pick merchant: offset bottom so top/bottom show different merchants
  let merchantContent: AdContent | null = null;
  if (adMerchants.length > 0) {
    const n = adMerchants.length;
    const offset = variant === "bottom" ? Math.max(1, Math.floor(n / 2)) : 0;
    const m = adMerchants[(tick + offset) % n];
    if (m) {
      merchantContent = {
        icon: m.logo_url ? (
          <img src={m.logo_url} alt="" className="w-full h-full object-cover rounded-xl" loading="lazy" />
        ) : (
          <Store className="w-7 h-7 text-primary" />
        ),
        iconBg: "bg-primary/10 border border-primary/20",
        title: m.business_name,
        description: m.description || `Earn ${m.cashback_rate}x PawBucks at ${m.business_name}.`,
        ctaLabel: "Visit",
        onCta: () => navigate(`/merchant/${m.id}`),
      };
    }
  }

  // Fallback content if no sponsored merchant available
  const fallback: AdContent =
    variant === "top"
      ? {
          icon: <PawBucksIcon className="w-7 h-7" />,
          iconBg: "bg-primary/10 border border-primary/20",
          title: "Discover More Pet Services Near You",
          description: "Find trusted groomers, vets, trainers, and more — all on PawBucks.",
          ctaLabel: "Explore",
          onCta: () => navigate("/discover"),
        }
      : {
          icon: <Star className="w-7 h-7 text-amber-500 fill-amber-400" />,
          iconBg: "bg-primary/10 border border-primary/20",
          title: "Earn More with PawPass+",
          description: "Upgrade to PawPass+ for 30x PawBucks, ad-free browsing, and exclusive deals.",
          ctaLabel: "Upgrade",
          onCta: () => navigate("/profile"),
        };

  const content = merchantContent ?? fallback;

  return (
    <div className="w-full">
      <div className="max-w-4xl mx-auto">
        {/* Sponsored header strip */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/60 rounded-t-xl border border-b-0 border-border">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            Advertisement
          </span>
          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1"
          >
            Remove Ads with PawPass+ <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Body */}
        <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-b-xl shadow-sm">
          <div
            className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden ${content.iconBg}`}
          >
            {content.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground leading-snug">{content.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{content.description}</p>
          </div>
          <button
            type="button"
            onClick={content.onCta}
            className="flex-shrink-0 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition"
          >
            {content.ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SponsoredAdBar;
