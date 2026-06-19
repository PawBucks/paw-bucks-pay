import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, X, FileText, Info, ChevronRight } from "lucide-react";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import { useUserEarnRate } from "@/hooks/useUserEarnRate";
import { useUserLocation } from "@/hooks/useUserLocation";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { calculateDistance, formatDistance } from "@/lib/geo";
import { getCategoryEmoji, getCategoryLabel } from "@/lib/categoryMapping";

type NearbyMerchant = {
  id: string;
  business_name: string;
  business_type: string | null;
  latitude: number | null;
  longitude: number | null;
  cashback_rate: number | null;
};

const SimpleSuccess = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const { rate: earnMultiplier } = useUserEarnRate();
  const { userLocation, requestLocation } = useUserLocation();
  const [infoOpen, setInfoOpen] = useState(false);

  const merchantName = params.get("merchant") || "the merchant";
  const excludeId = params.get("mid") || "";
  const amountPaid = parseFloat(params.get("paid") ?? "0") || 0;
  const pbEarned = parseInt(params.get("pb") ?? "0", 10) || 0;
  const receiptId = params.get("tx") || "";

  // Try to grab user location quietly so we can rank nearby merchants.
  // If denied, we still show a generic carousel.
  useEffect(() => {
    if (!userLocation) requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: nearbyRaw = [] } = useQuery({
    queryKey: ["success-nearby", excludeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("merchants")
        .select("id, business_name, business_type, latitude, longitude, cashback_rate")
        .eq("onboarding_complete", true)
        .eq("stripe_account_status", "active")
        .neq("id", excludeId || "00000000-0000-0000-0000-000000000000")
        .limit(40);
      return (data || []) as NearbyMerchant[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const nearbyMerchants = useMemo(() => {
    const list = nearbyRaw.map((m) => {
      const d =
        userLocation && m.latitude != null && m.longitude != null
          ? calculateDistance(userLocation.latitude, userLocation.longitude, m.latitude, m.longitude)
          : null;
      return { ...m, distance: d };
    });
    list.sort((a, b) => {
      if (a.distance == null && b.distance == null) return 0;
      if (a.distance == null) return 1;
      if (b.distance == null) return -1;
      return a.distance - b.distance;
    });
    return list.slice(0, 8);
  }, [nearbyRaw, userLocation]);

  const earnRateLabel = `${earnMultiplier}x`;

  const onClose = () => navigate("/home");
  const onViewReceipt = () => navigate(receiptId ? `/activity?tx=${receiptId}` : "/activity");

  return (
    <div
      className="fixed inset-0 z-[400] flex items-end justify-center bg-foreground/55 backdrop-blur-md"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <SEO title="Payment complete — PawBucks" noIndex />
      <div className="w-full max-w-[480px] max-h-[92vh] overflow-y-auto bg-card rounded-t-[20px] shadow-[0_-8px_40px_rgba(10,31,38,0.2)] animate-in slide-in-from-bottom-8 duration-300">
        {/* Drag handle */}
        <div className="relative h-4">
          <div className="absolute left-1/2 top-[10px] -translate-x-1/2 w-9 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-border">
          <span className="text-[17px] font-extrabold tracking-tight text-foreground">Success</span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-[30px] h-[30px] rounded-full bg-muted text-muted-foreground hover:bg-muted/80 flex items-center justify-center transition-colors"
          >
            <X className="h-[15px] w-[15px]" strokeWidth={2} />
          </button>
        </div>

        {/* Success state */}
        <div className="px-6 pt-8 text-center">
          <div className="mx-auto mb-[22px] h-[76px] w-[76px] rounded-full bg-success flex items-center justify-center shadow-[0_8px_24px_hsl(var(--success)/0.25)] animate-in zoom-in-50 duration-500">
            <Check className="h-9 w-9 text-success-foreground" strokeWidth={3} />
          </div>
          <h1 className="text-[23px] font-extrabold tracking-tight text-foreground mb-2">
            Payment Successful
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            Your payment to <strong className="text-foreground">{merchantName}</strong>
            {amountPaid > 0 && (
              <>
                {" "}of <strong className="text-foreground">${amountPaid.toFixed(2)}</strong>
              </>
            )}{" "}
            went through.
          </p>
        </div>

        {/* PawBucks earned callout */}
        {pbEarned > 0 && (
          <div className="px-5">
            <div className="relative flex items-center justify-between gap-3 rounded-[14px] border-[1.5px] border-primary/30 bg-[image:linear-gradient(135deg,hsl(var(--primary)/0.08),hsl(var(--primary)/0.02))] py-3.5 pl-[60px] pr-4">
              {/* Badge icon (pentagon shield) */}
              <div
                className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-[46px] h-[52px] flex items-center justify-center shadow-[0_4px_10px_hsl(var(--gold)/0.35)]"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--gold)), hsl(38, 92%, 38%))",
                  clipPath: "polygon(0 0, 100% 0, 100% 75%, 50% 100%, 0 75%)",
                }}
              >
                <span className="text-[18px] -mt-1.5 leading-none">🐾</span>
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-bold leading-snug text-foreground">
                  You earned{" "}
                  <span className="text-primary font-extrabold">
                    {pbEarned.toLocaleString()} PawBucks
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {earnRateLabel} rewards rate · added to your wallet
                </div>
              </div>
              <button
                onClick={() => setInfoOpen((o) => !o)}
                aria-label="What are PawBucks?"
                className="flex-shrink-0 w-[26px] h-[26px] rounded-full border border-primary/30 bg-card/60 text-primary flex items-center justify-center hover:bg-primary/10 transition-colors"
              >
                <Info className="h-[13px] w-[13px]" />
              </button>
            </div>
            {infoOpen && (
              <div className="mt-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                PawBucks are earned on the USD portion of every purchase. They're automatically credited to your wallet and can be redeemed at any PawBucks merchant.
              </div>
            )}
          </div>
        )}

        {/* View receipt */}
        <div className="px-5 pt-3">
          <button
            onClick={onViewReceipt}
            className="w-full flex items-center justify-center gap-2 px-3 py-3.5 rounded-xl border border-border bg-card text-sm font-semibold text-foreground hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <FileText className="h-4 w-4" />
            View your receipt
          </button>
        </div>

        {/* Keep exploring */}
        <div className="px-5 pt-7 pb-1 flex items-baseline justify-between">
          <div>
            <h2 className="text-base font-extrabold tracking-tight text-foreground">
              Keep earning PawBucks
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Spend your rewards at these spots nearby
            </p>
          </div>
          <button
            onClick={() => navigate("/discover")}
            className="flex items-center gap-0.5 text-[13px] font-semibold text-primary flex-shrink-0"
          >
            View All
            <ChevronRight className="h-[13px] w-[13px]" strokeWidth={2.5} />
          </button>
        </div>

        {/* Cross-sell carousel */}
        <div
          className="flex gap-3 overflow-x-auto px-5 py-3 pb-6"
          style={{ scrollbarWidth: "none" }}
        >
          {nearbyMerchants.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4">
              Discover more merchants near you.
            </div>
          ) : (
            nearbyMerchants.map((m) => {
              const emoji = getCategoryEmoji(m.business_type);
              const label = getCategoryLabel(m.business_type);
              const rate = Math.round((m.cashback_rate || 0) * earnMultiplier) || earnMultiplier;
              return (
                <button
                  key={m.id}
                  onClick={() => navigate(`/merchant/${m.id}`)}
                  className="flex-shrink-0 w-[158px] text-left"
                >
                  <div className="relative h-[110px] rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-center text-4xl mb-2 overflow-hidden">
                    <span aria-hidden="true">{emoji}</span>
                    {m.distance != null && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-foreground/65 text-background text-[10px] font-semibold">
                        {formatDistance(m.distance)}
                      </div>
                    )}
                    <div className="absolute bottom-2 right-2 px-1.5 py-[2px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                      {rate}x PB
                    </div>
                  </div>
                  <div className="text-[13px] font-bold text-foreground leading-tight mb-0.5 truncate">
                    {m.business_name}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">{label}</div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default SimpleSuccess;