import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/useDebounce";
import { useOptimizedQuery } from "@/hooks/useOptimizedQuery";
import { DataLoader } from "@/lib/dataLoader";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { PageLoader } from "@/components/PageLoader";
import { AdPlacement } from "@/components/AdPlacement";
import { SEO } from "@/components/SEO";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ROUTES, QUERY_STALE_TIMES } from "@/lib/constants";
import { usePersistentState } from "@/hooks/usePersistentState";
import { supabase } from "@/integrations/supabase/client";
import {
  Search,
  Store,
  Scissors,
  Home,
  Stethoscope,
  Footprints,
  Bone,
  ArrowUpDown,
  Coins,
  CreditCard,
  Star,
  MapPin,
  ChevronRight,
  Filter,
} from "lucide-react";

type MerchantWithRating = {
  id: string;
  business_name: string;
  business_type: string;
  description?: string;
  address?: string;
  cashback_rate: number;
  logo_url?: string;
  accepts_pawbucks?: boolean;
  average_rating: number;
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

const MerchantDirectory = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = usePersistentState<string>("directory-search", "");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [selectedCategory, setSelectedCategory] = usePersistentState<string>("directory-category", "all");
  const [sortBy, setSortBy] = usePersistentState<string>("directory-sort", "rating");
  const [pawbucksOnly, setPawbucksOnly] = usePersistentState<boolean>("directory-pawbucks", false);

  // Fetch merchants with ratings
  const { data: merchants = [], isLoading } = useOptimizedQuery<MerchantWithRating[]>(
    ["merchants-with-ratings"],
    async () => {
      // Fetch merchants
      const { data: merchantData, error: merchantError } = await supabase
        .from("merchants")
        .select("id, business_name, business_type, description, address, cashback_rate, logo_url, accepts_pawbucks")
        .order("business_name");

      if (merchantError) throw merchantError;

      // Fetch review stats for each merchant
      const merchantsWithRatings = await Promise.all(
        (merchantData || []).map(async (merchant) => {
          const { data: reviews } = await supabase
            .from("merchant_reviews")
            .select("rating")
            .eq("merchant_id", merchant.id);

          const reviewCount = reviews?.length || 0;
          const averageRating = reviewCount > 0
            ? reviews!.reduce((sum, r) => sum + r.rating, 0) / reviewCount
            : 0;

          return {
            ...merchant,
            average_rating: averageRating,
            review_count: reviewCount,
          };
        })
      );

      return merchantsWithRatings;
    },
    { staleTime: QUERY_STALE_TIMES.MEDIUM }
  );

  // Filter and sort merchants
  const filteredMerchants = useMemo(() => {
    let filtered = merchants;

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter((m) =>
        m.business_type.toLowerCase().includes(selectedCategory.toLowerCase())
      );
    }

    // Filter by PawBucks acceptance
    if (pawbucksOnly) {
      filtered = filtered.filter((m) => m.accepts_pawbucks);
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

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "rating":
          return b.average_rating - a.average_rating;
        case "cashback":
          return b.cashback_rate - a.cashback_rate;
        case "reviews":
          return b.review_count - a.review_count;
        case "name":
        default:
          return a.business_name.localeCompare(b.business_name);
      }
    });

    return sorted;
  }, [merchants, selectedCategory, debouncedSearch, sortBy, pawbucksOnly]);

  const handleLogout = async () => {
    await signOut();
    navigate(ROUTES.AUTH);
  };

  if (isLoading) {
    return <PageLoader message="Loading merchant directory..." />;
  }

  return (
    <>
      <SEO
        title="Pet Merchant Directory - PawBucks"
        description="Browse our complete directory of pet merchants. Find pet stores, groomers, vets, and more. Read reviews and earn cashback."
        keywords={["pet directory", "pet merchants", "pet stores", "pet services", "reviews"]}
      />
      <Header isAuthenticated={!!user} onLogout={user ? handleLogout : undefined} />

      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-24 md:pb-12">
        {/* Top Ad */}
        <div className="container mx-auto px-4 pt-4 max-w-7xl">
          <AdPlacement position="top" />
        </div>

        {/* Hero Section */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b mt-4">
          <div className="container mx-auto px-4 py-8">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Merchant Directory
            </h1>
            <p className="text-muted-foreground mb-6">
              Browse all pet merchants, read reviews, and find the perfect service
            </p>

            {/* Search Bar */}
            <div className="relative max-w-2xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search merchants by name, type, or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 pr-4 h-12 bg-background border-border shadow-sm"
              />
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-6 max-w-7xl">
          {/* Filters Row */}
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            {/* Category Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide flex-1">
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

            {/* Additional Filters */}
            <div className="flex gap-2 flex-shrink-0">
              <Button
                variant={pawbucksOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setPawbucksOnly(!pawbucksOnly)}
                className="gap-2"
              >
                <Coins className="w-4 h-4" />
                PawBucks Only
              </Button>
            </div>
          </div>

          {/* Sort & Count */}
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <p className="text-sm text-muted-foreground">
              {filteredMerchants.length} {filteredMerchants.length === 1 ? "merchant" : "merchants"} found
            </p>
            <div className="flex gap-2">
              {["rating", "cashback", "reviews", "name"].map((option) => (
                <Button
                  key={option}
                  variant={sortBy === option ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSortBy(option)}
                >
                  {option === "rating" && "Top Rated"}
                  {option === "cashback" && "Cashback"}
                  {option === "reviews" && "Most Reviews"}
                  {option === "name" && "A-Z"}
                </Button>
              ))}
            </div>
          </div>

          {/* Merchants Grid */}
          {filteredMerchants.length === 0 ? (
            <div className="text-center py-16">
              <Store className="w-16 h-16 mx-auto text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No merchants found</h3>
              <p className="text-muted-foreground">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              {filteredMerchants.map((merchant) => {
                const Icon = getBusinessIcon(merchant.business_type);
                return (
                  <Link key={merchant.id} to={`/merchant/${merchant.id}`}>
                    <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden border-border hover:border-primary/50 h-full">
                      <CardContent className="p-0">
                        {/* Logo/Icon Header */}
                        <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-6 flex items-center justify-center relative">
                          {merchant.logo_url ? (
                            <div className="w-24 h-24 rounded-full overflow-hidden bg-background group-hover:scale-105 transition-transform shadow-md border-2 border-border">
                              <img
                                src={merchant.logo_url}
                                alt={`${merchant.business_name} logo`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-24 h-24 rounded-full bg-background flex items-center justify-center group-hover:scale-105 transition-transform border-2 border-border/50 shadow-md">
                              <Icon className="w-12 h-12 text-primary" />
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="p-5">
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-primary transition-colors">
                              {merchant.business_name}
                            </h3>
                            <Badge className="bg-primary/10 text-primary border-primary/20 flex-shrink-0 ml-2">
                              {merchant.cashback_rate}%
                            </Badge>
                          </div>

                          {/* Rating */}
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex items-center gap-1">
                              <Star
                                className={`w-4 h-4 ${
                                  merchant.average_rating > 0
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-muted-foreground/30"
                                }`}
                              />
                              <span className="text-sm font-medium">
                                {merchant.average_rating > 0 ? merchant.average_rating.toFixed(1) : "New"}
                              </span>
                            </div>
                            <span className="text-sm text-muted-foreground">
                              ({merchant.review_count} {merchant.review_count === 1 ? "review" : "reviews"})
                            </span>
                          </div>

                          {/* Payment Methods */}
                          <div className="flex items-center gap-2 mb-3">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <CreditCard className="w-3 h-3" />
                              <span>Card</span>
                            </div>
                            {merchant.accepts_pawbucks && (
                              <div className="flex items-center gap-1 text-xs text-primary">
                                <Coins className="w-3 h-3" />
                                <span>PawBucks</span>
                              </div>
                            )}
                          </div>

                          <p className="text-sm text-muted-foreground capitalize mb-2">
                            {merchant.business_type.replace(/_/g, " ")}
                          </p>

                          {merchant.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                              {merchant.description}
                            </p>
                          )}

                          {merchant.address && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              <span className="line-clamp-1">{merchant.address}</span>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-3 border-t">
                            <span className="text-sm text-primary font-medium">View Profile</span>
                            <ChevronRight className="w-4 h-4 text-primary group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Bottom Ad */}
          <div className="mt-8">
            <AdPlacement position="bottom" />
          </div>
        </div>

        {user && <BottomNav />}
      </div>
    </>
  );
};

export default MerchantDirectory;
