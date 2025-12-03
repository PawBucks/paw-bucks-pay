import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ShoppingCart, Loader2, Store, ArrowLeft } from "lucide-react";
import { SEO } from "@/components/SEO";

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

const Storefront = () => {
  // NOTE: In a production app, you should use a more user-friendly identifier
  // like a custom domain, subdomain, or unique slug instead of the Stripe account ID
  const { accountId } = useParams<{ accountId: string }>();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [merchantName, setMerchantName] = useState<string>("");
  const [merchantId, setMerchantId] = useState<string | null>(null);
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

      // Load merchant info
      const { data: merchantData } = await supabase
        .from("merchants")
        .select("id, business_name")
        .eq("stripe_account_id", accountId)
        .single();

      if (merchantData) {
        setMerchantName(merchantData.business_name);
        setMerchantId(merchantData.id);
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

    try {
      setPurchasingProductId(product.id);

      const { data, error } = await supabase.functions.invoke("create-connect-checkout", {
        body: {
          accountId,
          priceId: product.price.id,
          quantity: 1,
          successUrl: `${window.location.origin}/checkout-success`,
          cancelUrl: window.location.href,
        },
      });

      if (error) throw error;

      if (data.checkout_url) {
        // Redirect to Stripe Checkout
        window.location.href = data.checkout_url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error) {
      console.error("Error creating checkout:", error);
      toast.error(error instanceof Error ? error.message : "Failed to start checkout");
      setPurchasingProductId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title={`${merchantName || "Store"} - Shop Products`}
        description={`Browse and purchase products from ${merchantName || "this store"}`}
      />

      {/* Header */}
      <div className="border-b bg-card">
        <div className="container py-6">
          {merchantId && (
            <Link to={`/merchant/${merchantId}`}>
              <Button variant="ghost" size="sm" className="mb-4 -ml-2">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Profile
              </Button>
            </Link>
          )}
          <div className="flex items-center gap-3 mb-2">
            <Store className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">
              {merchantName || "Store"}
            </h1>
          </div>
          <p className="text-muted-foreground">
            Browse our products and make secure purchases
          </p>
        </div>
      </div>

      {/* Products */}
      <div className="container py-8">
        {products.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Store className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No products available</h3>
              <p className="text-muted-foreground text-center">
                This store hasn't added any products yet
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <Card 
                key={product.id} 
                className="overflow-hidden hover:shadow-lg transition-all hover:border-primary/50"
              >
                <CardHeader className="pb-4">
                  <CardTitle className="line-clamp-1">{product.name}</CardTitle>
                  {product.description && (
                    <CardDescription className="line-clamp-2">
                      {product.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-3xl font-bold text-primary">
                      {product.price?.formatted || "N/A"}
                    </div>
                  </div>
                  <Button
                    onClick={() => handlePurchase(product)}
                    disabled={!product.price || purchasingProductId === product.id}
                    className="w-full"
                  >
                    {purchasingProductId === product.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Buy Now
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Secure checkout with Stripe
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Footer Note */}
      <div className="border-t bg-muted/30 py-8 mt-12">
        <div className="container text-center text-sm text-muted-foreground">
          <p>
            Powered by PawBucks Marketplace • Secure payments by Stripe
          </p>
        </div>
      </div>
    </div>
  );
};

export default Storefront;
