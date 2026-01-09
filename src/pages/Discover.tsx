import { useState, useMemo, useEffect, useCallback, memo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/useDebounce";
import { useOptimizedQuery } from "@/hooks/useOptimizedQuery";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { supabase } from "@/integrations/supabase/client";
import { PaymentDialogWithPawBucks } from "@/components/PaymentDialogWithPawBucks";
import { BottomNav } from "@/components/BottomNav";
import { PageLoader } from "@/components/PageLoader";
import { Header } from "@/components/Header";
import { AdPlacement } from "@/components/AdPlacement";
import { PawBucksInfoTooltip } from "@/components/PawBucksInfoTooltip";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Search, Store, Scissors, Home, Stethoscope, Footprints, Bone, Coins, CreditCard, ChevronRight, BookOpen, Star, Sparkles, MapPin, SlidersHorizontal, X, List, Map, Navigation, ArrowUpDown, LayoutGrid, BadgeCheck, Mountain, Zap, Hand, Brain, MoreHorizontal } from "lucide-react";
import { MerchantMap } from "@/components/MerchantMap";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { ROUTES, QUERY_STALE_TIMES } from "@/lib/constants";
import { SEO } from "@/components/SEO";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useSponsoredMerchants, useVerifiedProMerchants, useSearchBoostedMerchantSet, SERVICE_NAMES } from "@/hooks/useMerchantServices";
import { useQueryClient } from "@tanstack/react-query";
import { useSponsoredTracking } from "@/hooks/useSponsoredTracking";
import { useSearchRankingTracking } from "@/hooks/useSearchRankingTracking";

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

const StarRating = memo(({ rating, reviewCount }: { rating: number; reviewCount: number }) => {
  const safeRating = rating ?? 0;
  const fullStars = Math.floor(safeRating);
  const hasHalfStar = safeRating % 1 >= 0.5;
  
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`w-4 h-4 ${
              i < fullStars
                ? "text-yellow-500 fill-yellow-500"
                : i === fullStars && hasHalfStar
                ? "text-yellow-500 fill-yellow-500/50"
                : "text-muted-foreground/30"
            }`}
          />
        ))}
      </div>
      <span className="text-sm font-medium">{safeRating.toFixed(1)}</span>
      <span className="text-sm text-muted-foreground">({reviewCount ?? 0})</span>
    </div>
  );
});
StarRating.displayName = "StarRating";

