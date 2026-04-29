import { useState, useMemo, useCallback, useEffect } from"react";
import { useNavigate, Link } from"react-router-dom";
import { useAuth } from"@/hooks/useAuth";
import { useDebounce } from"@/hooks/useDebounce";
import { useOptimizedQuery } from"@/hooks/useOptimizedQuery";
import { usePullToRefresh } from"@/hooks/usePullToRefresh";
import { Header } from"@/components/Header";
import { BottomNav } from"@/components/BottomNav";
import { PageLoader } from"@/components/PageLoader";
import { AdPlacement } from"@/components/AdPlacement";
import { SEO } from"@/components/SEO";
import { seoMeta } from"@/lib/seoMeta";
import { PullToRefresh } from"@/components/PullToRefresh";
import { Input } from"@/components/ui/input";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { Separator } from"@/components/ui/separator";
import { ROUTES, QUERY_STALE_TIMES } from"@/lib/constants";
import { usePersistentState } from"@/hooks/usePersistentState";
import { supabase } from"@/integrations/supabase/client";
import { searchMatchesCategory, searchMatchesAnyCategory, merchantMatchesCategory } from"@/lib/categoryMapping";
import { useVerifiedProMerchants, useSponsoredMerchants, useFeaturedPartnerMerchants, usePremiumAdMerchants, useSearchBoostedMerchantSet, isVerifiedPro, isSponsored } from"@/hooks/useMerchantServices";
import { useQueryClient } from"@tanstack/react-query";
import { useSponsoredTracking } from"@/hooks/useSponsoredTracking";
import { useSearchRankingTracking } from"@/hooks/useSearchRankingTracking";
import { DirectoryMerchantCard } from"@/components/directory/DirectoryMerchantCard";
import { MerchantMap } from"@/components/MerchantMap";
import {
 Search,
 Store,
 Scissors,
 Home,
 Stethoscope,
 Footprints,
 Bone,
 Coins,
 SlidersHorizontal,
 Mountain,
 Zap,
 Hand,
 Brain,
 MoreHorizontal,
 MapPin,
 X,
 LayoutGrid,
 LayoutList,
 Map,
 Sun,
 Camera,
 Shield,
 Truck,
 Dog,
 Sparkles,
 ShoppingBag,
} from"lucide-react";

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
 { label:"All", value:"all", icon: Store },
 { label:"Vets", value:"veterinary", icon: Stethoscope },
 { label:"Groomers", value:"grooming", icon: Scissors },
 { label:"Mobile Groomers", value:"mobile_groomer", icon: Scissors },
 { label:"Pet Stores", value:"pet_store", icon: ShoppingBag },
 { label:"Food & Treats", value:"food", icon: Bone },
 { label:"Boarding", value:"boarding", icon: Home },
 { label:"Daycare", value:"daycare", icon: Sun },
 { label:"Trainers", value:"training", icon: Sparkles },
 { label:"Walkers", value:"walker", icon: Footprints },
 { label:"Hikers", value:"hiker", icon: Mountain },
 { label:"Runners", value:"runner", icon: Zap },
 { label:"Masseuses", value:"masseuse", icon: Hand },
 { label:"Behaviorists", value:"behaviorist", icon: Brain },
 { label:"Photographers", value:"photography", icon: Camera },
 { label:"Insurance", value:"insurance", icon: Shield },
 { label:"Delivery", value:"delivery", icon: Truck },
 { label:"Breeders", value:"breeder", icon: Dog },
 { label:"Rescue / Nonprofit", value:"rescue_nonprofit", icon: Shield },
 { label:"Other", value:"other", icon: MoreHorizontal },
];

const getBusinessIcon = (type: string) => {
 const lowerType = type.toLowerCase();
 if (lowerType.includes("store") || lowerType.includes("shop")) return Store;
 if (lowerType.includes("groom")) return Scissors;
 if (lowerType.includes("sitter") || lowerType.includes("boarding")) return Home;
 if (lowerType.includes("vet") || lowerType.includes("clinic")) return Stethoscope;
 if (lowerType.includes("walker") || lowerType.includes("walking")) return Footprints;
 if (lowerType.includes("trainer") || lowerType.includes("training")) return Bone;
 if (lowerType.includes("hiker") || lowerType.includes("hiking")) return Mountain;
 if (lowerType.includes("runner") || lowerType.includes("running") || lowerType.includes("jogger")) return Zap;
 if (lowerType.includes("masseuse") || lowerType.includes("massage")) return Hand;
 if (lowerType.includes("behaviorist") || lowerType.includes("behavior")) return Brain;
 if (lowerType.includes("other")) return MoreHorizontal;
 return Store;
};

