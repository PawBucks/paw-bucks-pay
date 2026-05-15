import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ServicePurchaseDialog } from "@/components/merchant/ServicePurchaseDialog";
import { ConsultationScheduleDialog } from "@/components/merchant/ConsultationScheduleDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, AlertTriangle, MapPin, Tag } from "lucide-react";
import { PawBucksLogo } from "@/components/PawBucksLogo";
import { MerchantWorkspaceLayout, WorkspacePageHeader } from "@/components/merchant/workspace/MerchantWorkspaceLayout";

type ServiceCategory = "visibility" | "analytics" | "growth" | "premium";

type Service = {
  id: string;
  name: string;
  description: string | null;
  short_description: string | null;
  benefits: string[];
  priceUSD: number;
  pricePawBucks: number;
  category: ServiceCategory;
  icon: string | null;
  popular?: boolean;
  newService?: boolean;
  billingPeriod?: "one_time" | "monthly" | "quarterly" | "yearly";
};

type GeoCellAvailability = {
  serviceId: string;
  maxSlots: number;
  usedSlots: number;
  availableSlots: number;
  cellName: string;
};

type Merchant = { id: string; business_name: string };

const CATEGORY_META: Record<ServiceCategory, { label: string; icon: string; desc: string }> = {
  visibility: { label: "Visibility & Promotion", icon: "📣", desc: "Boost your presence and get discovered by more pet owners" },
  analytics:  { label: "Analytics & Insights",   icon: "📈", desc: "Data-driven tools to understand and grow your business" },
  growth:     { label: "Growth & Optimization",  icon: "🚀", desc: "Expert services to accelerate your business growth" },
  premium:    { label: "Premium & Exclusive",    icon: "👑", desc: "Elite benefits for serious merchants" },
};

const CATEGORY_ORDER: ServiceCategory[] = ["visibility", "analytics", "growth", "premium"];

const formatBillingFreq = (period?: string) => {
  switch (period) {
    case "monthly":   return "Monthly · Recurring";
    case "quarterly": return "Quarterly · Recurring";
    case "yearly":    return "Annual · Recurring";
    case "one_time":  return "One-Time Purchase";
    default:          return "One-Time Purchase";
  }
};

const formatBillingSuffix = (period?: string) => {
  switch (period) {
    case "monthly":   return "/mo";
    case "quarterly": return "/qtr";
    case "yearly":    return "/yr";
    default:          return "";
  }
};

