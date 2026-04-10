import { useState, useMemo, useEffect, useCallback, useDeferredValue } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { getSubscriptionTier } from "@/lib/constants";
import { useDebounce } from "@/hooks/useDebounce";
import { useOptimizedQuery } from "@/hooks/useOptimizedQuery";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { supabase } from "@/integrations/supabase/client";
import { PaymentDialogWithPawBucks } from "@/components/PaymentDialogWithPawBucks";
import { BottomNav } from "@/components/BottomNav";
import { PageLoader } from "@/components/PageLoader";
import { Header } from "@/components/Header";
import { AdPlacement } from "@/components/AdPlacement";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Search, Store, Scissors, Home, Stethoscope, Footprints, Bone, BookOpen, Star, MapPin, SlidersHorizontal, X, List, Map, Navigation, ArrowUpDown, Mountain, Zap, Hand, Brain, MoreHorizontal } from "lucide-react";
import { MerchantMap } from "@/components/MerchantMap";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { ROUTES, QUERY_STALE_TIMES } from "@/lib/constants";
import { SEO } from "@/components/SEO";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useSponsoredMerchants, useVerifiedProMerchants, useSearchBoostedMerchantSet, useFeaturedPartnerMerchants, usePremiumAdMerchants, SERVICE_NAMES } from "@/hooks/useMerchantServices";
import { useQueryClient } from "@tanstack/react-query";
import { useSponsoredTracking } from "@/hooks/useSponsoredTracking";
import { useSearchRankingTracking } from "@/hooks/useSearchRankingTracking";
import { useServiceConversionTracking } from "@/hooks/useServiceConversionTracking";
import { FeaturedPartnerCard, PremiumAdCard, SponsoredMerchantCard, OrganicMerchantCard, AttentionLadderFeed } from "@/components/discover";

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
  is_sponsored?: boolean;
  sponsored_until?: string;
  price_range?: number;
  avg_rating: number;
  review_count: number;
  distance?: number; // Distance in miles from user
};

type UserLocation = {
  latitude: number;
  longitude: number;
} | null;

type SortOption = 'rating' | 'distance' | 'name';

const getPriceRange = (range?: number) => {
  const level = range || 2;
  return '$'.repeat(level);
};

