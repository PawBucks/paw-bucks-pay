import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/useDebounce";
import { useOptimizedQuery } from "@/hooks/useOptimizedQuery";
import { DataLoader } from "@/lib/dataLoader";
import { PaymentDialog } from "@/components/PaymentDialog";
import { BottomNav } from "@/components/BottomNav";
import { PageLoader } from "@/components/PageLoader";
import { DiscoverMap } from "@/components/DiscoverMap";
import { MerchantListDrawer } from "@/components/MerchantListDrawer";
import { Search, Menu, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
};

const Discover = () => {
  const { user, loading: authLoading } = useAuth();
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
      toast.error("Please sign in to make a payment");
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
      <div className="h-screen flex flex-col bg-background overflow-hidden">
        {/* Search Header */}
        <div className="flex-shrink-0 bg-card/95 backdrop-blur-sm border-b border-border z-10">
          <div className="flex items-center gap-3 p-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate(-1)}
              className="flex-shrink-0"
            >
              <Menu className="w-5 h-5" />
            </Button>
            
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-muted/50 border-0"
              />
            </div>

            {userLocation && (
              <div className="flex-shrink-0 bg-primary/10 text-primary px-3 py-2 rounded-lg text-sm font-semibold">
                ${filteredMerchants.length > 0 ? filteredMerchants[0].cashback_rate.toFixed(2) : '0.00'}
              </div>
            )}
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
            <Button variant="secondary" size="sm" className="rounded-full">
              <SlidersHorizontal className="w-4 h-4 mr-1" />
              Open
            </Button>
            <Button variant="secondary" size="sm" className="rounded-full">
              Cuisine
            </Button>
            <Button variant="secondary" size="sm" className="rounded-full">
              Rating
            </Button>
            <Button variant="secondary" size="sm" className="rounded-full">
              Price
            </Button>
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative">
          <DiscoverMap
            merchants={filteredMerchants}
            userLocation={userLocation}
            onMerchantClick={handlePayNowFromCard}
          />

          {/* Merchant List Drawer */}
          <div className="absolute bottom-0 left-0 right-0 h-[45%]">
            <MerchantListDrawer
              merchants={filteredMerchants}
              userLocation={userLocation}
              onMerchantClick={handlePayNowFromCard}
              calculateDistance={calculateDistance}
            />
          </div>
        </div>

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