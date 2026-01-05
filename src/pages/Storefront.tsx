import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShoppingCart, Loader2, Store, ArrowLeft, Sparkles, Shield, CreditCard, Package, Star, MapPin, Clock } from "lucide-react";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PawBucksCheckoutDialog } from "@/components/PawBucksCheckoutDialog";

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

const ProductSkeleton = () => (
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
);

const Storefront = () => {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [merchantName, setMerchantName] = useState<string>("");
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [merchantDescription, setMerchantDescription] = useState<string>("");
  const [merchantLogo, setMerchantLogo] = useState<string | null>(null);
  const [merchantAddress, setMerchantAddress] = useState<string | null>(null);
  const [merchantBusinessType, setMerchantBusinessType] = useState<string | null>(null);
  const [cashbackRate, setCashbackRate] = useState<number>(10);
  const [purchasingProductId, setPurchasingProductId] = useState<string | null>(null);
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [merchantAcceptsPawBucks, setMerchantAcceptsPawBucks] = useState<boolean>(false);
  
  // PawBucks checkout dialog state
  const [showPawBucksDialog, setShowPawBucksDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isRecurringProduct, setIsRecurringProduct] = useState(false);
  const [autoRedeemEnabled, setAutoRedeemEnabled] = useState(false);

  useEffect(() => {
    if (accountId) {
      loadStorefront();
    }
  }, [accountId]);

  // Load user's auto-redeem preference
  useEffect(() => {
    if (user?.id) {
      loadAutoRedeemPreference();
    }
  }, [user?.id]);

  const loadAutoRedeemPreference = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('profiles')
      .select('auto_redeem_pawbucks')
      .eq('id', user.id)
      .single();
    setAutoRedeemEnabled(data?.auto_redeem_pawbucks || false);
  };

  const loadStorefront = async () => {
    if (!accountId) return;

    try {
      setLoading(true);

      // First, try to find merchant by storefront_slug
      const { data: merchantBySlug } = await supabase
        .from('merchants_public')
        .select('id, business_name, description, cashback_rate, storefront_slug, logo_url, address, business_type')
        .eq('storefront_slug', accountId)
        .maybeSingle();

      let resolvedMerchantId: string | null = null;
      let resolvedStripeAccountId: string | null = accountId;

      if (merchantBySlug) {
        // Found by slug - need to get stripe_account_id from edge function
        setMerchantName(merchantBySlug.business_name || "");
        setMerchantId(merchantBySlug.id);
        setMerchantDescription(merchantBySlug.description || "");
        setMerchantLogo(merchantBySlug.logo_url);
        setMerchantAddress(merchantBySlug.address);
        setMerchantBusinessType(merchantBySlug.business_type);
        setCashbackRate(merchantBySlug.cashback_rate || 10);
        resolvedMerchantId = merchantBySlug.id;

        // Get stripe account ID and accepts_pawbucks via edge function
        const { data: connectStatus } = await supabase.functions.invoke("get-connect-account-status", {
          body: { merchantId: merchantBySlug.id },
        });
        
        if (connectStatus?.accountId) {
          resolvedStripeAccountId = connectStatus.accountId;
          setStripeAccountId(connectStatus.accountId);
        }
        if (connectStatus?.acceptsPawBucks !== undefined) {
          setMerchantAcceptsPawBucks(connectStatus.acceptsPawBucks);
        }
      } else {
        // Fall back to looking up by stripe_account_id (for backward compatibility)
        const { data: connectStatus } = await supabase.functions.invoke("get-connect-account-status", {
          body: { stripeAccountId: accountId },
        });

        if (connectStatus?.merchantName) {
          setMerchantName(connectStatus.merchantName);
          setMerchantId(connectStatus.merchantId);
          resolvedMerchantId = connectStatus.merchantId;
          resolvedStripeAccountId = accountId;
          setStripeAccountId(accountId);
        }
        if (connectStatus?.acceptsPawBucks !== undefined) {
          setMerchantAcceptsPawBucks(connectStatus.acceptsPawBucks);
        }

        // Get additional merchant info
        if (connectStatus?.merchantId) {
          const { data: merchantData } = await supabase
            .from('merchants_public')
            .select('description, cashback_rate, logo_url, address, business_type')
            .eq('id', connectStatus.merchantId)
            .single();

          if (merchantData) {
            setMerchantDescription(merchantData.description || "");
            setMerchantLogo(merchantData.logo_url);
            setMerchantAddress(merchantData.address);
            setMerchantBusinessType(merchantData.business_type);
            setCashbackRate(merchantData.cashback_rate || 10);
          }
        }
      }

      // Load products using the resolved stripe account ID
      if (resolvedStripeAccountId) {
        const { data, error } = await supabase.functions.invoke("list-connect-products", {
          body: { accountId: resolvedStripeAccountId },
        });

        if (error) throw error;
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error("Error loading storefront:", error);
      toast.error("Failed to load storefront");
    } finally {
      setLoading(false);
    }
  };

  // Initiates purchase - shows PawBucks dialog if applicable
  const handlePurchase = (product: Product) => {
    const effectiveAccountId = stripeAccountId || accountId;
    if (!product.price?.id || !effectiveAccountId) return;

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
    // We infer this from the price format - if it shows /month, /year, etc.
    const priceFormatted = product.price.formatted || "";
    const isRecurring = priceFormatted.includes('/') || 
                        priceFormatted.toLowerCase().includes('month') ||
                        priceFormatted.toLowerCase().includes('year');
    
    setSelectedProduct(product);
    setIsRecurringProduct(isRecurring);

    // For subscriptions with auto-redeem enabled, skip the dialog and proceed directly
    // The edge function will automatically apply PawBucks
    if (isRecurring && autoRedeemEnabled) {
      proceedToCheckout(product, 0, true);
      return;
    }

    // Show PawBucks dialog for user to choose how many to use
    setShowPawBucksDialog(true);
  };

  // Proceeds to Stripe checkout with optional PawBucks
  const proceedToCheckout = async (product: Product, pawbucksToUse: number, isAutoRedeem: boolean = false) => {
    const effectiveAccountId = stripeAccountId || accountId;
    if (!product.price?.id || !effectiveAccountId) return;

    try {
      setPurchasingProductId(product.id);
      setShowPawBucksDialog(false);

      const { data, error } = await supabase.functions.invoke("create-connect-checkout", {
        body: {
          accountId: effectiveAccountId,
          priceId: product.price.id,
          quantity: 1,
          productName: product.name,
          successUrl: `${window.location.origin}/checkout-success?store=${accountId}`,
          cancelUrl: window.location.href,
          // Pass manual PawBucks amount if not using auto-redeem
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
        // Show rewards info before redirect
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
        
        // Short delay to show the toast, then redirect
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
  };

  // Handler for PawBucks dialog confirmation
  const handlePawBucksDialogProceed = (pawbucksToUse: number) => {
    if (selectedProduct) {
      proceedToCheckout(selectedProduct, pawbucksToUse);
    }
  };

  // Calculate estimated PawBucks for a product
  // Base multiplier is 10x ($1 = 10 PawBucks), users may get more with subscriptions (20x or 30x)
  const getEstimatedPawBucks = (price: number) => {
    return Math.floor(price * cashbackRate);
  };

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
        {products.length === 0 ? (
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
                  {products.length} {products.length === 1 ? 'product' : 'products'} available
                </p>
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
    </div>
  );
};

export default Storefront;
