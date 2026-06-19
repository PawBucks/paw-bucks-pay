import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  HelpCircle,
  Lock,
  MapPin,
  Sparkles,
  Store,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageLoader } from "@/components/PageLoader";
import { useUserLocation } from "@/hooks/useUserLocation";
import { calculateDistance } from "@/lib/geo";
import { toast } from "@/hooks/use-toast";
import { PawBucksLogo } from "@/components/PawBucksLogo";
import { getCategoryEmoji } from "@/lib/categoryMapping";
import { format } from "date-fns";

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

type BrandedActivityRow = {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
  campaign_id: string | null;
  merchant_id: string | null;
  brand_campaigns: {
    id: string;
    name: string;
    campaign_color: string | null;
    campaign_logo_url: string | null;
    brand_id: string;
    brand_accounts: { id: string; brand_name: string; logo_url: string | null } | null;
  } | null;
};

const MyDeals = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
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

  // 3) Branded PawBucks campaign activity (earn/redeem) for this user
  const { data: brandedActivity = [], isLoading: brandedLoading } = useQuery({
    queryKey: ["my-deals-branded-activity", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("branded_pawbucks_activity")
        .select(
          `id, type, amount, description, created_at, campaign_id, merchant_id,
           brand_campaigns:campaign_id (
             id, name, campaign_color, campaign_logo_url, brand_id,
             brand_accounts:brand_id ( id, brand_name, logo_url )
           )`,
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as BrandedActivityRow[];
    },
  });

  const brandedTotals = useMemo(() => {
    let earned = 0;
    let redeemed = 0;
    for (const a of brandedActivity) {
      const amt = Number(a.amount || 0);
      if (a.type === "earn") earned += amt;
      else if (a.type === "redeem") redeemed += amt;
    }
    return { earned, redeemed };
  }, [brandedActivity]);

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
      <Header isAuthenticated onLogout={signOut} userId={user?.id} />

      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        {/* Hero / summary */}
        <section className="space-y-2">
          <h1 className="text-3xl font-bold">My Deals</h1>
          <p className="text-muted-foreground">
            Two ways to save: in-store deal codes you've unlocked, plus PawBucks earned from brand-sponsored campaigns.
          </p>

          <div className="grid grid-cols-3 gap-2 pt-3">
            <Card className="p-4 text-center py-3">
              <div className="text-2xl font-bold">{unlockedCount}</div>
              <div className="text-xs text-muted-foreground">Unlocked</div>
            </Card>
            <Card className="p-4 text-center py-3">
              <div className="text-2xl font-bold text-success">{readyCount}</div>
              <div className="text-xs text-muted-foreground">Ready to use</div>
            </Card>
            <Card className="p-4 text-center py-3">
              <div className="text-2xl font-bold text-muted-foreground">
                {redeemedCount}
              </div>
              <div className="text-xs text-muted-foreground">Redeemed</div>
            </Card>
          </div>
        </section>

        {/* ============================================================ */}
        {/* FEATURE 1 — New Customer Deals (in-store QR unlocks)          */}
        {/* ============================================================ */}
        <section className="space-y-5 rounded-2xl border border-accent/20 bg-accent/5 p-4 sm:p-5">
          <div className="space-y-1">
            <Badge className="bg-accent/15 text-accent border-accent/30">
              <Sparkles className="w-3 h-3 mr-1" aria-hidden="true" />
              New Customer Deals
            </Badge>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-success" aria-hidden="true" />
              Unlocked Codes
            </h2>
            <p className="text-sm text-muted-foreground">
              Scan a merchant's in-store QR to unlock their welcome offer.
            </p>
          </div>

          {redLoading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Loading your unlocked deals…
            </div>
          ) : acquisitionRedemptions.length === 0 ? (
            <Card className="p-4 text-sm text-muted-foreground text-center py-6">
              You haven't unlocked any New Customer deals yet. Visit a
              participating store and scan their QR code to unlock.
            </Card>
          ) : (
            <div className="space-y-3">
              {acquisitionRedemptions.map((r) => {
                const offer = r.partner_offers;
                const m = offer?.merchants;
                const redeemed = !!r.redeemed_at;
                return (
                  <Card key={r.id} className="p-4 space-y-3">
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
                  </Card>
                );
              })}
            </div>
          )}

          {/* Locked nearby — same feature */}
          <div className="space-y-3 pt-3 border-t border-accent/15">
            <div className="flex items-end justify-between gap-2">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                Still Locked Near You
              </h3>
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
              <Card className="p-4 text-sm text-muted-foreground text-center py-6 bg-background">
                {unlockedMerchantIds.size > 0
                  ? "You've unlocked every nearby New Customer deal — nice work!"
                  : "No locked New Customer deals nearby right now."}
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {lockedMerchants.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => navigate(`/merchant/${m.id}`)}
                    className="text-left"
                  >
                    <Card className="p-4 h-full bg-background hover:shadow-[var(--shadow-medium)] transition-all">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center shrink-0">
                          <Lock
                            className="w-5 h-5 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold truncate">
                            {m.business_name}
                          </h4>
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
                    </Card>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Visual separator between the two distinct features */}
        <div className="flex items-center gap-3" aria-hidden="true">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            And
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* ============================================================ */}
        {/* FEATURE 2 — Branded Campaign Rewards (sponsor PawBucks)       */}
        {/* ============================================================ */}
        <section className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
          <div className="flex items-end justify-between gap-2">
            <div className="space-y-1">
              <Badge className="bg-primary/15 text-primary border-primary/30">
                <PawBucksLogo className="w-3 h-3 mr-1" />
                Sponsor Rewards
              </Badge>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <PawBucksLogo className="w-5 h-5" />
                Branded Campaign Rewards
              </h2>
              <p className="text-sm text-muted-foreground">
                PawBucks you've earned or redeemed from brand-sponsored campaigns.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                toast({
                  title: "About Branded Campaigns",
                  description:
                    "Brands sponsor extra PawBucks on top of merchant cashback. Earn at participating stores; redeem like normal PawBucks.",
                })
              }
              className="text-muted-foreground hover:text-foreground"
              aria-label="About branded campaigns"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>

          {brandedLoading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Loading campaign rewards…
            </div>
          ) : brandedActivity.length === 0 ? (
            <Card className="p-4 text-sm text-muted-foreground text-center py-6">
              No branded campaign activity yet. Check in or shop at participating
              merchants to start earning brand-sponsored PawBucks.
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Card className="p-4 text-center py-3">
                  <div className="text-2xl font-bold text-success">
                    +{brandedTotals.earned.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">PB earned from campaigns</div>
                </Card>
                <Card className="p-4 text-center py-3">
                  <div className="text-2xl font-bold">
                    {brandedTotals.redeemed.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">PB redeemed</div>
                </Card>
              </div>

              <div className="space-y-2">
                {brandedActivity.map((a) => {
                  const isEarn = a.type === "earn";
                  const campaignName = a.brand_campaigns?.name || "Brand campaign";
                  const brandName = a.brand_campaigns?.brand_accounts?.brand_name;
                  const logo =
                    a.brand_campaigns?.campaign_logo_url ||
                    a.brand_campaigns?.brand_accounts?.logo_url ||
                    null;
                  return (
                    <Card key={a.id} className="p-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden"
                          style={
                            a.brand_campaigns?.campaign_color
                              ? { backgroundColor: a.brand_campaigns.campaign_color + "22" }
                              : undefined
                          }
                        >
                          {logo ? (
                            <img
                              src={logo}
                              alt={brandName || campaignName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <PawBucksLogo className="w-5 h-5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-medium truncate text-sm">
                              {campaignName}
                            </h3>
                            <span
                              className={`font-mono font-semibold text-sm shrink-0 ${
                                isEarn ? "text-success" : "text-foreground"
                              }`}
                            >
                              {isEarn ? "+" : "−"}
                              {Number(a.amount || 0).toLocaleString()} PB
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mt-0.5">
                            <span className="truncate">
                              {brandName ? `by ${brandName}` : "Brand campaign"}
                              {a.description ? ` · ${a.description}` : ""}
                            </span>
                            <span className="shrink-0">
                              {format(new Date(a.created_at), "MMM d")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
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
            <Card className="p-4 text-sm text-muted-foreground text-center py-6">
              {unlockedMerchantIds.size > 0
                ? "You've unlocked every nearby New Customer deal — nice work!"
                : "No locked New Customer deals nearby right now."}
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {lockedMerchants.map((m) => (
                <button
                  key={m.id}
                  onClick={() => navigate(`/merchant/${m.id}`)}
                  className="text-left"
                >
                  <Card className="p-4 h-full hover:shadow-[var(--shadow-medium)] transition-all">
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
                  </Card>
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