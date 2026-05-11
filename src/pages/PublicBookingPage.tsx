import { useParams, useNavigate } from"react-router-dom";
import { useQuery } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { BookingWidget } from"@/components/scheduling/BookingWidget";
import { BusinessHoursDisplay } from"@/components/scheduling/BusinessHoursDisplay";
import { OpenStatusBadge } from"@/components/merchant/OpenStatusBadge";
import { PriceRangeDisplay } from"@/components/merchant/PriceRangeDisplay";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { Skeleton } from"@/components/ui/skeleton";
import { Card, CardContent } from"@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { toast } from"sonner";
import { useIsMobile } from"@/hooks/use-mobile";

import { Formatters } from "@/utils/formatters";
import { PawBucksLogo } from "@/components/PawBucksLogo";
export default function PublicBookingPage() {
 const { slug } = useParams<{ slug: string }>();
 const navigate = useNavigate();
 const isMobile = useIsMobile();

 const { data: merchant, isLoading, error } = useQuery({
 queryKey: ["merchant-by-slug", slug],
 queryFn: async () => {
 if (!slug) throw new Error("No slug");
 const { data, error } = await (supabase
 .from("merchants") as any)
 .select("id, business_name, logo_url, address, phone, website_url, business_type, cashback_rate, storefront_slug, price_range, accepts_pawbucks, description")
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
 return { avg: Formatters.decimal(avg, 1), count: data.length };
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
 return isMobile ? (
 <div className="min-h-screen bg-background p-4 max-w-xl mx-auto">
 <Skeleton className="h-24 w-24 rounded-md mb-4" />
 <Skeleton className="h-8 w-48 mb-2" />
 <Skeleton className="h-4 w-32 mb-6" />
 <Skeleton className="h-96 w-full rounded-md" />
 </div>
 ) : (
 <div className="min-h-screen bg-muted/30">
 <div className="max-w-6xl mx-auto px-8 py-10">
 <Skeleton className="h-64 w-full rounded-md mb-8" />
 <div className="grid grid-cols-3 gap-8">
 <div className="col-span-2"><Skeleton className="h-96 rounded-md" /></div>
 <div><Skeleton className="h-72 rounded-md" /></div>
 </div>
 </div>
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

 // Shared merchant info elements
 const logoElement = merchant.logo_url ? (
 <img src={merchant.logo_url} alt={merchant.business_name} className="w-full h-full object-cover" />
 ) : (
 <span className="text-3xl font-bold text-primary">{merchant.business_name?.charAt(0)}</span>
 );

 const ratingElement = reviewStats && (
 <span className="flex items-center gap-1">
 <span className="w-4 h-4 text-gold fill-gold" aria-hidden="true">⭐</span>
 <span className="font-semibold">{reviewStats.avg}</span>
 <span className="text-muted-foreground">({reviewStats.count} reviews)</span>
 </span>
 );

 // ─── MOBILE LAYOUT ───
 if (isMobile) {
 return (
 <div className="min-h-screen bg-background">
 <div className="max-w-xl mx-auto px-4 py-6 pb-24">
 <div className="flex items-center justify-between mb-6">
 <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
 <ArrowLeft className="w-5 h-5" />
 </Button>
 <Button variant="ghost" size="icon" onClick={handleShare}>
 <span className="w-5 h-5" aria-hidden="true">🔗</span>
 </Button>
 </div>

 <div className="mb-6">
 <div className="flex gap-4 items-start">
 <div className={`w-20 h-20 rounded-md overflow-hidden shadow-lg border-2 border-border ring-2 ring-primary/10 flex-shrink-0 ${!merchant.logo_url ?'bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center' :''}`}>
 {logoElement}
 </div>
 <div className="flex-1 min-w-0 pt-0.5">
 <h1 className="text-xl font-bold tracking-tight">{merchant.business_name}</h1>
 <div className="flex items-center gap-2 mt-1 flex-wrap">
 <Badge variant="secondary" className="capitalize text-xs">
 {merchant.business_type?.replace(/_/g,"")}
 </Badge>
 <OpenStatusBadge merchantId={merchant.id} />
 </div>
 <div className="flex items-center gap-2 mt-2 flex-wrap text-sm">
 {ratingElement}
 <PriceRangeDisplay priceRange={merchant.price_range} />
 {merchant.accepts_pawbucks && (
 <>
 <span className="text-muted-foreground">·</span>
 <span className="flex items-center gap-1 text-primary text-xs font-medium">
 <PawBucksLogo className="w-3.5 h-3.5" /> PawBucks
 </span>
 </>
 )}
 </div>
 </div>
 </div>

 {(merchant.address || merchant.phone || merchant.website_url) && (
 <div className="mt-4 space-y-2">
 {merchant.address && (
 <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(merchant.address)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
              <span className="text-base flex-shrink-0">📍</span>
 <span className="truncate">{merchant.address}</span>
 </a>
 )}
 <div className="flex items-center gap-3">
 {merchant.phone && (
 <Button variant="outline" size="sm" asChild>
 <a href={`tel:${merchant.phone}`}><span className="w-3.5 h-3.5 mr-1" aria-hidden="true">📞</span> Call</a>
 </Button>
 )}
 {merchant.website_url && (
 <Button variant="outline" size="sm" asChild>
 <a href={merchant.website_url} target="_blank" rel="noopener noreferrer"><span className="w-3.5 h-3.5 mr-1" aria-hidden="true">🌐</span> Website</a>
 </Button>
 )}
 </div>
 </div>
 )}
 </div>

 <div className="mb-6">
 <BusinessHoursDisplay merchantId={merchant.id} />
 </div>

 <div className="mb-6 p-3 bg-primary/5 rounded-md border border-primary/10 text-center">
 <p className="text-sm text-primary font-semibold">
 🎉 Earn {merchant.cashback_rate}x PawBucks on every booking!
 </p>
 </div>

 <BookingWidget
 merchantId={merchant.id}
 merchantName={merchant.business_name}
 cashbackRate={merchant.cashback_rate || 10}
 />
 </div>
 </div>
 );
 }

 // ─── DESKTOP LAYOUT ───
 return (
 <div className="min-h-screen bg-muted/30">
 {/* Top navigation bar */}
 <div className="bg-background border-b border-border sticky top-0 z-30">
 <div className="max-w-6xl mx-auto px-8 py-3 flex items-center justify-between">
 <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
 <ArrowLeft className="w-4 h-4" /> Back
 </Button>
 <Button variant="outline" size="sm" onClick={handleShare} className="gap-2">
 <span className="w-4 h-4" aria-hidden="true">🔗</span> Share
 </Button>
 </div>
 </div>

 {/* Hero banner */}
 <div className="bg-background border-b border-border">
 <div className="max-w-6xl mx-auto px-8 py-8">
 <div className="flex gap-6 items-start">
 <div className={`w-28 h-28 rounded-md overflow-hidden shadow-lg border-2 border-border ring-2 ring-primary/10 flex-shrink-0 ${!merchant.logo_url ?'bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center' :''}`}>
 {logoElement}
 </div>

 <div className="flex-1 min-w-0">
 <div className="flex items-start justify-between gap-4">
 <div>
 <h1 className="text-3xl font-bold tracking-tight">{merchant.business_name}</h1>
 <div className="flex items-center gap-3 mt-2 flex-wrap">
 <Badge variant="secondary" className="capitalize">
 {merchant.business_type?.replace(/_/g,"")}
 </Badge>
 <OpenStatusBadge merchantId={merchant.id} />
 <PriceRangeDisplay priceRange={merchant.price_range} />
 {merchant.accepts_pawbucks && (
 <span className="flex items-center gap-1 text-primary text-sm font-medium">
 <PawBucksLogo className="w-4 h-4" /> Accepts PawBucks
 </span>
 )}
 </div>
 {reviewStats && (
 <div className="flex items-center gap-1.5 mt-2 text-sm">
 <span className="w-5 h-5 text-gold fill-gold" aria-hidden="true">⭐</span>
 <span className="font-bold text-base">{reviewStats.avg}</span>
 <span className="text-muted-foreground">({reviewStats.count} reviews)</span>
 </div>
 )}
 </div>

 {/* Quick action buttons */}
 <div className="flex items-center gap-2 flex-shrink-0">
 {merchant.phone && (
 <Button variant="outline" asChild>
 <a href={`tel:${merchant.phone}`}><span className="w-4 h-4 mr-2" aria-hidden="true">📞</span> Call</a>
 </Button>
 )}
 {merchant.address && (
 <Button variant="outline" asChild>
 <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(merchant.address)}`} target="_blank" rel="noopener noreferrer">
 <span className="w-4 h-4 mr-2" aria-hidden="true">🧭</span> Directions
 </a>
 </Button>
 )}
 {merchant.website_url && (
 <Button variant="outline" asChild>
 <a href={merchant.website_url} target="_blank" rel="noopener noreferrer">
 <span className="w-4 h-4 mr-2" aria-hidden="true">🌐</span> Website
 </a>
 </Button>
 )}
 </div>
 </div>

 {merchant.description && (
 <p className="text-muted-foreground mt-3 text-sm max-w-2xl leading-relaxed">{merchant.description}</p>
 )}

 {merchant.address && (
 <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
 <span className="text-base flex-shrink-0">📍</span>
 <span>{merchant.address}</span>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>

 {/* Main content: 2/3 booking + 1/3 sidebar */}
 <div className="max-w-6xl mx-auto px-8 py-8">
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
 {/* Left: Booking widget */}
 <div className="lg:col-span-2">
 <Card className="shadow-sm">
 <CardContent className="p-6">
 <BookingWidget
 merchantId={merchant.id}
 merchantName={merchant.business_name}
 cashbackRate={merchant.cashback_rate || 10}
 />
 </CardContent>
 </Card>
 </div>

 {/* Right: Sidebar */}
 <div className="space-y-6">
 {/* Cashback banner */}
 <Card className="shadow-sm border-primary/20 bg-primary/5">
 <CardContent className="p-5 text-center">
 <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
 <PawBucksLogo className="w-5 h-5 text-primary" />
 </div>
 <p className="font-semibold text-primary">
 Earn {merchant.cashback_rate}x PawBucks
 </p>
 <p className="text-xs text-muted-foreground mt-1">on every booking you make</p>
 </CardContent>
 </Card>

 {/* Hours */}
 <Card className="shadow-sm">
 <CardContent className="p-5">
 <div className="flex items-center gap-2 mb-3">
 <span className="w-4 h-4 text-muted-foreground" aria-hidden="true">⏰</span>
 <h3 className="font-semibold text-sm">Hours of Operation</h3>
 </div>
 <BusinessHoursDisplay merchantId={merchant.id} />
 </CardContent>
 </Card>

 {/* Location card */}
 {merchant.address && (
 <Card className="shadow-sm">
 <CardContent className="p-5">
 <div className="flex items-center gap-2 mb-3">
 <span className="text-base text-muted-foreground">📍</span>
 <h3 className="font-semibold text-sm">Location</h3>
 </div>
 <p className="text-sm text-muted-foreground">{merchant.address}</p>
 <Button variant="outline" size="sm" className="mt-3 w-full" asChild>
 <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(merchant.address)}`} target="_blank" rel="noopener noreferrer">
 <span className="w-3.5 h-3.5 mr-2" aria-hidden="true">🧭</span> Get Directions
 </a>
 </Button>
 </CardContent>
 </Card>
 )}
 </div>
 </div>
 </div>
 </div>
 );
}
