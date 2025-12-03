import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/useDebounce";
import { useOptimizedQuery } from "@/hooks/useOptimizedQuery";
import { supabase } from "@/integrations/supabase/client";
import { PaymentDialogWithPawBucks } from "@/components/PaymentDialogWithPawBucks";
import { BottomNav } from "@/components/BottomNav";
import { PageLoader } from "@/components/PageLoader";
import { Header } from "@/components/Header";
import { AdPlacement } from "@/components/AdPlacement";
import { Search, Store, Scissors, Home, Stethoscope, Footprints, Bone, Coins, CreditCard, ChevronRight, BookOpen, Star, Sparkles, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ROUTES, QUERY_STALE_TIMES } from "@/lib/constants";
import { SEO } from "@/components/SEO";
import { usePersistentState } from "@/hooks/usePersistentState";

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
  avg_rating: number;
  review_count: number;
};

const businessTypes = [
  { label: "All", value: "all", icon: Store },
  { label: "Pet Stores", value: "pet_store", icon: Store },
  { label: "Groomers", value: "groomer", icon: Scissors },
  { label: "Sitters", value: "sitter", icon: Home },
  { label: "Vets", value: "vet", icon: Stethoscope },
  { label: "Walkers", value: "walker", icon: Footprints },
  { label: "Trainers", value: "trainer", icon: Bone },
];

const getBusinessIcon = (type: string) => {
  const lowerType = type.toLowerCase();
  if (lowerType.includes("store") || lowerType.includes("shop")) return Store;
  if (lowerType.includes("groom")) return Scissors;
  if (lowerType.includes("sitter") || lowerType.includes("boarding")) return Home;
  if (lowerType.includes("vet") || lowerType.includes("clinic")) return Stethoscope;
  if (lowerType.includes("walker") || lowerType.includes("walking")) return Footprints;
  if (lowerType.includes("trainer") || lowerType.includes("training")) return Bone;
  return Store;
};

const StarRating = ({ rating, reviewCount }: { rating: number; reviewCount: number }) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  
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
      <span className="text-sm font-medium">{rating.toFixed(1)}</span>
      <span className="text-sm text-muted-foreground">({reviewCount})</span>
    </div>
  );
};

