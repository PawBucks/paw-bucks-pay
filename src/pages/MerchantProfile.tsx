import { useState, useMemo } from "react";
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
import { WriteReviewDialog } from "@/components/merchant/WriteReviewDialog";
import { ReviewCard } from "@/components/merchant/ReviewCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ROUTES } from "@/lib/constants";
import {
  Star,
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock,
  Coins,
  CreditCard,
  Store,
  Scissors,
  Home,
  Stethoscope,
  Footprints,
  Bone,
  ArrowLeft,
  ShoppingBag,
  MessageSquare,
  Camera,
  ChevronRight,
} from "lucide-react";

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

const MerchantProfile = () => {
  const { merchantId } = useParams<{ merchantId: string }>();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);

  // Fetch merchant data
  const { data: merchant, isLoading: merchantLoading } = useOptimizedQuery(
    ["merchant", merchantId],
    async () => {
      const { data, error } = await supabase
        .from("merchants")
        .select("*")
        .eq("id", merchantId)
        .single();
      if (error) throw error;
      return data;
    },
    { staleTime: 1000 * 60 * 5 }
  );

  // Fetch reviews with photos and user info
  const { data: reviews = [], isLoading: reviewsLoading, refetch: refetchReviews } = useOptimizedQuery<Review[]>(
    ["merchant-reviews", merchantId],
    async () => {
      const { data: reviewData, error: reviewError } = await supabase
        .from("merchant_reviews")
        .select("*")
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: false });

      if (reviewError) throw reviewError;

      // Fetch photos for each review
      const reviewsWithPhotos = await Promise.all(
        (reviewData || []).map(async (review) => {
          const { data: photos } = await supabase
            .from("review_photos")
            .select("id, photo_url")
            .eq("review_id", review.id);

          // Get user profile for display name
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", review.user_id)
            .single();

          return {
            ...review,
            photos: photos || [],
            user_name: profile?.full_name || "Anonymous",
          };
        })
      );

      return reviewsWithPhotos;
    },
    { staleTime: 1000 * 60 * 2 }
  );

  // Calculate rating stats
  const ratingStats = useMemo(() => {
    if (!reviews.length) return { average: 0, total: 0, distribution: [0, 0, 0, 0, 0] };
    
    const distribution = [0, 0, 0, 0, 0];
    let sum = 0;
    
    reviews.forEach((r) => {
      sum += r.rating;
      distribution[r.rating - 1]++;
    });
    
    return {
      average: sum / reviews.length,
      total: reviews.length,
      distribution,
    };
  }, [reviews]);

  // Check if user has already reviewed
  const userHasReviewed = useMemo(() => {
    if (!user) return false;
    return reviews.some((r) => r.user_id === user.id);
  }, [reviews, user]);

  const handlePaymentSuccess = () => {
    toast.success("Redirecting to wallet...");
    setTimeout(() => navigate(ROUTES.WALLET), 1000);
  };

  const handleLogout = async () => {
    await signOut();
    navigate(ROUTES.AUTH);
  };

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
        description={merchant.description || `Visit ${merchant.business_name} and earn ${merchant.cashback_rate}% cashback with PawBucks.`}
        keywords={[merchant.business_name, merchant.business_type, "pet services", "cashback"]}
      />
      <Header isAuthenticated={!!user} onLogout={user ? handleLogout : undefined} />
      
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-24 md:pb-12">
        <div className="container mx-auto px-4 pt-4 max-w-4xl">
          {/* Top Ad */}
          <div className="mb-4">
            <AdPlacement position="top" />
          </div>

          {/* Back Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {/* Hero Header */}
          <Card className="overflow-hidden mb-6">
            <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-background p-8">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                {/* Logo */}
                <div className="flex-shrink-0">
                  {merchant.logo_url ? (
                    <div className="w-28 h-28 rounded-2xl overflow-hidden bg-background shadow-lg border-2 border-border">
                      <img
                        src={merchant.logo_url}
                        alt={merchant.business_name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-28 h-28 rounded-2xl bg-background flex items-center justify-center shadow-lg border-2 border-border">
                      <Icon className="w-14 h-14 text-primary" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1">
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                      <h1 className="text-3xl font-bold mb-1">{merchant.business_name}</h1>
                      <p className="text-muted-foreground capitalize">
                        {merchant.business_type.replace(/_/g, " ")}
                      </p>
                    </div>
                    <Badge className="bg-primary text-primary-foreground text-lg px-4 py-2">
                      {merchant.cashback_rate}% Cashback
                    </Badge>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-3 mt-4">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-5 h-5 ${
                            star <= Math.round(ratingStats.average)
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground/30"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="font-semibold">{ratingStats.average.toFixed(1)}</span>
                    <span className="text-muted-foreground">
                      ({ratingStats.total} {ratingStats.total === 1 ? "review" : "reviews"})
                    </span>
                  </div>

                  {/* Payment Methods */}
                  <div className="flex items-center gap-4 mt-4">
                    <div className="flex items-center gap-2 text-sm">
                      <CreditCard className="w-4 h-4 text-muted-foreground" />
                      <span>Card Payments</span>
                    </div>
                    {merchant.accepts_pawbucks && (
                      <div className="flex items-center gap-2 text-sm text-primary font-medium">
                        <Coins className="w-4 h-4" />
                        <span>Accepts PawBucks</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-4 bg-muted/30 flex flex-wrap gap-3">
              <Button
                size="lg"
                className="flex-1 min-w-[200px]"
                onClick={() => {
                  if (!user) {
                    toast.error("Please sign in to make a payment");
                    navigate(ROUTES.AUTH);
                    return;
                  }
                  setPaymentDialogOpen(true);
                }}
              >
                <ShoppingBag className="w-4 h-4 mr-2" />
                Pay & Earn Cashback
              </Button>
              {user && !userHasReviewed && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setReviewDialogOpen(true)}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Write a Review
                </Button>
              )}
            </div>
          </Card>

          {/* Tabs Content */}
          <Tabs defaultValue="about" className="mb-6">
            <TabsList className="w-full justify-start mb-4">
              <TabsTrigger value="about">About</TabsTrigger>
              <TabsTrigger value="reviews">
                Reviews ({ratingStats.total})
              </TabsTrigger>
              {merchant.stripe_account_id && (
                <TabsTrigger value="products">Products</TabsTrigger>
              )}
            </TabsList>

            {/* About Tab */}
            <TabsContent value="about" className="space-y-6">
              {/* Description */}
              {merchant.description && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">About</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground whitespace-pre-line">
                      {merchant.description}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Contact & Location */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Contact & Location</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {merchant.address && (
                    <>
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">Address</p>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(merchant.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {merchant.address}
                          </a>
                        </div>
                      </div>
                      {/* Google Maps Embed */}
                      <div className="rounded-lg overflow-hidden border">
                        <iframe
                          title={`Map of ${merchant.business_name}`}
                          width="100%"
                          height="250"
                          style={{ border: 0 }}
                          loading="lazy"
                          allowFullScreen
                          referrerPolicy="no-referrer-when-downgrade"
                          src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodeURIComponent(merchant.address)}`}
                        />
                      </div>
                    </>
                  )}
                  {merchant.phone && (
                    <div className="flex items-start gap-3">
                      <Phone className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Phone</p>
                        <a
                          href={`tel:${merchant.phone}`}
                          className="text-primary hover:underline"
                        >
                          {merchant.phone}
                        </a>
                      </div>
                    </div>
                  )}
                  {merchant.email && (
                    <div className="flex items-start gap-3">
                      <Mail className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Email</p>
                        <a
                          href={`mailto:${merchant.email}`}
                          className="text-primary hover:underline"
                        >
                          {merchant.email}
                        </a>
                      </div>
                    </div>
                  )}
                  {merchant.contact_person && (
                    <div className="flex items-start gap-3">
                      <Globe className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Contact Person</p>
                        <p className="text-muted-foreground">{merchant.contact_person}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Payment Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Payment Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-muted-foreground" />
                      <span>Credit/Debit Card</span>
                    </div>
                    <Badge variant="outline">Available</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Coins className="w-5 h-5 text-primary" />
                      <div>
                        <span>PawBucks</span>
                        <p className="text-xs text-muted-foreground">100 PawBucks = $1.00</p>
                      </div>
                    </div>
                    <Badge variant={merchant.accepts_pawbucks ? "default" : "secondary"}>
                      {merchant.accepts_pawbucks ? "Accepted" : "Not Accepted"}
                    </Badge>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <p className="text-sm text-primary font-medium">
                      Earn {merchant.cashback_rate}% cashback on every purchase!
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Reviews Tab */}
            <TabsContent value="reviews" className="space-y-6">
              {/* Rating Summary */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row gap-6">
                    {/* Overall Rating */}
                    <div className="text-center md:text-left">
                      <div className="text-5xl font-bold">{ratingStats.average.toFixed(1)}</div>
                      <div className="flex items-center justify-center md:justify-start gap-1 mt-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-5 h-5 ${
                              star <= Math.round(ratingStats.average)
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground/30"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {ratingStats.total} reviews
                      </p>
                    </div>

                    {/* Rating Distribution */}
                    <div className="flex-1 space-y-2">
                      {[5, 4, 3, 2, 1].map((rating) => {
                        const count = ratingStats.distribution[rating - 1];
                        const percentage = ratingStats.total
                          ? (count / ratingStats.total) * 100
                          : 0;
                        return (
                          <div key={rating} className="flex items-center gap-2">
                            <span className="text-sm w-3">{rating}</span>
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-yellow-400 rounded-full transition-all"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-sm text-muted-foreground w-8">
                              {count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Write Review Button */}
                  {user && !userHasReviewed && (
                    <div className="mt-6 pt-6 border-t">
                      <Button onClick={() => setReviewDialogOpen(true)} className="w-full md:w-auto">
                        <Camera className="w-4 h-4 mr-2" />
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
                    <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
                    <h3 className="font-semibold mb-2">No reviews yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Be the first to review this merchant!
                    </p>
                    {user && (
                      <Button onClick={() => setReviewDialogOpen(true)}>
                        Write a Review
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <ReviewCard
                      key={review.id}
                      review={review}
                      currentUserId={user?.id}
                      onDelete={() => refetchReviews()}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Products Tab */}
            {merchant.stripe_account_id && (
              <TabsContent value="products">
                <Card>
                  <CardContent className="py-8 text-center">
                    <ShoppingBag className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
                    <h3 className="font-semibold mb-2">View Products</h3>
                    <p className="text-muted-foreground mb-4">
                      Check out the products and services offered by this merchant.
                    </p>
                    <Button asChild>
                      <Link to={`/storefront/${merchant.stripe_account_id}`}>
                        View Storefront
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>

          {/* Bottom Ad */}
          <AdPlacement position="bottom" />
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
            onSuccess={() => refetchReviews()}
          />
        )}

        {user && <BottomNav />}
      </div>
    </>
  );
};

export default MerchantProfile;
