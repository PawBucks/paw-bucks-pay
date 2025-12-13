import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Package, Plus, ExternalLink, Loader2, ArrowLeft, DollarSign } from "lucide-react";
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

type Merchant = {
  id: string;
  business_name: string;
  stripe_account_id: string | null;
};

const MerchantProducts = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productPrice, setProductPrice] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadMerchantAndProducts();
    }
  }, [user]);

  const loadMerchantAndProducts = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Load merchant data
      const { data: merchantData, error: merchantError } = await supabase
        .from("merchants")
        .select("id, business_name, stripe_account_id")
        .eq("user_id", user.id)
        .single();

      if (merchantError) {
        throw merchantError;
      }

      if (!merchantData.stripe_account_id) {
        toast.error("Please connect your Stripe account first");
        navigate("/merchant-dashboard");
        return;
      }

      setMerchant(merchantData);

      // Load products
      await loadProducts(merchantData.stripe_account_id);
    } catch (error) {
      console.error("Error loading merchant data:", error);
      toast.error("Failed to load merchant data");
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async (accountId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Your session has expired. Please sign in again.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("list-connect-products", {
        body: { accountId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      setProducts(data.products || []);
    } catch (error) {
      console.error("Error loading products:", error);
      toast.error("Failed to load products");
    }
  };

  const handleCreateProduct = async () => {
    if (!merchant?.stripe_account_id) return;

    if (!productName || !productPrice) {
      toast.error("Please fill in all required fields");
      return;
    }

    const priceInCents = Math.round(parseFloat(productPrice) * 100);
    if (isNaN(priceInCents) || priceInCents < 50) {
      toast.error("Price must be at least $0.50");
      return;
    }

    try {
      setCreating(true);

      const { data, error } = await supabase.functions.invoke("create-connect-product", {
        body: {
          accountId: merchant.stripe_account_id,
          name: productName,
          description: productDescription,
          priceInCents,
          currency: "usd",
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Product created successfully!");
        setCreateDialogOpen(false);
        setProductName("");
        setProductDescription("");
        setProductPrice("");
        await loadProducts(merchant.stripe_account_id);
      } else {
        throw new Error(data.error || "Failed to create product");
      }
    } catch (error) {
      console.error("Error creating product:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create product");
    } finally {
      setCreating(false);
    }
  };

  const getStorefrontUrl = () => {
    if (!merchant?.stripe_account_id) return "";
    return `${window.location.origin}/storefront/${merchant.stripe_account_id}`;
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-6xl">
      <SEO 
        title="My Products - Merchant Dashboard"
        description="Manage your store products and view your storefront"
      />

      {/* Header */}
      <div className="flex items-start gap-3 mb-8">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/merchant-dashboard")}
          className="flex-shrink-0 mt-1"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">My Products</h1>
              <p className="text-muted-foreground text-sm sm:text-base mt-1">
                Manage your store products and pricing
              </p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)} className="flex-shrink-0">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Product</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Storefront Link Card */}
      {merchant?.stripe_account_id && (
        <Card className="mb-8 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Your Storefront
            </CardTitle>
            <CardDescription>
              Share this link with your customers to let them browse and purchase your products
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input
                value={getStorefrontUrl()}
                readOnly
                className="flex-1 font-mono text-sm"
              />
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(getStorefrontUrl());
                  toast.success("Link copied to clipboard!");
                }}
              >
                Copy
              </Button>
              <Button
                onClick={() => window.open(getStorefrontUrl(), "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Visit
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Products Grid */}
      {products.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No products yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first product to start selling
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Product
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <CardTitle className="line-clamp-1">{product.name}</CardTitle>
                {product.description && (
                  <CardDescription className="line-clamp-2">
                    {product.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-2xl font-bold text-primary">
                    <DollarSign className="h-6 w-6" />
                    {product.price?.formatted || "N/A"}
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    product.active 
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" 
                      : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"
                  }`}>
                    {product.active ? "Active" : "Inactive"}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Product Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Product</DialogTitle>
            <DialogDescription>
              Add a new product to your storefront
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g., Premium Dog Food"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="Describe your product..."
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="price">Price (USD) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0.50"
                value={productPrice}
                onChange={(e) => setProductPrice(e.target.value)}
                placeholder="10.00"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Minimum $0.50
              </p>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateProduct} disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Product"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MerchantProducts;
