import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BookingWidget } from "@/components/scheduling/BookingWidget";
import { BusinessHoursDisplay } from "@/components/scheduling/BusinessHoursDisplay";
import { OpenStatusBadge } from "@/components/merchant/OpenStatusBadge";
import { PriceRangeDisplay } from "@/components/merchant/PriceRangeDisplay";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin, Star, Phone, Globe, Share2, Coins } from "lucide-react";
import { toast } from "sonner";

export default function PublicBookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const { data: merchant, isLoading, error } = useQuery({
    queryKey: ["merchant-by-slug", slug],
    queryFn: async () => {
      if (!slug) throw new Error("No slug");
      const { data, error } = await (supabase
        .from("merchants") as any)
        .select("id, business_name, logo_url, address, phone, website_url, business_type, cashback_rate, storefront_slug, price_range, accepts_pawbucks")
        .eq("storefront_slug", slug)
        .eq("is_active", true)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const { data: reviewStats } = useQuery({
    queryKey: ["merchant-review-stats", merchant?.id],
    queryFn: async () => {
      if (!merchant?.id) return null;
      const { data } = await supabase
        .from("merchant_reviews")
        .select("rating")
        .eq("merchant_id", merchant.id);
      if (!data || data.length === 0) return null;
      const avg = data.reduce((s: number, r: any) => s + r.rating, 0) / data.length;
      return { avg: avg.toFixed(1), count: data.length };
    },
    enabled: !!merchant?.id,
  });

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: `Book with ${merchant?.business_name}`, url });
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Booking link copied!");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 max-w-xl mx-auto">
        <Skeleton className="h-24 w-24 rounded-2xl mb-4" />
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-32 mb-6" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !merchant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Business Not Found</h1>
          <p className="text-muted-foreground mb-4">This booking page doesn't exist or is no longer active.</p>
          <Button onClick={() => navigate("/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-4 py-6 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleShare}>
            <Share2 className="w-5 h-5" />
          </Button>
        </div>

        {/* Merchant Hero */}
        <div className="mb-6">
          <div className="flex gap-4 items-start">
            {merchant.logo_url ? (
              <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg border-2 border-border ring-2 ring-primary/10 flex-shrink-0">
                <img src={merchant.logo_url} alt={merchant.business_name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0 shadow-lg border-2 border-border">
                <span className="text-2xl font-bold text-primary">{merchant.business_name?.charAt(0)}</span>
              </div>
            )}

            <div className="flex-1 min-w-0 pt-0.5">
              <h1 className="text-xl font-bold tracking-tight">{merchant.business_name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="secondary" className="capitalize text-xs">
                  {merchant.business_type?.replace(/_/g, " ")}
                </Badge>
                <OpenStatusBadge merchantId={merchant.id} />
              </div>

              <div className="flex items-center gap-2 mt-2 flex-wrap text-sm">
                {reviewStats && (
                  <span className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="font-semibold">{reviewStats.avg}</span>
                    <span className="text-muted-foreground">({reviewStats.count})</span>
                  </span>
                )}
                <PriceRangeDisplay priceRange={merchant.price_range} />
                {merchant.accepts_pawbucks && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="flex items-center gap-1 text-primary text-xs font-medium">
                      <Coins className="w-3.5 h-3.5" /> PawBucks
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick contact */}
          {(merchant.address || merchant.phone || merchant.website_url) && (
            <div className="mt-4 space-y-2">
              {merchant.address && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(merchant.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <MapPin className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{merchant.address}</span>
                </a>
              )}
              <div className="flex items-center gap-3">
                {merchant.phone && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`tel:${merchant.phone}`}>
                      <Phone className="w-3.5 h-3.5 mr-1" /> Call
                    </a>
                  </Button>
                )}
                {merchant.website_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={merchant.website_url} target="_blank" rel="noopener noreferrer">
                      <Globe className="w-3.5 h-3.5 mr-1" /> Website
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Hours of Operation */}
        <div className="mb-6">
          <BusinessHoursDisplay merchantId={merchant.id} />
        </div>

        {/* Cashback banner */}
        <div className="mb-6 p-3 bg-primary/5 rounded-xl border border-primary/10 text-center">
          <p className="text-sm text-primary font-semibold">
            🎉 Earn {merchant.cashback_rate}x PawBucks on every booking!
          </p>
        </div>

        {/* Booking Widget */}
        <BookingWidget
          merchantId={merchant.id}
          merchantName={merchant.business_name}
          cashbackRate={merchant.cashback_rate || 10}
        />
      </div>
    </div>
  );
}
