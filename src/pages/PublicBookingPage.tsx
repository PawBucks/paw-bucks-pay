import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BookingWidget } from "@/components/scheduling/BookingWidget";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin, Star, Clock, Phone, Globe, Share2 } from "lucide-react";
import { toast } from "sonner";

export default function PublicBookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const { data: merchant, isLoading, error } = useQuery({
    queryKey: ["merchant-by-slug", slug],
    queryFn: async () => {
      if (!slug) throw new Error("No slug");
      const { data, error } = await supabase
        .from("merchants")
        .select("id, business_name, logo_url, address, phone, website_url, business_type, cashback_rate, storefront_slug")
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
      const avg = data.reduce((s, r) => s + r.rating, 0) / data.length;
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
        <Skeleton className="h-48 w-full rounded-xl mb-4" />
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

        {/* Merchant Info Card */}
        <div className="mb-6 text-center">
          {merchant.logo_url ? (
            <img
              src={merchant.logo_url}
              alt={merchant.business_name}
              className="w-20 h-20 rounded-2xl object-cover mx-auto mb-3 shadow-lg"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl font-bold text-primary">
                {merchant.business_name?.charAt(0)}
              </span>
            </div>
          )}
          <h1 className="text-2xl font-bold mb-1">{merchant.business_name}</h1>
          <Badge variant="secondary" className="capitalize mb-3">
            {merchant.business_type?.replace(/_/g, " ")}
          </Badge>

          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground flex-wrap">
            {reviewStats && (
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                {reviewStats.avg} ({reviewStats.count})
              </span>
            )}
            {merchant.address && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                <span className="truncate max-w-[200px]">{merchant.address}</span>
              </span>
            )}
          </div>

          <div className="flex items-center justify-center gap-3 mt-3">
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
