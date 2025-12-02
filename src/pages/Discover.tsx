import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/useDebounce";
import { useOptimizedQuery } from "@/hooks/useOptimizedQuery";
import { DataLoader } from "@/lib/dataLoader";
import { PaymentDialogWithPawBucks } from "@/components/PaymentDialogWithPawBucks";
import { BottomNav } from "@/components/BottomNav";
import { PageLoader } from "@/components/PageLoader";
import { Header } from "@/components/Header";
import { AdPlacement } from "@/components/AdPlacement";
import { Search, Store, Scissors, Home, Stethoscope, Footprints, Bone, ArrowUpDown, Coins, CreditCard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ROUTES, QUERY_STALE_TIMES } from "@/lib/constants";
import { SEO } from "@/components/SEO";
import { usePersistentState } from "@/hooks/usePersistentState";

export type Merchant = {
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

const Discover = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = usePersistentState<string>('discover-search', "");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [selectedCategory, setSelectedCategory] = usePersistentState<string>('discover-category', "all");
  const [sortBy, setSortBy] = usePersistentState<string>('discover-sort', "name");
  const [selectedMerchant, setSelectedMerchant] = useState<{
    id: string;
    name: string;
    cashbackRate: number;
    acceptsPawbucks: boolean;
  } | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  // Optimized merchant loading with caching
  const { data: merchants = [], isLoading: loading } = useOptimizedQuery<Merchant[]>(
    ['merchants'],
    () => DataLoader.loadMerchants(),
    { staleTime: QUERY_STALE_TIMES.LONG }
  );

  // Memoized filtered and sorted merchants
  const filteredMerchants = useMemo(() => {
    let filtered = merchants;

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

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "cashback":
          return b.cashback_rate - a.cashback_rate;
        case "name":
        default:
          return a.business_name.localeCompare(b.business_name);
      }
    });

    return sorted;
  }, [merchants, selectedCategory, debouncedSearch, sortBy]);


  const handleMerchantClick = (merchant: Merchant) => {
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

  return (
    <>
      <SEO
        title="Discover Pet Merchants - PawBucks"
        description="Find trusted pet stores, groomers, trainers and more. Earn cashback rewards with every purchase."
        keywords={["pet merchants", "pet stores", "pet services", "cashback", "rewards"]}
      />
      <Header isAuthenticated={!!user} onLogout={user ? handleLogout : undefined} />
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-4 pt-4 max-w-7xl">
          {/* Top Ad Placement */}
          <div className="mb-6">
            <AdPlacement position="top" />
          </div>
        </div>

        {/* Hero Section */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b">
          <div className="container mx-auto px-4 py-8">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Discover Pet Merchants
            </h1>
            <p className="text-muted-foreground mb-6">
              Find trusted pet services and earn cashback on every purchase
            </p>

            {/* Search Bar */}
            <div className="relative max-w-2xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search for pet stores, groomers, vets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 pr-4 h-12 bg-background border-border shadow-sm"
              />
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-6 max-w-7xl">
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

          {/* Sort & Count */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-muted-foreground">
              {filteredMerchants.length} {filteredMerchants.length === 1 ? "merchant" : "merchants"} found
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortBy(sortBy === "name" ? "cashback" : "name")}
              className="gap-2"
            >
              <ArrowUpDown className="w-4 h-4" />
              {sortBy === "name" ? "Sort by Cashback" : "Sort by Name"}
            </Button>
          </div>

          {/* Merchants Grid */}
          {filteredMerchants.length === 0 ? (
            <div className="text-center py-16">
              <Store className="w-16 h-16 mx-auto text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No merchants found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search or filters
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              {filteredMerchants.map((merchant) => {
                const Icon = getBusinessIcon(merchant.business_type);
                return (
                  <Card
                    key={merchant.id}
                    className="group hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden border-border hover:border-primary/50"
                    onClick={() => handleMerchantClick(merchant)}
                  >
                    <CardContent className="p-0">
                      {/* Logo/Icon Header */}
                      <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-6 flex items-center justify-center relative">
                        {merchant.logo_url ? (
                          <div className="w-32 h-32 rounded-full overflow-hidden bg-background group-hover:scale-105 transition-transform shadow-md border-2 border-border">
                            <img
                              src={merchant.logo_url}
                              alt={`${merchant.business_name} logo`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-32 h-32 rounded-full bg-background flex items-center justify-center group-hover:scale-105 transition-transform border-2 border-border/50 shadow-md">
                            <Icon className="w-16 h-16 text-primary" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-primary transition-colors">
                            {merchant.business_name}
                          </h3>
                          <Badge className="bg-primary/10 text-primary border-primary/20 flex-shrink-0">
                            {merchant.cashback_rate.toFixed(1)}% back
                          </Badge>
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

                        <p className="text-sm text-muted-foreground capitalize mb-3">
                          {merchant.business_type.replace(/_/g, " ")}
                        </p>

                        {merchant.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                            {merchant.description}
                          </p>
                        )}

                        {merchant.address && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            📍 {merchant.address}
                          </p>
                        )}

                        <Button className="w-full mt-4 group-hover:bg-primary group-hover:text-primary-foreground">
                          Pay & Earn Cashback
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
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