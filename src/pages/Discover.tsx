import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/useDebounce";
import { useOptimizedQuery } from "@/hooks/useOptimizedQuery";
import { DataLoader } from "@/lib/dataLoader";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { MerchantCard } from "@/components/MerchantCard";
import { PaymentDialog } from "@/components/PaymentDialog";
import { BottomNav } from "@/components/BottomNav";
import { PageLoader } from "@/components/PageLoader";
import { EmptyState } from "@/components/EmptyState";
import { FeaturedMerchants } from "@/components/FeaturedMerchants";
import { PartnerOffers } from "@/components/PartnerOffers";
import { PromotionalBanner } from "@/components/PromotionalBanner";
import { AdPlacement } from "@/components/AdPlacement";
import { Search, MapPin, Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ROUTES, ERROR_MESSAGES, QUERY_STALE_TIMES } from "@/lib/constants";
import { SEO } from "@/components/SEO";
import { usePersistentState } from "@/hooks/usePersistentState";

type Merchant = {
  id: string;
  business_name: string;
  business_type: string;
  description?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  cashback_rate: number;
};

const Discover = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = usePersistentState<string>('discover-search', "");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [userLocation, setUserLocation] = usePersistentState<{ lat: number; lng: number } | null>('user-location', null);
  const [selectedMerchant, setSelectedMerchant] = useState<{
    id: string;
    name: string;
    cashbackRate: number;
  } | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  // Optimized merchant loading with caching
  const { data: merchants = [], isLoading: loading } = useOptimizedQuery<Merchant[]>(
    ['merchants'],
    () => DataLoader.loadMerchants(),
    { staleTime: QUERY_STALE_TIMES.LONG }
  );

  useEffect(() => {
    getUserLocation();
  }, []);

  // Memoized filtered merchants
  const filteredMerchants = useMemo(() => {
    if (!debouncedSearch) return merchants;
    
    const searchLower = debouncedSearch.toLowerCase();
    return (merchants as Merchant[]).filter((merchant) =>
      merchant.business_name.toLowerCase().includes(searchLower) ||
      merchant.business_type.toLowerCase().includes(searchLower)
    );
  }, [debouncedSearch, merchants]);

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  };

  // Distance calculation memoized
  const calculateDistance = useMemo(() => {
    return (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 3959; // Earth's radius in miles
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLng = ((lng2 - lng1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };
  }, []);


  const handlePayNow = (merchantId: string, merchantName: string, cashbackRate: number) => {
    if (!user) {
      toast.error(ERROR_MESSAGES.AUTH_REQUIRED);
      navigate(ROUTES.AUTH);
      return;
    }
    setSelectedMerchant({ id: merchantId, name: merchantName, cashbackRate });
    setPaymentDialogOpen(true);
  };

  const handlePayNowFromCard = (merchant: Merchant) => {
    handlePayNow(merchant.id, merchant.business_name, merchant.cashback_rate);
  };

  const handlePaymentSuccess = () => {
    toast.success("Redirecting to wallet...");
    setTimeout(() => navigate(ROUTES.WALLET), 1000);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate(ROUTES.AUTH);
  };

  if (authLoading || loading) {
    return <PageLoader message="Finding amazing pet merchants near you..." />;
  }

  return (
    <>
      <SEO 
        title="Discover Pet Merchants"
        description="Find trusted pet stores, groomers, trainers and more. Earn cashback rewards with every purchase."
        keywords={['pet merchants', 'pet stores', 'pet services', 'cashback', 'rewards']}
      />
      <div className="min-h-screen bg-background pb-20">
        <Header isAuthenticated={!!user} onLogout={handleSignOut} />

        <main className="container mx-auto px-4 py-6 space-y-6">
          {/* Ad Placement for Free Users */}
          <AdPlacement />
          
          <PromotionalBanner />
          
          <FeaturedMerchants onMerchantClick={handlePayNowFromCard} />
          
          <PartnerOffers />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">All Merchants</h2>
            </div>

        {/* Search */}
        <GradientCard className="mb-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Search by name or type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                aria-label="Search merchants"
              />
            </div>
            {userLocation && (
              <Button variant="outline" size="icon" aria-label="Your location">
                <MapPin className="w-4 h-4" />
              </Button>
            )}
          </div>
        </GradientCard>

        {/* Merchants Grid */}
        {filteredMerchants.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2" role="list">
            {filteredMerchants.map((merchant) => {
              const distance =
                userLocation && merchant.latitude && merchant.longitude
                  ? calculateDistance(
                      userLocation.lat,
                      userLocation.lng,
                      merchant.latitude,
                      merchant.longitude
                    )
                  : undefined;

              return (
                <MerchantCard
                  key={merchant.id}
                  merchant={merchant}
                  distance={distance}
                  onPayNow={handlePayNow}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Store}
            title="No merchants found"
            description={searchTerm ? "Try a different search term" : "No merchants available yet"}
            action={searchTerm ? {
              label: "Clear Search",
              onClick: () => setSearchTerm("")
            } : undefined}
          />
        )}
          </div>
      </main>

      {/* Payment Dialog */}
      {selectedMerchant && user && (
        <PaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          merchantId={selectedMerchant.id}
          merchantName={selectedMerchant.name}
          cashbackRate={selectedMerchant.cashbackRate}
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