const MerchantCard = ({ 
  merchant, 
  onPayClick,
  isSponsored = false 
}: { 
  merchant: MerchantWithRating; 
  onPayClick: () => void;
  isSponsored?: boolean;
}) => {
  const Icon = getBusinessIcon(merchant.business_type);
  
  return (
    <Card className={`group hover:shadow-lg transition-all duration-300 overflow-hidden ${isSponsored ? 'border-primary/30 bg-primary/5' : 'border-border hover:border-primary/50'}`}>
      <CardContent className="p-0">
        <Link to={`/merchant/${merchant.id}`} className="block">
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
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-primary transition-colors">
                  {merchant.business_name}
                </h3>
                {isSponsored && (
                  <Badge variant="secondary" className="flex-shrink-0 gap-1 bg-primary/10 text-primary text-xs">
                    <Sparkles className="w-3 h-3" />
                    Sponsored
                  </Badge>
                )}
              </div>

              {/* Rating */}
              <div className="mb-2">
                <StarRating rating={merchant.avg_rating} reviewCount={merchant.review_count} />
              </div>

              {/* Business Type & Cashback */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge variant="outline" className="text-xs capitalize">
                  {merchant.business_type.replace(/_/g, " ")}
                </Badge>
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
                  {merchant.cashback_rate.toFixed(0)}% cashback
                </Badge>
              </div>

              {/* Description */}
              {merchant.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                  {merchant.description}
                </p>
              )}

              {/* Address & Payment Methods */}
              <div className="flex items-center justify-between gap-2">
                {merchant.address && (
                  <p className="text-xs text-muted-foreground line-clamp-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    {merchant.address}
                  </p>
                )}
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
            Pay & Earn Cashback
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const Discover = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = usePersistentState<string>('discover-search', "");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [selectedCategory, setSelectedCategory] = usePersistentState<string>('discover-category', "all");
  const [selectedMerchant, setSelectedMerchant] = useState<{
    id: string;
    name: string;
    cashbackRate: number;
    acceptsPawbucks: boolean;
  } | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  // Fetch merchants with ratings
  const { data: merchantsWithRatings = [], isLoading: loading } = useOptimizedQuery<MerchantWithRating[]>(
    ['merchants-with-ratings'],
    async () => {
      // Fetch merchants
      const { data: merchants, error: merchantsError } = await supabase
        .from('merchants')
        .select('*')
        .order('business_name');
      
      if (merchantsError) throw merchantsError;
      if (!merchants) return [];

      // Fetch all reviews to calculate ratings
      const { data: reviews, error: reviewsError } = await supabase
        .from('merchant_reviews')
        .select('merchant_id, rating');
      
      if (reviewsError) throw reviewsError;

      // Calculate average ratings per merchant
      const ratingsByMerchant = (reviews || []).reduce((acc, review) => {
        if (!acc[review.merchant_id]) {
          acc[review.merchant_id] = { total: 0, count: 0 };
        }
        acc[review.merchant_id].total += review.rating;
        acc[review.merchant_id].count += 1;
        return acc;
      }, {} as Record<string, { total: number; count: number }>);

      // Merge merchant data with ratings
      return merchants.map(merchant => ({
        ...merchant,
        avg_rating: ratingsByMerchant[merchant.id] 
          ? ratingsByMerchant[merchant.id].total / ratingsByMerchant[merchant.id].count 
          : 0,
        review_count: ratingsByMerchant[merchant.id]?.count || 0
      }));
    },
    { staleTime: QUERY_STALE_TIMES.LONG }
  );

  // Separate sponsored and regular merchants, sorted by rating
  const { sponsoredMerchants, regularMerchants } = useMemo(() => {
    const now = new Date().toISOString();
    
    let filtered = merchantsWithRatings;

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

    // Separate sponsored (active) from regular
    const sponsored = filtered
      .filter(m => m.is_sponsored && m.sponsored_until && m.sponsored_until > now)
      .sort((a, b) => b.avg_rating - a.avg_rating);
    
    const regular = filtered
      .filter(m => !m.is_sponsored || !m.sponsored_until || m.sponsored_until <= now)
      .sort((a, b) => b.avg_rating - a.avg_rating);

    return { sponsoredMerchants: sponsored, regularMerchants: regular };
  }, [merchantsWithRatings, selectedCategory, debouncedSearch]);

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

  const handlePaymentSuccess = () => {
    toast.success("Redirecting to wallet...");
    setTimeout(() => navigate(ROUTES.WALLET), 1000);
  };

  const handleLogout = async () => {
    await signOut();
    navigate(ROUTES.AUTH);
  };

  if (authLoading || loading) {
    return <PageLoader message="Finding amazing pet merchants near you..." />;
  }

  const totalMerchants = sponsoredMerchants.length + regularMerchants.length;

  return (
    <>
      <SEO
        title="Discover Pet Merchants - PawBucks"
        description="Find trusted pet stores, groomers, trainers and more. Earn cashback rewards with every purchase."
        keywords={["pet merchants", "pet stores", "pet services", "cashback", "rewards"]}
      />
      <Header isAuthenticated={!!user} onLogout={user ? handleLogout : undefined} />
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-4 pt-4 max-w-4xl">
          {/* Top Ad Placement */}
          <div className="mb-6">
            <AdPlacement position="top" />
          </div>
        </div>

        {/* Hero Section */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b">
          <div className="container mx-auto px-4 py-8 max-w-4xl">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Discover Pet Merchants
            </h1>
            <p className="text-muted-foreground mb-6">
              Find trusted pet services and earn cashback on every purchase
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
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
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

          {/* Results Count */}
          <div className="mb-6">
            <p className="text-sm text-muted-foreground">
              {totalMerchants} {totalMerchants === 1 ? "result" : "results"} • Sorted by highest rating
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
            <div className="space-y-8">
              {/* Sponsored Merchants Section */}
              {sponsoredMerchants.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold">Sponsored Results</h2>
                  </div>
                  <div className="space-y-4">
                    {sponsoredMerchants.map((merchant) => (
                      <MerchantCard
                        key={merchant.id}
                        merchant={merchant}
                        onPayClick={() => handleMerchantClick(merchant)}
                        isSponsored
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
                  {regularMerchants.map((merchant) => (
                    <MerchantCard
                      key={merchant.id}
                      merchant={merchant}
                      onPayClick={() => handleMerchantClick(merchant)}
                    />
                  ))}
                </div>
              </div>
            </div>
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

        {user && <BottomNav />}
      </div>
    </>
  );
};

export default Discover;
