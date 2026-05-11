import { useState, useMemo, useCallback, useEffect, memo, useRef } from"react";
import { useParams, useNavigate, Link } from"react-router-dom";
import { useAuth } from"@/hooks/useAuth";
import { useOptimizedQuery } from"@/hooks/useOptimizedQuery";
import { supabase } from"@/integrations/supabase/client";
import { Header } from"@/components/Header";
import { BottomNav } from"@/components/BottomNav";
import { PageLoader } from"@/components/PageLoader";
import { AdPlacement } from"@/components/AdPlacement";
import { SEO } from"@/components/SEO";
import { PaymentDialogWithPawBucks } from"@/components/PaymentDialogWithPawBucks";
import { WriteReviewDialog } from"@/components/merchant/WriteReviewDialog";
import { ReviewCard } from"@/components/merchant/ReviewCard";
import { BookingWidget } from"@/components/scheduling/BookingWidget";
import { BusinessHoursDisplay } from"@/components/scheduling/BusinessHoursDisplay";
import { OpenStatusBadge } from"@/components/merchant/OpenStatusBadge";
import { QuickActions } from"@/components/merchant/QuickActions";
import { PhotoGallery } from"@/components/merchant/PhotoGallery";
import { PriceRangeDisplay } from"@/components/merchant/PriceRangeDisplay";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { Separator } from"@/components/ui/separator";
import { toast } from"sonner";
import { ROUTES } from"@/lib/constants";
import { useMerchantActiveServices, SERVICE_NAMES, merchantHasService } from"@/hooks/useMerchantServices";
import { useServiceConversionTracking } from"@/hooks/useServiceConversionTracking";
import { schedulingService } from"@/services/api/scheduling.service";
import { useQuery, useQueries } from"@tanstack/react-query";
import { Founding50Badge } from"@/components/shared/Founding50Badge";
import { Star, Store, Scissors, Home, Stethoscope, Footprints, Bone, ArrowLeft, Facebook, Instagram, Twitter, Linkedin, BadgeCheck } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";

import { Formatters } from "@/utils/formatters";
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

type Review = {
 id: string;
 user_id: string;
 rating: number;
 review_text: string | null;
 created_at: string;
 user_name?: string;
 photos: { id: string; photo_url: string }[];
};

