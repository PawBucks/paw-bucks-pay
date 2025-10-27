import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { MerchantCard } from "@/components/MerchantCard";
import { PaymentDialog } from "@/components/PaymentDialog";
import { BottomNav } from "@/components/BottomNav";
import { LogOut, PawPrint, Search, Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

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
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [filteredMerchants, setFilteredMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<{
    id: string;
    name: string;
    cashbackRate: number;
  } | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadMerchants();
      getUserLocation();
    }
  }, [user]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = merchants.filter((merchant) =>
        merchant.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        merchant.business_type.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredMerchants(filtered);
    } else {
      setFilteredMerchants(merchants);
    }
  }, [searchTerm, merchants]);

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

  const loadMerchants = async () => {
    try {
      const { data, error } = await supabase
        .from("merchants")
        .select("*")
        .order("business_name");

      if (error) throw error;
      setMerchants(data || []);
      setFilteredMerchants(data || []);
    } catch (error: any) {
      console.error("Error loading merchants:", error);
      toast.error("Failed to load merchants");
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
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

  const handlePayNow = (merchantId: string, merchantName: string, cashbackRate: number) => {
    setSelectedMerchant({ id: merchantId, name: merchantName, cashbackRate });
    setPaymentDialogOpen(true);
  };

  const handlePaymentSuccess = () => {
    // Optionally refresh data or show updated balance
    toast.success("Redirecting to wallet...");
    setTimeout(() => navigate("/wallet"), 1000);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--gradient-hero)] pb-24">
      <header className="border-b bg-card/80 backdrop-blur-lg sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <PawPrint className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-[var(--gradient-primary)] bg-clip-text text-transparent">
              PetalPay
            </h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Discover</h2>
          <p className="text-muted-foreground">Find trusted pet services near you</p>
        </div>

        {/* Search */}
        <GradientCard className="mb-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {userLocation && (
              <Button variant="outline" size="icon">
                <MapPin className="w-4 h-4" />
              </Button>
            )}
          </div>
        </GradientCard>

        {/* Merchants Grid */}
        {filteredMerchants.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
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
          <GradientCard className="text-center py-12">
            <p className="text-muted-foreground mb-4">No merchants found</p>
            <Button onClick={() => setSearchTerm("")}>Clear Search</Button>
          </GradientCard>
        )}
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

      <BottomNav />
    </div>
  );
};

export default Discover;