const MerchantMarket = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | "all">("all");
  const [activeOnly, setActiveOnly] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [showConsultationDialog, setShowConsultationDialog] = useState(false);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [scarcityMap, setScarcityMap] = useState<Record<string, GeoCellAvailability>>({});
  const [activeServiceIds, setActiveServiceIds] = useState<Set<string>>(new Set());
  const [pricePref, setPricePref] = useState<Record<string, "usd" | "pb">>({});

  // Auth gate
  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  // Load merchant + services + active services
  useEffect(() => {
    const load = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from("merchants")
          .select("id, business_name")
          .eq("user_id", user.id)
          .single();
        if (error) {
          if (error.code === "PGRST116") { navigate("/merchant-onboarding"); return; }
          throw error;
        }
        setMerchant(data);

        const { data: svcRows } = await supabase
          .from("merchant_market_services")
          .select("*")
          .eq("is_active", true)
          .order("display_order", { ascending: true });

        const transformed: Service[] = (svcRows || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          short_description: s.short_description,
          benefits: Array.isArray(s.features) ? (s.features as string[]) : [],
          priceUSD: Number(s.price_usd),
          pricePawBucks: s.price_pawbucks,
          category: s.category as ServiceCategory,
          icon: s.icon,
          popular: s.is_popular,
          newService: s.is_new,
          billingPeriod: s.billing_type as Service["billingPeriod"],
        }));
        setServices(transformed);

        // Active services for this merchant
        const { data: activeRows } = await supabase
          .from("merchant_active_services_public")
          .select("service_id")
          .eq("merchant_id", data.id);
        setActiveServiceIds(new Set((activeRows || []).map((r: any) => r.service_id)));
      } catch (err) {
        console.error("MerchantMarket load error", err);
        toast.error("Failed to load marketplace");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, navigate]);

  // Geo-cell scarcity
  useEffect(() => {
    const loadScarcity = async () => {
      if (!merchant) return;
      try {
        const { data: cellId } = await supabase.rpc("get_merchant_geo_cell", { p_merchant_id: merchant.id });
        if (!cellId) return;
        const { data: cellData } = await supabase.from("geo_cells").select("name").eq("id", cellId).single();
        const cellName = cellData?.name || "your area";
        const { data: limits } = await supabase
          .from("geo_cell_service_limits")
          .select("service_id, max_slots")
          .eq("geo_cell_id", cellId)
          .eq("is_active", true);
        if (!limits?.length) return;
        const { data: reservations } = await supabase
          .from("geo_cell_slot_reservations")
          .select("service_id")
          .eq("geo_cell_id", cellId)
          .eq("is_active", true)
          .gt("expires_at", new Date().toISOString());
        const map: Record<string, GeoCellAvailability> = {};
        for (const limit of limits) {
          const usedSlots = (reservations || []).filter((r: any) => r.service_id === limit.service_id).length;
          map[limit.service_id] = {
            serviceId: limit.service_id,
            maxSlots: limit.max_slots,
            usedSlots,
            availableSlots: Math.max(0, limit.max_slots - usedSlots),
            cellName,
          };
        }
        setScarcityMap(map);
      } catch (err) {
        console.error("scarcity error", err);
      }
    };
    loadScarcity();
  }, [merchant]);

  useEffect(() => {
    if (searchParams.get("purchase") === "success") {
      toast.success("Service purchased successfully!");
      navigate("/merchant/market", { replace: true });
    }
  }, [searchParams, navigate]);

  const handlePurchase = (service: Service) => {
    if (!user) { toast.error("Please log in to purchase services"); return; }
    setSelectedService(service);
    setShowPurchaseDialog(true);
  };

  const handlePurchaseSuccess = () => {
    toast.success(`${selectedService?.name} has been activated for your account!`);
    setSelectedService(null);
    setShowPurchaseDialog(false);
  };

  const filteredServices = useMemo(() => services.filter((s) => {
    if (selectedCategory !== "all" && s.category !== selectedCategory) return false;
    if (activeOnly && !activeServiceIds.has(s.id)) return false;
    return true;
  }), [services, selectedCategory, activeOnly, activeServiceIds]);

  const grouped = useMemo(() => {
    const map: Record<ServiceCategory, Service[]> = { visibility: [], analytics: [], growth: [], premium: [] };
    filteredServices.forEach((s) => { map[s.category]?.push(s); });
    return map;
  }, [filteredServices]);

  if (authLoading || loading) {
    return (
      <MerchantWorkspaceLayout>
        <WorkspacePageHeader section="Catalog & Services" title="Services Marketplace" subtitle="Spend earned PawBucks on tools, analytics, and growth services" />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MerchantWorkspaceLayout>
    );
  }
  if (!merchant) return null;

  const totalCount = filteredServices.length;
  const activeCount = services.filter((s) => activeServiceIds.has(s.id)).length;

  return (
    <MerchantWorkspaceLayout>
      <SEO title="Services Marketplace · Merchant Workspace" description="Spend earned PawBucks on tools, analytics, and growth services for your pet business." />
      <WorkspacePageHeader
        section="Catalog & Services"
        title="Services Marketplace"
        subtitle="Spend earned PawBucks on tools, analytics, and growth services for your pet business"
        actions={
          <span className="hidden sm:inline-flex items-center gap-2 rounded-full border border-border bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Tag className="w-3.5 h-3.5" /> Marketplace
          </span>
        }
      />
      <main className="max-w-7xl mx-auto pb-24 w-full">
        {/* PAGE HEADER */}
        <section className="px-4 md:px-10 pt-10 md:pt-14">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary mb-3">
            Merchant Marketplace
          </p>
          <h1 className="font-display text-3xl md:text-5xl font-black leading-[1.05] tracking-tight text-foreground mb-3">
            Grow your business with <em className="not-italic md:italic text-primary">earned PawBucks</em>.
          </h1>
          <p className="text-base text-muted-foreground max-w-2xl leading-relaxed">
            Spend your earned PawBucks on tools, analytics, advertising, and support to grow your pet business.
          </p>
        </section>

        {/* DISCOUNT BANNER */}
        <section className="px-4 md:px-10 mt-8">
          <div className="rounded-md bg-foreground text-background px-5 md:px-8 py-5 flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-4 min-w-0">
              <PawBucksLogo className="text-2xl" aria-hidden />
              <p className="text-sm md:text-[0.95rem] leading-snug">
                Pay with PawBucks and get <strong className="text-primary">50% off every service</strong>.
                Earn PawBucks from every customer transaction — then reinvest them here.
              </p>
            </div>
            <div className="rounded border border-primary/30 bg-primary/10 px-4 py-2 text-xs text-primary">
              Example: <strong>$100</strong> service = <strong>50,000 PB</strong> ($50)
            </div>
          </div>
        </section>

        {/* FILTER BAR */}
        <section className="px-4 md:px-10 mt-8 border-b border-border pb-4 flex flex-wrap items-center gap-2">
          <FilterPill active={selectedCategory === "all"} onClick={() => setSelectedCategory("all")}>
            All Services
          </FilterPill>
          {CATEGORY_ORDER.map((cat) => (
            <FilterPill
              key={cat}
              active={selectedCategory === cat}
              onClick={() => setSelectedCategory(cat)}
            >
              <span className="mr-1.5" aria-hidden>{CATEGORY_META[cat].icon}</span>
              {CATEGORY_META[cat].label}
            </FilterPill>
          ))}
          <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <Checkbox
              checked={activeOnly}
              onCheckedChange={(v) => setActiveOnly(Boolean(v))}
            />
            Show only my active services {activeCount > 0 && <span className="text-xs">({activeCount})</span>}
          </label>
        </section>

        {/* CATEGORY GROUPS */}
        <section className="px-4 md:px-10 mt-10 space-y-14">
          {totalCount === 0 ? (
            <EmptyState onClear={() => { setSelectedCategory("all"); setActiveOnly(false); }} />
          ) : (
            CATEGORY_ORDER
              .filter((cat) => selectedCategory === "all" || selectedCategory === cat)
              .map((cat) => {
                const items = grouped[cat];
                if (!items || items.length === 0) return null;
                const meta = CATEGORY_META[cat];
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-3 pb-3 border-b border-border mb-5">
                      <span className="text-xl" aria-hidden>{meta.icon}</span>
                      <h2 className="font-display text-xl md:text-2xl font-bold text-foreground">{meta.label}</h2>
                      <span className="rounded-full border border-border bg-primary/10 text-primary px-2 py-0.5 text-[0.7rem] font-medium">
                        {items.length}
                      </span>
                      <span className="hidden md:inline ml-auto text-sm text-muted-foreground">{meta.desc}</span>
                    </div>
                    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
                      {items.map((service) => (
                        <ServiceCard
                          key={service.id}
                          service={service}
                          isActive={activeServiceIds.has(service.id)}
                          scarcity={scarcityMap[service.id]}
                          pref={pricePref[service.id] || "usd"}
                          onPrefChange={(p) => setPricePref((m) => ({ ...m, [service.id]: p }))}
                          onPurchase={() => handlePurchase(service)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })
          )}
        </section>

        {/* CONSULTATION CTA */}
        <section className="px-4 md:px-10 mt-16">
          <div className="rounded-md border border-border bg-muted/30 p-8 text-center">
            <h2 className="font-display text-2xl font-bold mb-2">Not sure where to start?</h2>
            <p className="text-muted-foreground mb-5 max-w-lg mx-auto text-sm">
              Book a free 15-minute consultation with our merchant success team to find the perfect services for your business goals.
            </p>
            <Button size="lg" onClick={() => setShowConsultationDialog(true)}>
              Schedule Free Consultation
            </Button>
          </div>
        </section>
      </main>

      <ConsultationScheduleDialog
        open={showConsultationDialog}
        onOpenChange={setShowConsultationDialog}
        merchantName={merchant?.business_name}
      />
      {user && (
        <ServicePurchaseDialog
          open={showPurchaseDialog}
          onOpenChange={setShowPurchaseDialog}
          service={selectedService}
          userId={user.id}
          onSuccess={handlePurchaseSuccess}
        />
      )}
    </MerchantWorkspaceLayout>
  );
};

/* ─── Sub-components ─────────────────────────────────────────────────── */

const FilterPill = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={cn(
      "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
      active
        ? "bg-primary text-primary-foreground border-primary"
        : "bg-card text-muted-foreground border-border hover:border-primary hover:text-primary",
    )}
  >
    {children}
  </button>
);

const EmptyState = ({ onClear }: { onClear: () => void }) => (
  <div className="rounded-md border border-dashed border-border py-16 text-center">
    <div className="text-4xl mb-3" aria-hidden>🔍</div>
    <h3 className="font-display text-lg text-foreground mb-1">No services match these filters</h3>
    <p className="text-sm text-muted-foreground mb-4">Try clearing filters to see the full marketplace.</p>
    <Button variant="outline" onClick={onClear}>Clear filters</Button>
  </div>
);

const ServiceCard = ({
  service,
  isActive,
  scarcity,
  pref,
  onPrefChange,
  onPurchase,
}: {
  service: Service;
  isActive: boolean;
  scarcity?: GeoCellAvailability;
  pref: "usd" | "pb";
  onPrefChange: (p: "usd" | "pb") => void;
  onPurchase: () => void;
}) => {
  const soldOut = scarcity?.availableSlots === 0;
  const lowSlots = scarcity && scarcity.availableSlots > 0 && scarcity.availableSlots <= 2;

  return (
    <div className={cn(
      "relative bg-card border border-border rounded-md p-6 flex flex-col transition-all hover:-translate-y-0.5 hover:shadow-lg",
      isActive && "border-success",
    )}>
      {isActive && (
        <span className="absolute -top-2.5 right-4 rounded-full bg-success text-success-foreground text-[0.65rem] font-semibold uppercase tracking-wider px-2.5 py-0.5">
          Active
        </span>
      )}

      <p className="text-[0.68rem] font-medium uppercase tracking-[0.12em] text-muted-foreground mb-1.5">
        {formatBillingFreq(service.billingPeriod)}
      </p>
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-display text-lg font-bold text-foreground leading-tight">{service.name}</h3>
        <div className="flex flex-col gap-1 items-end shrink-0">
          {service.popular && <Badge className="bg-primary/90 text-[0.65rem]">Popular</Badge>}
          {service.newService && <Badge variant="secondary" className="text-[0.65rem]">New</Badge>}
        </div>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed mb-5 flex-1">
        {service.short_description || service.description}
      </p>

      {scarcity && (
        <div className={cn(
          "rounded border px-3 py-2 mb-4 text-xs font-medium flex items-center gap-2",
          soldOut
            ? "bg-destructive/10 border-destructive/30 text-destructive"
            : "bg-warning/10 border-warning/30 text-warning",
        )}>
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          {soldOut
            ? `Sold out in ${scarcity.cellName}`
            : `${scarcity.availableSlots} of ${scarcity.maxSlots} slots left in ${scarcity.cellName}`}
          <span className="ml-auto flex gap-1">
            {Array.from({ length: scarcity.maxSlots }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "w-2 h-2 rounded-full",
                  i < scarcity.usedSlots ? "bg-warning" : "bg-border",
                )}
              />
            ))}
          </span>
        </div>
      )}

      {/* Pricing dual options */}
      <div className="flex items-stretch gap-2 mt-auto">
        <PriceOption
          label="Pay USD"
          amount={`$${service.priceUSD}`}
          sub={formatBillingSuffix(service.billingPeriod) || "one-time"}
          selected={pref === "usd"}
          onClick={() => onPrefChange("usd")}
        />
        <PriceOption
          label="Pay PawBucks · 50% off"
          amount={`${service.pricePawBucks.toLocaleString()} PB`}
          sub={`≈ $${(service.pricePawBucks / 1000).toFixed(2)}`}
          selected={pref === "pb"}
          isPB
          onClick={() => onPrefChange("pb")}
        />
      </div>

      <Button
        className="w-full mt-3"
        variant={isActive ? "outline" : "default"}
        disabled={soldOut}
        onClick={onPurchase}
      >
        {soldOut ? (
          <><AlertTriangle className="w-4 h-4 mr-1.5" /> Sold out in your area</>
        ) : isActive ? (
          "Manage / Renew"
        ) : (
          "Get Started"
        )}
      </Button>
    </div>
  );
};

const PriceOption = ({
  label, amount, sub, selected, isPB, onClick,
}: {
  label: string; amount: string; sub: string; selected: boolean; isPB?: boolean; onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "flex-1 rounded border px-3 py-2.5 flex flex-col items-center gap-0.5 transition-colors text-center",
      selected ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary hover:bg-primary/5",
    )}
  >
    <span className="text-[0.62rem] uppercase tracking-[0.08em] font-medium text-muted-foreground leading-tight">
      {label}
    </span>
    <span className={cn("font-display text-base font-bold leading-none", isPB ? "text-primary" : "text-foreground")}>
      {isPB ? <PawBucksLogo className="w-4 h-4 inline mr-1" /> : null}{amount}
    </span>
    <span className="text-[0.65rem] text-muted-foreground">{sub}</span>
  </button>
);

export default MerchantMarket;
