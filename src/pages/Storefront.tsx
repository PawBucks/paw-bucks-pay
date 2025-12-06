import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShoppingCart, Loader2, Store, ArrowLeft, Sparkles, Shield, CreditCard, Package } from "lucide-react";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [cashbackRate, setCashbackRate] = useState<number>(10);
  const [purchasingProductId, setPurchasingProductId] = useState<string | null>(null);

  useEffect(() => {
    if (accountId) {
      loadStorefront();
    }
  }, [accountId]);

  const loadStorefront = async () => {
    if (!accountId) return;

    try {
      setLoading(true);

      // Load merchant info from base table via edge function
      const { data: connectStatus } = await supabase.functions.invoke("get-connect-account-status", {
        body: { stripeAccountId: accountId },
      });

      if (connectStatus?.merchantName) {
        setMerchantName(connectStatus.merchantName);
        setMerchantId(connectStatus.merchantId);
      }

      // Get additional merchant info
      if (connectStatus?.merchantId) {
        const { data: merchantData } = await supabase
          .from('merchants_public')
          .select('description, cashback_rate')
          .eq('id', connectStatus.merchantId)
          .single();

        if (merchantData) {
          setMerchantDescription(merchantData.description || "");
          setCashbackRate(merchantData.cashback_rate || 10);
        }
      }

      // Load products
      const { data, error } = await supabase.functions.invoke("list-connect-products", {
        body: { accountId },
      });

      if (error) throw error;

      setProducts(data.products || []);
    } catch (error) {
      console.error("Error loading storefront:", error);
      toast.error("Failed to load storefront");
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (product: Product) => {
    if (!product.price?.id || !accountId) return;

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

    try {
      setPurchasingProductId(product.id);

      const { data, error } = await supabase.functions.invoke("create-connect-checkout", {
        body: {
          accountId,
          priceId: product.price.id,
          quantity: 1,
          productName: product.name,
          successUrl: `${window.location.origin}/checkout-success?store=${accountId}`,
          cancelUrl: window.location.href,
        },
      });

      if (error) throw error;

      if (data.checkout_url) {
        // Show rewards info before redirect
        if (data.rewards?.estimated_pawbucks > 0) {
          toast.success(`You'll earn ${data.rewards.formatted} on this purchase!`, {
            duration: 2000,
          });
        }
        
        // Short delay to show the toast, then redirect
        setTimeout(() => {
          window.location.href = data.checkout_url;
        }, 500);
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error) {
      console.error("Error creating checkout:", error);
      toast.error(error instanceof Error ? error.message : "Failed to start checkout");
      setPurchasingProductId(null);
    }
  };

  // Calculate estimated PawBucks for a product (simplified - actual calculation happens server-side)
  const getEstimatedPawBucks = (price: number) => {
    // Base rate is 10x, users may get more with subscriptions
    return Math.floor(price * 0.10 * 10); // 10% * $1 = 10 PawBucks base
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card/80 backdrop-blur-sm">
          <div className="container py-8">
            <Skeleton className="h-8 w-32 mb-4" />
            <div className="flex items-center gap-3 mb-2">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-10 w-64" />
            </div>
            <Skeleton className="h-5 w-96 mt-2" />
          </div>
        </div>
        <div className="container py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
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
      <div className="border-b bg-gradient-to-r from-card via-card to-primary/5">
        <div className="container py-8 md:py-12">
          {merchantId && (
            <Link to={`/merchant/${merchantId}`}>
              <Button variant="ghost" size="sm" className="mb-4 -ml-2 hover:bg-primary/10">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Profile
              </Button>
            </Link>
          )}
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
                  <Store className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
                    {merchantName || "Store"}
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    Official Storefront
                  </p>
                </div>
              </div>
              {merchantDescription && (
                <p className="text-muted-foreground max-w-xl">
                  {merchantDescription}
                </p>
              )}
            </div>

            {/* Rewards Badge */}
            <div className="flex items-center gap-2">
              <Badge 
                variant="outline" 
                className="px-4 py-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Earn up to {cashbackRate * 3}x PawBucks
              </Badge>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap gap-4 mt-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-600" />
              Secure checkout
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-600" />
              Stripe payments
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600" />
              PawBucks rewards
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="container py-8 md:py-12">
        {products.length === 0 ? (
          <Card className="border-dashed border-2 bg-muted/30">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-6">
                <Package className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No products available</h3>
              <p className="text-muted-foreground text-center max-w-md">
                This store hasn't added any products yet. Check back soon!
              </p>
              {merchantId && (
                <Link to={`/merchant/${merchantId}`} className="mt-6">
                  <Button variant="outline">
                    View Merchant Profile
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">
                {products.length} {products.length === 1 ? 'Product' : 'Products'} Available
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => {
                const estimatedPawBucks = product.price?.unit_amount 
                  ? getEstimatedPawBucks(product.price.unit_amount / 100)
                  : 0;

                return (
                  <Card 
                    key={product.id} 
                    className="group overflow-hidden hover:shadow-xl transition-all duration-300 hover:border-primary/50 hover:-translate-y-1"
                  >
                    {/* Product Image */}
                    {product.images && product.images.length > 0 && (
                      <div className="aspect-video overflow-hidden bg-muted">
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          width={400}
                          height={225}
                        />
                      </div>
                    )}

                    <CardHeader className="pb-3">
                      <CardTitle className="line-clamp-1 group-hover:text-primary transition-colors">
                        {product.name}
                      </CardTitle>
                      {product.description && (
                        <CardDescription className="line-clamp-2">
                          {product.description}
                        </CardDescription>
                      )}
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Price and Rewards */}
                      <div className="flex items-end justify-between">
                        <div className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                          {product.price?.formatted || "N/A"}
                        </div>
                        {estimatedPawBucks > 0 && (
                          <Badge 
                            variant="secondary" 
                            className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            +{estimatedPawBucks} PB
                          </Badge>
                        )}
                      </div>

                      {/* Buy Button */}
                      <Button
                        onClick={() => handlePurchase(product)}
                        disabled={!product.price || purchasingProductId === product.id}
                        className="w-full group/btn"
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

                      <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                        <Shield className="h-3 w-3" />
                        Secure checkout with Stripe
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t bg-card/50 backdrop-blur-sm py-8 mt-auto">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Powered by PawBucks Marketplace
            </p>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Shield className="h-4 w-4" />
                Secure Payments
              </span>
              <span>•</span>
              <span>Powered by Stripe</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Storefront;
