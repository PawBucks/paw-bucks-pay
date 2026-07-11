import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  Copy,
  Handshake,
  Lock,
  MapPin,
  Sparkles,
  Store,
  UserPlus,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { PageLoader } from "@/components/PageLoader";
import { useUserLocation } from "@/hooks/useUserLocation";
import { calculateDistance } from "@/lib/geo";
import { toast } from "@/hooks/use-toast";
import { PawBucksLogo } from "@/components/PawBucksLogo";

// --- Data types -----------------------------------------------------------
type OfferType = "new_customer" | "partner_deal" | "pawbucks_redemption";

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
    offer_type: OfferType | string | null;
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

type BrandedEarnRow = {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
  campaign_id: string | null;
  merchant_id: string | null;
  brand_campaigns: {
    id: string;
    name: string;
    campaign_color: string | null;
    campaign_logo_url: string | null;
    end_date?: string | null;
    brand_id: string;
    brand_accounts: {
      id: string;
      brand_name: string;
      logo_url: string | null;
    } | null;
  } | null;
};

// --- Card variant styling per offer type ----------------------------------
const TYPE_META: Record<
  OfferType | "branded",
  {
    label: string;
    Icon: typeof UserPlus;
    badgeClass: string;
    ringClass: string;
    iconBgClass: string;
  }
> = {
  new_customer: {
    label: "NEW CUSTOMER OFFER",
    Icon: UserPlus,
    badgeClass: "bg-info/10 text-info border-info/30",
    ringClass: "border-info/25",
    iconBgClass: "bg-info/10 text-info",
  },
  partner_deal: {
    label: "PARTNER DEAL",
    Icon: Handshake,
    badgeClass: "bg-warning/10 text-warning border-warning/30",
    ringClass: "border-warning/25",
    iconBgClass: "bg-warning/10 text-warning",
  },
  pawbucks_redemption: {
    label: "PAWBUCKS OFFER",
    Icon: PawBucksLogo as unknown as typeof UserPlus,
    badgeClass: "bg-primary/10 text-primary border-primary/30",
    ringClass: "border-primary/25",
    iconBgClass: "bg-primary/10 text-primary",
  },
  branded: {
    label: "BRANDED PAWBUCKS",
    Icon: PawBucksLogo as unknown as typeof UserPlus,
    badgeClass: "bg-accent/10 text-accent border-accent/30",
    ringClass: "border-accent/25",
    iconBgClass: "bg-accent/10 text-accent",
  },
};

function normalizeOfferType(v: string | null | undefined): OfferType {
  if (v === "new_customer" || v === "partner_deal" || v === "pawbucks_redemption") return v;
  return "partner_deal";
}

