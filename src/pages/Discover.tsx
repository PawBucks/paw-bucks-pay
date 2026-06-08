import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/useDebounce";
import { useOptimizedQuery } from "@/hooks/useOptimizedQuery";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { PageLoader } from "@/components/PageLoader";
import { SEO } from "@/components/SEO";
import { seoMeta } from "@/lib/seoMeta";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Button } from "@/components/ui/button";
import { ROUTES, QUERY_STALE_TIMES } from "@/lib/constants";
import { getSubscriptionTier } from "@/lib/constants";
import { useSubscription } from "@/hooks/useSubscription";
import { usePersistentState } from "@/hooks/usePersistentState";
import { supabase } from "@/integrations/supabase/client";
import { searchMatchesAnyCategory, merchantMatchesCategory, getCategoryEmoji } from "@/lib/categoryMapping";
import {
  useVerifiedProMerchants,
  useSponsoredMerchants,
  useFeaturedPartnerMerchants,
  usePremiumAdMerchants,
  useSearchBoostedMerchantSet,
  useAdMerchants,
  isVerifiedPro,
  isSponsored,
} from "@/hooks/useMerchantServices";
import { useQueryClient } from "@tanstack/react-query";
import { useSponsoredTracking } from "@/hooks/useSponsoredTracking";
import { useSearchRankingTracking } from "@/hooks/useSearchRankingTracking";
import { MerchantMap } from "@/components/MerchantMap";
import {
  LayoutList, Map as MapIcon, MapPin, Search, Store, X, Star, BadgeCheck, ChevronRight, Crown,
  Stethoscope, Scissors, Truck, ShoppingBag, Bone, Hotel, School, GraduationCap, Dog,
  Mountain, PersonStanding, Hand, Brain, Camera, Shield, Plane, Dna, Heart, Puzzle, Trash2,
} from "lucide-react";
import { useUserLocation } from "@/hooks/useUserLocation";
import { calculateDistance } from "@/lib/geo";

type MerchantWithRating = {
  id: string;
  business_name: string;
  business_type: string;
  description?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  cashback_rate: number;
  logo_url?: string;
  accepts_pawbucks?: boolean;
  price_range?: number;
  average_rating: number;
  review_count: number;
};

const businessTypes = [
  { label: "All", value: "all", Icon: Star },
  { label: "Vets", value: "veterinary", Icon: Stethoscope },
  { label: "Groomers", value: "grooming", Icon: Scissors },
  { label: "Mobile Groomers", value: "mobile_groomer", Icon: Truck },
  { label: "Pet Stores", value: "pet_store", Icon: ShoppingBag },
  { label: "Food & Treats", value: "food", Icon: Bone },
  { label: "Boarding", value: "boarding", Icon: Hotel },
  { label: "Daycare", value: "daycare", Icon: School },
  { label: "Trainers", value: "training", Icon: GraduationCap },
  { label: "Walkers", value: "walker", Icon: Dog },
  { label: "Hikers", value: "hiker", Icon: Mountain },
  { label: "Runners", value: "runner", Icon: PersonStanding },
  { label: "Masseuses", value: "masseuse", Icon: Hand },
  { label: "Behaviorists", value: "behaviorist", Icon: Brain },
  { label: "Photographers", value: "photography", Icon: Camera },
  { label: "Insurance", value: "insurance", Icon: Shield },
  { label: "Transportation", value: "delivery", Icon: Plane },
  { label: "Breeders", value: "breeder", Icon: Dna },
  { label: "Rescue / Nonprofit", value: "rescue_nonprofit", Icon: Heart },
  { label: "Pet Waste Removal", value: "pet_waste_removal", Icon: Trash2 },
  { label: "Other", value: "other", Icon: Puzzle },
];

const getBusinessIcon = (type: string) => {
  const emoji = getCategoryEmoji(type);
  const Comp = ({ className }: { className?: string }) => (
    <span
      className={`inline-flex items-center justify-center text-2xl leading-none ${className ?? ""}`}
      role="img"
      aria-hidden="true"
    >
      {emoji}
    </span>
  );
  Comp.displayName = "BusinessEmojiIcon";
  return Comp;
};