const sortOptions = [
 { value:"rating", label:"Top Rated" },
 { value:"reviews", label:"Most Reviewed" },
 { value:"cashback", label:"Best Rewards" },
 { value:"name", label:"A – Z" },
];

const MerchantDirectory = () => {
 const { user, signOut } = useAuth();
 const navigate = useNavigate();
 const queryClient = useQueryClient();
 const [searchTerm, setSearchTerm] = usePersistentState<string>("directory-search","");
 const debouncedSearch = useDebounce(searchTerm, 300);
 const [selectedCategory, setSelectedCategory] = usePersistentState<string>("directory-category","all");
 const [sortBy, setSortBy] = usePersistentState<string>("directory-sort","rating");
 const [pawbucksOnly, setPawbucksOnly] = usePersistentState<boolean>("directory-pawbucks", false);
 const [viewMode, setViewMode] = usePersistentState<"list" |"grid" |"map">("directory-view","list");
 const [showMobileMap, setShowMobileMap] = useState(false);

 // Fetch verified, sponsored, featured, and premium merchants for badge/pin display
 const { data: verifiedProIds = [] } = useVerifiedProMerchants();
 const { data: sponsoredMerchantsList = [] } = useSponsoredMerchants();
 const { data: featuredPartnersList = [] } = useFeaturedPartnerMerchants();
 const { data: premiumAdsList = [] } = usePremiumAdMerchants();
 const { data: searchBoostedIds = new Set<string>() } = useSearchBoostedMerchantSet();

 // Sponsored placement tracking
 const { trackImpression, trackClick } = useSponsoredTracking("directory");

 // Search ranking tracking for boosted merchants
 const { trackBatchImpressions, trackSearchClick } = useSearchRankingTracking();

 // Track impressions for sponsored merchants when they're displayed
 useEffect(() => {
 if (sponsoredMerchantsList.length > 0) {
 sponsoredMerchantsList.forEach((merchant, index) => {
 trackImpression(merchant.id, index + 1, debouncedSearch || undefined);
 });
 }
 }, [sponsoredMerchantsList, trackImpression, debouncedSearch]);

 // Fetch merchants with ratings
 const { data: merchants = [], isLoading } = useOptimizedQuery<MerchantWithRating[]>(
 ["merchants-with-ratings"],
 async () => {
 const { data: merchantData, error: merchantError } = await supabase
 .from("merchants_public")
 .select("id, business_name, business_type, business_categories, description, address, latitude, longitude, cashback_rate, logo_url, accepts_pawbucks, price_range")
 .order("business_name");

 if (merchantError) throw merchantError;

 const merchantIds = (merchantData || []).map((m) => m.id);

 // Single batched query for all reviews — visible to all (anon + authenticated)
 const { data: allReviews } = merchantIds.length
 ? await supabase
 .from("merchant_reviews")
 .select("merchant_id, rating")
 .in("merchant_id", merchantIds)
 : { data: [] as { merchant_id: string; rating: number }[] };

 const ratingMap: Record<string, { sum: number; count: number }> = {};
 (allReviews || []).forEach((r: { merchant_id: string; rating: number }) => {
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

 // Filter and sort merchants
 const filteredMerchants = useMemo(() => {
 let filtered = merchants;

 if (selectedCategory !=="all") {
 filtered = filtered.filter((m) =>
 merchantMatchesCategory(selectedCategory, m.business_type, (m as any).business_categories)
 );
 }

 if (pawbucksOnly) {
 filtered = filtered.filter((m) => m.accepts_pawbucks);
 }

 if (debouncedSearch) {
 const searchLower = debouncedSearch.toLowerCase();
 filtered = filtered.filter(
 (m) =>
 m.business_name.toLowerCase().includes(searchLower) ||
 searchMatchesAnyCategory(debouncedSearch, m.business_type, (m as any).business_categories) ||
 m.description?.toLowerCase().includes(searchLower)
 );
 }

 const sorted = [...filtered].sort((a, b) => {
 const aIsBoosted = searchBoostedIds.has(a.id);
 const bIsBoosted = searchBoostedIds.has(b.id);
 if (aIsBoosted && !bIsBoosted) return -1;
 if (!aIsBoosted && bIsBoosted) return 1;

 switch (sortBy) {
 case"rating":
 return b.average_rating - a.average_rating;
 case"cashback":
 return b.cashback_rate - a.cashback_rate;
 case"reviews":
 return b.review_count - a.review_count;
 case"name":
 default:
 return a.business_name.localeCompare(b.business_name);
 }
 });

 return sorted;
 }, [merchants, selectedCategory, debouncedSearch, sortBy, pawbucksOnly, searchBoostedIds]);

 // Track search ranking impressions for boosted merchants
 useEffect(() => {
 if (filteredMerchants.length > 0 && searchBoostedIds.size > 0) {
 const boostedMerchants = filteredMerchants
 .filter(m => searchBoostedIds.has(m.id))
 .map((m, index) => ({
 id: m.id,
 position: index + 1,
 isBoosted: true,
 categoryMatch: selectedCategory !=="all" && m.business_type.toLowerCase().includes(selectedCategory.toLowerCase()),
 localMatch: false,
 }));

 if (boostedMerchants.length > 0) {
 trackBatchImpressions(boostedMerchants,"directory", debouncedSearch || undefined);
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

 const { containerRef, isRefreshing, pullDistance, progress } = usePullToRefresh({
 onRefresh: handleRefresh,
 });

 const activeFilterCount = [
 selectedCategory !=="all",
 pawbucksOnly,
 !!debouncedSearch,
 ].filter(Boolean).length;

 // Map data: transform to MerchantMarker shape
 const mapMerchants = useMemo(() => {
 return filteredMerchants
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
 }));
 }, [filteredMerchants]);

 const sponsoredIdSet = useMemo(
 () => new Set(sponsoredMerchantsList.map((m) => m.id)),
 [sponsoredMerchantsList]
 );

 const featuredIdSet = useMemo(
 () => new Set(featuredPartnersList.map((m) => m.id)),
 [featuredPartnersList]
 );

 const premiumIdSet = useMemo(
 () => new Set(premiumAdsList.map((m) => m.id)),
 [premiumAdsList]
 );

 const handleMapMerchantClick = useCallback(
 (merchantId: string) => navigate(`/merchant/${merchantId}`),
 [navigate]
 );

 if (isLoading) {
 return <PageLoader message="Loading merchant directory..." />;
 }

 return (
 <>
 <SEO
 title={seoMeta.directory.title}
 description={seoMeta.directory.description}
 keywords={[...seoMeta.directory.keywords]}
 canonical={seoMeta.directory.canonical}
 />
 <Header isAuthenticated={!!user} onLogout={user ? handleLogout : undefined} />

 <PullToRefresh
 ref={containerRef}
 isRefreshing={isRefreshing}
 pullDistance={pullDistance}
 progress={progress}
 className="min-h-screen bg-background pb-24 md:pb-12 overflow-auto"
 >
 {/* ── Hero + Search ── */}
 <div className="bg-gradient-to-b from-primary/8 via-primary/4 to-transparent border-b border-border/40">
 <div className="container mx-auto px-4 pt-6 pb-5 max-w-4xl">
 <div className="flex items-center gap-3 mb-1">
 <MapPin className="w-6 h-6 text-primary" />
 <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
 Find Pet Services
 </h1>
 </div>
 <p className="text-sm text-muted-foreground mb-4 ml-9">
 {merchants.length} merchants · Reviews · Rewards
 </p>

 {/* Search Bar */}
 <div className="relative max-w-2xl ml-0">
 <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
 <Input
 placeholder="Search by name, service, or location…"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="pl-10 pr-10 h-11 bg-background/80 backdrop-blur-sm border-border/60 shadow-sm rounded-xl focus-visible:ring-primary/30"
 />
 {searchTerm && (
 <button
 onClick={() => setSearchTerm("")}
 className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted transition-colors"
 aria-label="Clear search"
 >
 <X className="w-4 h-4 text-muted-foreground" />
 </button>
 )}
 </div>
 </div>
 </div>

 {/* ── Category Pills ── */}
 <div className="border-b border-border/30 bg-background/80 backdrop-blur-sm sticky top-0 z-20">
 <div className="container mx-auto px-4 max-w-4xl">
 <div className="flex gap-1.5 overflow-x-auto py-3 scrollbar-hide -mx-1 px-1">
 {businessTypes.map((type) => {
 const Icon = type.icon;
 const isSelected = selectedCategory === type.value;
 return (
 <button
 key={type.value}
 onClick={() => setSelectedCategory(type.value)}
 className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
 isSelected
 ?"bg-primary text-primary-foreground shadow-sm"
 :"bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
 }`}
 >
 <Icon className="w-3.5 h-3.5" />
 {type.label}
 </button>
 );
 })}
 </div>
 </div>
 </div>

 <div className={`container mx-auto px-4 py-4 ${viewMode ==="map" || showMobileMap ?"max-w-7xl" :"max-w-4xl"}`}>
 {/* Top Ad */}
 <AdPlacement position="top" />

 {/* ── Toolbar: Sort, Filters, View Toggle ── */}
 <div className="flex items-center justify-between gap-3 mb-4 mt-2">
 <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-1">
 {/* Sort pills */}
 {sortOptions.map((opt) => (
 <button
 key={opt.value}
 onClick={() => setSortBy(opt.value)}
 className={`text-xs font-medium px-2.5 py-1 rounded-md whitespace-nowrap transition-colors ${
 sortBy === opt.value
 ?"bg-foreground text-background"
 :"text-muted-foreground hover:text-foreground hover:bg-muted/50"
 }`}
 >
 {opt.label}
 </button>
 ))}
 <Separator orientation="vertical" className="h-4 mx-1" />
 <button
 onClick={() => setPawbucksOnly(!pawbucksOnly)}
 className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md whitespace-nowrap transition-colors ${
 pawbucksOnly
 ?"bg-primary/10 text-primary border border-primary/20"
 :"text-muted-foreground hover:text-foreground hover:bg-muted/50"
 }`}
 >
 <Coins className="w-3 h-3" />
 PawBucks
 </button>
 </div>

 {/* View toggle */}
 <div className="flex items-center border border-border/60 rounded-lg overflow-hidden">
 <button
 onClick={() => { setViewMode("list"); setShowMobileMap(false); }}
 className={`p-1.5 transition-colors ${viewMode ==="list" && !showMobileMap ?"bg-muted text-foreground" :"text-muted-foreground hover:text-foreground"}`}
 aria-label="List view"
 >
 <LayoutList className="w-4 h-4" />
 </button>
 <button
 onClick={() => { setViewMode("grid"); setShowMobileMap(false); }}
 className={`p-1.5 transition-colors hidden sm:block ${viewMode ==="grid" && !showMobileMap ?"bg-muted text-foreground" :"text-muted-foreground hover:text-foreground"}`}
 aria-label="Grid view"
 >
 <LayoutGrid className="w-4 h-4" />
 </button>
 <button
 onClick={() => { setViewMode("map"); setShowMobileMap(true); }}
 className={`p-1.5 transition-colors ${viewMode ==="map" || showMobileMap ?"bg-muted text-foreground" :"text-muted-foreground hover:text-foreground"}`}
 aria-label="Map view"
 >
 <Map className="w-4 h-4" />
 </button>
 </div>
 </div>

 {/* Active filters summary */}
 {activeFilterCount > 0 && (
 <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
 <SlidersHorizontal className="w-3.5 h-3.5" />
 <span>{filteredMerchants.length} result{filteredMerchants.length !== 1 ?"s" :""}</span>
 {selectedCategory !=="all" && (
 <Badge variant="secondary" className="text-[10px] h-5 gap-1 cursor-pointer" onClick={() => setSelectedCategory("all")}>
 {selectedCategory.replace(/_/g,"")}
 <X className="w-2.5 h-2.5" />
 </Badge>
 )}
 {pawbucksOnly && (
 <Badge variant="secondary" className="text-[10px] h-5 gap-1 cursor-pointer" onClick={() => setPawbucksOnly(false)}>
 PawBucks
 <X className="w-2.5 h-2.5" />
 </Badge>
 )}
 {debouncedSearch && (
 <Badge variant="secondary" className="text-[10px] h-5 gap-1 cursor-pointer" onClick={() => setSearchTerm("")}>
"{debouncedSearch}"
 <X className="w-2.5 h-2.5" />
 </Badge>
 )}
 </div>
 )}

 {/* ── Results ── */}
 {filteredMerchants.length === 0 ? (
 <div className="text-center py-20">
 <div className="w-16 h-16 rounded-full bg-muted/50 mx-auto flex items-center justify-center mb-4">
 <Store className="w-8 h-8 text-muted-foreground/40" />
 </div>
 <h3 className="text-lg font-semibold mb-1">No merchants found</h3>
 <p className="text-sm text-muted-foreground mb-4">Try adjusting your search or filters</p>
 <Button variant="outline" size="sm" onClick={() => { setSearchTerm(""); setSelectedCategory("all"); setPawbucksOnly(false); }}>
 Clear All Filters
 </Button>
 </div>
 ) : viewMode ==="map" || showMobileMap ? (
 /* ── Full Map View ── */
 <div className="flex flex-col lg:flex-row gap-4">
 {/* Map panel */}
 <div className="w-full lg:w-1/2 lg:sticky lg:top-16 lg:self-start">
 <div className="rounded-xl overflow-hidden border border-border/60 shadow-sm" style={{ height:"min(70vh, 600px)" }}>
 <MerchantMap
 merchants={mapMerchants}
 onMerchantClick={handleMapMerchantClick}
 featuredIds={featuredIdSet}
 premiumIds={premiumIdSet}
 sponsoredIds={sponsoredIdSet}
 />
 </div>
 {/* Mobile: show list button */}
 <div className="lg:hidden mt-3 text-center">
 <Button
 variant="outline"
 size="sm"
 className="gap-2"
 onClick={() => { setViewMode("list"); setShowMobileMap(false); }}
 >
 <LayoutList className="w-4 h-4" />
 Show List
 </Button>
 </div>
 </div>
 {/* Desktop: scrollable list beside map */}
 <div className="hidden lg:flex flex-col gap-3 flex-1 min-w-0">
 {filteredMerchants.map((merchant, index) => {
 const Icon = getBusinessIcon(merchant.business_type);
 const merchantIsVerified = isVerifiedPro(merchant.id, verifiedProIds);
 const merchantIsSponsored = isSponsored(merchant.id, sponsoredMerchantsList);
 const merchantIsBoosted = searchBoostedIds.has(merchant.id);

 const handleCardClick = () => {
 if (merchantIsSponsored) trackClick(merchant.id, index + 1, debouncedSearch || undefined);
 if (merchantIsBoosted) trackSearchClick(merchant.id, index + 1,"directory", { searchTerm: debouncedSearch || undefined, isBoosted: true });
 };

 return (
 <DirectoryMerchantCard
 key={merchant.id}
 merchant={merchant}
 index={index}
 isVerified={merchantIsVerified}
 isSponsored={merchantIsSponsored}
 isBoosted={merchantIsBoosted}
 onClick={handleCardClick}
 Icon={Icon}
 />
 );
 })}
 </div>
 </div>
 ) : (
 /* ── List / Grid View ── */
 <div className={
 viewMode ==="grid"
 ?"grid grid-cols-1 sm:grid-cols-2 gap-4"
 :"flex flex-col gap-3"
 }>
 {filteredMerchants.map((merchant, index) => {
 const Icon = getBusinessIcon(merchant.business_type);
 const merchantIsVerified = isVerifiedPro(merchant.id, verifiedProIds);
 const merchantIsSponsored = isSponsored(merchant.id, sponsoredMerchantsList);
 const merchantIsBoosted = searchBoostedIds.has(merchant.id);

 const handleCardClick = () => {
 if (merchantIsSponsored) {
 trackClick(merchant.id, index + 1, debouncedSearch || undefined);
 }
 if (merchantIsBoosted) {
 trackSearchClick(merchant.id, index + 1,"directory", {
 searchTerm: debouncedSearch || undefined,
 isBoosted: true,
 });
 }
 };

 return (
 <DirectoryMerchantCard
 key={merchant.id}
 merchant={merchant}
 index={index}
 isVerified={merchantIsVerified}
 isSponsored={merchantIsSponsored}
 isBoosted={merchantIsBoosted}
 onClick={handleCardClick}
 Icon={Icon}
 />
 );
 })}
 </div>
 )}

 {/* Bottom Ad */}
 <div className="mt-8">
 <AdPlacement position="bottom" />
 </div>
 </div>

 {/* Mobile Map FAB (only in list/grid mode) */}
 {!showMobileMap && viewMode !=="map" && filteredMerchants.length > 0 && (
 <button
 onClick={() => { setViewMode("map"); setShowMobileMap(true); }}
 className="sm:hidden fixed bottom-24 left-1/2 -translate-x-1/2 z-30 bg-foreground text-background px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium hover:scale-105 transition-transform"
 >
 <Map className="w-4 h-4" />
 Map
 </button>
 )}

 {user && <BottomNav />}
 </PullToRefresh>
 </>
 );
};

export default MerchantDirectory;