const MerchantProfile = memo(() => {
 const { merchantId } = useParams<{ merchantId: string }>();
 const navigate = useNavigate();
 const { user, signOut } = useAuth();
 const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
 const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
 const [activeSection, setActiveSection] = useState<string>("overview");
 const bookingRef = useRef<HTMLDivElement>(null);

 // Fetch merchant active services
 const { data: activeServices = [] } = useMerchantActiveServices(merchantId);
 const hasVerifiedPro = merchantHasService(activeServices, SERVICE_NAMES.VERIFIED_PRO_BADGE);
 const isSponsored = merchantHasService(activeServices, SERVICE_NAMES.SPONSORED_PLACEMENT);
 const hasFeaturedPartner = merchantHasService(activeServices, SERVICE_NAMES.FEATURED_PARTNER);

 // Track profile views for service ROI
 const { trackProfileView } = useServiceConversionTracking();
 
 useEffect(() => {
 if (merchantId && activeServices.length > 0) {
 if (hasVerifiedPro) trackProfileView(merchantId, SERVICE_NAMES.VERIFIED_PRO_BADGE,'profile');
 if (hasFeaturedPartner) trackProfileView(merchantId, SERVICE_NAMES.FEATURED_PARTNER,'profile');
 if (isSponsored) trackProfileView(merchantId, SERVICE_NAMES.SPONSORED_PLACEMENT,'profile');
 }
 }, [merchantId, activeServices, hasVerifiedPro, hasFeaturedPartner, isSponsored, trackProfileView]);

 // Parallel queries
 const queryResults = useQueries({
 queries: [
 {
 queryKey: ["merchant", merchantId],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("merchants_public")
 .select("id, business_name, business_type, description, logo_url, address, phone, cashback_rate, accepts_pawbucks, storefront_slug, price_range, facebook_url, instagram_url, twitter_url, linkedin_url, website_url")
 .eq("id", merchantId)
 .single();
 if (error) throw error;
 return data;
 },
 staleTime: 1000 * 60 * 5,
 enabled: !!merchantId,
 },
 {
 queryKey: ["merchant-services-public", merchantId],
 queryFn: () => schedulingService.getActiveServices(merchantId!),
 staleTime: 1000 * 60 * 5,
 enabled: !!merchantId,
 },
 {
 queryKey: ["merchant-stripe", merchantId],
 queryFn: async () => {
 const { data, error } = await supabase.functions.invoke("get-connect-account-status", {
 body: { merchantId },
 });
 if (error) return null;
 return data;
 },
 staleTime: 1000 * 60 * 5,
 enabled: !!user && !!merchantId,
 },
 ],
 });

 const merchant = queryResults[0].data;
 const merchantLoading = queryResults[0].isLoading;
 const merchantServices = queryResults[1].data || [];
 const merchantStripeInfo = queryResults[2].data;
 const stripeAccountId = merchantStripeInfo?.accountId;
 const hasBookableServices = merchantServices.length > 0;

 // Reviews query
 const { data: reviews = [], isLoading: reviewsLoading, refetch: refetchReviews } = useOptimizedQuery<Review[]>(
 ["merchant-reviews", merchantId],
 async () => {
 const { data: reviewData, error: reviewError } = await supabase
 .from("merchant_reviews")
 .select("id, user_id, rating, review_text, created_at")
 .eq("merchant_id", merchantId)
 .order("created_at", { ascending: false })
 .limit(50);

 if (reviewError) throw reviewError;
 if (!reviewData?.length) return [];

 const reviewIds = reviewData.map(r => r.id);
 const userIds = [...new Set(reviewData.map(r => r.user_id))];

 const [photosResult, profilesResult] = await Promise.all([
 supabase.from("review_photos").select("id, photo_url, review_id").in("review_id", reviewIds),
 supabase.from("reviewer_profiles").select("id, full_name").in("id", userIds),
 ]);

 const photosByReview = new Map<string, { id: string; photo_url: string }[]>();
 (photosResult.data || []).forEach(photo => {
 const existing = photosByReview.get(photo.review_id) || [];
 existing.push({ id: photo.id, photo_url: photo.photo_url });
 photosByReview.set(photo.review_id, existing);
 });

 const profilesByUser = new Map<string, string>();
 (profilesResult.data || []).forEach(profile => {
 profilesByUser.set(profile.id, profile.full_name ||"Anonymous");
 });

 return reviewData.map(review => ({
 ...review,
 photos: photosByReview.get(review.id) || [],
 user_name: profilesByUser.get(review.user_id) ||"Anonymous",
 }));
 },
 { staleTime: 1000 * 60 * 2, enabled: !!merchantId }
 );

 // Rating stats
 const ratingStats = useMemo(() => {
 if (!reviews.length) return { average: 0, total: 0, distribution: [0, 0, 0, 0, 0] };
 const distribution = [0, 0, 0, 0, 0];
 let sum = 0;
 reviews.forEach((r) => { sum += r.rating; distribution[r.rating - 1]++; });
 return { average: sum / reviews.length, total: reviews.length, distribution };
 }, [reviews]);

 const userHasReviewed = useMemo(() => {
 if (!user) return false;
 return reviews.some((r) => r.user_id === user.id);
 }, [reviews, user]);

 // Featured review (highest rated with text)
 const featuredReview = useMemo(() => {
 return reviews.find(r => r.review_text && r.review_text.length > 20 && r.rating >= 4);
 }, [reviews]);

 const handlePaymentSuccess = useCallback(() => {
 toast.success("Redirecting to wallet...");
 setTimeout(() => navigate(ROUTES.WALLET), 1000);
 }, [navigate]);

 const handleLogout = useCallback(async () => {
 await signOut();
 navigate(ROUTES.AUTH);
 }, [signOut, navigate]);

 const handleOpenPaymentDialog = useCallback(() => {
 if (!user) {
 toast.error("Please sign in to make a payment");
 navigate(`${ROUTES.AUTH}?redirect=/merchant/${merchantId}`);
 return;
 }
 setPaymentDialogOpen(true);
 }, [user, navigate, merchantId]);

 const handleOpenReviewDialog = useCallback(() => setReviewDialogOpen(true), []);
 const handleReviewSuccess = useCallback(() => refetchReviews(), [refetchReviews]);

 const scrollToBooking = useCallback(() => {
 bookingRef.current?.scrollIntoView({ behavior:"smooth" });
 }, []);

 if (merchantLoading || reviewsLoading) {
 return <PageLoader message="Loading merchant profile..." />;
 }

 if (!merchant) {
 return (
 <div className="min-h-screen flex items-center justify-center">
 <div className="text-center">
 <h2 className="text-2xl font-bold mb-2">Merchant not found</h2>
 <Button onClick={() => navigate(ROUTES.DISCOVER)}>Go to Discover</Button>
 </div>
 </div>
 );
 }

 const Icon = getBusinessIcon(merchant.business_type);

 return (
 <>
 <SEO
 title={`${merchant.business_name} - PawBucks`}
 description={merchant.description || `Visit ${merchant.business_name} and earn ${merchant.cashback_rate}x points in PawBucks!`}
 keywords={[merchant.business_name, merchant.business_type,"pet services","PawBucks","rewards"]}
 />
 <Header isAuthenticated={!!user} onLogout={user ? handleLogout : undefined} />
 
 <div className="min-h-screen bg-background pb-24 md:pb-12">
 <div className="max-w-4xl lg:max-w-5xl mx-auto">
 {/* Top Ad */}
 <div className="px-4 pt-4">
 <AdPlacement position="top" />
 </div>

 {/* Back Button */}
 <div className="px-4 pt-3">
 <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2 text-muted-foreground hover:text-foreground -ml-2">
 <ArrowLeft className="w-4 h-4" />
 Back
 </Button>
 </div>

 {/* ═══════════════ HERO SECTION ═══════════════ */}
  <div className="relative px-4 pt-2 pb-6 overflow-hidden">
  {/* Editorial radial accent */}
  <div
   aria-hidden
   className="pointer-events-none absolute -top-24 -right-16 w-[420px] h-[420px] rounded-full opacity-60"
   style={{
    background:
     "radial-gradient(closest-side, hsl(var(--primary) / 0.18), transparent 70%)",
   }}
  />
  <div className="relative">
  {/* Eyebrow */}
  <div className="text-[0.7rem] font-medium tracking-[0.18em] uppercase text-primary mb-3 flex items-center gap-2">
   <span className="w-3.5 h-3.5" aria-hidden="true">🏪</span>
   The Profile
  </div>

 {/* Logo + Name Row */}
 <div className="flex gap-4 items-start">
 {/* Logo */}
 <div className="flex-shrink-0">
 {merchant.logo_url ? (
 <div className="w-24 h-24 rounded-md overflow-hidden shadow-lg border-2 border-border ring-2 ring-primary/10">
 <img src={merchant.logo_url} alt={merchant.business_name} className="w-full h-full object-cover" />
 </div>
 ) : (
 <div className="w-24 h-24 rounded-md bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-lg border-2 border-border">
 <Icon className="w-12 h-12 text-primary" />
 </div>
 )}
 </div>

 {/* Name & Meta */}
 <div className="flex-1 min-w-0 pt-1">
 <div className="flex items-center gap-2 flex-wrap">
  <h1
   className="font-black leading-[1.05] tracking-[-0.025em] text-foreground"
   style={{
    fontFamily: '"Playfair Display", Georgia, serif',
    fontSize: "clamp(1.75rem, 4.5vw, 2.5rem)",
   }}
  >
   {merchant.business_name}
  </h1>
 {hasVerifiedPro && (
 <BadgeCheck className="w-6 h-6 text-info flex-shrink-0" />
 )}
 {merchantId && (
 <Founding50Badge entityType="merchant" entityId={merchantId} size="md" />
 )}
 </div>

 {/* Category + Price */}
 <div className="flex items-center gap-2 mt-1 flex-wrap">
 <span className="text-sm text-muted-foreground capitalize">
 {merchant.business_type.replace(/_/g,"")}
 </span>
 <PriceRangeDisplay priceRange={merchant.price_range} />
 </div>

 {/* Badges Row */}
 <div className="flex items-center gap-2 mt-2 flex-wrap">
 <OpenStatusBadge merchantId={merchant.id} />
 {isSponsored && (
 <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary text-xs">
 <Sparkles className="w-3 h-3" /> Sponsored
 </Badge>
 )}
 {merchant.accepts_pawbucks && (
 <Badge variant="outline" className="gap-1 text-xs bg-warning/10 text-warning border-warning/30">
 <PawBucksLogo className="w-3 h-3" /> PawBucks
 </Badge>
 )}
 </div>
 </div>
 </div>

 {/* ═══ Rating Summary Bar ═══ */}
 <div className="flex items-center gap-3 mt-4 px-1">
 <div className="flex items-center gap-1.5">
 <span className="text-2xl font-bold text-foreground">{Formatters.decimal(ratingStats.average, 1)}</span>
 <div className="flex items-center">
 {[1, 2, 3, 4, 5].map((star) => (
 <Star
 key={star}
 className={`w-4 h-4 ${
 star <= Math.round(ratingStats.average)
 ?"fill-gold text-gold"
 :"text-muted-foreground/20"
 }`}
 />
 ))}
 </div>
 </div>
 <button
 onClick={() => setActiveSection("reviews")}
 className="text-sm text-primary hover:underline font-medium bg-transparent border-none p-0 cursor-pointer"
 >
 {ratingStats.total} {ratingStats.total === 1 ?"review" :"reviews"}
 </button>
 <span className="text-muted-foreground">·</span>
 <Badge className="bg-primary text-primary-foreground text-xs font-semibold">
 {merchant.cashback_rate}x Points
 </Badge>
 </div>

 {/* ═══ Quick Actions ═══ */}
 <div className="mt-4">
 <QuickActions
 phone={merchant.phone}
 address={merchant.address}
 websiteUrl={merchant.website_url}
 businessName={merchant.business_name}
 storefrontSlug={merchant.storefront_slug}
 hasBookableServices={hasBookableServices}
 onBookClick={scrollToBooking}
 />
 </div>

 {/* ═══ Primary CTA ═══ */}
 <div className="flex gap-2 mt-2">
 <Button size="lg" className="flex-1 h-12 text-base font-semibold" onClick={handleOpenPaymentDialog}>
 <span className="w-5 h-5 mr-2" aria-hidden="true">🛍️</span>
 Pay & Earn PawBucks
 </Button>
 {user && !userHasReviewed && (
 <Button variant="outline" size="lg" className="h-12" onClick={handleOpenReviewDialog}>
 <span className="w-5 h-5 mr-1" aria-hidden="true">📸</span>
 Review
 </Button>
 )}
 </div>
 {merchant?.storefront_slug && (
 <Button variant="outline" className="w-full mt-2" asChild>
 <Link to={`/storefront/${merchant.storefront_slug}`}>
 <span className="w-4 h-4 mr-2" aria-hidden="true">🏪</span> View Storefront
 </Link>
 </Button>
 )}
  </div>
 </div>

 <Separator />

 {/* ═══════════════ SCROLLABLE SECTION NAV ═══════════════ */}
 <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b">
 <div className="flex overflow-x-auto scrollbar-none px-4">
 {[
 { id:"overview", label:"Overview" },
 ...(hasBookableServices ? [{ id:"booking", label:"Book Now" }] : []),
 { id:"reviews", label: `Reviews (${ratingStats.total})` },
 { id:"hours", label:"Hours" },
 ].map((tab) => (
 <button
 key={tab.id}
 onClick={() => {
 setActiveSection(tab.id);
 document.getElementById(`section-${tab.id}`)?.scrollIntoView({ behavior:"smooth" });
 }}
 className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap bg-transparent ${
 activeSection === tab.id
 ?"border-primary text-primary"
 :"border-transparent text-muted-foreground hover:text-foreground"
 }`}
 >
 {tab.label}
 </button>
 ))}
 </div>
 </div>

 {/* ═══════════════ CONTENT SECTIONS ═══════════════ */}
 <div className="px-4 py-6 space-y-8">

 {/* ─── Overview Section ─── */}
 <section id="section-overview">
 {/* Featured Review Quote */}
 {featuredReview && (
 <div className="bg-muted rounded-md p-4 mb-6 border border-border/50">
 <div className="flex items-start gap-3">
 <span className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" aria-hidden="true">👍</span>
 <div>
 <p className="text-sm italic text-foreground line-clamp-3">
"{featuredReview.review_text}"
 </p>
 <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
 — {featuredReview.user_name}
 <span className="inline-flex items-center gap-0.5 ml-2">
 {[1,2,3,4,5].map(s => (
 <Star key={s} className={`w-3 h-3 ${s <= featuredReview.rating ?"fill-gold text-gold" :"text-muted-foreground/20"}`} />
 ))}
 </span>
 </p>
 </div>
 </div>
 </div>
 )}

 {/* Photo Gallery */}
 {merchantId && <PhotoGallery merchantId={merchantId} />}

 {/* About */}
 {merchant.description && (
  <div className="mb-8">
  <div className="text-[0.7rem] font-medium tracking-[0.18em] uppercase text-primary mb-2">
   About
  </div>
  <h2
   className="font-black leading-[1.1] tracking-[-0.02em] text-foreground mb-3"
   style={{
    fontFamily: '"Playfair Display", Georgia, serif',
    fontSize: "clamp(1.35rem, 2.6vw, 1.65rem)",
   }}
  >
   About the Business
  </h2>
  <p className="text-[15px] text-muted-foreground whitespace-pre-line leading-relaxed">
 {merchant.description}
 </p>
 </div>
 )}

 {/* Contact & Location Card */}
  <Card className="mb-8 border-border/60 shadow-sm">
 <CardContent className="p-5 space-y-4">
  <h3 className="text-[0.7rem] font-medium tracking-[0.18em] uppercase text-primary">Location & Contact</h3>
 
 {merchant.phone && (
 <a href={`tel:${merchant.phone}`} className="flex items-center gap-3 group py-1">
 <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
 <span className="w-4 h-4 text-primary" aria-hidden="true">📞</span>
 </div>
 <div>
 <p className="text-sm font-medium group-hover:text-primary transition-colors">{merchant.phone}</p>
 <p className="text-xs text-muted-foreground">Tap to call</p>
 </div>
 </a>
 )}

 {merchant.address && (
 <>
 <a
 href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(merchant.address)}`}
 target="_blank"
 rel="noopener noreferrer"
 className="flex items-center gap-3 group py-1"
 >
 <div className="w-10 h-10 rounded-full bg-info/10 flex items-center justify-center flex-shrink-0">
 <span className="text-base text-info">📍</span>
 </div>
 <div>
 <p className="text-sm font-medium group-hover:text-primary transition-colors">{merchant.address}</p>
 <p className="text-xs text-muted-foreground">Get directions</p>
 </div>
 </a>
 {/* Map */}
 <div className="rounded-md overflow-hidden border">
 <iframe
 title={`Map of ${merchant.business_name}`}
 width="100%"
 height="200"
 style={{ border: 0 }}
 loading="lazy"
 allowFullScreen
 referrerPolicy="no-referrer-when-downgrade"
 src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodeURIComponent(merchant.address)}`}
 />
 </div>
 </>
 )}

 {merchant.website_url && (
 <a
 href={merchant.website_url.startsWith("http") ? merchant.website_url : `https://${merchant.website_url}`}
 target="_blank"
 rel="noopener noreferrer"
 className="flex items-center gap-3 group py-1"
 >
 <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
 <span className="w-4 h-4 text-accent" aria-hidden="true">🌐</span>
 </div>
 <div>
 <p className="text-sm font-medium group-hover:text-primary transition-colors">
 {merchant.website_url.replace(/^https?:\/\//,"")}
 </p>
 <p className="text-xs text-muted-foreground">Visit website</p>
 </div>
 </a>
 )}
 </CardContent>
 </Card>

 {/* Social Media */}
 {(merchant.facebook_url || merchant.instagram_url || merchant.twitter_url || merchant.linkedin_url) && (
  <div className="mb-8">
  <h3 className="text-[0.7rem] font-medium tracking-[0.18em] uppercase text-primary mb-3">Follow</h3>
 <div className="flex items-center gap-3">
 {merchant.facebook_url && (
 <a href={merchant.facebook_url} target="_blank" rel="noopener noreferrer"
 className="w-11 h-11 rounded-full bg-[#1877F2]/10 hover:bg-[#1877F2]/20 flex items-center justify-center text-[#1877F2] transition-all hover:scale-110"
 aria-label="Facebook">
 <Facebook className="w-5 h-5" />
 </a>
 )}
 {merchant.instagram_url && (
 <a href={merchant.instagram_url} target="_blank" rel="noopener noreferrer"
 className="w-11 h-11 rounded-full bg-[#E4405F]/10 hover:bg-[#E4405F]/20 flex items-center justify-center text-[#E4405F] transition-all hover:scale-110"
 aria-label="Instagram">
 <Instagram className="w-5 h-5" />
 </a>
 )}
 {merchant.twitter_url && (
 <a href={merchant.twitter_url} target="_blank" rel="noopener noreferrer"
 className="w-11 h-11 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-foreground transition-all hover:scale-110"
 aria-label="X">
 <Twitter className="w-5 h-5" />
 </a>
 )}
 {merchant.linkedin_url && (
 <a href={merchant.linkedin_url} target="_blank" rel="noopener noreferrer"
 className="w-11 h-11 rounded-full bg-[#0A66C2]/10 hover:bg-[#0A66C2]/20 flex items-center justify-center text-[#0A66C2] transition-all hover:scale-110"
 aria-label="LinkedIn">
 <Linkedin className="w-5 h-5" />
 </a>
 )}
 </div>
 </div>
 )}

 {/* Payment Options */}
  <Card className="border-border/60 shadow-sm">
 <CardContent className="p-5">
  <h3 className="text-[0.7rem] font-medium tracking-[0.18em] uppercase text-primary mb-3">Payment Options</h3>
 <div className="space-y-2">
 <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
 <div className="flex items-center gap-3">
 <span className="w-5 h-5 text-muted-foreground" aria-hidden="true">💳</span>
 <span className="text-sm font-medium">Credit/Debit Card</span>
 </div>
 <Badge variant="outline" className="text-xs">Available</Badge>
 </div>
 <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
 <div className="flex items-center gap-3">
 <PawBucksLogo className="w-5 h-5 text-primary" />
 <div>
 <span className="text-sm font-medium">PawBucks</span>
 <p className="text-xs text-muted-foreground">1000 PawBucks = $1.00</p>
 </div>
 </div>
 <Badge variant={merchant.accepts_pawbucks ?"default" :"secondary"} className="text-xs">
 {merchant.accepts_pawbucks ?"Accepted" :"Not Accepted"}
 </Badge>
 </div>
 </div>
 <div className="mt-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
 <p className="text-sm text-primary font-medium flex items-center gap-2">
 <Sparkles className="w-4 h-4" />
 Earn {merchant.cashback_rate}x points on every purchase!
 </p>
 </div>
 </CardContent>
 </Card>
 </section>

 {/* ─── Booking Section ─── */}
 {hasBookableServices && (
 <section id="section-booking" ref={bookingRef}>
  <div className="text-[0.7rem] font-medium tracking-[0.18em] uppercase text-primary mb-2 flex items-center gap-2">
   <span className="w-3.5 h-3.5" aria-hidden="true">📅</span>
   Booking
  </div>
  <h2
   className="font-black leading-[1.1] tracking-[-0.02em] text-foreground mb-5"
   style={{
    fontFamily: '"Playfair Display", Georgia, serif',
    fontSize: "clamp(1.5rem, 3vw, 1.85rem)",
   }}
  >
   Book an <span className="italic text-primary">appointment</span>
  </h2>
 <BookingWidget
 merchantId={merchant.id}
 merchantName={merchant.business_name}
 cashbackRate={merchant.cashback_rate}
 />
 </section>
 )}

 {/* ─── Reviews Section ─── */}
 <section id="section-reviews">
  <div className="text-[0.7rem] font-medium tracking-[0.18em] uppercase text-primary mb-2 flex items-center gap-2">
   <span className="w-3.5 h-3.5 fill-current" aria-hidden="true">⭐</span>
   Reviews
  </div>
  <h2
   className="font-black leading-[1.1] tracking-[-0.02em] text-foreground mb-5"
   style={{
    fontFamily: '"Playfair Display", Georgia, serif',
    fontSize: "clamp(1.5rem, 3vw, 1.85rem)",
   }}
  >
   What pet parents <span className="italic text-primary">are saying</span>
  </h2>

 {/* Rating Breakdown Card */}
  <Card className="mb-6 border-border/60 shadow-sm">
 <CardContent className="p-5">
 <div className="flex gap-6">
 {/* Big number */}
 <div className="text-center flex-shrink-0">
  <div
   className="text-5xl font-black tracking-tight text-foreground"
   style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
  >
   {Formatters.decimal(ratingStats.average, 1)}
  </div>
 <div className="flex items-center justify-center gap-0.5 mt-1">
 {[1,2,3,4,5].map((star) => (
 <Star key={star} className={`w-4 h-4 ${star <= Math.round(ratingStats.average) ?"fill-gold text-gold" :"text-muted-foreground/20"}`} />
 ))}
 </div>
 <p className="text-xs text-muted-foreground mt-1">{ratingStats.total} reviews</p>
 </div>

 {/* Distribution bars */}
 <div className="flex-1 space-y-1.5 pt-1">
 {[5, 4, 3, 2, 1].map((rating) => {
 const count = ratingStats.distribution[rating - 1];
 const pct = ratingStats.total ? (count / ratingStats.total) * 100 : 0;
 return (
 <div key={rating} className="flex items-center gap-2">
 <span className="text-xs w-3 text-muted-foreground">{rating}</span>
 <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
 <div
 className="h-full bg-warning rounded-full transition-all duration-500"
 style={{ width: `${pct}%` }}
 />
 </div>
 </div>
 );
 })}
 </div>
 </div>

 {user && !userHasReviewed && (
 <div className="mt-5 pt-4 border-t">
 <Button onClick={handleOpenReviewDialog} className="w-full">
 <span className="w-4 h-4 mr-2" aria-hidden="true">📸</span>
 Write a Review
 </Button>
 </div>
 )}
 </CardContent>
 </Card>

 {/* Reviews List */}
 {reviews.length === 0 ? (
 <Card>
 <CardContent className="py-12 text-center">
 <span className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" aria-hidden="true">💬</span>
 <h3 className="font-semibold mb-2">No reviews yet</h3>
 <p className="text-sm text-muted-foreground mb-4">Be the first to share your experience!</p>
 {user && (
 <Button onClick={handleOpenReviewDialog}>Write a Review</Button>
 )}
 </CardContent>
 </Card>
 ) : (
 <div className="space-y-4">
 {reviews.map((review) => (
 <ReviewCard key={review.id} review={review} currentUserId={user?.id} onDelete={handleReviewSuccess} />
 ))}
 </div>
 )}
 </section>

 {/* ─── Hours Section ─── */}
 <section id="section-hours">
  <div className="text-[0.7rem] font-medium tracking-[0.18em] uppercase text-primary mb-2">
   Hours
  </div>
  <h2
   className="font-black leading-[1.1] tracking-[-0.02em] text-foreground mb-5"
   style={{
    fontFamily: '"Playfair Display", Georgia, serif',
    fontSize: "clamp(1.5rem, 3vw, 1.85rem)",
   }}
  >
   When we're <span className="italic text-primary">open</span>
  </h2>
 <BusinessHoursDisplay merchantId={merchant.id} />
 </section>

 {/* Bottom Ad */}
 <AdPlacement position="bottom" />
 </div>
 </div>

 {/* Payment Dialog */}
 {user && (
 <PaymentDialogWithPawBucks
 open={paymentDialogOpen}
 onOpenChange={setPaymentDialogOpen}
 merchantId={merchant.id}
 merchantName={merchant.business_name}
 cashbackRate={merchant.cashback_rate}
 acceptsPawbucks={merchant.accepts_pawbucks}
 userId={user.id}
 onSuccess={handlePaymentSuccess}
 />
 )}

 {/* Write Review Dialog */}
 {user && merchantId && (
 <WriteReviewDialog
 open={reviewDialogOpen}
 onOpenChange={setReviewDialogOpen}
 merchantId={merchantId}
 userId={user.id}
 onSuccess={handleReviewSuccess}
 />
 )}

 {user && <BottomNav />}
 </div>
 </>
 );
});

MerchantProfile.displayName ="MerchantProfile";

export default MerchantProfile;