// --- Page ----------------------------------------------------------------
const MyDeals = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { userLocation, requestLocation } = useUserLocation();
  const [asked, setAsked] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [tab, setTab] = useState<"active" | "redeemed">("active");

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!asked) {
      setAsked(true);
      requestLocation();
    }
  }, [asked, requestLocation]);

  // 1) All unlocked redemptions for this user (both new_customer & partner_deal)
  const { data: redemptions = [], isLoading: redLoading } = useQuery({
    queryKey: ["my-deals-redemptions", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("offer_redemptions")
        .select(
          `id, offer_id, redemption_code, redeemed_at, partner_confirmed, created_at,
           partner_offers:offer_id (
             id, title, description, end_date, partner_id, is_active, status, offer_type,
             merchants:partner_id ( id, business_name, address, latitude, longitude, fee_model )
           )`,
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as RedemptionRow[];
    },
  });

  const unlockedOfferIds = useMemo(
    () => new Set(redemptions.map((r) => r.offer_id)),
    [redemptions],
  );

  // 2) Branded PawBucks earn events — surface as "Active" deal cards grouped by campaign
  const { data: brandedRows = [], isLoading: brandedLoading } = useQuery({
    queryKey: ["my-deals-branded", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("branded_pawbucks_activity")
        .select(
          `id, amount, type, description, created_at, campaign_id, merchant_id,
           brand_campaigns:campaign_id (
             id, name, campaign_color, campaign_logo_url, end_date, brand_id,
             brand_accounts:brand_id ( id, brand_name, logo_url )
           )`,
        )
        .eq("user_id", user!.id)
        .eq("type", "earn")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as BrandedEarnRow[];
    },
  });

  // Group branded earn rows by campaign; one card per campaign showing total earned.
  const brandedCards = useMemo(() => {
    const byCampaign = new Map<
      string,
      {
        id: string;
        name: string;
        brandName: string | null;
        logo: string | null;
        color: string | null;
        end_date: string | null;
        totalEarned: number;
        lastAt: string;
      }
    >();
    for (const r of brandedRows) {
      const c = r.brand_campaigns;
      if (!c) continue;
      const existing = byCampaign.get(c.id);
      if (existing) {
        existing.totalEarned += Number(r.amount || 0);
        if (r.created_at > existing.lastAt) existing.lastAt = r.created_at;
      } else {
        byCampaign.set(c.id, {
          id: c.id,
          name: c.name,
          brandName: c.brand_accounts?.brand_name ?? null,
          logo: c.campaign_logo_url ?? c.brand_accounts?.logo_url ?? null,
          color: c.campaign_color ?? null,
          end_date: c.end_date ?? null,
          totalEarned: Number(r.amount || 0),
          lastAt: r.created_at,
        });
      }
    }
    return [...byCampaign.values()].sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
  }, [brandedRows]);

  // 3) Locked nearby: acquisition-only merchants with active offers user hasn't unlocked
  const { data: lockedRaw = [], isLoading: lockedLoading } = useQuery({
    queryKey: ["my-deals-locked"],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await (supabase as any)
        .from("partner_offers")
        .select(
          `id, partner_id, end_date, start_date, is_active, status, offer_type,
           merchants:partner_id ( id, business_name, address, latitude, longitude, fee_model, is_active )`,
        )
        .eq("is_active", true);
      if (error) throw error;
      const rows = (data || []) as Array<any>;
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
    for (const r of lockedRaw as any[]) {
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

  // Split redemptions into active/redeemed
  const activeRedemptions = useMemo(
    () => redemptions.filter((r) => !r.redeemed_at),
    [redemptions],
  );
  const redeemedRedemptions = useMemo(
    () => redemptions.filter((r) => !!r.redeemed_at),
    [redemptions],
  );

  const activeCount = activeRedemptions.length + brandedCards.length;
  const redeemedCount = redeemedRedemptions.length;

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

  const loading = redLoading || brandedLoading;

  return (
    <div className="min-h-screen bg-background pb-24">
      <SEO
        title="My Deals — PawBucks"
        description="Every unlocked offer and brand-sponsored reward in one place."
      />
      <Header isAuthenticated onLogout={signOut} userId={user?.id} />

      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-5">
        <section className="space-y-1">
          <h1 className="text-3xl font-bold">My Deals</h1>
          <p className="text-muted-foreground text-sm">
            Scan a merchant's in-store QR to unlock their offers. Everything you unlock lives here.
          </p>
        </section>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "redeemed")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="active">Active ({activeCount})</TabsTrigger>
            <TabsTrigger value="redeemed">Redeemed ({redeemedCount})</TabsTrigger>
          </TabsList>

          {/* -------- Active tab -------- */}
          <TabsContent value="active" className="mt-4 space-y-3">
            {loading ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                Loading your deals…
              </Card>
            ) : activeCount === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground space-y-2">
                <Sparkles className="w-6 h-6 mx-auto text-accent" aria-hidden="true" />
                <p className="font-medium text-foreground">No active deals yet</p>
                <p>Visit a participating merchant and scan their QR code to unlock offers.</p>
              </Card>
            ) : (
              <>
                {activeRedemptions.map((r) => (
                  <RedemptionCard
                    key={r.id}
                    r={r}
                    copyCode={copyCode}
                    copiedCode={copiedCode}
                    onMerchantClick={(id) => navigate(`/merchant/${id}`)}
                    redeemed={false}
                  />
                ))}
                {brandedCards.map((c) => (
                  <BrandedCard key={c.id} c={c} />
                ))}
              </>
            )}

            {/* Locked nearby (discover more) */}
            {lockedMerchants.length > 0 && (
              <div className="pt-4 space-y-3">
                <div className="flex items-end justify-between gap-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                    <Lock className="w-4 h-4" aria-hidden="true" />
                    Discover More Nearby
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/discover")}
                  >
                    See all <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {lockedMerchants.slice(0, 4).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => navigate(`/merchant/${m.id}`)}
                      className="text-left"
                    >
                      <Card className="p-4 h-full bg-background hover:shadow-[var(--shadow-medium)] transition-all">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                            <Lock
                              className="w-4 h-4 text-muted-foreground"
                              aria-hidden="true"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold truncate text-sm">
                              {m.business_name}
                            </h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {m.offer_count} deal{m.offer_count === 1 ? "" : "s"} to unlock
                            </p>
                            {m.address && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5">
                                <MapPin className="w-3 h-3" aria-hidden="true" />
                                <span className="truncate">{m.address}</span>
                                {m.distance != null && (
                                  <span className="ml-1 shrink-0">
                                    · {m.distance.toFixed(1)} mi
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* -------- Redeemed tab -------- */}
          <TabsContent value="redeemed" className="mt-4 space-y-3">
            {loading ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                Loading…
              </Card>
            ) : redeemedCount === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                No deals redeemed yet.
              </Card>
            ) : (
              redeemedRedemptions.map((r) => (
                <RedemptionCard
                  key={r.id}
                  r={r}
                  copyCode={copyCode}
                  copiedCode={copiedCode}
                  onMerchantClick={(id) => navigate(`/merchant/${id}`)}
                  redeemed
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>

      <BottomNav />
    </div>
  );
};

export default MyDeals;

// --- Card components ------------------------------------------------------
function RedemptionCard({
  r,
  redeemed,
  copyCode,
  copiedCode,
  onMerchantClick,
}: {
  r: RedemptionRow;
  redeemed: boolean;
  copyCode: (code: string) => void;
  copiedCode: string | null;
  onMerchantClick: (id: string) => void;
}) {
  const offer = r.partner_offers;
  const m = offer?.merchants;
  const type = normalizeOfferType(offer?.offer_type ?? null);
  const meta = TYPE_META[type];
  const Icon = meta.Icon;

  return (
    <Card className={`p-4 space-y-3 border ${meta.ringClass}`}>
      <div className="flex items-start gap-3">
        <div
          className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${meta.iconBgClass}`}
        >
          <Icon className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          {m ? (
            <button
              onClick={() => onMerchantClick(m.id)}
              className="text-sm font-semibold hover:underline flex items-center gap-1"
            >
              <Store className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{m.business_name}</span>
            </button>
          ) : (
            <span className="text-sm font-semibold">Merchant</span>
          )}
          <Badge className={`${meta.badgeClass} mt-1 text-[10px] tracking-wider`}>
            {meta.label}
          </Badge>
          <h3 className="font-bold text-lg mt-1 truncate">
            {offer?.title || "Deal"}
          </h3>
          {offer?.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {offer.description}
            </p>
          )}
          {offer?.end_date && (
            <p className="text-xs text-muted-foreground mt-1">
              Expires {new Date(offer.end_date).toLocaleDateString()}
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
          redeemed ? "bg-muted/40 border-border" : "bg-background border-border"
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
    </Card>
  );
}

function BrandedCard({
  c,
}: {
  c: {
    id: string;
    name: string;
    brandName: string | null;
    logo: string | null;
    color: string | null;
    end_date: string | null;
    totalEarned: number;
  };
}) {
  const meta = TYPE_META.branded;
  return (
    <Card className={`p-4 border ${meta.ringClass}`}>
      <div className="flex items-start gap-3">
        <div
          className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 overflow-hidden ${
            c.logo ? "bg-muted" : meta.iconBgClass
          }`}
          style={
            c.color && !c.logo
              ? { backgroundColor: c.color + "22" }
              : undefined
          }
        >
          {c.logo ? (
            <img src={c.logo} alt={c.brandName ?? c.name} className="w-full h-full object-cover" />
          ) : (
            <PawBucksLogo className="w-5 h-5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">
            {c.brandName ?? c.name}
          </div>
          <Badge className={`${meta.badgeClass} mt-1 text-[10px] tracking-wider`}>
            {meta.label}
          </Badge>
          <h3 className="font-bold text-lg mt-1">
            Earned {c.totalEarned.toLocaleString()} PB
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {c.name}
          </p>
          {c.end_date && (
            <p className="text-xs text-muted-foreground mt-1">
              Campaign ends {new Date(c.end_date).toLocaleDateString()}
            </p>
          )}
        </div>
        <Badge className="bg-primary/10 text-primary border-primary/30 shrink-0 flex items-center gap-1">
          <PawBucksLogo className="w-3 h-3" />
          +{c.totalEarned.toLocaleString()}
        </Badge>
      </div>
    </Card>
  );
}