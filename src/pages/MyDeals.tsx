import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, CheckCircle2, Copy, Lock, MapPin, Sparkles, Store } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GradientCard } from "@/components/ui/gradient-card";
import { PageLoader } from "@/components/PageLoader";
import { useUserLocation } from "@/hooks/useUserLocation";
import { calculateDistance } from "@/lib/geo";
import { toast } from "@/hooks/use-toast";

type RedemptionRow = {
  id: string;
  offer_id: string;
  redemption_code: string;
  redeemed_at: string | null;
  partner_confirmed: boolean | null;
  created_at: string;
  partner_offers: {
    id: string;
    title: string;
    description: string | null;
    end_date: string | null;
    partner_id: string;
    is_active: boolean | null;
    status: string | null;
    merchants: {
      id: string;
      business_name: string;
      address: string | null;
      latitude: number | null;
      longitude: number | null;
      fee_model: string | null;
    } | null;
  } | null;
};

type LockedMerchant = {
  id: string;
  business_name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  fee_model: string | null;
  offer_count: number;
  distance: number | null;
};

const MyDeals = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { userLocation, requestLocation } = useUserLocation();
  const [asked, setAsked] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!asked) {
      setAsked(true);
      requestLocation();
    }
  }, [asked, requestLocation]);

  // 1) Unlocked redemptions for this user (acquisition-only only)
  const { data: redemptions = [], isLoading: redLoading } = useQuery({
    queryKey: ["my-deals-redemptions", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("offer_redemptions")
        .select(
          `id, offer_id, redemption_code, redeemed_at, partner_confirmed, created_at,
           partner_offers:offer_id (
             id, title, description, end_date, partner_id, is_active, status,
             merchants:partner_id ( id, business_name, address, latitude, longitude, fee_model )
           )`,
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as RedemptionRow[];
    },
  });

  const acquisitionRedemptions = useMemo(
    () =>
      redemptions.filter(
        (r) => r.partner_offers?.merchants?.fee_model === "acquisition_only",
      ),
    [redemptions],
  );

  const unlockedOfferIds = useMemo(
    () => new Set(acquisitionRedemptions.map((r) => r.offer_id)),
    [acquisitionRedemptions],
  );
  const unlockedMerchantIds = useMemo(
    () =>
      new Set(
        acquisitionRedemptions
          .map((r) => r.partner_offers?.merchants?.id)
          .filter(Boolean) as string[],
      ),
    [acquisitionRedemptions],
  );

  // 2) Locked: nearby acquisition-only merchants with active offers that user hasn't unlocked
  const { data: lockedRaw = [], isLoading: lockedLoading } = useQuery({
    queryKey: ["my-deals-locked"],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await (supabase as any)
        .from("partner_offers")
        .select(
          `id, partner_id, end_date, start_date, is_active, status,
           merchants:partner_id ( id, business_name, address, latitude, longitude, fee_model, is_active )`,
        )
        .eq("is_active", true);
      if (error) throw error;
      const rows = (data || []) as Array<{
        id: string;
        partner_id: string;
        end_date: string | null;
        start_date: string | null;
        is_active: boolean | null;
        status: string | null;
        merchants: {
          id: string;
          business_name: string;
          address: string | null;
          latitude: number | null;
          longitude: number | null;
          fee_model: string | null;
          is_active: boolean | null;
        } | null;
      }>;
      return rows.filter(
        (r) =>
          (!r.status || r.status === "active") &&
          (!r.start_date || r.start_date <= nowIso) &&
          (!r.end_date || r.end_date >= nowIso) &&
          r.merchants?.is_active &&
          r.merchants?.fee_model === "acquisition_only",
      );
    },
    staleTime: 1000 * 60 * 5,
  });

  const lockedMerchants: LockedMerchant[] = useMemo(() => {
    const byMerchant = new Map<string, LockedMerchant>();
    for (const r of lockedRaw) {
      if (unlockedOfferIds.has(r.id)) continue;
      const m = r.merchants;
      if (!m) continue;
      const distance =
        userLocation && m.latitude != null && m.longitude != null
          ? calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              m.latitude,
              m.longitude,
            )
          : null;
      const existing = byMerchant.get(m.id);
      if (existing) {
        existing.offer_count += 1;
      } else {
        byMerchant.set(m.id, {
          id: m.id,
          business_name: m.business_name,
          address: m.address,
          latitude: m.latitude,
          longitude: m.longitude,
          fee_model: m.fee_model,
          offer_count: 1,
          distance,
        });
      }
    }
    return [...byMerchant.values()].sort((a, b) => {
      if (a.distance == null && b.distance == null) return 0;
      if (a.distance == null) return 1;
      if (b.distance == null) return -1;
      return a.distance - b.distance;
    });
  }, [lockedRaw, unlockedOfferIds, userLocation]);

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast({ title: "Code copied", description: code });
      setTimeout(() => setCopiedCode((c) => (c === code ? null : c)), 1500);
    } catch {
      toast({ title: "Couldn't copy", description: code, variant: "destructive" });
    }
  };

  if (authLoading || !user) return <PageLoader />;

  const unlockedCount = acquisitionRedemptions.length;
  const redeemedCount = acquisitionRedemptions.filter((r) => !!r.redeemed_at).length;
  const readyCount = unlockedCount - redeemedCount;

  return (
    <div className="min-h-screen bg-background pb-24">
      <SEO
        title="My New Customer Deals — PawBucks"
        description="Track the New Customer deals you've unlocked and find new ones to scan in-store."
      />
      <Header />

      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-8">
        {/* Hero / summary */}
        <section className="space-y-2">
          <Badge className="bg-accent/10 text-accent border-accent/30">
            <Sparkles className="w-3 h-3 mr-1" aria-hidden="true" />
            New Customer Deals
          </Badge>
          <h1 className="text-3xl font-bold">My Deals</h1>
          <p className="text-muted-foreground">
            Codes you've unlocked by scanning a merchant's in-store QR — plus
            deals still waiting for you to visit.
          </p>

          <div className="grid grid-cols-3 gap-2 pt-3">
            <GradientCard className="text-center py-3">
              <div className="text-2xl font-bold">{unlockedCount}</div>
              <div className="text-xs text-muted-foreground">Unlocked</div>
            </GradientCard>
            <GradientCard className="text-center py-3">
              <div className="text-2xl font-bold text-success">{readyCount}</div>
              <div className="text-xs text-muted-foreground">Ready to use</div>
            </GradientCard>
            <GradientCard className="text-center py-3">
              <div className="text-2xl font-bold text-muted-foreground">
                {redeemedCount}
              </div>
              <div className="text-xs text-muted-foreground">Redeemed</div>
            </GradientCard>
          </div>
        </section>

        {/* Unlocked */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-success" aria-hidden="true" />
            Unlocked Codes
          </h2>

          {redLoading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Loading your unlocked deals…
            </div>
          ) : acquisitionRedemptions.length === 0 ? (
            <GradientCard className="text-sm text-muted-foreground text-center py-6">
              You haven't unlocked any New Customer deals yet. Visit a
              participating store and scan their QR code to unlock.
            </GradientCard>
          ) : (
            <div className="space-y-3">
              {acquisitionRedemptions.map((r) => {
                const offer = r.partner_offers;
                const m = offer?.merchants;
                const redeemed = !!r.redeemed_at;
                return (
                  <GradientCard key={r.id} className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">
                          {offer?.title || "New Customer Deal"}
                        </h3>
                        {m && (
                          <button
                            onClick={() => navigate(`/merchant/${m.id}`)}
                            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mt-0.5"
                          >
                            <Store className="w-3 h-3" aria-hidden="true" />
                            <span className="truncate">{m.business_name}</span>
                          </button>
                        )}
                        {offer?.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {offer.description}
                          </p>
                        )}
                      </div>
                      {redeemed ? (
                        <Badge className="bg-muted text-muted-foreground border-border shrink-0">
                          <Check className="w-3 h-3 mr-1" /> Redeemed
                        </Badge>
                      ) : (
                        <Badge className="bg-success/10 text-success border-success/30 shrink-0">
                          Ready
                        </Badge>
                      )}
                    </div>

                    <div
                      className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 ${
                        redeemed
                          ? "bg-muted/40 border-border"
                          : "bg-accent/5 border-accent/30"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Redemption code
                        </div>
                        <div className="font-mono text-lg font-semibold truncate">
                          {r.redemption_code}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={redeemed ? "outline" : "default"}
                        onClick={() => copyCode(r.redemption_code)}
                      >
                        {copiedCode === r.redemption_code ? (
                          <>
                            <Check className="w-4 h-4 mr-1" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-1" /> Copy
                          </>
                        )}
                      </Button>
                    </div>

                    {offer?.end_date && !redeemed && (
                      <p className="text-xs text-muted-foreground">
                        Expires {new Date(offer.end_date).toLocaleDateString()}
                      </p>
                    )}
                  </GradientCard>
                );
              })}
            </div>
          )}
        </section>

        {/* Locked */}
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-2">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Lock className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
              Still Locked Near You
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/discover")}
            >
              See all <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {lockedLoading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Loading nearby deals…
            </div>
          ) : lockedMerchants.length === 0 ? (
            <GradientCard className="text-sm text-muted-foreground text-center py-6">
              {unlockedMerchantIds.size > 0
                ? "You've unlocked every nearby New Customer deal — nice work!"
                : "No locked New Customer deals nearby right now."}
            </GradientCard>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {lockedMerchants.map((m) => (
                <button
                  key={m.id}
                  onClick={() => navigate(`/merchant/${m.id}`)}
                  className="text-left"
                >
                  <GradientCard className="h-full hover:shadow-[var(--shadow-medium)] transition-all">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Lock
                          className="w-5 h-5 text-muted-foreground"
                          aria-hidden="true"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">
                          {m.business_name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {m.offer_count} New Customer{" "}
                          {m.offer_count === 1 ? "deal" : "deals"} to unlock
                        </p>
                        {m.address && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                            <MapPin className="w-3 h-3" aria-hidden="true" />
                            <span className="truncate">{m.address}</span>
                            {m.distance != null && (
                              <span className="ml-1 shrink-0">
                                · {m.distance.toFixed(1)} mi
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-xs text-accent mt-2 font-medium">
                          Scan in-store QR to unlock
                        </div>
                      </div>
                    </div>
                  </GradientCard>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  );
};

export default MyDeals;