const DiscoverMerchantCard = memo(({ 
  merchant, 
  onPayClick,
  onCardClick,
  isSponsored = false,
  showDistance = false,
  isVerifiedPro = false,
  index = 0
}: { 
  merchant: MerchantWithRating; 
  onPayClick: () => void;
  onCardClick?: () => void;
  isSponsored?: boolean;
  showDistance?: boolean;
  isVerifiedPro?: boolean;
  index?: number;
}) => {
  const Icon = getBusinessIcon(merchant.business_type);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" }}
    >
    <Card className={`group hover:shadow-lg transition-all duration-300 overflow-hidden ${isSponsored ? 'border-primary/30 bg-primary/5' : 'border-border hover:border-primary/50'}`}>
      <CardContent className="p-0">
        <Link to={`/merchant/${merchant.id}`} className="block" onClick={onCardClick}>
          <div className="flex gap-4 p-4">
            {/* Logo */}
            <div className="flex-shrink-0">
              {merchant.logo_url ? (
                <div className="w-24 h-24 rounded-lg overflow-hidden bg-background shadow-sm border border-border">
                  <img
                    src={merchant.logo_url}
                    alt={`${merchant.business_name} logo`}
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border border-border/50">
                  <Icon className="w-10 h-10 text-primary" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="mb-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {isVerifiedPro && (
                    <Badge className="gap-1 bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs">
                      <BadgeCheck className="w-3 h-3" />
                      Verified Pro
                    </Badge>
                  )}
                  {isSponsored && (
                    <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary text-xs">
                      <Sparkles className="w-3 h-3" />
                      Sponsored
                    </Badge>
                  )}
                </div>
                <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-primary transition-colors">
                  {merchant.business_name}
                </h3>
              </div>

              {/* Rating */}
              <div className="mb-2">
                <StarRating rating={merchant.avg_rating} reviewCount={merchant.review_count} />
              </div>

              {/* Business Type, Price Range & Cashback */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge variant="outline" className="text-xs capitalize">
                  {merchant.business_type.replace(/_/g, " ")}
                </Badge>
                <span className="text-sm font-medium text-muted-foreground">
                  {getPriceRange(merchant.price_range)}
                </span>
                <span className="text-muted-foreground/50">•</span>
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs gap-1">
                  {(merchant.cashback_rate ?? 0).toFixed(0)}x points
                  <PawBucksInfoTooltip variant="multiplier" className="ml-0.5" />
                </Badge>
              </div>

              {/* Description */}
              {merchant.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                  {merchant.description}
                </p>
              )}

              {/* Address, Distance & Payment Methods */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {merchant.address && (
                    <p className="text-xs text-muted-foreground line-clamp-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      {merchant.address}
                    </p>
                  )}
                  {showDistance && merchant.distance !== undefined && (
                    <Badge variant="outline" className="text-xs flex-shrink-0 gap-1">
                      <Navigation className="w-3 h-3" />
                      {formatDistance(merchant.distance)}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                  {merchant.accepts_pawbucks && (
                    <Coins className="w-3.5 h-3.5 text-primary" />
                  )}
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex-shrink-0 self-center">
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        </Link>

        {/* Pay Button */}
        <div className="px-4 pb-4">
          <Button className="w-full" onClick={onPayClick}>
            Pay & Earn Points
          </Button>
        </div>
      </CardContent>
    </Card>
    </motion.div>
  );
});
DiscoverMerchantCard.displayName = "DiscoverMerchantCard";

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

  // Fetch sponsored merchants from service purchases
  const { data: sponsoredMerchantsList = [] } = useSponsoredMerchants();
  const sponsoredMerchantIds = useMemo(() => new Set(sponsoredMerchantsList.map(m => m.id)), [sponsoredMerchantsList]);

  // Fetch verified pro merchants from service purchases
  const { data: verifiedProMerchantIds = [] } = useVerifiedProMerchants();
  const verifiedProSet = useMemo(() => new Set(verifiedProMerchantIds), [verifiedProMerchantIds]);

  // Fetch search boosted merchants (merchants with Search Ranking Booster service)
  const { data: searchBoostedIds = new Set<string>() } = useSearchBoostedMerchantSet();

  // Sponsored placement tracking
  const { trackImpression, trackClick, trackSponsoredImpressions } = useSponsoredTracking("discover");

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

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationLoading(false);
        toast.success("Location found! Showing nearby merchants.");
      },
      (error) => {
        setLocationLoading(false);
        let errorMessage = "Unable to get your location";
        if (error.code === error.PERMISSION_DENIED) {
          errorMessage = "Location access denied. Please enable location in your browser settings.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMessage = "Location unavailable. Please try again.";
        } else if (error.code === error.TIMEOUT) {
          errorMessage = "Location request timed out. Please try again.";
        }
        setLocationError(errorMessage);
        toast.error(errorMessage);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  // Auto-request location if distance filter or sort is selected
  useEffect(() => {
    if ((maxDistance > 0 || sortBy === 'distance') && !userLocation && !locationLoading && !locationError) {
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

  // Separate sponsored and regular merchants with distance calculation
  const { sponsoredMerchants, regularMerchants } = useMemo(() => {
    const now = new Date().toISOString();
    
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
          m.business_type.toLowerCase().includes(searchLower) ||
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

    // Sort function based on sortBy, with search boost priority
    const sortMerchants = (merchants: typeof filtered) => {
      return [...merchants].sort((a, b) => {
        // Search boosted merchants get priority (appear higher in results)
        const aIsBoosted = searchBoostedIds.has(a.id);
        const bIsBoosted = searchBoostedIds.has(b.id);
        
        // If only one is boosted, prioritize the boosted one
        if (aIsBoosted && !bIsBoosted) return -1;
        if (!aIsBoosted && bIsBoosted) return 1;
        
        // If both boosted or neither boosted, sort by the selected criterion
        switch (sortBy) {
          case 'distance':
            // Merchants without distance go to the end
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

    // Separate sponsored (from service purchases) from regular
    const sponsored = sortMerchants(
      filtered.filter(m => sponsoredMerchantIds.has(m.id))
    );
    
    const regular = sortMerchants(
      filtered.filter(m => !sponsoredMerchantIds.has(m.id))
    );

    return { sponsoredMerchants: sponsored, regularMerchants: regular };
  }, [merchantsWithRatings, selectedCategory, debouncedSearch, minRating, selectedPrices, maxDistance, userLocation, sortBy, sponsoredMerchantIds, searchBoostedIds]);

  // Track sponsored impressions when they change
  useEffect(() => {
    if (sponsoredMerchants.length > 0) {
      trackSponsoredImpressions(
        sponsoredMerchants.map(m => m.id),
        debouncedSearch || undefined
      );
    }
  }, [sponsoredMerchants, trackSponsoredImpressions, debouncedSearch]);

  // Track search ranking impressions for boosted merchants
  useEffect(() => {
    const allMerchants = [...sponsoredMerchants, ...regularMerchants];
    const boostedMerchants = allMerchants
      .filter(m => searchBoostedIds.has(m.id))
      .map((m, index) => ({
        id: m.id,
        position: index + 1,
        isBoosted: true,
        categoryMatch: selectedCategory !== 'all' && m.business_type.toLowerCase().includes(selectedCategory.toLowerCase()),
        localMatch: !!m.distance && m.distance <= 10,
      }));

    if (boostedMerchants.length > 0) {
      trackBatchImpressions(boostedMerchants, 'discover', debouncedSearch || undefined);
    }
  }, [sponsoredMerchants, regularMerchants, searchBoostedIds, trackBatchImpressions, debouncedSearch, selectedCategory]);

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

  // Handle card click for search ranking tracking
  const handleCardClickTracking = (merchantId: string, position: number) => {
    if (searchBoostedIds.has(merchantId)) {
      trackSearchClick(merchantId, position, 'discover', {
        searchTerm: debouncedSearch || undefined,
        isBoosted: true,
      });
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

  const totalMerchants = sponsoredMerchants.length + regularMerchants.length;

  return (
    <>
      <SEO
        title="Discover Pet Merchants - PawBucks"
        description="Find trusted pet stores, groomers, trainers and more. Earn PawBucks rewards with every purchase."
        keywords={["pet merchants", "pet stores", "pet services", "PawBucks", "rewards"]}
      />
      <Header isAuthenticated={!!user} onLogout={user ? handleLogout : undefined} />
      <PullToRefresh
        ref={containerRef}
        isRefreshing={isRefreshing}
        pullDistance={pullDistance}
        progress={progress}
        className="min-h-[100dvh] bg-gradient-to-b from-background to-muted/20 flex flex-col overflow-auto"
      >
        <div className="container mx-auto px-4 pt-3 max-w-4xl">
          {/* Top Ad Placement */}
          <div className="mb-4">
            <AdPlacement position="top" />
          </div>
        </div>

        {/* Hero Section */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b">
          <div className="container mx-auto px-4 py-4 sm:py-6 max-w-4xl">
            <h1 className="text-2xl sm:text-3xl font-bold mb-1 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Discover Pet Merchants
            </h1>
            <p className="text-sm text-muted-foreground mb-4">
              Find trusted pet services and earn rewards on every purchase
            </p>

            {/* Search Bar */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Search for pet stores, groomers, vets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 pr-4 h-12 bg-background border-border shadow-sm"
                />
              </div>
              <Button asChild variant="outline" className="h-12 gap-2">
                <Link to="/directory">
                  <BookOpen className="w-4 h-4" />
                  Browse Directory
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-6 max-w-4xl">
          {/* Category Filters */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
            {businessTypes.map((type) => {
              const Icon = type.icon;
              const isSelected = selectedCategory === type.value;
              return (
                <Button
                  key={type.value}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(type.value)}
                  className="flex-shrink-0 gap-2"
                >
                  <Icon className="w-4 h-4" />
                  {type.label}
                </Button>
              );
            })}
          </div>

          {/* Rating & Price Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {/* Rating Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Star className="w-4 h-4" />
                  {minRating > 0 ? `${minRating}+ Stars` : "Rating"}
                </Button>
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

            {/* Price Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <SlidersHorizontal className="w-4 h-4" />
                  {selectedPrices.length > 0 
                    ? selectedPrices.sort().map(p => '$'.repeat(p)).join(', ')
                    : "Price"}
                </Button>
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

            {/* Distance Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className={`gap-2 ${maxDistance > 0 && !userLocation ? 'animate-pulse' : ''}`}
                  disabled={locationLoading}
                >
                  <Navigation className={`w-4 h-4 ${locationLoading ? 'animate-spin' : ''}`} />
                  {locationLoading ? 'Locating...' : maxDistance > 0 ? `Within ${maxDistance} mi` : "Near Me"}
                </Button>
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
                    <div className="px-2 py-1.5 text-xs text-destructive">
                      {locationError}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full justify-start text-xs"
                      onClick={requestLocation}
                    >
                      Retry location
                    </Button>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sort Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowUpDown className="w-4 h-4" />
                  Sort: {sortBy === 'rating' ? 'Rating' : sortBy === 'distance' ? 'Distance' : 'Name'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Sort By</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                  <DropdownMenuRadioItem value="rating">Highest Rating</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="distance" disabled={!userLocation && !locationLoading}>
                    Nearest First {!userLocation && '(enable location)'}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="name">Name (A-Z)</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearFilters}
                className="gap-1 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
                Clear filters
              </Button>
            )}

            {/* View Toggle - Mobile Only */}
            <div className="ml-auto flex lg:hidden items-center border rounded-lg overflow-hidden">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-none gap-1.5"
              >
                <List className="w-4 h-4" />
                List
              </Button>
              <Button
                variant={viewMode === 'map' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('map')}
                className="rounded-none gap-1.5"
              >
                <Map className="w-4 h-4" />
                Map
              </Button>
            </div>

            {/* Split View Indicator - Desktop */}
            <div className="ml-auto hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
              <LayoutGrid className="w-4 h-4" />
              Split View
            </div>
          </div>

          {/* Results Count */}
          <div className="mb-6">
            <p className="text-sm text-muted-foreground">
              {totalMerchants} {totalMerchants === 1 ? "result" : "results"} • Sorted by {sortBy === 'rating' ? 'highest rating' : sortBy === 'distance' ? 'nearest first' : 'name'}
              {userLocation && <span className="ml-1">• Location enabled</span>}
            </p>
          </div>

          {/* No Results */}
          {totalMerchants === 0 ? (
            <div className="text-center py-16">
              <Store className="w-16 h-16 mx-auto text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No merchants found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search or filters
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Split View */}
              <div className="hidden lg:flex gap-6 h-[calc(100vh-380px)] min-h-[500px]">
                {/* List Panel */}
                <ScrollArea className="flex-1 pr-4">
                  <div className="space-y-6">
                    {/* Sponsored Merchants Section */}
                    {sponsoredMerchants.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <Sparkles className="w-5 h-5 text-primary" />
                          <h2 className="text-lg font-semibold">Sponsored Results</h2>
                        </div>
                        <div className="space-y-4">
                          {sponsoredMerchants.map((merchant, index) => (
                            <DiscoverMerchantCard
                              key={merchant.id}
                              merchant={merchant}
                              onPayClick={() => handleSponsoredMerchantClick(merchant, index + 1)}
                              onCardClick={() => handleCardClickTracking(merchant.id, index + 1)}
                              isSponsored
                              showDistance={!!userLocation}
                              isVerifiedPro={verifiedProSet.has(merchant.id)}
                              index={index}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* All Results Section */}
                    <div>
                      <h2 className="text-lg font-semibold mb-4">
                        {sponsoredMerchants.length > 0 ? "All Results" : "Results"}
                      </h2>
                      <div className="space-y-4">
                        {regularMerchants.map((merchant, index) => (
                          <DiscoverMerchantCard
                            key={merchant.id}
                            merchant={merchant}
                            onPayClick={() => handleMerchantClick(merchant)}
                            onCardClick={() => handleCardClickTracking(merchant.id, sponsoredMerchants.length + index + 1)}
                            showDistance={!!userLocation}
                            isVerifiedPro={verifiedProSet.has(merchant.id)}
                            index={index}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </ScrollArea>

                {/* Map Panel */}
                <div className="w-[45%] flex-shrink-0 rounded-xl overflow-hidden border border-border shadow-sm">
                  <MerchantMap
                    merchants={[...sponsoredMerchants, ...regularMerchants]}
                    onMerchantClick={(merchantId) => {
                      // Track search ranking click from map
                      if (searchBoostedIds.has(merchantId)) {
                        trackSearchClick(merchantId, undefined, 'map', {
                          searchTerm: debouncedSearch || undefined,
                          isBoosted: true,
                        });
                      }
                      navigate(`/merchant/${merchantId}`);
                    }}
                  />
                </div>
              </div>

              {/* Mobile View */}
              <div className="lg:hidden">
                {viewMode === 'map' ? (
                  /* Map View */
                  <div className="space-y-4">
                    <MerchantMap
                      merchants={[...sponsoredMerchants, ...regularMerchants]}
                      onMerchantClick={(merchantId) => {
                        // Track search ranking click from map
                        if (searchBoostedIds.has(merchantId)) {
                          trackSearchClick(merchantId, undefined, 'map', {
                            searchTerm: debouncedSearch || undefined,
                            isBoosted: true,
                          });
                        }
                        navigate(`/merchant/${merchantId}`);
                      }}
                    />
                    <p className="text-sm text-muted-foreground text-center">
                      Click on a marker to view merchant details
                    </p>
                  </div>
                ) : (
                  /* List View */
                  <div className="space-y-8">
                    {/* Sponsored Merchants Section */}
                    {sponsoredMerchants.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <Sparkles className="w-5 h-5 text-primary" />
                          <h2 className="text-lg font-semibold">Sponsored Results</h2>
                        </div>
                        <div className="space-y-4">
                          {sponsoredMerchants.map((merchant, index) => (
                            <DiscoverMerchantCard
                              key={merchant.id}
                              merchant={merchant}
                              onPayClick={() => handleSponsoredMerchantClick(merchant, index + 1)}
                              onCardClick={() => handleCardClickTracking(merchant.id, index + 1)}
                              isSponsored
                              showDistance={!!userLocation}
                              isVerifiedPro={verifiedProSet.has(merchant.id)}
                              index={index}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* All Results Section */}
                    <div>
                      <h2 className="text-lg font-semibold mb-4">
                        {sponsoredMerchants.length > 0 ? "All Results" : "Results"}
                      </h2>
                      <div className="space-y-4">
                        {regularMerchants.map((merchant, index) => (
                          <DiscoverMerchantCard
                            key={merchant.id}
                            merchant={merchant}
                            onPayClick={() => handleMerchantClick(merchant)}
                            onCardClick={() => handleCardClickTracking(merchant.id, sponsoredMerchants.length + index + 1)}
                            showDistance={!!userLocation}
                            isVerifiedPro={verifiedProSet.has(merchant.id)}
                            index={index}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Bottom Ad Placement */}
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

      {user && <BottomNav />}
    </>
  );
};

export default Discover;
