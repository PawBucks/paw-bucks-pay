import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Lock, MapPin, Sparkles, Store } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GradientCard } from "@/components/ui/gradient-card";
import { PageLoader } from "@/components/PageLoader";
import { WelcomeCreditCard } from "@/components/dashboard/WelcomeCreditCard";
import { MerchantTypeBadge } from "@/components/shared/MerchantTypeBadge";
import { PawBucksLogo } from "@/components/PawBucksLogo";
import { useUserLocation } from "@/hooks/useUserLocation";
import { calculateDistance } from "@/lib/geo";

type MerchantRow = {
  id: string;
  business_name: string;
  business_type: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  cashback_rate: number | null;
  logo_url: string | null;
  fee_model: string | null;
  stripe_account_status: string | null;
};

const LIMIT = 6;

const WelcomeExplore = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const petId = searchParams.get("petId") || undefined;
  const { userLocation, requestLocation, locationLoading } = useUserLocation();
  const [askedForLocation, setAskedForLocation] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  // Auto-prompt for location once on mount (browser will gate native prompt)
  useEffect(() => {
    if (!askedForLocation) {
      setAskedForLocation(true);
      requestLocation();
    }
  }, [askedForLocation, requestLocation]);

  const { data: pet } = useQuery({
    queryKey: ["welcome-pet", petId],
    queryFn: async () => {
      if (!petId) return null;
      const { data } = await supabase
        .from("pet_profiles")
        .select("id, name, photo_url")
        .eq("id", petId)
        .maybeSingle();
      return data as { id: string; name: string; photo_url: string | null } | null;
    },
    enabled: !!petId,
  });

  const { data: merchants = [], isLoading: merchantsLoading } = useQuery({
    queryKey: ["welcome-explore-merchants"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("merchants")
        .select(
          "id, business_name, business_type, address, latitude, longitude, cashback_rate, logo_url, fee_model, stripe_account_status",
        )
        .eq("is_active", true)
        .limit(200);
      if (error) throw error;
      return (data || []) as MerchantRow[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const withDistance = useMemo(() => {
    return merchants.map((m) => {
      const distance =
        userLocation && m.latitude != null && m.longitude != null
          ? calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              m.latitude,
              m.longitude,
            )
          : null;
      return { ...m, distance };
    });
  }, [merchants, userLocation]);

  const sortByDistance = (arr: (MerchantRow & { distance: number | null })[]) =>
    [...arr].sort((a, b) => {
      if (a.distance == null && b.distance == null) return 0;
      if (a.distance == null) return 1;
      if (b.distance == null) return -1;
      return a.distance - b.distance;
    });

  const acquisitionMerchants = useMemo(
    () =>
      sortByDistance(
        withDistance.filter((m) => m.fee_model === "acquisition_only"),
      ).slice(0, LIMIT),
    [withDistance],
  );

  const fullEcosystemMerchants = useMemo(
    () =>
      sortByDistance(
        withDistance.filter(
          (m) =>
            m.fee_model !== "acquisition_only" &&
            m.stripe_account_status === "active",
        ),
      ).slice(0, LIMIT),
    [withDistance],
  );

  if (authLoading || !user) return <PageLoader />;

  const petName = pet?.name;

  return (
    <div className="min-h-screen bg-background pb-24">
      <SEO
        title="Welcome to PawBucks — Start Exploring"
        description="Use your Welcome Credit and unlock New Customer deals near you."
      />
      <Header />

      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-8">
        {/* Hero */}
        <section className="text-center space-y-2">
          <Badge className="bg-success/10 text-success border-success/30">
            <Sparkles className="w-3 h-3 mr-1" aria-hidden="true" />
            You're all set!
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold">
            {petName ? `${petName} is ready to explore` : "Ready to explore"}
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Here's where to put your Welcome Credit to work — plus exclusive New
            Customer deals near you.
          </p>
        </section>

        {/* Welcome Credit */}
        <section>
          <WelcomeCreditCard userId={user.id} />
        </section>

        {/* Acquisition-only New Customer deals */}
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent" aria-hidden="true" />
                New Customer Deals Near You
              </h2>
              <p className="text-sm text-muted-foreground">
                Visit the store and scan their QR code to unlock.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/discover")}
            >
              See all <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {merchantsLoading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Loading nearby merchants…
            </div>
          ) : acquisitionMerchants.length === 0 ? (
            <GradientCard className="text-sm text-muted-foreground text-center py-6">
              No New Customer deals nearby yet — check back soon.
            </GradientCard>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {acquisitionMerchants.map((m) => (
                <button
                  key={m.id}
                  onClick={() => navigate(`/merchant/${m.id}`)}
                  className="text-left"
                >
                  <GradientCard className="h-full hover:shadow-[var(--shadow-medium)] transition-all">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
                        <Store className="w-6 h-6 text-accent" aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">
                          {m.business_name}
                        </h3>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <MerchantTypeBadge feeModel={m.fee_model} />
                        </div>
                        {m.address && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                            <MapPin className="w-3 h-3" aria-hidden="true" />
                            <span className="truncate">{m.address}</span>
                            {m.distance != null && (
                              <span className="ml-1 shrink-0">
                                · {m.distance.toFixed(1)} mi
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                          <Lock className="w-3 h-3" aria-hidden="true" />
                          Scan in-store QR to unlock
                        </div>
                      </div>
                    </div>
                  </GradientCard>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Full Ecosystem — Earn PawBucks */}
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <PawBucksLogo className="w-5 h-5" />
                Earn PawBucks Here
              </h2>
              <p className="text-sm text-muted-foreground">
                Full Ecosystem partners — pay with and earn PawBucks every visit.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/discover")}
            >
              See all <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {merchantsLoading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Loading nearby merchants…
            </div>
          ) : fullEcosystemMerchants.length === 0 ? (
            <GradientCard className="text-sm text-muted-foreground text-center py-6">
              No PawBucks partners nearby yet.
            </GradientCard>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {fullEcosystemMerchants.map((m) => (
                <button
                  key={m.id}
                  onClick={() => navigate(`/merchant/${m.id}`)}
                  className="text-left"
                >
                  <GradientCard className="h-full hover:shadow-[var(--shadow-medium)] transition-all">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <Store className="w-6 h-6 text-primary" aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold truncate">
                            {m.business_name}
                          </h3>
                          <Badge className="bg-primary/10 text-primary border-primary/20 shrink-0">
                            10x PB
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <MerchantTypeBadge feeModel={m.fee_model} />
                        </div>
                        {m.address && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                            <MapPin className="w-3 h-3" aria-hidden="true" />
                            <span className="truncate">{m.address}</span>
                            {m.distance != null && (
                              <span className="ml-1 shrink-0">
                                · {m.distance.toFixed(1)} mi
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </GradientCard>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Continue */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button size="lg" onClick={() => navigate("/discover")}>
            Explore the Map
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate("/home")}>
            Go to Home
          </Button>
        </div>

        {!userLocation && !locationLoading && (
          <p className="text-xs text-muted-foreground text-center">
            Enable location to see deals closest to you.
          </p>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default WelcomeExplore;