// Calculate distance between two points using Haversine formula
const calculateDistance = (
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number => {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const formatDistance = (distance?: number): string => {
  if (distance === undefined) return '';
  if (distance < 0.1) return '< 0.1 mi';
  if (distance < 10) return `${distance.toFixed(1)} mi`;
  return `${Math.round(distance)} mi`;
};

const businessTypes = [
  { label: "All", value: "all", icon: Store },
  { label: "Pet Stores", value: "pet_store", icon: Store },
  { label: "Groomers", value: "groomer", icon: Scissors },
  { label: "Sitters", value: "sitter", icon: Home },
  { label: "Vets", value: "vet", icon: Stethoscope },
  { label: "Walkers", value: "walker", icon: Footprints },
  { label: "Trainers", value: "trainer", icon: Bone },
  { label: "Hikers", value: "hiker", icon: Mountain },
  { label: "Runners", value: "runner", icon: Zap },
  { label: "Masseuses", value: "masseuse", icon: Hand },
  { label: "Behaviorists", value: "behaviorist", icon: Brain },
  { label: "Other", value: "other", icon: MoreHorizontal },
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



const ratingFilters = [
  { label: "Any Rating", value: 0 },
  { label: "3+ Stars", value: 3 },
  { label: "4+ Stars", value: 4 },
  { label: "4.5+ Stars", value: 4.5 },
];

const priceFilters = [
  { label: "$", value: 1 },
  { label: "$$", value: 2 },
  { label: "$$$", value: 3 },
  { label: "$$$$", value: 4 },
];

const distanceFilters = [
  { label: "Any Distance", value: 0 },
  { label: "Within 5 miles", value: 5 },
  { label: "Within 10 miles", value: 10 },
  { label: "Within 25 miles", value: 25 },
  { label: "Within 50 miles", value: 50 },
];

const Discover = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { subscription } = useSubscription();
  const tier = useMemo(() => getSubscriptionTier(subscription.product_id, subscription.subscription_tier), [subscription.product_id, subscription.subscription_tier]);
  const [searchTerm, setSearchTerm] = usePersistentState<string>('discover-search', "");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [selectedCategory, setSelectedCategory] = usePersistentState<string>('discover-category', "all");
  const [minRating, setMinRating] = usePersistentState<number>('discover-min-rating', 0);
  const [selectedPrices, setSelectedPrices] = usePersistentState<number[]>('discover-prices', []);
  const [maxDistance, setMaxDistance] = usePersistentState<number>('discover-max-distance', 0);
  const [sortBy, setSortBy] = usePersistentState<SortOption>('discover-sort', 'rating');
  const [userLocation, setUserLocation] = useState<UserLocation>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<{
    id: string;
    name: string;
    cashbackRate: number;
    acceptsPawbucks: boolean;
  } | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [viewMode, setViewMode] = usePersistentState<'list' | 'map'>('discover-view-mode', 'list');

  // Fetch all tiers from service purchases
  const { data: featuredPartnersList = [] } = useFeaturedPartnerMerchants();
  const featuredPartnerIds = useMemo(() => new Set(featuredPartnersList.map(m => m.id)), [featuredPartnersList]);

  const { data: premiumAdsList = [] } = usePremiumAdMerchants();
  const premiumAdIds = useMemo(() => new Set(premiumAdsList.map(m => m.id)), [premiumAdsList]);

  const { data: sponsoredMerchantsList = [] } = useSponsoredMerchants();
  const sponsoredMerchantIds = useMemo(() => new Set(sponsoredMerchantsList.map(m => m.id)), [sponsoredMerchantsList]);

  // Fetch verified pro merchants from service purchases
  const { data: verifiedProMerchantIds = [] } = useVerifiedProMerchants();
  const verifiedProSet = useMemo(() => new Set(verifiedProMerchantIds), [verifiedProMerchantIds]);

  // Fetch search boosted merchants (merchants with Search Ranking Booster service)
  const { data: searchBoostedIds = new Set<string>() } = useSearchBoostedMerchantSet();

  // Sponsored placement tracking
  const { trackImpression, trackClick, trackSponsoredImpressions } = useSponsoredTracking("discover");

  // Service conversion tracking for ROI measurement
  const { trackImpression: trackServiceImpression, trackClick: trackServiceClick, trackProfileView: trackServiceProfileView } = useServiceConversionTracking();

  // Search ranking tracking for boosted merchants
  const { trackBatchImpressions, trackSearchClick, trackSearchConversion } = useSearchRankingTracking();

  // Get user's location
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setLocationLoading(true);
    setLocationError(null);

    // Try high accuracy first, fall back to low accuracy on failure
    const onSuccess = (position: GeolocationPosition) => {
      setUserLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setLocationLoading(false);
      toast.success("Location found! Showing nearby merchants.");
    };

    const onError = (error: GeolocationPositionError) => {
      // If high accuracy failed with POSITION_UNAVAILABLE, retry without it
      if (error.code === error.POSITION_UNAVAILABLE) {
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          (retryError) => {
            setLocationLoading(false);
            let errorMessage = "Unable to get your location";
            if (retryError.code === retryError.PERMISSION_DENIED) {
              errorMessage = "Location access denied. Please enable location in your browser settings.";
            } else if (retryError.code === retryError.POSITION_UNAVAILABLE) {
              errorMessage = "Location unavailable. Please check your browser's location settings and try again.";
            } else if (retryError.code === retryError.TIMEOUT) {
              errorMessage = "Location request timed out. Please try again.";
            }
            setLocationError(errorMessage);
            toast.error(errorMessage);
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 }
        );
        return;
      }

      setLocationLoading(false);
      let errorMessage = "Unable to get your location";
      if (error.code === error.PERMISSION_DENIED) {
        errorMessage = "Location access denied. Please enable location in your browser settings.";
      } else if (error.code === error.TIMEOUT) {
        errorMessage = "Location request timed out. Please try again.";
      }
      setLocationError(errorMessage);
      toast.error(errorMessage);
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000,
    });
  }, []);

  // Auto-request location if distance filter or sort is selected
  useEffect(() => {
    if ((maxDistance > 0 || sortBy === 'distance') && !userLocation && !locationLoading) {
      // Reset previous error so we can retry
      if (locationError) setLocationError(null);
      requestLocation();
    }
  }, [maxDistance, sortBy, userLocation, locationLoading, locationError, requestLocation]);

  // Fetch merchants with ratings - optimized query with parallel data loading
  const { data: merchantsWithRatings = [], isLoading: loading } = useOptimizedQuery<MerchantWithRating[]>(
    ['merchants-with-ratings'],
    async () => {
      // Fetch merchants and reviews in parallel
      const [merchantsResult, reviewsResult] = await Promise.all([
        supabase
          .from('merchants_public')
          .select('id, business_name, business_type, description, address, latitude, longitude, cashback_rate, logo_url, accepts_pawbucks, is_sponsored, sponsored_until, price_range')
          .order('business_name'),
        supabase
          .from('merchant_reviews')
          .select('merchant_id, rating')
      ]);
      
      if (merchantsResult.error) throw merchantsResult.error;
      if (!merchantsResult.data) return [];

      // Calculate average ratings per merchant
      const ratingsByMerchant = (reviewsResult.data || []).reduce((acc, review) => {
        if (!acc[review.merchant_id]) {
          acc[review.merchant_id] = { total: 0, count: 0 };
        }
        acc[review.merchant_id].total += review.rating;
        acc[review.merchant_id].count += 1;
        return acc;
      }, {} as Record<string, { total: number; count: number }>);

      // Merge merchant data with ratings
      return merchantsResult.data.map(merchant => ({
        ...merchant,
        avg_rating: ratingsByMerchant[merchant.id] 
          ? ratingsByMerchant[merchant.id].total / ratingsByMerchant[merchant.id].count 
          : 0,
        review_count: ratingsByMerchant[merchant.id]?.count || 0
      }));
    },
    { staleTime: QUERY_STALE_TIMES.LONG, refetchOnMount: false }
  );

  // Toggle price filter
  const togglePriceFilter = (price: number) => {
    setSelectedPrices(prev => 
      prev.includes(price) 
        ? prev.filter(p => p !== price)
        : [...prev, price]
    );
  };

  // Clear all filters
  const clearFilters = () => {
    setMinRating(0);
    setSelectedPrices([]);
    setMaxDistance(0);
  };

  const hasActiveFilters = minRating > 0 || selectedPrices.length > 0 || maxDistance > 0;

  // Separate merchants into 5 attention ladder tiers with distance calculation
  const { featuredPartners, premiumAds, sponsoredMerchants, boostedMerchants, organicMerchants } = useMemo(() => {
    // Calculate distances first
    let filtered = merchantsWithRatings.map(merchant => {
      let distance: number | undefined;
      if (userLocation && merchant.latitude && merchant.longitude) {
        distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          merchant.latitude,
          merchant.longitude
        );
      }
      return { ...merchant, distance };
    });

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter((m) =>
        m.business_type.toLowerCase().includes(selectedCategory.toLowerCase())
      );
    }

    // Filter by search
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.business_name.toLowerCase().includes(searchLower) ||
          searchMatchesCategory(debouncedSearch, m.business_type) ||
          m.description?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by minimum rating
    if (minRating > 0) {
      filtered = filtered.filter(m => m.avg_rating >= minRating);
    }

    // Filter by price range
    if (selectedPrices.length > 0) {
      filtered = filtered.filter(m => selectedPrices.includes(m.price_range || 2));
    }

    // Filter by max distance (only if user location is available)
    if (maxDistance > 0 && userLocation) {
      filtered = filtered.filter(m => m.distance !== undefined && m.distance <= maxDistance);
    }

    // Sort function for organic/regular merchants
    const sortMerchants = (merchants: typeof filtered) => {
      return [...merchants].sort((a, b) => {
        switch (sortBy) {
          case 'distance':
            if (a.distance === undefined && b.distance === undefined) return 0;
            if (a.distance === undefined) return 1;
            if (b.distance === undefined) return -1;
            return a.distance - b.distance;
          case 'name':
            return a.business_name.localeCompare(b.business_name);
          case 'rating':
          default:
            return b.avg_rating - a.avg_rating;
        }
      });
    };

    // 🥇 Level 1 — Featured Partner (max 1 per category shown)
    const featured = sortMerchants(
      filtered.filter(m => featuredPartnerIds.has(m.id))
    ).slice(0, 1); // Max 1 visible at once per spec

    // 🥈 Level 2 — Premium Ad (max 3)
    const premium = sortMerchants(
      filtered.filter(m => premiumAdIds.has(m.id) && !featuredPartnerIds.has(m.id))
    ).slice(0, 3);

    // 🥉 Level 3 — Sponsored (max 5, not grouped together - will be interspersed)
    const sponsored = sortMerchants(
      filtered.filter(m => sponsoredMerchantIds.has(m.id) && !featuredPartnerIds.has(m.id) && !premiumAdIds.has(m.id))
    ).slice(0, 5);

    // ⚡ Level 4 — Boosted (search ranking boost, no badge)
    const boosted = sortMerchants(
      filtered.filter(m => 
        searchBoostedIds.has(m.id) && 
        !featuredPartnerIds.has(m.id) && 
        !premiumAdIds.has(m.id) && 
        !sponsoredMerchantIds.has(m.id)
      )
    );

    // 🌿 Level 5 — Organic (pure ranking)
    const organic = sortMerchants(
      filtered.filter(m => 
        !featuredPartnerIds.has(m.id) && 
        !premiumAdIds.has(m.id) && 
        !sponsoredMerchantIds.has(m.id) &&
        !searchBoostedIds.has(m.id)
      )
    );

    return { 
      featuredPartners: featured, 
      premiumAds: premium, 
      sponsoredMerchants: sponsored, 
      boostedMerchants: boosted,
      organicMerchants: organic 
    };
  }, [merchantsWithRatings, selectedCategory, debouncedSearch, minRating, selectedPrices, maxDistance, userLocation, sortBy, featuredPartnerIds, premiumAdIds, sponsoredMerchantIds, searchBoostedIds]);

  // Defer expensive list rendering so filter interactions stay snappy
  const deferredFeatured = useDeferredValue(featuredPartners);
  const deferredPremium = useDeferredValue(premiumAds);

  // Intersperse sponsored into first 10 organic results (not grouped)
  const interspersedResults = useMemo(() => {
    const combined = [...boostedMerchants, ...organicMerchants];
    if (sponsoredMerchants.length === 0) return combined;
    
    const result: (typeof combined[0] & { _isSponsored?: boolean })[] = [];
    let sponsoredIndex = 0;
    // Insert sponsored at positions 2, 5, 8 within first 10
    const sponsoredPositions = [2, 5, 8, 11, 14];
    
    for (let i = 0; i < combined.length; i++) {
      if (sponsoredIndex < sponsoredMerchants.length && sponsoredPositions.includes(result.length)) {
        result.push({ ...sponsoredMerchants[sponsoredIndex], _isSponsored: true });
        sponsoredIndex++;
      }
      result.push(combined[i]);
    }
    // Append remaining sponsored if not all placed
    while (sponsoredIndex < sponsoredMerchants.length) {
      result.push({ ...sponsoredMerchants[sponsoredIndex], _isSponsored: true });
      sponsoredIndex++;
    }
    return result;
  }, [boostedMerchants, organicMerchants, sponsoredMerchants]);

  const deferredInterspersed = useDeferredValue(interspersedResults);

  // Track sponsored impressions when they change
  useEffect(() => {
    if (sponsoredMerchants.length > 0) {
      trackSponsoredImpressions(
        sponsoredMerchants.map(m => m.id),
        debouncedSearch || undefined
      );
    }
  }, [sponsoredMerchants, trackSponsoredImpressions, debouncedSearch]);

  // Track service conversion impressions for Featured Partner and Verified Pro
  useEffect(() => {
    featuredPartners.forEach(m => {
      trackServiceImpression(m.id, SERVICE_NAMES.FEATURED_PARTNER, 'discover');
    });
    premiumAds.forEach(m => {
      trackServiceImpression(m.id, SERVICE_NAMES.PREMIUM_AD, 'discover');
    });
    // Track Verified Pro impressions for all visible merchants with the badge
    [...featuredPartners, ...premiumAds, ...sponsoredMerchants, ...boostedMerchants, ...organicMerchants].forEach(m => {
      if (verifiedProSet.has(m.id)) {
        trackServiceImpression(m.id, SERVICE_NAMES.VERIFIED_PRO_BADGE, 'discover');
      }
    });
  }, [featuredPartners, premiumAds, sponsoredMerchants, boostedMerchants, organicMerchants, verifiedProSet, trackServiceImpression]);

  // Track search ranking impressions for boosted merchants
  useEffect(() => {
    const allMerchants = [...featuredPartners, ...premiumAds, ...sponsoredMerchants, ...boostedMerchants, ...organicMerchants];
    const boosted = allMerchants
      .filter(m => searchBoostedIds.has(m.id))
      .map((m, index) => ({
        id: m.id,
        position: index + 1,
        isBoosted: true,
        categoryMatch: selectedCategory !== 'all' && m.business_type.toLowerCase().includes(selectedCategory.toLowerCase()),
        localMatch: !!m.distance && m.distance <= 10,
      }));

    if (boosted.length > 0) {
      trackBatchImpressions(boosted, 'discover', debouncedSearch || undefined);
    }
  }, [featuredPartners, premiumAds, sponsoredMerchants, boostedMerchants, organicMerchants, searchBoostedIds, trackBatchImpressions, debouncedSearch, selectedCategory]);

  const handleSponsoredMerchantClick = (merchant: MerchantWithRating, position: number) => {
    // Track the sponsored click
    trackClick(merchant.id, position, debouncedSearch || undefined);
    
    // Also track search ranking click if boosted
    if (searchBoostedIds.has(merchant.id)) {
      trackSearchClick(merchant.id, position, 'discover', {
        searchTerm: debouncedSearch || undefined,
        isBoosted: true,
      });
    }
    
    // Then handle the payment flow
    handleMerchantClick(merchant);
  };

  const handleMerchantClick = (merchant: MerchantWithRating) => {
    if (!user) {
      toast.error("Please sign in to make a payment");
      navigate(ROUTES.AUTH);
      return;
    }
    setSelectedMerchant({
      id: merchant.id,
      name: merchant.business_name,
      cashbackRate: merchant.cashback_rate,
      acceptsPawbucks: merchant.accepts_pawbucks ?? false,
    });
    setPaymentDialogOpen(true);
  };

  // Handle card click for search ranking tracking + service conversion tracking
  const handleCardClickTracking = (merchantId: string, position: number) => {
    if (searchBoostedIds.has(merchantId)) {
      trackSearchClick(merchantId, position, 'discover', {
        searchTerm: debouncedSearch || undefined,
        isBoosted: true,
      });
    }
    // Track service clicks for ROI
    if (verifiedProSet.has(merchantId)) {
      trackServiceClick(merchantId, SERVICE_NAMES.VERIFIED_PRO_BADGE, 'discover');
    }
    if (featuredPartnerIds.has(merchantId)) {
      trackServiceClick(merchantId, SERVICE_NAMES.FEATURED_PARTNER, 'discover');
    }
    if (premiumAdIds.has(merchantId)) {
      trackServiceClick(merchantId, SERVICE_NAMES.PREMIUM_AD, 'discover');
    }
  };

  const handlePaymentSuccess = () => {
    toast.success("Redirecting to wallet...");
    setTimeout(() => navigate(ROUTES.WALLET), 1000);
  };

  const handleLogout = async () => {
    await signOut();
    navigate(ROUTES.AUTH);
  };

  // Pull to refresh - invalidate query cache to refetch merchants
  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['merchants-with-ratings'] });
  }, [queryClient]);

  const { containerRef, isRefreshing, pullDistance, progress } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  if (authLoading || loading) {
    return <PageLoader message="Finding amazing pet merchants near you..." />;
  }

  const totalMerchants = deferredFeatured.length + deferredPremium.length + deferredInterspersed.length;

  return (
    <>
      <SEO
        title="Discover Pet Merchants - PawBucks"
        description="Find trusted pet stores, groomers, trainers and more. Earn PawBucks rewards with every purchase."
        keywords={["pet merchants", "pet stores", "pet services", "PawBucks", "rewards"]}
      />
      <Header isAuthenticated={!!user} onLogout={user ? handleLogout : undefined} />
      <div className="min-h-[100dvh] bg-background flex flex-col">
        <PullToRefresh
          ref={containerRef}
          isRefreshing={isRefreshing}
          pullDistance={pullDistance}
          progress={progress}
          className="flex-1"
        >

        {/* ── Hero Section ── */}
        <div className="border-b bg-card">
          <div className="container mx-auto px-4 py-5 sm:py-8 max-w-4xl lg:max-w-7xl">
            <div className="max-w-2xl">
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-1.5">
                Find the best pet services
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground mb-5">
                Trusted merchants · Earn rewards on every visit
              </p>
            </div>

            {/* Search Bar — Yelp-style prominent */}
            <div className="flex gap-2 sm:gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
                <Input
                  placeholder="Groomers, vets, pet stores..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 h-11 sm:h-12 bg-background border-border shadow-sm text-sm sm:text-base rounded-lg"
                />
              </div>
              <Button asChild variant="outline" className="h-11 sm:h-12 gap-2 rounded-lg">
                <Link to="/directory">
                  <BookOpen className="w-4 h-4" />
                  <span className="hidden sm:inline">Directory</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* ── Top Ad ── */}
        <div className="container mx-auto px-4 pt-3 max-w-4xl lg:max-w-7xl">
          <AdPlacement position="top" />
        </div>

        {/* ── Main Content ── */}
        <div className="container mx-auto px-4 py-4 max-w-4xl lg:max-w-7xl">

          {/* Category Chips — horizontal scroll */}
          <div className="flex gap-1.5 mb-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
            {businessTypes.map((type) => {
              const Icon = type.icon;
              const isSelected = selectedCategory === type.value;
              return (
                <button
                  key={type.value}
                  onClick={() => setSelectedCategory(type.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {type.label}
                </button>
              );
            })}
          </div>

          {/* Filter Row — compact pills */}
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                  minRating > 0 ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground'
                }`}>
                  <Star className="w-3 h-3" />
                  {minRating > 0 ? `${minRating}+` : "Rating"}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Minimum Rating</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ratingFilters.map((filter) => (
                  <DropdownMenuCheckboxItem
                    key={filter.value}
                    checked={minRating === filter.value}
                    onCheckedChange={() => setMinRating(filter.value)}
                  >
                    {filter.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                  selectedPrices.length > 0 ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground'
                }`}>
                  <SlidersHorizontal className="w-3 h-3" />
                  {selectedPrices.length > 0 ? selectedPrices.sort().map(p => '$'.repeat(p)).join(' ') : "Price"}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Price Range</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {priceFilters.map((filter) => (
                  <DropdownMenuCheckboxItem
                    key={filter.value}
                    checked={selectedPrices.includes(filter.value)}
                    onCheckedChange={() => togglePriceFilter(filter.value)}
                  >
                    {filter.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    maxDistance > 0 ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground'
                  } ${locationLoading ? 'opacity-60' : ''}`}
                  disabled={locationLoading}
                >
                  <Navigation className={`w-3 h-3 ${locationLoading ? 'animate-spin' : ''}`} />
                  {locationLoading ? 'Locating...' : maxDistance > 0 ? `${maxDistance} mi` : "Near Me"}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Maximum Distance</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {distanceFilters.map((filter) => (
                  <DropdownMenuCheckboxItem
                    key={filter.value}
                    checked={maxDistance === filter.value}
                    onCheckedChange={() => setMaxDistance(filter.value)}
                  >
                    {filter.label}
                  </DropdownMenuCheckboxItem>
                ))}
                {locationError && (
                  <>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-xs text-destructive">{locationError}</div>
                    <Button variant="ghost" size="sm" className="w-full justify-start text-xs" onClick={requestLocation}>
                      Retry location
                    </Button>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border bg-card border-border text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowUpDown className="w-3 h-3" />
                  {sortBy === 'rating' ? 'Top Rated' : sortBy === 'distance' ? 'Nearest' : 'A-Z'}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Sort By</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                  <DropdownMenuRadioItem value="rating">Top Rated</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="distance" disabled={!userLocation && !locationLoading}>
                    Nearest {!userLocation && '(enable location)'}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="name">A-Z</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}

            {/* View Toggle — mobile */}
            <div className="ml-auto flex lg:hidden items-center border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                List
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'map' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Map className="w-3.5 h-3.5" />
                Map
              </button>
            </div>
          </div>

          {/* Results summary */}
          <div className="mb-3">
            <p className="text-xs text-muted-foreground">
              {totalMerchants} {totalMerchants === 1 ? "result" : "results"}
              {userLocation && " · Using your location"}
            </p>
          </div>

          {/* ── Results Area ── */}
          {totalMerchants === 0 ? (
            <div className="text-center py-20">
              <Store className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <h3 className="text-base font-semibold mb-1">No merchants found</h3>
              <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              {(() => {
                const allMapMerchants = [...deferredFeatured, ...deferredPremium, ...deferredInterspersed];
                const mapClickHandler = (merchantId: string) => {
                  if (searchBoostedIds.has(merchantId)) {
                    trackSearchClick(merchantId, undefined, 'map', {
                      searchTerm: debouncedSearch || undefined,
                      isBoosted: true,
                    });
                  }
                  navigate(`/merchant/${merchantId}`);
                };

                return (
                  <>
                    {/* Desktop: Split View */}
                    <div className="hidden lg:flex gap-5 h-[calc(100vh-340px)] min-h-[520px]">
                      <ScrollArea className="flex-1 pr-3">
                        <AttentionLadderFeed
                          featuredPartners={deferredFeatured}
                          premiumAds={deferredPremium}
                          interspersedResults={deferredInterspersed}
                          verifiedProSet={verifiedProSet}
                          showDistance={!!userLocation}
                          selectedCategory={selectedCategory}
                          subscriptionTier={tier}
                          onPayClick={handleMerchantClick}
                          onSponsoredClick={handleSponsoredMerchantClick}
                          onCardClick={handleCardClickTracking}
                        />
                      </ScrollArea>

                      <div className="w-[42%] flex-shrink-0 rounded-xl overflow-hidden border border-border shadow-sm">
                        <MerchantMap
                          merchants={allMapMerchants}
                          onMerchantClick={mapClickHandler}
                          featuredIds={featuredPartnerIds}
                          premiumIds={premiumAdIds}
                          sponsoredIds={sponsoredMerchantIds}
                        />
                      </div>
                    </div>

                    {/* Mobile: Toggle */}
                    <div className="lg:hidden">
                      {viewMode === 'map' ? (
                        <div className="space-y-3">
                          <MerchantMap
                            merchants={allMapMerchants}
                            onMerchantClick={mapClickHandler}
                            featuredIds={featuredPartnerIds}
                            premiumIds={premiumAdIds}
                            sponsoredIds={sponsoredMerchantIds}
                          />
                          <p className="text-xs text-muted-foreground text-center">
                            Tap a pin to view details
                          </p>
                        </div>
                      ) : (
                        <AttentionLadderFeed
                          featuredPartners={deferredFeatured}
                          premiumAds={deferredPremium}
                          interspersedResults={deferredInterspersed}
                          verifiedProSet={verifiedProSet}
                          showDistance={!!userLocation}
                          selectedCategory={selectedCategory}
                          subscriptionTier={tier}
                          onPayClick={handleMerchantClick}
                          onSponsoredClick={handleSponsoredMerchantClick}
                          onCardClick={handleCardClickTracking}
                        />
                      )}
                    </div>
                  </>
                );
              })()}
            </>
          )}

          {/* Bottom Ad */}
          <div className="mt-8 mb-6 pb-24 md:pb-12">
            <AdPlacement position="bottom" />
          </div>
        </div>

        {/* Payment Dialog */}
        {selectedMerchant && user && (
          <PaymentDialogWithPawBucks
            open={paymentDialogOpen}
            onOpenChange={setPaymentDialogOpen}
            merchantId={selectedMerchant.id}
            merchantName={selectedMerchant.name}
            cashbackRate={selectedMerchant.cashbackRate}
            acceptsPawbucks={selectedMerchant.acceptsPawbucks}
            userId={user.id}
            onSuccess={handlePaymentSuccess}
          />
        )}
        </PullToRefresh>
      </div>

      {user && <BottomNav />}
    </>
  );
};

export default Discover;
