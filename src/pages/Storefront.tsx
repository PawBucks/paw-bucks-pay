import { useState, useCallback, useMemo, memo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShoppingCart, Loader2, Store, ArrowLeft, Sparkles, Shield, CreditCard, Package, Star, MapPin, Clock, RefreshCw, Check } from "lucide-react";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PawBucksCheckoutDialog } from "@/components/PawBucksCheckoutDialog";
import { SubscriptionCheckoutDialog } from "@/components/SubscriptionCheckoutDialog";
import { useQuery, useQueries } from "@tanstack/react-query";
import { merchantSubscriptionPlansService } from "@/services/api/merchantSubscriptionPlans.service";

type Product = {
  id: string;
  name: string;
  description: string | null;
  images: string[];
  price: {
    id: string;
    unit_amount: number | null;
    currency: string;
    formatted: string;
  } | null;
  active: boolean;
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

const ProductSkeleton = memo(() => (
  <Card className="overflow-hidden">
    <CardHeader className="pb-4">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-full mt-2" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-10 w-1/3 mb-4" />
      <Skeleton className="h-10 w-full" />
    </CardContent>
  </Card>
));
ProductSkeleton.displayName = "ProductSkeleton";

const Storefront = memo(() => {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [purchasingProductId, setPurchasingProductId] = useState<string | null>(null);
  
  // PawBucks checkout dialog state
  const [showPawBucksDialog, setShowPawBucksDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isRecurringProduct, setIsRecurringProduct] = useState(false);

  // Parallel queries for merchant data, products, and auto-redeem preference
  const queryResults = useQueries({
    queries: [
      // Merchant data lookup by slug (stripe_account_id is resolved server-side for security)
      {
        queryKey: ["storefront-merchant", accountId],
        queryFn: async () => {
          if (!accountId) return null;
          
          // Lookup merchant by storefront slug from public view
          const { data: merchantBySlug } = await supabase
            .from('merchants_public')
            .select('id, business_name, description, cashback_rate, storefront_slug, logo_url, address, business_type, accepts_pawbucks')
            .eq('storefront_slug', accountId)
            .maybeSingle();

          if (merchantBySlug) {
            return {
              ...merchantBySlug,
              acceptsPawBucks: merchantBySlug.accepts_pawbucks ?? false,
              foundBySlug: true,
            };
          }

          // Try to find by merchant ID directly
          const { data: merchantById } = await supabase
            .from('merchants_public')
            .select('id, business_name, description, cashback_rate, storefront_slug, logo_url, address, business_type, accepts_pawbucks')
            .eq('id', accountId)
            .maybeSingle();

          if (merchantById) {
            return {
              ...merchantById,
              acceptsPawBucks: merchantById.accepts_pawbucks ?? false,
              foundBySlug: false,
            };
          }

          return null;
        },
        staleTime: 1000 * 60 * 10,
        enabled: !!accountId,
      },
      // Auto-redeem preference (only for authenticated users)
      {
        queryKey: ["auto-redeem-preference", user?.id],
        queryFn: async () => {
          if (!user?.id) return false;
          const { data } = await supabase
            .from('profiles')
            .select('auto_redeem_pawbucks')
            .eq('id', user.id)
            .single();
          return data?.auto_redeem_pawbucks || false;
        },
        staleTime: 1000 * 60 * 5,
        enabled: !!user?.id,
      },
    ],
  });

  const merchantData = queryResults[0].data;
  const merchantLoading = queryResults[0].isLoading;
  const autoRedeemEnabled = queryResults[1].data ?? false;

  // Products query depends on merchant data - uses merchantId, stripe_account_id resolved server-side
  const merchantIdForProducts = merchantData?.id;
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["storefront-products", merchantIdForProducts],
    queryFn: async () => {
      if (!merchantIdForProducts) return { products: [], connectedAccountId: null };
      const { data, error } = await supabase.functions.invoke("list-connect-products", {
        body: { merchantId: merchantIdForProducts },
      });
      if (error) throw error;
      return {
        products: data.products || [],
        connectedAccountId: data.connectedAccountId || null,
      };
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!merchantIdForProducts,
  });

  // Extract products and connectedAccountId from query response
  const products = productsData?.products || [];
  const merchantConnectedAccountId = productsData?.connectedAccountId || null;

  // Subscription plans query
  const { data: subscriptionPlans = [] } = useQuery({
    queryKey: ["storefront-subscription-plans", merchantIdForProducts],
    queryFn: async () => {
      if (!merchantIdForProducts) return [];
      const { data } = await merchantSubscriptionPlansService.getPublishedPlans(merchantIdForProducts);
      return (data || []).map(p => ({
        ...p,
        features: Array.isArray(p.features) ? p.features as string[] : [],
      }));
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!merchantIdForProducts,
  });

  // Subscription checkout state
  const [showSubDialog, setShowSubDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [connectedAccountId, setConnectedAccountId] = useState<string | null>(null);

  const handleSubscribe = useCallback(async (plan: SubscriptionPlan) => {
    if (!user) {
      toast.error("Please sign in to subscribe", {
        action: { label: "Sign In", onClick: () => navigate("/auth") },
      });
      return;
    }
    // Use pre-fetched connectedAccountId from server-side lookup
    if (!merchantConnectedAccountId) {
      toast.error("This merchant hasn't completed payment setup.");
      return;
    }
    setConnectedAccountId(merchantConnectedAccountId);
    setSelectedPlan(plan);
    setShowSubDialog(true);
  }, [user, navigate, merchantConnectedAccountId]);

  // Derived values
  const merchantName = merchantData?.business_name || "";
  const merchantId = merchantData?.id || null;
  const merchantDescription = merchantData?.description || "";
  const merchantLogo = merchantData?.logo_url || null;
  const merchantAddress = merchantData?.address || null;
  const merchantBusinessType = merchantData?.business_type || null;
  const cashbackRate = merchantData?.cashback_rate || 10;
  const merchantAcceptsPawBucks = merchantData?.acceptsPawBucks ?? false;

  const loading = merchantLoading || productsLoading;

  // Calculate estimated PawBucks for a product
  const getEstimatedPawBucks = useCallback((price: number) => {
    return Math.floor(price * cashbackRate);
  }, [cashbackRate]);

  // Initiates purchase - shows PawBucks dialog if applicable
  const handlePurchase = useCallback((product: Product) => {
    if (!product.price?.id || !merchantIdForProducts) return;

    // Check if user is authenticated
    if (!user) {
      toast.error("Please sign in to make a purchase", {
        action: {
          label: "Sign In",
          onClick: () => navigate("/auth"),
        },
      });
      return;
    }

    // Determine if product is recurring (subscription)
    const priceFormatted = product.price.formatted || "";
    const isRecurring = priceFormatted.includes('/') || 
                        priceFormatted.toLowerCase().includes('month') ||
                        priceFormatted.toLowerCase().includes('year');
    
    setSelectedProduct(product);
    setIsRecurringProduct(isRecurring);

    // For subscriptions with auto-redeem enabled, skip the dialog and proceed directly
    if (isRecurring && autoRedeemEnabled) {
      proceedToCheckout(product, 0, true);
      return;
    }

    // Show PawBucks dialog for user to choose how many to use
    setShowPawBucksDialog(true);
  }, [merchantIdForProducts, user, navigate, autoRedeemEnabled]);

  // Proceeds to Stripe checkout with optional PawBucks
  const proceedToCheckout = useCallback(async (product: Product, pawbucksToUse: number, isAutoRedeem: boolean = false) => {
    if (!product.price?.id || !merchantIdForProducts) return;

    try {
      setPurchasingProductId(product.id);
      setShowPawBucksDialog(false);

      const { data, error } = await supabase.functions.invoke("create-connect-checkout", {
        body: {
          merchantId: merchantIdForProducts, // Pass merchantId, stripe_account_id resolved server-side
          priceId: product.price.id,
          quantity: 1,
          productName: product.name,
          successUrl: `${window.location.origin}/checkout-success?store=${accountId}`,
          cancelUrl: window.location.href,
          pawbucksToUse: isAutoRedeem ? undefined : pawbucksToUse,
        },
      });

      if (error) throw error;

      // Handle full PawBucks payment (no Stripe needed)
      if (data.paid_with_pawbucks) {
        toast.success(data.message || `Purchase completed with PawBucks!`);
        if (data.redirect_url) {
          window.location.href = data.redirect_url;
        }
        setPurchasingProductId(null);
        return;
      }

      if (data.checkout_url) {
        let message = "";
        if (data.pawbucks_applied) {
          message = `Applied ${data.pawbucks_applied.formatted}. `;
        }
        if (data.rewards?.estimated_pawbucks > 0) {
          message += `You'll earn ${data.rewards.formatted} on this purchase!`;
        }
        if (message) {
          toast.success(message, { duration: 2000 });
        }
        
        setTimeout(() => {
          window.location.href = data.checkout_url;
        }, 500);
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error: any) {
      console.error("Error creating checkout:", error);
      const errorMessage = error?.message || 
                          error?.error || 
                          (typeof error === 'string' ? error : 'Failed to start checkout');
      toast.error(errorMessage);
      setPurchasingProductId(null);
    }
  }, [merchantIdForProducts, accountId]);

  // Handler for PawBucks dialog confirmation
  const handlePawBucksDialogProceed = useCallback((pawbucksToUse: number) => {
    if (selectedProduct) {
      proceedToCheckout(selectedProduct, pawbucksToUse);
    }
  }, [selectedProduct, proceedToCheckout]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="relative overflow-hidden border-b">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
          <div className="container relative py-12">
            <Skeleton className="h-8 w-32 mb-6" />
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              <Skeleton className="h-24 w-24 rounded-2xl" />
              <div className="space-y-3 flex-1">
                <Skeleton className="h-10 w-72" />
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-96" />
              </div>
            </div>
          </div>
        </div>
        <div className="container py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <ProductSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <SEO 
        title={`${merchantName || "Store"} - Shop Products`}
        description={`Browse and purchase products from ${merchantName || "this store"}. Earn PawBucks on every purchase!`}
      />

      {/* Hero Header */}
      <div className="relative overflow-hidden border-b">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        
        <div className="container relative py-8 md:py-12">
          {merchantId && (
            <Link to={`/merchant/${merchantId}`}>
              <Button variant="ghost" size="sm" className="mb-6 -ml-2 hover:bg-primary/10 group">
                <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                Back to Profile
              </Button>
            </Link>
          )}
          
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
            {/* Left: Store Info */}
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              {/* Store Logo */}
              <Avatar className="h-24 w-24 rounded-2xl border-4 border-background shadow-xl ring-2 ring-primary/20">
                <AvatarImage 
                  src={merchantLogo || undefined} 
                  alt={merchantName}
                  className="object-cover"
                />
                <AvatarFallback className="rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-3xl font-bold">
                  {merchantName?.charAt(0) || <Store className="h-10 w-10" />}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
                      {merchantName || "Store"}
                    </h1>
                    {merchantBusinessType && (
                      <Badge variant="secondary" className="capitalize">
                        {merchantBusinessType.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-1">
                    Official Storefront
                  </p>
                </div>

                {merchantDescription && (
                  <p className="text-muted-foreground max-w-xl leading-relaxed">
                    {merchantDescription}
                  </p>
                )}

                {/* Store Meta */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {merchantAddress && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span className="truncate max-w-[200px]">{merchantAddress}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-primary" />
                    <span>Usually responds quickly</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Rewards & Trust */}
            <div className="flex flex-col gap-4 sm:items-end">
              {/* Rewards Badge */}
              <div className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/30">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Earn Rewards</p>
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                    Up to {cashbackRate * 3}x PawBucks
                  </p>
                </div>
              </div>

              {/* Trust Indicators */}
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 text-green-700 dark:text-green-400 text-sm">
                  <Shield className="h-4 w-4" />
                  Secure
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 text-sm">
                  <CreditCard className="h-4 w-4" />
                  Stripe
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm">
                  <Star className="h-4 w-4" />
                  Verified
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Products Section */}
      <div className="container py-10 md:py-14">
        {products.length === 0 && subscriptionPlans.length === 0 ? (
          <Card className="border-dashed border-2 bg-gradient-to-br from-muted/30 to-muted/50">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-muted to-muted/80 flex items-center justify-center mb-8 shadow-inner">
                <Package className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-2xl font-semibold mb-3">No products available yet</h3>
              <p className="text-muted-foreground text-center max-w-md mb-8">
                This store is setting up their catalog. Check back soon for amazing products!
              </p>
              {merchantId && (
                <Link to={`/merchant/${merchantId}`}>
                  <Button variant="outline" size="lg">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    View Merchant Profile
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Section Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold">Shop Products</h2>
                <p className="text-muted-foreground mt-1">
                  {products.length + subscriptionPlans.length} {(products.length + subscriptionPlans.length) === 1 ? 'item' : 'items'} available
                </p>
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {/* Subscription Plans */}
              {subscriptionPlans.map((plan) => {
                const formattedPrice = `$${(plan.amount / 100).toFixed(2)}`;
                const intervalLabel = plan.billing_interval_count === 1 
                  ? plan.billing_interval 
                  : `${plan.billing_interval_count} ${plan.billing_interval}s`;
                
                return (
                  <Card 
                    key={`plan-${plan.id}`}
                    className="group overflow-hidden hover:shadow-2xl transition-all duration-300 hover:border-primary/40 hover:-translate-y-1.5 bg-card/80 backdrop-blur-sm border-primary/20"
                  >
                    {/* Plan Header with Badge */}
                    <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <RefreshCw className="h-16 w-16 text-primary/40" />
                      <div className="absolute top-3 left-3">
                        <Badge className="bg-primary text-primary-foreground border-0">
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Subscription
                        </Badge>
                      </div>
                      {plan.trial_days > 0 && (
                        <div className="absolute top-3 right-3">
                          <Badge variant="outline" className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">
                            {plan.trial_days} day trial
                          </Badge>
                        </div>
                      )}
                    </div>

                    <CardHeader className="pb-2 pt-4">
                      <CardTitle className="line-clamp-1 text-lg group-hover:text-primary transition-colors">
                        {plan.name}
                      </CardTitle>
                      {plan.description && (
                        <CardDescription className="line-clamp-2 text-sm">
                          {plan.description}
                        </CardDescription>
                      )}
                    </CardHeader>

                    <CardContent className="space-y-4 pt-2">
                      {/* Price */}
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-foreground">{formattedPrice}</span>
                        <span className="text-muted-foreground">/ {intervalLabel}</span>
                      </div>

                      {/* Features */}
                      {plan.features.length > 0 && (
                        <ul className="space-y-1">
                          {plan.features.slice(0, 3).map((feature, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
                              <span className="line-clamp-1">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Subscribe Button */}
                      <Button
                        onClick={() => handleSubscribe(plan)}
                        className="w-full group/btn shadow-lg shadow-primary/20"
                        size="lg"
                      >
                        <CreditCard className="h-4 w-4 mr-2 group-hover/btn:scale-110 transition-transform" />
                        Subscribe
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}

              {/* One-time Products */}
              {products.map((product) => {
                const estimatedPawBucks = product.price?.unit_amount 
                  ? getEstimatedPawBucks(product.price.unit_amount / 100)
                  : 0;

                return (
                  <Card 
                    key={product.id} 
                    className="group overflow-hidden hover:shadow-2xl transition-all duration-300 hover:border-primary/40 hover:-translate-y-1.5 bg-card/80 backdrop-blur-sm"
                  >
                    {/* Product Image */}
                    <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-muted to-muted/50">
                      {product.images && product.images.length > 0 ? (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                          width={400}
                          height={400}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-16 w-16 text-muted-foreground/50" />
                        </div>
                      )}
                      
                      {/* Rewards Badge Overlay */}
                      {estimatedPawBucks > 0 && (
                        <div className="absolute top-3 right-3">
                          <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-lg">
                            <Sparkles className="h-3 w-3 mr-1" />
                            +{estimatedPawBucks} PB
                          </Badge>
                        </div>
                      )}
                    </div>

                    <CardHeader className="pb-2 pt-4">
                      <CardTitle className="line-clamp-1 text-lg group-hover:text-primary transition-colors">
                        {product.name}
                      </CardTitle>
                      {product.description && (
                        <CardDescription className="line-clamp-2 text-sm">
                          {product.description}
                        </CardDescription>
                      )}
                    </CardHeader>

                    <CardContent className="space-y-4 pt-2">
                      {/* Price */}
                      <div className="text-2xl font-bold text-foreground">
                        {product.price?.formatted || "N/A"}
                      </div>

                      {/* Buy Button */}
                      <Button
                        onClick={() => handlePurchase(product)}
                        disabled={!product.price || purchasingProductId === product.id}
                        className="w-full group/btn shadow-lg shadow-primary/20"
                        size="lg"
                      >
                        {purchasingProductId === product.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="h-4 w-4 mr-2 group-hover/btn:scale-110 transition-transform" />
                            Buy Now
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t bg-gradient-to-b from-card/80 to-card py-10 mt-16">
        <div className="container">
          <div className="flex flex-col items-center gap-6">
            {/* Store Logo in Footer */}
            <Avatar className="h-12 w-12 rounded-xl border-2 border-primary/20">
              <AvatarImage src={merchantLogo || undefined} alt={merchantName} />
              <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-bold">
                {merchantName?.charAt(0) || "S"}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="font-medium text-foreground">{merchantName}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Powered by PawBucks Marketplace
              </p>
            </div>

            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-green-600" />
                Secure Payments
              </span>
              <span className="text-border">•</span>
              <span className="flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-blue-600" />
                Powered by Stripe
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* PawBucks Checkout Dialog */}
      {selectedProduct && user && (
        <PawBucksCheckoutDialog
          open={showPawBucksDialog}
          onOpenChange={setShowPawBucksDialog}
          productName={selectedProduct.name}
          priceAmount={(selectedProduct.price?.unit_amount || 0) / 100}
          isRecurring={isRecurringProduct}
          merchantName={merchantName}
          merchantAcceptsPawBucks={merchantAcceptsPawBucks}
          cashbackRate={cashbackRate}
          userId={user.id}
          onProceed={handlePawBucksDialogProceed}
          isLoading={purchasingProductId === selectedProduct.id}
        />
      )}

      {/* Subscription Checkout Dialog */}
      {selectedPlan && connectedAccountId && merchantId && (
        <SubscriptionCheckoutDialog
          open={showSubDialog}
          onOpenChange={setShowSubDialog}
          plan={selectedPlan}
          merchantId={merchantId}
          merchantName={merchantName}
          connectedAccountId={connectedAccountId}
          merchantAcceptsPawBucks={merchantData?.acceptsPawBucks ?? false}
          cashbackRate={merchantData?.cashback_rate ?? 10}
          onSuccess={() => {
            setShowSubDialog(false);
            setSelectedPlan(null);
          }}
        />
      )}
    </div>
  );
});

Storefront.displayName = "Storefront";

export default Storefront;
