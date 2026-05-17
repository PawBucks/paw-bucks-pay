import { useState, useMemo, useCallback, useEffect, memo, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOptimizedQuery } from "@/hooks/useOptimizedQuery";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { PageLoader } from "@/components/PageLoader";
import { AdPlacement } from "@/components/AdPlacement";
import { SEO } from "@/components/SEO";
import { PaymentDialogWithPawBucks } from "@/components/PaymentDialogWithPawBucks";
import { SubscriptionCheckoutDialog } from "@/components/SubscriptionCheckoutDialog";
import { WriteReviewDialog } from "@/components/merchant/WriteReviewDialog";
import { ReviewCard } from "@/components/merchant/ReviewCard";
import { BookingWidget } from "@/components/scheduling/BookingWidget";
import { BusinessHoursDisplay } from "@/components/scheduling/BusinessHoursDisplay";
import { OpenStatusBadge } from "@/components/merchant/OpenStatusBadge";
import { PhotoGallery } from "@/components/merchant/PhotoGallery";
import { PriceRangeDisplay } from "@/components/merchant/PriceRangeDisplay";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ROUTES } from "@/lib/constants";
import { useMerchantActiveServices, SERVICE_NAMES, merchantHasService } from "@/hooks/useMerchantServices";
import { useServiceConversionTracking } from "@/hooks/useServiceConversionTracking";
import { schedulingService } from "@/services/api/scheduling.service";
import { merchantSubscriptionPlansService } from "@/services/api/merchantSubscriptionPlans.service";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Founding50Badge } from "@/components/shared/Founding50Badge";
import {
  ArrowLeft, BadgeCheck, Ban, Bone, Calendar, Camera, Check, CreditCard,
  Facebook, Footprints, Globe, Heart, Home, Instagram, Linkedin, MapPin,
  MessageSquare, Phone, Scissors, Share2, ShoppingBag, Star, Stethoscope, Store, Twitter,
} from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { Formatters } from "@/utils/formatters";
import { PawBucksLogo } from "@/components/PawBucksLogo";

const getBusinessIcon = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes("store") || t.includes("shop")) return Store;
  if (t.includes("groom")) return Scissors;
  if (t.includes("sitter") || t.includes("boarding")) return Home;
  if (t.includes("vet") || t.includes("clinic")) return Stethoscope;
  if (t.includes("walker") || t.includes("walking")) return Footprints;
  if (t.includes("trainer") || t.includes("training")) return Bone;
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

type SubscriptionPlan = {
  id: string;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  billing_interval: string;
  billing_interval_count: number;
  stripe_price_id: string;
  features: string[];
  trial_days: number;
};

const SAVED_KEY = "pb:saved-merchants";
const getSavedSet = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(SAVED_KEY) || "[]")); }
  catch { return new Set(); }
};

