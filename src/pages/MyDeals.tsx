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

type LockedOffer = {
  id: string;
  title: string;
  description: string | null;
  end_date: string | null;
  offer_type: OfferType;
  merchant: {
    id: string;
    business_name: string;
    address: string | null;
    fee_model: string | null;
  } | null;
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
    // Merchant confirmation happens on their device — keep this fresh so the
    // deal flips from Active to Redeemed shortly after the code is entered.
    refetchInterval: 20000,
    refetchOnWindowFocus: true,
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

  // 3) Every active offer on the platform (partner + non-partner merchants)
  const { data: lockedRaw = [], isLoading: lockedLoading } = useQuery({
    queryKey: ["my-deals-all-active-offers"],
    queryFn: async () => {
      // Uses the same server-side source as the Redeem page so both stay in sync.
      const { data, error } = await supabase.functions.invoke("get-partner-offers");
      if (error) throw error;
      const rows = ((data as any)?.offers || []) as Array<any>;
      return rows.filter((r) => !r.merchants?.is_paused);
    },
    staleTime: 1000 * 60 * 5,
  });

  // Locked = active offer the pet owner hasn't unlocked with an in-store QR scan yet
  const lockedOffers: LockedOffer[] = useMemo(() => {
    const list: LockedOffer[] = [];
    for (const r of lockedRaw as any[]) {
      if (unlockedOfferIds.has(r.id)) continue;
      const m = r.merchants;
      const distance =
        userLocation && m?.latitude != null && m?.longitude != null
          ? calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              m.latitude,
              m.longitude,
            )
          : null;
      list.push({
        id: r.id,
        title: r.title ?? "Deal",
        description: r.description ?? null,
        end_date: r.end_date ?? null,
        offer_type: normalizeOfferType(r.offer_type),
        merchant: m
          ? {
              id: m.id,
              business_name: m.business_name,
              address: m.address,
              fee_model: m.fee_model,
            }
          : null,
        distance,
      });
    }
    return list.sort((a, b) => {
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

  const activeCount =
    activeRedemptions.length + brandedCards.length + lockedOffers.length;
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

  const loading = redLoading || brandedLoading || lockedLoading;

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

                {lockedOffers.length > 0 && (
                  <div className="pt-4 space-y-3">
                    <div className="flex items-end justify-between gap-2">
                      <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                        <Lock className="w-4 h-4" aria-hidden="true" />
                        Locked — scan in-store to reveal ({lockedOffers.length})
                      </h3>
                      <Button variant="ghost" size="sm" onClick={() => navigate("/discover")}>
                        Find nearby <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {lockedOffers.map((o) => (
                        <LockedOfferCard
                          key={o.id}
                          o={o}
                          onMerchantClick={(id) => navigate(`/merchant/${id}`)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
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

function LockedOfferCard({
  o,
  onMerchantClick,
}: {
  o: LockedOffer;
  onMerchantClick: (id: string) => void;
}) {
  const meta = TYPE_META[o.offer_type];
  const Icon = meta.Icon;
  const isPartner = o.merchant?.fee_model === "full_ecosystem";

  return (
    <Card className="p-4 space-y-3 border border-border relative overflow-hidden">
      <div className="flex items-start gap-3">
        <div
          className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${meta.iconBgClass}`}
        >
          <Icon className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          {o.merchant ? (
            <button
              onClick={() => onMerchantClick(o.merchant!.id)}
              className="text-sm font-semibold hover:underline flex items-center gap-1"
            >
              <Store className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{o.merchant.business_name}</span>
            </button>
          ) : (
            <span className="text-sm font-semibold">Merchant</span>
          )}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <Badge className={`${meta.badgeClass} text-[10px] tracking-wider`}>
              {meta.label}
            </Badge>
            <Badge variant="outline" className="text-[10px] tracking-wider">
              {isPartner ? "PARTNER" : "NON-PARTNER"}
            </Badge>
          </div>

          {/* Details visible; only the redemption code stays hidden until QR check-in */}
          <div className="mt-1">
            <h3 className="font-bold text-lg truncate">{o.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {o.description || "Scan this merchant's in-store QR code to unlock your code."}
            </p>
          </div>


          {o.merchant?.address && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5">
              <MapPin className="w-3 h-3" aria-hidden="true" />
              <span className="truncate">{o.merchant.address}</span>
              {o.distance != null && (
                <span className="ml-1 shrink-0">· {o.distance.toFixed(1)} mi</span>
              )}
            </div>
          )}
        </div>
        <Badge className="bg-muted text-muted-foreground border-border shrink-0 flex items-center gap-1">
          <Lock className="w-3 h-3" aria-hidden="true" /> Locked
        </Badge>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Redemption code
          </div>
          <div className="font-mono text-lg font-semibold truncate blur-[6px] select-none">
            XXXX-XXXX
          </div>
        </div>
        <span className="text-xs text-muted-foreground text-right shrink-0">
          Scan in-store QR to unlock
        </span>
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