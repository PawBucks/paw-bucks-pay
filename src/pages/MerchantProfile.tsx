import { useState, useMemo, useCallback, useEffect, memo, useRef } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOptimizedQuery } from "@/hooks/useOptimizedQuery";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { PageLoader } from "@/components/PageLoader";
import { SponsoredAdBar } from "@/components/SponsoredAdBar";
import { SEO } from "@/components/SEO";
import { PaymentDialogWithPawBucks } from "@/components/PaymentDialogWithPawBucks";
import { AskQuestionButton } from "@/components/storefront/AskQuestionButton";
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
import { ArrowLeft, BadgeCheck, Ban, Bone, Calendar, Camera, Check, CreditCard, Facebook, Footprints, Globe, Heart, Home, Instagram, Linkedin, MapPin, MessageSquare, Phone, Scissors, Share2, ShoppingBag, Star, Stethoscope, Store, Twitter, Sparkles } from "lucide-react";

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
  const [searchParams] = useSearchParams();
  const shouldOpenMessage = searchParams.get("openMessage") === "1";
  const incomingPetId = searchParams.get("petId");
  const incomingIntent = searchParams.get("intent");
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
            .select("id, business_name, business_type, description, logo_url, address, phone, cashback_rate, accepts_pawbucks, storefront_slug, price_range, facebook_url, instagram_url, twitter_url, linkedin_url, website_url, stripe_account_status")
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
  const paymentsActive = merchant?.stripe_account_status === "active";
  const canPay = !!merchant?.accepts_pawbucks && paymentsActive;

  // If user arrived with intent=book (e.g. from "Schedule Visit"), auto-open the booking tab.
  useEffect(() => {
    if (incomingIntent === "book" && hasBookableServices) {
      setTab("booking");
    }
  }, [incomingIntent, hasBookableServices]);

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
    if (!paymentsActive) {
      toast.error("Payments are temporarily unavailable for this merchant");
      return;
    }
    requireAuth(() => setPaymentDialogOpen(true), "Please sign in to make a payment");
  }, [requireAuth, paymentsActive]);

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

      <div className="min-h-screen bg-muted/30">
        <div className="max-w-7xl mx-auto">
          {/* ══════ Sticky top bar ══════ */}
          <div className="sticky top-0 z-30 bg-card border-b border-border px-3 py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back" className="h-9 w-9">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="font-bold text-base truncate">{merchant.business_name}</h1>
            </div>
            <div className="flex items-center gap-0">
              <Button variant="ghost" size="icon" onClick={handleShare} aria-label="Share" className="h-9 w-9 text-muted-foreground">
                <Share2 className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost" size="icon"
                onClick={handleToggleSave}
                aria-label={saved ? "Remove from saved" : "Save merchant"}
                className={`h-9 w-9 ${saved ? "text-rose-500" : "text-muted-foreground"}`}
              >
                <Heart className={`w-5 h-5 ${saved ? "fill-current" : ""}`} />
              </Button>
            </div>
          </div>

          {/* ══════ Stationary top sponsored ad (rotates opposite of bottom) ══════ */}
          <div className="px-3 pt-3">
            <SponsoredAdBar variant="top" />
          </div>

          {/* ══════ DARK HERO ══════ */}
          <section className="relative bg-[hsl(218_35%_10%)] text-white px-4 pt-5 pb-4 overflow-hidden">
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.18),transparent_60%)]" />
            <div className="relative">
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0">
                  {merchant.logo_url ? (
                    <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg">
                      <img src={merchant.logo_url} alt={merchant.business_name} className="w-full h-full object-cover" loading="eager" />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-900 flex items-center justify-center shadow-lg text-white text-2xl font-bold tracking-tight">
                      {merchant.business_name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h2 className="font-extrabold text-2xl tracking-tight leading-tight">
                      {merchant.business_name}
                    </h2>
                    {hasVerifiedPro && (
                      <BadgeCheck className="w-5 h-5 text-info flex-shrink-0" aria-label="Verified Pro" />
                    )}
                    {merchantId && <Founding50Badge entityType="merchant" entityId={merchantId} size="sm" />}
                  </div>

                  <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-primary/60 text-primary font-medium capitalize">
                      {merchant.business_type.replace(/_/g, " ")}
                    </span>
                    {merchant.address && (
                      <span className="text-white/80 truncate">{merchant.address.split(",").slice(-3, -1).join(",").trim()}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-2.5">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${s <= Math.round(ratingStats.average) ? "fill-gold text-gold" : "text-white/25"}`}
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => setTab("reviews")}
                      className="text-xs text-white/70 hover:text-white bg-transparent border-none cursor-pointer"
                    >
                      {Formatters.decimal(ratingStats.average, 1)} ({ratingStats.total})
                    </button>
                  </div>
                </div>
              </div>

              {/* Status row */}
              <div className="flex items-center gap-3 mt-4 text-sm">
                <OpenStatusBadge merchantId={merchant.id} />
                {merchant.accepts_pawbucks && (
                  <>
                    <span aria-hidden="true" className="text-white/80">·</span>
                    <span className="inline-flex items-center gap-1.5 text-primary font-medium">
                      <PawBucksLogo className="w-4 h-4" /> Earns PawBucks
                    </span>
                  </>
                )}
              </div>

              <div className="h-px bg-white/10 my-4" />

              {/* Quick action grid */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {hasBookableServices && (
                  <button
                    onClick={scrollToBooking}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xl bg-primary text-primary-foreground py-3 px-1 font-semibold shadow-md active:scale-95 transition-transform"
                  >
                    <Calendar className="w-5 h-5" />
                    <span className="text-[11px]">Book</span>
                  </button>
                )}
                <button
                  onClick={handleOpenPaymentDialog}
                  disabled={!canPay}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] text-white py-3 px-1 disabled:opacity-50 active:scale-95 transition"
                >
                  <PawBucksLogo className="w-5 h-5" />
                  <span className="text-[11px] leading-tight text-center">
                    {paymentsActive ? "Pay & Earn" : "Pay unavailable"}
                  </span>
                </button>
                {merchant.storefront_slug && (
                  <Link
                    to={`/storefront/${merchant.storefront_slug}`}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] text-white py-3 px-1 active:scale-95 transition no-underline"
                  >
                    <Store className="w-5 h-5 text-primary" />
                    <span className="text-[11px]">Storefront</span>
                  </Link>
                )}
                {merchant.phone && (
                  <a
                    href={`tel:${merchant.phone}`}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] text-white py-3 px-1 active:scale-95 transition"
                  >
                    <Phone className="w-5 h-5" />
                    <span className="text-[11px]">Call</span>
                  </a>
                )}
                {merchant.address && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(merchant.address)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] text-white py-3 px-1 active:scale-95 transition"
                  >
                    <MapPin className="w-5 h-5 text-rose-400" />
                    <span className="text-[11px]">Directions</span>
                  </a>
                )}
                {merchant.website_url && (
                  <a
                    href={merchant.website_url.startsWith("http") ? merchant.website_url : `https://${merchant.website_url}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] text-white py-3 px-1 active:scale-95 transition"
                  >
                    <Globe className="w-5 h-5 text-sky-300" />
                    <span className="text-[11px]">Website</span>
                  </a>
                )}
                <button
                  onClick={handleShare}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] text-white py-3 px-1 active:scale-95 transition"
                >
                  <Share2 className="w-5 h-5 text-amber-300" />
                  <span className="text-[11px]">Share</span>
                </button>
              </div>
            </div>
          </section>

          {/* ══════ TABS ══════ */}
          <div className="bg-card px-4">
            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <TabsList className="w-full justify-around overflow-x-auto h-auto bg-transparent border-b border-border rounded-none p-0 gap-1">
                <TabsTrigger
                  value="about"
                  className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-3 text-sm font-semibold"
                >
                  About
                </TabsTrigger>
                {plans.length > 0 && (
                  <TabsTrigger
                    value="plans"
                    className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-3 text-sm font-semibold"
                  >
                    Plans &amp; Pricing
                  </TabsTrigger>
                )}
                {hasBookableServices && (
                  <TabsTrigger
                    value="booking"
                    className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-3 text-sm font-semibold"
                  >
                    Book
                  </TabsTrigger>
                )}
                <TabsTrigger
                  value="reviews"
                  className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-3 text-sm font-semibold"
                >
                  Reviews
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* ══════ TAB CONTENT ══════ */}
          <div className="px-4 pt-4">
            <Tabs value={tab} onValueChange={setTab} className="w-full">

              {/* ─── ABOUT ─── */}
              <TabsContent value="about" className="mt-2 space-y-5 focus-visible:ring-0">
                {/* Earn PawBucks here info card */}
                {merchant.accepts_pawbucks && (
                  <div className="rounded-2xl bg-[hsl(218_35%_10%)] text-white p-4 flex items-start gap-3 shadow-lg">
                    <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0">
                      <PawBucksLogo className="w-6 h-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-base">Earn PawBucks here</h3>
                      <p className="text-sm text-white/75 leading-relaxed mt-0.5">
                        10x on Free · 20x on PawPass · 30x on PawPass+ · 1,000 PawBucks = $1
                      </p>
                    </div>
                  </div>
                )}

                {/* Photos */}
                {merchantId && (
                  <div>
                    <h3 className="text-xl font-extrabold tracking-tight mb-3">Photos</h3>
                    <PhotoGallery merchantId={merchantId} />
                  </div>
                )}

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

                {/* About text */}
                {merchant.description && (
                  <div>
                    <h3 className="text-xl font-extrabold tracking-tight mb-3">About</h3>
                    <Card>
                      <CardContent className="p-5">
                        <p className="text-sm text-foreground/80 whitespace-pre-line leading-relaxed">{merchant.description}</p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Hours */}
                <div>
                  <h3 className="text-xl font-extrabold tracking-tight mb-3">Hours</h3>
                  <BusinessHoursDisplay merchantId={merchant.id} />
                </div>

                {/* Location & contact */}
                <div>
                  <h3 className="text-xl font-extrabold tracking-tight mb-3">Location &amp; Contact</h3>
                  <Card>
                    <CardContent className="p-0 divide-y">
                      {merchant.address && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(merchant.address)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-3 group p-4"
                        >
                          <MapPin className="w-5 h-5 text-rose-500 flex-shrink-0" />
                          <p className="text-sm font-medium group-hover:text-primary transition-colors flex-1">{merchant.address}</p>
                        </a>
                      )}
                      {merchant.phone && (
                        <a href={`tel:${merchant.phone}`} className="flex items-center gap-3 group p-4">
                          <Phone className="w-5 h-5 text-foreground/70 flex-shrink-0" />
                          <p className="text-sm font-medium group-hover:text-primary transition-colors flex-1">{merchant.phone}</p>
                        </a>
                      )}
                      {merchant.website_url && (
                        <a
                          href={merchant.website_url.startsWith("http") ? merchant.website_url : `https://${merchant.website_url}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-3 group p-4"
                        >
                          <Globe className="w-5 h-5 text-sky-500 flex-shrink-0" />
                          <p className="text-sm font-medium group-hover:text-primary transition-colors break-all flex-1">
                            {merchant.website_url.replace(/^https?:\/\//, "")}
                          </p>
                        </a>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Location map */}
                {merchant.address && (
                  <div>
                    <h3 className="text-xl font-extrabold tracking-tight mb-3">Location</h3>
                    <Card className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="bg-primary/5">
                          <iframe
                            title={`Map of ${merchant.business_name}`}
                            width="100%"
                            height="220"
                            style={{ border: 0 }}
                            loading="lazy"
                            allowFullScreen
                            referrerPolicy="no-referrer-when-downgrade"
                            src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodeURIComponent(merchant.address)}`}
                          />
                        </div>
                        <div className="p-4 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{merchant.business_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{merchant.address}</p>
                          </div>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(merchant.address)}`}
                            target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-sm hover:opacity-90"
                          >
                            <MapPin className="w-4 h-4" /> Directions
                          </a>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Payment options */}
                <div>
                  <h3 className="text-xl font-extrabold tracking-tight mb-3">Payment Options</h3>
                  <Card>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-xl leading-none" aria-hidden="true">💳</span>
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
                          <span className="text-base leading-none" aria-hidden="true">✨</span> Earn {merchant.cashback_rate}x PawBucks on every purchase!
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
                <TabsContent value="plans" className="mt-6 focus-visible:ring-0">
                  {/* Multi-colored premium backdrop */}
                  <div className="relative overflow-hidden rounded-2xl p-5 sm:p-7 border border-primary/20 shadow-[0_10px_40px_-12px_hsl(var(--primary)/0.25)]">
                    {/* Animated multi-color gradient */}
                    <div
                      aria-hidden
                      className="absolute inset-0 -z-10 bg-[linear-gradient(135deg,hsl(var(--primary)/0.18),hsl(var(--accent)/0.16)_35%,hsl(var(--gold)/0.18)_65%,hsl(var(--primary)/0.20))]"
                    />
                    <div
                      aria-hidden
                      className="absolute -top-20 -right-16 -z-10 w-72 h-72 rounded-full blur-3xl bg-gold/20"
                    />
                    <div
                      aria-hidden
                      className="absolute -bottom-24 -left-20 -z-10 w-80 h-80 rounded-full blur-3xl bg-primary/25"
                    />

                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/70">
                        Premium Memberships
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">Subscription Plans</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Subscribe and earn <span className="font-semibold text-primary">{merchant.cashback_rate}x PawBucks</span> on every billing cycle.
                    </p>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      {plans.map(plan => {
                        const isBest = plan.id === bestPlanId;
                        const priceUsd = (plan.amount / 100).toFixed(plan.amount % 100 === 0 ? 0 : 2);
                        return (
                          <div
                            key={plan.id}
                            className={`relative rounded-xl p-5 transition-all backdrop-blur-md ${
                              isBest
                                ? "border-2 border-transparent bg-gradient-to-br from-primary/95 via-primary to-primary/80 text-primary-foreground shadow-[0_12px_30px_-10px_hsl(var(--primary)/0.55)] sm:scale-[1.02]"
                                : "border border-border/60 bg-card/80 hover:border-primary/40 hover:-translate-y-0.5 shadow-sm"
                            }`}
                          >
                            {isBest && (
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                <Badge className="bg-gold text-ink text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 shadow-md border-0">
                                  Best Value
                                </Badge>
                              </div>
                            )}
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className={`text-base font-bold ${isBest ? "text-primary-foreground" : ""}`}>{plan.name}</h3>
                                {plan.description && (
                                  <p className={`text-xs mt-0.5 ${isBest ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                                    {plan.description}
                                  </p>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className={`text-2xl font-extrabold leading-none ${isBest ? "text-primary-foreground" : ""}`}>
                                  ${priceUsd}
                                </div>
                                <div className={`text-[11px] mt-1 ${isBest ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                                  / {intervalLabel(plan)}
                                </div>
                              </div>
                            </div>

                            {plan.features?.length > 0 && (
                              <ul className="mt-3 space-y-1.5">
                                {plan.features.map((f, i) => (
                                  <li key={i} className={`flex items-start gap-2 text-sm ${isBest ? "text-primary-foreground" : "text-foreground"}`}>
                                    <Check className={`w-3.5 h-3.5 mt-1 flex-shrink-0 ${isBest ? "text-gold" : "text-primary"}`} strokeWidth={3} />
                                    <span>{f}</span>
                                  </li>
                                ))}
                              </ul>
                            )}

                            {plan.trial_days > 0 && (
                              <p className={`text-xs mt-3 font-medium ${isBest ? "text-gold" : "text-primary"}`}>
                                {plan.trial_days}-day free trial
                              </p>
                            )}

                            <Button
                              onClick={() => handleSubscribe(plan)}
                              className={`w-full mt-4 font-semibold ${
                                isBest
                                  ? "bg-gold text-ink hover:bg-gold/90 shadow-md"
                                  : ""
                              }`}
                              variant={isBest ? "default" : "outline"}
                            >
                              Subscribe &amp; Earn PawBucks
                            </Button>
                          </div>
                        );
                      })}
                    </div>
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
                      preselectedPetId={incomingPetId}
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

            </Tabs>
          </div>

        </div>

        {/* ══════ Inline sponsored ad (sits just above the sticky CTA bar) ══════ */}
        <div
          className="px-3 pt-8"
          style={{ paddingBottom: `calc(${user ? 64 : 0}px + 76px + env(safe-area-inset-bottom) + 16px)` }}
        >
          <SponsoredAdBar variant="bottom" />
        </div>

        {/* ══════ Sticky bottom CTA bar ══════ */}
        <div
          className={`fixed inset-x-0 z-40 bg-card border-t border-border px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-3 ${
            user ? "bottom-[64px] md:bottom-0" : "bottom-0"
          }`}
        >
          <div className="max-w-7xl mx-auto flex gap-2">
            <AskQuestionButton
              merchantId={merchant.id}
              merchantName={merchant.business_name}
              autoOpen={shouldOpenMessage}
              trigger={
                <button
                  className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-xl border border-border bg-card text-sm font-semibold text-foreground hover:bg-muted/40 transition"
                >
                  <MessageSquare className="w-4 h-4" /> Message
                </button>
              }
            />
            <button
              onClick={hasBookableServices ? scrollToBooking : handleOpenPaymentDialog}
              disabled={!hasBookableServices && !canPay}
              className="flex-[2] inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-md hover:opacity-95 disabled:opacity-50 transition"
            >
              <PawBucksLogo className="w-4 h-4" />
              {hasBookableServices
                ? "Book & Earn PawBucks"
                : !merchant.accepts_pawbucks
                  ? "Doesn't accept PawBucks"
                  : !paymentsActive
                    ? "Payments unavailable"
                    : "Pay & Earn PawBucks"}
            </button>
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