const MerchantProfile = memo(() => {
  const { merchantId } = useParams<{ merchantId: string }>();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState("about");
  const bookingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (merchantId) setSaved(getSavedSet().has(merchantId));
  }, [merchantId]);

  // Services & ROI tracking
  const { data: activeServices = [] } = useMerchantActiveServices(merchantId);
  const hasVerifiedPro = merchantHasService(activeServices, SERVICE_NAMES.VERIFIED_PRO_BADGE);
  const isSponsored = merchantHasService(activeServices, SERVICE_NAMES.SPONSORED_PLACEMENT);
  const hasFeaturedPartner = merchantHasService(activeServices, SERVICE_NAMES.FEATURED_PARTNER);
  const { trackProfileView } = useServiceConversionTracking();

  useEffect(() => {
    if (merchantId && activeServices.length > 0) {
      if (hasVerifiedPro) trackProfileView(merchantId, SERVICE_NAMES.VERIFIED_PRO_BADGE, "profile");
      if (hasFeaturedPartner) trackProfileView(merchantId, SERVICE_NAMES.FEATURED_PARTNER, "profile");
      if (isSponsored) trackProfileView(merchantId, SERVICE_NAMES.SPONSORED_PLACEMENT, "profile");
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
          const { data, error } = await supabase.functions.invoke("get-connect-account-status", { body: { merchantId } });
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
  const merchantStripeInfo = queryResults[2].data as { accountId?: string } | null;
  const connectedAccountId = merchantStripeInfo?.accountId || null;
  const hasBookableServices = merchantServices.length > 0;

  // Subscription plans
  const { data: plans = [] } = useQuery<SubscriptionPlan[]>({
    queryKey: ["merchant-subscription-plans-public", merchantId],
    queryFn: async () => {
      if (!merchantId) return [];
      const { data } = await merchantSubscriptionPlansService.getPublishedPlans(merchantId);
      return (data || []).map(p => ({ ...p, features: Array.isArray(p.features) ? p.features as string[] : [] })) as SubscriptionPlan[];
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!merchantId,
  });

  // Reviews
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
      (photosResult.data || []).forEach(p => {
        const existing = photosByReview.get(p.review_id) || [];
        existing.push({ id: p.id, photo_url: p.photo_url });
        photosByReview.set(p.review_id, existing);
      });
      const profilesByUser = new Map<string, string>();
      (profilesResult.data || []).forEach(pr => { profilesByUser.set(pr.id, pr.full_name || "Anonymous"); });
      return reviewData.map(r => ({
        ...r,
        photos: photosByReview.get(r.id) || [],
        user_name: profilesByUser.get(r.user_id) || "Anonymous",
      }));
    },
    { staleTime: 1000 * 60 * 2, enabled: !!merchantId }
  );

  const ratingStats = useMemo(() => {
    if (!reviews.length) return { average: 0, total: 0, distribution: [0, 0, 0, 0, 0] };
    const distribution = [0, 0, 0, 0, 0];
    let sum = 0;
    reviews.forEach(r => { sum += r.rating; distribution[r.rating - 1]++; });
    return { average: sum / reviews.length, total: reviews.length, distribution };
  }, [reviews]);

  const userHasReviewed = useMemo(
    () => (user ? reviews.some(r => r.user_id === user.id) : false),
    [reviews, user]
  );

  const featuredReview = useMemo(
    () => reviews.find(r => r.review_text && r.review_text.length > 20 && r.rating >= 4),
    [reviews]
  );

  // Identify the highest-value plan to show "Best Value"
  const bestPlanId = useMemo(() => {
    if (plans.length < 2) return null;
    return [...plans].sort((a, b) => b.amount - a.amount)[0].id;
  }, [plans]);

  const handlePaymentSuccess = useCallback(() => {
    toast.success("Redirecting to wallet...");
    setTimeout(() => navigate(ROUTES.WALLET), 1000);
  }, [navigate]);

  const handleLogout = useCallback(async () => {
    await signOut();
    navigate(ROUTES.AUTH);
  }, [signOut, navigate]);

  const requireAuth = useCallback((action: () => void, msg = "Please sign in to continue") => {
    if (!user) {
      toast.error(msg);
      navigate(`${ROUTES.AUTH}?redirect=/merchant/${merchantId}`);
      return;
    }
    action();
  }, [user, navigate, merchantId]);

  const handleOpenPaymentDialog = useCallback(() => {
    requireAuth(() => setPaymentDialogOpen(true), "Please sign in to make a payment");
  }, [requireAuth]);

  const handleOpenReviewDialog = useCallback(() => setReviewDialogOpen(true), []);
  const handleReviewSuccess = useCallback(() => refetchReviews(), [refetchReviews]);

  const handleSubscribe = useCallback((plan: SubscriptionPlan) => {
    requireAuth(() => {
      if (!connectedAccountId) {
        toast.error("This merchant hasn't completed payment setup yet.");
        return;
      }
      setSelectedPlan(plan);
      setSubDialogOpen(true);
    }, "Please sign in to subscribe");
  }, [requireAuth, connectedAccountId]);

  const handleToggleSave = useCallback(() => {
    if (!merchantId) return;
    const set = getSavedSet();
    if (set.has(merchantId)) { set.delete(merchantId); setSaved(false); toast.success("Removed from saved"); }
    else { set.add(merchantId); setSaved(true); toast.success("Saved"); }
    localStorage.setItem(SAVED_KEY, JSON.stringify([...set]));
  }, [merchantId]);

  const handleShare = useCallback(() => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const shareData = {
      title: merchant?.business_name || "Check out this merchant on PawBucks",
      text: merchant?.description || "",
      url,
    };
    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => toast.success("Link copied to clipboard!"));
    }
  }, [merchant]);

  const scrollToBooking = useCallback(() => {
    setTab("booking");
    setTimeout(() => bookingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, []);

  if (merchantLoading || reviewsLoading) return <PageLoader message="Loading merchant profile..." />;

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
  const intervalLabel = (p: SubscriptionPlan) =>
    p.billing_interval_count > 1 ? `${p.billing_interval_count} ${p.billing_interval}s` : p.billing_interval;

  return (
    <>
      <SEO
        title={merchant.business_name}
        description={merchant.description || `Visit ${merchant.business_name} and earn ${merchant.cashback_rate}x points in PawBucks!`}
        keywords={[merchant.business_name, merchant.business_type, "pet services", "PawBucks", "rewards"]}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          name: merchant.business_name,
          description: merchant.description || undefined,
          image: merchant.logo_url || undefined,
          telephone: merchant.phone || undefined,
          address: merchant.address ? { "@type": "PostalAddress", streetAddress: merchant.address } : undefined,
          url: typeof window !== "undefined" ? window.location.href : undefined,
        }}
      />
      <Header isAuthenticated={!!user} onLogout={user ? handleLogout : undefined} />

      <div className="min-h-screen bg-background pb-32 md:pb-12">
        <div className="max-w-4xl mx-auto">
          {/* Top Ad */}
          <div className="px-4 pt-4"><AdPlacement position="top" /></div>

          {/* Back */}
          <div className="px-4 pt-3 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2 text-muted-foreground hover:text-foreground -ml-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <Button
              variant="ghost" size="icon"
              onClick={handleToggleSave}
              aria-label={saved ? "Remove from saved" : "Save merchant"}
              className={saved ? "text-rose-500" : "text-muted-foreground"}
            >
              <Heart className={`w-5 h-5 ${saved ? "fill-current" : ""}`} />
            </Button>
          </div>

          {/* ═══════════════ HERO ═══════════════ */}
          <section className="px-4 pt-3 pb-5">
            <div className="flex gap-4 items-start">
              <div className="flex-shrink-0">
                {merchant.logo_url ? (
                  <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-border shadow-md">
                    <img src={merchant.logo_url} alt={merchant.business_name} className="w-full h-full object-cover" loading="eager" />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-md border-2 border-border">
                    <Icon className="w-10 h-10 text-primary" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h1 className="font-bold text-xl sm:text-2xl tracking-tight text-foreground leading-tight">
                    {merchant.business_name}
                  </h1>
                  {hasVerifiedPro && (
                    <BadgeCheck className="w-5 h-5 text-info flex-shrink-0" aria-label="Verified Pro" />
                  )}
                  {merchantId && <Founding50Badge entityType="merchant" entityId={merchantId} size="sm" />}
                </div>

                <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs">
                  <Badge variant="secondary" className="capitalize bg-primary/10 text-primary hover:bg-primary/15 border-none">
                    {merchant.business_type.replace(/_/g, " ")}
                  </Badge>
                  <PriceRangeDisplay priceRange={merchant.price_range} />
                  <OpenStatusBadge merchantId={merchant.id} />
                </div>

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-warning text-warning" />
                    <span className="font-semibold text-sm">{Formatters.decimal(ratingStats.average, 1)}</span>
                    <button onClick={() => setTab("reviews")} className="text-xs text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer">
                      ({ratingStats.total})
                    </button>
                  </div>
                  <span className="text-muted-foreground text-xs">·</span>
                  <Badge className="bg-primary text-primary-foreground text-[10px] font-semibold py-0.5 h-5">
                    {merchant.cashback_rate}x PawBucks
                  </Badge>
                  {isSponsored && (
                    <Badge variant="secondary" className="text-[10px] gap-1 py-0.5 h-5">
                      <Sparkles className="w-2.5 h-2.5" /> Sponsored
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Quick action chips */}
            <div className="flex gap-2 mt-4 overflow-x-auto scrollbar-none pb-1">
              {merchant.phone && (
                <a href={`tel:${merchant.phone}`} className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors">
                  <Phone className="w-3.5 h-3.5" /> Call
                </a>
              )}
              {merchant.address && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(merchant.address)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5" /> Directions
                </a>
              )}
              {merchant.website_url && (
                <a
                  href={merchant.website_url.startsWith("http") ? merchant.website_url : `https://${merchant.website_url}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
                >
                  <Globe className="w-3.5 h-3.5" /> Website
                </a>
              )}
              {merchant.storefront_slug && (
                <Link
                  to={`/storefront/${merchant.storefront_slug}`}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
                >
                  <Store className="w-3.5 h-3.5" /> Storefront
                </Link>
              )}
            </div>

            {/* Primary CTAs */}
            <div className="flex gap-2 mt-4">
              {merchant.accepts_pawbucks ? (
                <Button size="lg" className="flex-1 h-12 text-sm font-semibold" onClick={handleOpenPaymentDialog}>
                  <ShoppingBag className="w-5 h-5 mr-2" /> Pay &amp; Earn PawBucks
                </Button>
              ) : (
                <Button size="lg" className="flex-1 h-12 text-sm font-semibold" disabled variant="secondary">
                  <Ban className="w-5 h-5 mr-2" /> Doesn't accept PawBucks
                </Button>
              )}
              {hasBookableServices && (
                <Button size="lg" variant="outline" className="h-12" onClick={scrollToBooking}>
                  <Calendar className="w-5 h-5 mr-1.5" /> Book
                </Button>
              )}
            </div>
            {!merchant.accepts_pawbucks && (
              <p className="text-xs text-muted-foreground mt-2 px-1">
                This merchant hasn't enabled PawBucks payments yet. You can still visit their storefront or contact them directly.
              </p>
            )}
          </section>

          <Separator />

          {/* ═══════════════ TABS ═══════════════ */}
          <div className="px-4 pt-4">
            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <TabsList className="w-full justify-start overflow-x-auto h-auto bg-transparent border-b border-border rounded-none p-0 gap-1 flex-wrap">
                <TabsTrigger
                  value="about"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2.5 text-sm"
                >
                  About
                </TabsTrigger>
                {plans.length > 0 && (
                  <TabsTrigger
                    value="plans"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2.5 text-sm"
                  >
                    Plans ({plans.length})
                  </TabsTrigger>
                )}
                {hasBookableServices && (
                  <TabsTrigger
                    value="booking"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2.5 text-sm"
                  >
                    Book
                  </TabsTrigger>
                )}
                <TabsTrigger
                  value="reviews"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2.5 text-sm"
                >
                  Reviews ({ratingStats.total})
                </TabsTrigger>
                <TabsTrigger
                  value="hours"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2.5 text-sm"
                >
                  Hours
                </TabsTrigger>
              </TabsList>

              {/* ─── ABOUT ─── */}
              <TabsContent value="about" className="mt-6 space-y-6 focus-visible:ring-0">
                {/* Featured review */}
                {featuredReview && (
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2">
                        <Star className="w-4 h-4 fill-warning text-warning flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm italic text-foreground line-clamp-3">"{featuredReview.review_text}"</p>
                          <p className="text-xs text-muted-foreground mt-2">— {featuredReview.user_name}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Photo gallery */}
                {merchantId && <PhotoGallery merchantId={merchantId} />}

                {/* About text */}
                {merchant.description && (
                  <div>
                    <h2 className="text-base font-bold mb-2">About</h2>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{merchant.description}</p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Hours compact */}
                <div>
                  <h2 className="text-base font-bold mb-2">Hours</h2>
                  <BusinessHoursDisplay merchantId={merchant.id} />
                </div>

                {/* Location & contact */}
                <div>
                  <h2 className="text-base font-bold mb-2">Location & Contact</h2>
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      {merchant.address && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(merchant.address)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-start gap-3 group"
                        >
                          <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium group-hover:text-primary transition-colors">{merchant.address}</p>
                            <p className="text-xs text-muted-foreground">Tap for directions</p>
                          </div>
                        </a>
                      )}
                      {merchant.phone && (
                        <a href={`tel:${merchant.phone}`} className="flex items-start gap-3 group">
                          <Phone className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium group-hover:text-primary transition-colors">{merchant.phone}</p>
                            <p className="text-xs text-muted-foreground">Tap to call</p>
                          </div>
                        </a>
                      )}
                      {merchant.website_url && (
                        <a
                          href={merchant.website_url.startsWith("http") ? merchant.website_url : `https://${merchant.website_url}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-start gap-3 group"
                        >
                          <Globe className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium group-hover:text-primary transition-colors break-all">
                              {merchant.website_url.replace(/^https?:\/\//, "")}
                            </p>
                            <p className="text-xs text-muted-foreground">Visit website</p>
                          </div>
                        </a>
                      )}
                      {merchant.address && (
                        <div className="rounded-lg overflow-hidden border mt-2">
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
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Payment options */}
                <div>
                  <h2 className="text-base font-bold mb-2">Payment Options</h2>
                  <Card>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                        <div className="flex items-center gap-3">
                          <CreditCard className="w-5 h-5 text-muted-foreground" />
                          <span className="text-sm font-medium">Credit/Debit Card</span>
                        </div>
                        <Badge variant="outline" className="text-xs">Available</Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                        <div className="flex items-center gap-3">
                          <PawBucksLogo className="w-5 h-5 text-primary" />
                          <div>
                            <span className="text-sm font-medium">PawBucks</span>
                            <p className="text-xs text-muted-foreground">1,000 PawBucks = $1.00</p>
                          </div>
                        </div>
                        <Badge variant={merchant.accepts_pawbucks ? "default" : "secondary"} className="text-xs">
                          {merchant.accepts_pawbucks ? "Accepted" : "Not Accepted"}
                        </Badge>
                      </div>
                      <div className="mt-2 p-3 bg-primary/5 rounded-lg border border-primary/10">
                        <p className="text-sm text-primary font-medium flex items-center gap-2">
                          <Sparkles className="w-4 h-4" /> Earn {merchant.cashback_rate}x PawBucks on every purchase!
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Socials */}
                {(merchant.facebook_url || merchant.instagram_url || merchant.twitter_url || merchant.linkedin_url) && (
                  <div>
                    <h2 className="text-base font-bold mb-2">Follow</h2>
                    <div className="flex items-center gap-3">
                      {merchant.facebook_url && (
                        <a href={merchant.facebook_url} target="_blank" rel="noopener noreferrer" aria-label="Facebook"
                          className="w-11 h-11 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center text-foreground transition-transform hover:scale-110">
                          <Facebook className="w-5 h-5" />
                        </a>
                      )}
                      {merchant.instagram_url && (
                        <a href={merchant.instagram_url} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                          className="w-11 h-11 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center text-foreground transition-transform hover:scale-110">
                          <Instagram className="w-5 h-5" />
                        </a>
                      )}
                      {merchant.twitter_url && (
                        <a href={merchant.twitter_url} target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)"
                          className="w-11 h-11 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center text-foreground transition-transform hover:scale-110">
                          <Twitter className="w-5 h-5" />
                        </a>
                      )}
                      {merchant.linkedin_url && (
                        <a href={merchant.linkedin_url} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"
                          className="w-11 h-11 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center text-foreground transition-transform hover:scale-110">
                          <Linkedin className="w-5 h-5" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ─── PLANS ─── */}
              {plans.length > 0 && (
                <TabsContent value="plans" className="mt-6 space-y-4 focus-visible:ring-0">
                  <div>
                    <h2 className="text-base font-bold">Subscription Plans</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Subscribe and earn {merchant.cashback_rate}x PawBucks on every billing cycle.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {plans.map(plan => {
                      const isBest = plan.id === bestPlanId;
                      const priceUsd = (plan.amount / 100).toFixed(plan.amount % 100 === 0 ? 0 : 2);
                      return (
                        <div
                          key={plan.id}
                          className={`relative rounded-xl border bg-card p-5 transition-all ${
                            isBest ? "border-primary shadow-md ring-1 ring-primary/30" : "border-border hover:border-primary/40"
                          }`}
                        >
                          {isBest && (
                            <div className="absolute -top-2.5 left-4">
                              <Badge className="bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                                Best Value
                              </Badge>
                            </div>
                          )}
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <h3 className="text-base font-bold">{plan.name}</h3>
                              {plan.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-2xl font-extrabold leading-none">${priceUsd}</div>
                              <div className="text-[11px] text-muted-foreground mt-1">/ {intervalLabel(plan)}</div>
                            </div>
                          </div>

                          {plan.features?.length > 0 && (
                            <ul className="mt-3 space-y-1.5">
                              {plan.features.map((f, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                                  <Check className="w-3.5 h-3.5 text-primary mt-1 flex-shrink-0" strokeWidth={3} />
                                  <span>{f}</span>
                                </li>
                              ))}
                            </ul>
                          )}

                          {plan.trial_days > 0 && (
                            <p className="text-xs text-primary mt-3 font-medium">
                              {plan.trial_days}-day free trial
                            </p>
                          )}

                          <Button
                            onClick={() => handleSubscribe(plan)}
                            className="w-full mt-4"
                            variant={isBest ? "default" : "outline"}
                          >
                            Subscribe &amp; Earn PawBucks
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
              )}

              {/* ─── BOOK ─── */}
              {hasBookableServices && (
                <TabsContent value="booking" className="mt-6 focus-visible:ring-0">
                  <div ref={bookingRef}>
                    <h2 className="text-base font-bold mb-1">Book an appointment</h2>
                    <p className="text-sm text-muted-foreground mb-4">Choose a service and time that works for you.</p>
                    <BookingWidget
                      merchantId={merchant.id}
                      merchantName={merchant.business_name}
                      cashbackRate={merchant.cashback_rate}
                    />
                  </div>
                </TabsContent>
              )}

              {/* ─── REVIEWS ─── */}
              <TabsContent value="reviews" className="mt-6 space-y-4 focus-visible:ring-0">
                <Card>
                  <CardContent className="p-5">
                    <div className="flex gap-6">
                      <div className="text-center flex-shrink-0">
                        <div className="text-5xl font-extrabold tracking-tight">
                          {Formatters.decimal(ratingStats.average, 1)}
                        </div>
                        <div className="flex items-center justify-center gap-0.5 mt-1">
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star key={s} className={`w-4 h-4 ${s <= Math.round(ratingStats.average) ? "fill-warning text-warning" : "text-muted-foreground/30"}`} />
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{ratingStats.total} reviews</p>
                      </div>
                      <div className="flex-1 space-y-1.5 pt-1">
                        {[5, 4, 3, 2, 1].map(rating => {
                          const count = ratingStats.distribution[rating - 1];
                          const pct = ratingStats.total ? (count / ratingStats.total) * 100 : 0;
                          return (
                            <div key={rating} className="flex items-center gap-2">
                              <span className="text-xs w-3 text-muted-foreground">{rating}</span>
                              <Star className="w-3 h-3 fill-warning text-warning" />
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-warning rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs w-6 text-right text-muted-foreground">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {user && !userHasReviewed && (
                      <div className="mt-4 pt-4 border-t">
                        <Button onClick={handleOpenReviewDialog} className="w-full" variant="outline">
                          <Camera className="w-4 h-4 mr-2" /> Write a Review
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {reviews.length === 0 ? (
                  <Card>
                    <CardContent className="py-10 text-center">
                      <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                      <h3 className="font-semibold mb-1">No reviews yet</h3>
                      <p className="text-sm text-muted-foreground mb-4">Be the first to share your experience!</p>
                      {user && <Button onClick={handleOpenReviewDialog}>Write a Review</Button>}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {reviews.map(review => (
                      <ReviewCard key={review.id} review={review} currentUserId={user?.id} onDelete={handleReviewSuccess} />
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ─── HOURS ─── */}
              <TabsContent value="hours" className="mt-6 focus-visible:ring-0">
                <h2 className="text-base font-bold mb-3">Business Hours</h2>
                <BusinessHoursDisplay merchantId={merchant.id} />
              </TabsContent>
            </Tabs>
          </div>

          <div className="px-4 py-6">
            <AdPlacement position="bottom" />
          </div>
        </div>

        {/* Dialogs */}
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

        {user && merchantId && (
          <WriteReviewDialog
            open={reviewDialogOpen}
            onOpenChange={setReviewDialogOpen}
            merchantId={merchantId}
            userId={user.id}
            onSuccess={handleReviewSuccess}
          />
        )}

        {selectedPlan && connectedAccountId && merchantId && (
          <SubscriptionCheckoutDialog
            open={subDialogOpen}
            onOpenChange={setSubDialogOpen}
            plan={selectedPlan}
            merchantId={merchantId}
            merchantName={merchant.business_name}
            connectedAccountId={connectedAccountId}
            merchantAcceptsPawBucks={merchant.accepts_pawbucks}
            cashbackRate={merchant.cashback_rate}
            onSuccess={() => { setSubDialogOpen(false); setSelectedPlan(null); }}
          />
        )}

        {user && <BottomNav />}
      </div>
    </>
  );
});

MerchantProfile.displayName = "MerchantProfile";

export default MerchantProfile;