const sortOptions = [
  { value: "rating", label: "Top Rated" },
  { value: "distance", label: "Nearest" },
  { value: "reviews", label: "Most Reviewed" },
  { value: "cashback", label: "Best Rewards" },
  { value: "name", label: "A – Z" },
];

const Discover = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const bookingPetId = searchParams.get("petId");
  const bookingIntent = searchParams.get("intent");

  // Fetch the preselected pet (for the "Booking for {name}" chip)
  const { data: bookingPet } = useOptimizedQuery<{ id: string; name: string; photo_url: string | null } | null>(
    ["discover-booking-pet", bookingPetId],
    async () => {
      if (!bookingPetId) return null;
      const { data } = await supabase
        .from("pet_profiles")
        .select("id, name, photo_url")
        .eq("id", bookingPetId)
        .maybeSingle();
      return data;
    },
    { staleTime: QUERY_STALE_TIMES.LONG, enabled: !!bookingPetId }
  );

  // Append petId/intent to a target merchant URL so booking context survives the navigation.
  const withBookingParams = useCallback(
    (path: string) => {
      if (!bookingPetId) return path;
      const sp = new URLSearchParams();
      sp.set("petId", bookingPetId);
      if (bookingIntent) sp.set("intent", bookingIntent);
      return `${path}?${sp.toString()}`;
    },
    [bookingPetId, bookingIntent]
  );

  const clearBookingPet = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("petId");
    next.delete("intent");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const { subscription, loading: subLoading } = useSubscription();
  const tier = getSubscriptionTier(subscription.product_id, subscription.subscription_tier);
  const showAds = !subLoading && tier !== "pawpass_plus";
  const { data: adMerchants = [] } = useAdMerchants();
  // Rotate sponsored ads every 15s, and make sure the top and inline
  // placements show different merchants whenever possible.
  const [adTick, setAdTick] = useState(0);
  useEffect(() => {
    if (adMerchants.length <= 1) return;
    const id = setInterval(() => setAdTick((t) => t + 1), 15000);
    return () => clearInterval(id);
  }, [adMerchants.length]);
  const adCount = adMerchants.length;
  const topAdMerchant = adCount > 0 ? adMerchants[adTick % adCount] : undefined;
  const inlineOffset = adCount > 1 ? Math.max(1, Math.floor(adCount / 2)) : 0;
  const inlineAdMerchant =
    adCount > 0 ? adMerchants[(adTick + inlineOffset) % adCount] : undefined;
  const adMerchant = topAdMerchant; // back-compat alias for existing checks
  const [searchTerm, setSearchTerm] = useState<string>("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [selectedCategory, setSelectedCategory] = usePersistentState<string>("discover-category", "all");
  const [sortBy, setSortBy] = usePersistentState<string>("discover-sort", "rating");
  const [pawbucksOnly, setPawbucksOnly] = usePersistentState<boolean>("discover-pawbucks", false);
  const [viewMode, setViewMode] = usePersistentState<"list" | "grid" | "map">("discover-view", "list");
  const [showMobileMap, setShowMobileMap] = useState(false);

  const { userLocation, locationLoading, locationError, requestLocation } = useUserLocation();

  useEffect(() => {
    if (sortBy === "distance" && !userLocation && !locationLoading && !locationError) {
      requestLocation();
    }
  }, [sortBy, userLocation, locationLoading, locationError, requestLocation]);

  const { data: verifiedProIds = [] } = useVerifiedProMerchants();
  const { data: sponsoredMerchantsList = [] } = useSponsoredMerchants();
  const { data: featuredPartnersList = [] } = useFeaturedPartnerMerchants();
  const { data: premiumAdsList = [] } = usePremiumAdMerchants();
  const { data: searchBoostedIds = new Set<string>() } = useSearchBoostedMerchantSet();

  const { trackImpression, trackClick } = useSponsoredTracking("discover");
  const { trackBatchImpressions, trackSearchClick } = useSearchRankingTracking();

  useEffect(() => {
    if (sponsoredMerchantsList.length > 0) {
      sponsoredMerchantsList.forEach((merchant, index) => {
        trackImpression(merchant.id, index + 1, debouncedSearch || undefined);
      });
    }
  }, [sponsoredMerchantsList, trackImpression, debouncedSearch]);

  const { data: merchants = [], isLoading } = useOptimizedQuery<MerchantWithRating[]>(
    ["merchants-with-ratings"],
    async () => {
      const { data: merchantData, error: merchantError } = await supabase
        .from("merchants_public")
        .select("id, business_name, business_type, business_categories, description, address, latitude, longitude, cashback_rate, logo_url, accepts_pawbucks, price_range")
        .order("business_name");

      if (merchantError) throw merchantError;

      const merchantIds = (merchantData || []).map((m) => m.id);
      const { data: allReviews } = merchantIds.length
        ? await supabase.from("merchant_reviews").select("merchant_id, rating").in("merchant_id", merchantIds)
        : { data: [] as { merchant_id: string; rating: number }[] };

      const ratingMap: Record<string, { sum: number; count: number }> = {};
      (allReviews || []).forEach((r) => {
        const entry = ratingMap[r.merchant_id] || { sum: 0, count: 0 };
        entry.sum += r.rating;
        entry.count += 1;
        ratingMap[r.merchant_id] = entry;
      });

      return (merchantData || []).map((merchant) => {
        const stats = ratingMap[merchant.id];
        return {
          ...merchant,
          average_rating: stats && stats.count > 0 ? stats.sum / stats.count : 0,
          review_count: stats?.count || 0,
        };
      });
    },
    { staleTime: QUERY_STALE_TIMES.MEDIUM }
  );

  const filteredMerchants = useMemo(() => {
    let filtered = merchants;

    if (selectedCategory !== "all") {
      filtered = filtered.filter((m) =>
        merchantMatchesCategory(selectedCategory, m.business_type, (m as any).business_categories)
      );
    }

    if (pawbucksOnly) filtered = filtered.filter((m) => m.accepts_pawbucks);

    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.business_name.toLowerCase().includes(searchLower) ||
          searchMatchesAnyCategory(debouncedSearch, m.business_type, (m as any).business_categories) ||
          m.description?.toLowerCase().includes(searchLower)
      );
    }

    const withDistance = userLocation
      ? filtered.map((m) => {
          if (m.latitude == null || m.longitude == null) return { ...m, distance: undefined };
          return {
            ...m,
            distance: calculateDistance(userLocation.latitude, userLocation.longitude, m.latitude, m.longitude),
          };
        })
      : filtered;

    const sorted = [...withDistance].sort((a, b) => {
      const aIsBoosted = searchBoostedIds.has(a.id);
      const bIsBoosted = searchBoostedIds.has(b.id);
      if (aIsBoosted && !bIsBoosted) return -1;
      if (!aIsBoosted && bIsBoosted) return 1;

      switch (sortBy) {
        case "rating":
          return b.average_rating - a.average_rating;
        case "cashback":
          return b.cashback_rate - a.cashback_rate;
        case "reviews":
          return b.review_count - a.review_count;
        case "distance": {
          const aD = (a as any).distance;
          const bD = (b as any).distance;
          if (aD == null && bD == null) return 0;
          if (aD == null) return 1;
          if (bD == null) return -1;
          return aD - bD;
        }
        case "name":
        default:
          return a.business_name.localeCompare(b.business_name);
      }
    });

    return sorted;
  }, [merchants, selectedCategory, debouncedSearch, sortBy, pawbucksOnly, searchBoostedIds, userLocation]);

  useEffect(() => {
    if (filteredMerchants.length > 0 && searchBoostedIds.size > 0) {
      const boostedMerchants = filteredMerchants
        .filter((m) => searchBoostedIds.has(m.id))
        .map((m, index) => ({
          id: m.id,
          position: index + 1,
          isBoosted: true,
          categoryMatch:
            selectedCategory !== "all" && m.business_type.toLowerCase().includes(selectedCategory.toLowerCase()),
          localMatch: false,
        }));
      if (boostedMerchants.length > 0) {
        trackBatchImpressions(boostedMerchants, "discover", debouncedSearch || undefined);
      }
    }
  }, [filteredMerchants, searchBoostedIds, trackBatchImpressions, debouncedSearch, selectedCategory]);

  const handleLogout = async () => {
    await signOut();
    navigate(ROUTES.AUTH);
  };

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["merchants-with-ratings"] });
  }, [queryClient]);

  const { containerRef, isRefreshing, pullDistance, progress } = usePullToRefresh({ onRefresh: handleRefresh });

  const activeFilterCount = [selectedCategory !== "all", pawbucksOnly, !!debouncedSearch].filter(Boolean).length;

  const mapMerchants = useMemo(
    () =>
      filteredMerchants
        .filter((m) => m.latitude && m.longitude)
        .map((m) => ({
          id: m.id,
          business_name: m.business_name,
          business_type: m.business_type,
          latitude: m.latitude,
          longitude: m.longitude,
          address: m.address,
          cashback_rate: m.cashback_rate,
          avg_rating: m.average_rating,
          review_count: m.review_count,
        })),
    [filteredMerchants]
  );

  const sponsoredIdSet = useMemo(() => new Set(sponsoredMerchantsList.map((m) => m.id)), [sponsoredMerchantsList]);
  const featuredIdSet = useMemo(() => new Set(featuredPartnersList.map((m) => m.id)), [featuredPartnersList]);
  const premiumIdSet = useMemo(() => new Set(premiumAdsList.map((m) => m.id)), [premiumAdsList]);

  const handleMapMerchantClick = useCallback(
    (merchantId: string) => navigate(withBookingParams(`/merchant/${merchantId}`)),
    [navigate, withBookingParams]
  );

  if (isLoading) return <PageLoader message="Discovering pet care near you..." />;

  const sponsoredList = filteredMerchants.filter(
    (m) => sponsoredIdSet.has(m.id) || featuredIdSet.has(m.id) || premiumIdSet.has(m.id)
  );
  const organicList = filteredMerchants.filter(
    (m) => !sponsoredIdSet.has(m.id) && !featuredIdSet.has(m.id) && !premiumIdSet.has(m.id)
  );

  // Interleave inline ads after every 5 organic results
  type ListEntry =
    | { kind: "merchant"; m: typeof filteredMerchants[number]; index: number }
    | { kind: "ad"; key: string };
  const interleaved: ListEntry[] = [];
  organicList.forEach((m, i) => {
    interleaved.push({ kind: "merchant", m, index: sponsoredList.length + i });
  });

  const renderMerchantCard = (
    merchant: typeof filteredMerchants[number],
    index: number
  ) => {
    const merchantIsVerified = isVerifiedPro(merchant.id, verifiedProIds);
    const merchantIsSponsored = isSponsored(merchant.id, sponsoredMerchantsList);
    const merchantIsFeatured = featuredIdSet.has(merchant.id);
    const merchantIsBoosted = searchBoostedIds.has(merchant.id);
    const handleClick = () => {
      if (merchantIsSponsored)
        trackClick(merchant.id, index + 1, debouncedSearch || undefined);
      if (merchantIsBoosted)
        trackSearchClick(merchant.id, index + 1, "discover", {
          searchTerm: debouncedSearch || undefined,
          isBoosted: true,
        });
      navigate(withBookingParams(`/merchant/${merchant.id}`));
    };
    return (
      <MerchantListItem
        key={merchant.id}
        merchant={merchant}
        isVerified={merchantIsVerified}
        isSponsored={merchantIsSponsored}
        isFeatured={merchantIsFeatured}
        onClick={handleClick}
      />
    );
  };

  return (
    <>
      <SEO
        title={seoMeta.discover.title}
        description={seoMeta.discover.description}
        keywords={[...seoMeta.discover.keywords]}
        canonical={seoMeta.discover.canonical}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: seoMeta.discover.title,
          description: seoMeta.discover.description,
          url: `https://pawbucks.app${seoMeta.discover.canonical}`,
        }}
      />
      <Header isAuthenticated={!!user} onLogout={user ? handleLogout : undefined} />

      <PullToRefresh
        ref={containerRef}
        isRefreshing={isRefreshing}
        pullDistance={pullDistance}
        progress={progress}
        className="min-h-screen bg-background pb-24 md:pb-12 overflow-auto flex flex-col"
      >
        {/* Top nav: title + view toggles + search */}
        <div className="bg-card border-b border-border px-4 py-3 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-lg font-extrabold tracking-tight">Discover</h1>
              <div className="flex gap-1.5">
                <button
                  onClick={() => { setViewMode("list"); setShowMobileMap(false); }}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-colors ${
                    viewMode !== "map" && !showMobileMap
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label="List view"
                >
                  <LayoutList className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setViewMode("map"); setShowMobileMap(true); }}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-colors ${
                    viewMode === "map" || showMobileMap
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label="Map view"
                >
                  <MapIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {viewMode !== "map" && !showMobileMap && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, service, or location..."
                  className="w-full pl-9 pr-9 h-10 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {bookingPet && (
          <div className="bg-primary/5 border-b border-primary/20 px-4 py-2.5">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {bookingPet.photo_url ? (
                  <img
                    src={bookingPet.photo_url}
                    alt={bookingPet.name}
                    className="w-8 h-8 rounded-full object-cover border border-primary/30 flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center flex-shrink-0">
                    <Dog className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold tracking-wider uppercase text-primary">
                    Booking for
                  </div>
                  <div className="text-sm font-bold truncate">{bookingPet.name}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={clearBookingPet}
                className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
                aria-label="Clear pet selection"
              >
                <X className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>
          </div>
        )}

        {viewMode === "map" || showMobileMap ? (
          /* Map View */
          <div className="flex-1 relative">
            <div className="absolute inset-0">
              <MerchantMap
                merchants={mapMerchants}
                onMerchantClick={handleMapMerchantClick}
                featuredIds={featuredIdSet}
                premiumIds={premiumIdSet}
                sponsoredIds={sponsoredIdSet}
              />
            </div>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
              <Button
                variant="outline"
                className="gap-2 bg-card shadow-lg"
                onClick={() => { setViewMode("list"); setShowMobileMap(false); }}
              >
                <LayoutList className="w-4 h-4" />
                Show List
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Top sponsored ad — Free + PawPass only */}
            {showAds && topAdMerchant && (
              <div className="bg-card border-b border-border">
                <div className="max-w-7xl mx-auto">
                  <div className="flex items-center justify-between px-4 pt-2 pb-0.5">
                    <span className="text-[9px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">
                      Advertisement
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate("/profile")}
                      className="text-[10px] font-medium text-primary hover:underline"
                    >
                      Remove Ads with PawPass+ →
                    </button>
                  </div>
                  <div className="flex items-center gap-3 px-4 pb-3 pt-1">
                    <div className="w-11 h-11 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-lg overflow-hidden flex-shrink-0">
                      {topAdMerchant.logo_url ? (
                        <img src={topAdMerchant.logo_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <span aria-hidden="true">{getCategoryEmoji(topAdMerchant.business_type)}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">
                        {topAdMerchant.business_name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {topAdMerchant.description || `Earn ${topAdMerchant.cashback_rate}x PawBucks at ${topAdMerchant.business_name}.`}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(withBookingParams(`/merchant/${topAdMerchant.id}`))}
                      className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-xs font-semibold hover:bg-primary/90 transition flex-shrink-0"
                    >
                      Visit
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Hero + category pills */}
            <div className="bg-card border-b border-border">
              <div className="max-w-7xl mx-auto px-4 pt-5">
                <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-primary mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" /> The Directory
                </div>
                <h2
                  className="text-2xl font-extrabold tracking-tight leading-tight mb-1.5"
                  style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
                >
                  Find pet services{" "}
                  <em className="not-italic text-primary italic font-extrabold">worth loving.</em>
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {merchants.length} hand-picked pet care professionals. Real reviews. Rewards on every visit.
                </p>

                {/* Category pills */}
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3 -mx-1 px-1">
                  {businessTypes.map((type) => {
                    const isSelected = selectedCategory === type.value;
                    return (
                      <button
                        key={type.value}
                        onClick={() => setSelectedCategory(type.value)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
                          isSelected
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-card text-muted-foreground ring-1 ring-inset ring-border hover:text-foreground"
                        }`}
                      >
                        <type.Icon className="w-3.5 h-3.5" />
                        {type.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Sort bar */}
            <div className="bg-card border-b border-border px-4">
              <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto scrollbar-hide">
                {sortOptions.map((opt) => {
                  const isActive = sortBy === opt.value;
                  const isDistance = opt.value === "distance";
                  return (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setSortBy(opt.value);
                        if (isDistance && !userLocation) requestLocation();
                      }}
                      className={`py-2.5 px-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                        isActive
                          ? "border-primary text-primary font-semibold"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {isDistance && (
                        <MapPin
                          className={`w-3 h-3 inline-block mr-1 ${locationLoading ? "animate-pulse" : ""}`}
                        />
                      )}
                      {isDistance && locationLoading ? "Locating…" : opt.label}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPawbucksOnly(!pawbucksOnly)}
                  className={`ml-auto py-2.5 px-2 text-xs font-medium whitespace-nowrap transition-colors ${
                    pawbucksOnly ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  PawBucks only
                </button>
              </div>
            </div>

            {/* List body */}
            <div className="max-w-7xl mx-auto px-4 pt-3 pb-6">
              <div className="text-[11px] text-muted-foreground mb-3">
                {filteredMerchants.length} result{filteredMerchants.length !== 1 ? "s" : ""}
                {selectedCategory !== "all" &&
                  ` · ${businessTypes.find((c) => c.value === selectedCategory)?.label}`}
              </div>

              {filteredMerchants.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-14 h-14 rounded-full bg-muted mx-auto flex items-center justify-center mb-3">
                    <Store className="w-7 h-7 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-base font-semibold mb-1">No results found</h3>
                  <p className="text-sm text-muted-foreground mb-4">Try a different search or category</p>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSearchTerm("");
                      setSelectedCategory("all");
                      setPawbucksOnly(false);
                    }}
                  >
                    Clear filters
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {sponsoredList.map((m, i) => renderMerchantCard(m, i))}
                  {interleaved.map((entry) =>
                    entry.kind === "ad" ? (
                      <InlineAdBanner key={entry.key} merchant={inlineAdMerchant!} />
                    ) : (
                      renderMerchantCard(entry.m, entry.index)
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sticky footer ad — Free + PawPass only. Uses a different merchant from the top ad. */}
        {showAds && inlineAdMerchant && viewMode !== "map" && !showMobileMap && (
          <div className="sticky bottom-0 left-0 right-0 z-30 bg-card border-t border-border shadow-[0_-4px_16px_hsl(var(--foreground)/0.07)]">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between px-4 pt-1 pb-0.5">
                <span className="text-[9px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">
                  Advertisement
                </span>
                <button
                  type="button"
                  onClick={() => navigate("/profile")}
                  className="text-[10px] font-medium text-primary hover:underline"
                >
                  Remove Ads with PawPass+ →
                </button>
              </div>
              <div className="flex items-center gap-3 px-4 pb-3 pt-1">
                <div className="w-11 h-11 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-lg overflow-hidden flex-shrink-0">
                  {inlineAdMerchant.logo_url ? (
                    <img src={inlineAdMerchant.logo_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <span aria-hidden="true">{getCategoryEmoji(inlineAdMerchant.business_type)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">
                    {inlineAdMerchant.business_name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {inlineAdMerchant.description || `Earn ${inlineAdMerchant.cashback_rate}x PawBucks at ${inlineAdMerchant.business_name}.`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(withBookingParams(`/merchant/${inlineAdMerchant.id}`))}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-xs font-semibold hover:bg-primary/90 transition flex-shrink-0"
                >
                  Visit
                </button>
              </div>
            </div>
          </div>
        )}

        {user && <BottomNav />}
      </PullToRefresh>
    </>
  );
};

// ── Merchant list item ─────────────────────────────────────────────────────────
type MerchantListItemProps = {
  merchant: {
    id: string;
    business_name: string;
    business_type: string;
    description?: string;
    address?: string;
    cashback_rate: number;
    accepts_pawbucks?: boolean;
    price_range?: number;
    average_rating: number;
    review_count: number;
    logo_url?: string;
    distance?: number;
  };
  isVerified: boolean;
  isSponsored: boolean;
  isFeatured: boolean;
  onClick: () => void;
};

const MerchantListItem = ({ merchant, isVerified, isSponsored, isFeatured, onClick }: MerchantListItemProps) => {
  const emoji = getCategoryEmoji(merchant.business_type);
  const distance = (merchant as any).distance as number | undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-card border border-border rounded-xl overflow-hidden text-left transition-all hover:border-primary hover:shadow-md flex"
    >
      {/* Image / icon block */}
      <div
        className={`w-24 flex-shrink-0 flex items-center justify-center text-4xl relative ${
          isFeatured
            ? "bg-gradient-to-br from-foreground to-foreground/80"
            : "bg-primary/10"
        }`}
        aria-hidden="true"
      >
        {merchant.logo_url ? (
          <img src={merchant.logo_url} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span>{emoji}</span>
        )}
        {isFeatured && (
          <div className="absolute top-2 left-2 w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-sm shadow-sm">
            <Crown className="w-3.5 h-3.5 text-background" />
          </div>
        )}
        {isSponsored && !isFeatured && (
          <span className="absolute top-2 left-2 bg-foreground text-background text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5">
            ✨ Ad
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 p-3 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="text-sm font-bold tracking-tight text-foreground truncate">
              {merchant.business_name}
            </span>
            {isVerified && <BadgeCheck className="w-3.5 h-3.5 text-info flex-shrink-0" />}
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
        </div>

        {/* Rating + price */}
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="inline-flex items-center gap-0.5 text-[11px]">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={`w-3 h-3 ${
                  i <= Math.round(merchant.average_rating ?? 0)
                    ? "fill-amber-400 text-amber-400"
                    : "fill-muted text-muted"
                }`}
              />
            ))}
            {merchant.review_count > 0 ? (
              <>
                <span className="font-semibold text-foreground ml-0.5">
                  {(merchant.average_rating ?? 0).toFixed(1)}
                </span>
                <span className="text-muted-foreground">({merchant.review_count})</span>
              </>
            ) : (
              <span className="text-muted-foreground ml-0.5 italic">No reviews yet</span>
            )}
          </span>
          {merchant.price_range ? (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-[11px]">
                    {[1, 2, 3, 4].map((lvl) => (
                      <span
                        key={lvl}
                        className={
                          lvl <= (merchant.price_range || 0)
                            ? "text-foreground font-semibold"
                            : "text-muted-foreground/40"
                        }
                      >
                        $
                      </span>
                    ))}
                  </span>
                </>
              ) : null}
        </div>

        {/* Tags */}
        <div className="flex gap-1.5 flex-wrap items-center mb-1.5">
          <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-[10px] font-medium">
            {merchant.business_type.replace(/_/g, " ")}
          </span>
          {merchant.accepts_pawbucks && merchant.cashback_rate > 0 ? (
            <span className="bg-primary/10 text-primary ring-1 ring-inset ring-primary/20 px-2 py-0.5 rounded-full text-[10px] font-semibold">
              {merchant.cashback_rate}x PB
            </span>
          ) : (
            <span className="bg-muted text-muted-foreground/70 px-2 py-0.5 rounded-full text-[10px]">
              No PawBucks
            </span>
          )}
        </div>

        {/* Description */}
        {merchant.description && (
          <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 mb-1.5">
            {merchant.description}
          </p>
        )}

        {/* Address / distance */}
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">
            {distance != null ? `${distance.toFixed(1)} mi away` : merchant.address || "Location not available"}
          </span>
        </div>
      </div>
    </button>
  );
};

// ── Inline ad banner ───────────────────────────────────────────────────────────
const InlineAdBanner = ({
  merchant,
}: {
  merchant: {
    id: string;
    business_name: string;
    business_type: string;
    description?: string | null;
    cashback_rate: number;
    logo_url?: string | null;
  };
}) => {
  const navigate = useNavigate();
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/40 border-b border-border">
        <span className="text-[9px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">
          Advertisement
        </span>
        <button
          type="button"
          onClick={() => navigate("/profile")}
          className="text-[10px] font-medium text-primary hover:underline"
        >
          Remove Ads with PawPass+ →
        </button>
      </div>
      <div className="flex items-center gap-3 px-3.5 py-3">
        <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-xl overflow-hidden flex-shrink-0">
          {merchant.logo_url ? (
            <img src={merchant.logo_url} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <span aria-hidden="true">{getCategoryEmoji(merchant.business_type)}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">{merchant.business_name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {merchant.description || `Earn ${merchant.cashback_rate}x PawBucks at ${merchant.business_name}.`}
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/merchant/${merchant.id}`)}
          className="bg-primary text-primary-foreground px-3.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-primary/90 transition flex-shrink-0"
        >
          Visit
        </button>
      </div>
    </div>
  );
};

export default Discover;
