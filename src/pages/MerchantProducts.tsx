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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Package, Plus, ExternalLink, Loader2, ArrowLeft, DollarSign, Store, Coins, RefreshCw, Trash2 } from "lucide-react";
import { PricingCalculator } from "@/components/merchant/PricingCalculator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
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
  is_active: boolean;
  stripe_price_id: string | null;
};

type Merchant = {
  id: string;
  business_name: string;
  stripe_account_id: string | null;
  storefront_slug: string | null;
};

const MerchantProducts = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productItemType, setProductItemType] = useState<"product" | "service">("product");
  const [listInPetStore, setListInPetStore] = useState(false);
  const [pawbucksPrice, setPawbucksPrice] = useState("");

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
        .select("id, business_name, stripe_account_id, storefront_slug")
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

      // Load products and subscription plans in parallel
      await Promise.all([
        loadProducts(merchantData.stripe_account_id),
        loadSubscriptionPlans(merchantData.id),
      ]);
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

  const loadSubscriptionPlans = async (merchantId: string) => {
    try {
      const { data, error } = await merchantSubscriptionPlansService.getMyPlans(merchantId);
      if (error) throw error;
      setSubscriptionPlans(data || []);
    } catch (error) {
      console.error("Error loading subscription plans:", error);
    }
  };

  const formatInterval = (interval: string, count: number) => {
    const labels: Record<string, [string, string]> = {
      day: ["day", "days"],
      week: ["week", "weeks"],
      month: ["month", "months"],
      year: ["year", "years"],
    };
    const [singular, plural] = labels[interval] || ["period", "periods"];
    return count === 1 ? `per ${singular}` : `every ${count} ${plural}`;
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

    // Validate PawBucks price if listing in Pet Store
    if (listInPetStore) {
      const pawbucksPriceNum = parseInt(pawbucksPrice);
      if (isNaN(pawbucksPriceNum) || pawbucksPriceNum < 1) {
        toast.error("PawBucks price must be at least 1");
        return;
      }
    }

    try {
      setCreating(true);

      // Create the Stripe Connect product
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
        // If listing in Pet Store, also create a pet_store_items entry
        if (listInPetStore) {
          const { error: petStoreError } = await supabase
            .from("pet_store_items")
            .insert({
              name: productName,
              description: productDescription || null,
              category: "Merchant Products",
              item_type: productItemType,
              price: priceInCents,
              price_pawbucks: parseInt(pawbucksPrice),
              merchant_id: merchant.id,
              is_active: true,
              stock_quantity: 999,
            });

          if (petStoreError) {
            console.error("Error listing in Pet Store:", petStoreError);
            toast.error("Product created but failed to list in Pet Store");
          } else {
            toast.success("Product created and listed in Pet Store!");
          }
        } else {
          toast.success("Product created successfully!");
        }

        setCreateDialogOpen(false);
        setProductName("");
        setProductDescription("");
        setProductPrice("");
        setProductItemType("product");
        setListInPetStore(false);
        setPawbucksPrice("");
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
    if (!merchant?.storefront_slug) return "";
    return `${window.location.origin}/storefront/${merchant.storefront_slug}`;
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete || !merchant?.stripe_account_id) return;
    
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-connect-product", {
        body: {
          productId: productToDelete.id,
          accountId: merchant.stripe_account_id,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Product deleted successfully");
        setProducts(products.filter(p => p.id !== productToDelete.id));
      } else {
        throw new Error(data.error || "Failed to delete product");
      }
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete product");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setProductToDelete(null);
    }
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
      {merchant?.storefront_slug && (
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
          <CardContent className="space-y-4">
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
            <p className="text-xs text-muted-foreground">
              Your storefront URL is: <span className="font-mono text-foreground">/storefront/{merchant.storefront_slug}</span>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Products Grid */}
      {products.length === 0 && subscriptionPlans.length === 0 ? (
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
          {/* Subscription Plans */}
          {subscriptionPlans.map((plan) => (
            <Card key={`plan-${plan.id}`} className="overflow-hidden hover:shadow-lg transition-shadow border-primary/20">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="gap-1 text-xs">
                    <RefreshCw className="h-3 w-3" />
                    Subscription
                  </Badge>
                </div>
                <CardTitle className="line-clamp-1">{plan.name}</CardTitle>
                {plan.description && (
                  <CardDescription className="line-clamp-2">
                    {plan.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-1">
                    <div className="flex items-center gap-1 text-2xl font-bold text-primary">
                      <DollarSign className="h-5 w-5" />
                      {(plan.amount / 100).toFixed(2)}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatInterval(plan.billing_interval, plan.billing_interval_count)}
                    </span>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    plan.is_active 
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" 
                      : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"
                  }`}>
                    {plan.is_active ? "Active" : "Inactive"}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* One-time Products */}
          {products.map((product) => (
            <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="line-clamp-1">{product.name}</CardTitle>
                    {product.description && (
                      <CardDescription className="line-clamp-2">
                        {product.description}
                      </CardDescription>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                    onClick={() => {
                      setProductToDelete(product);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
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
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g., Premium Dog Food"
              />
            </div>
            <div>
              <Label htmlFor="item-type">Type *</Label>
              <Select value={productItemType} onValueChange={(v: "product" | "service") => setProductItemType(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                </SelectContent>
              </Select>
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

            {/* Fee Recovery Calculator */}
            <PricingCalculator 
              compact 
              onApplyPrice={(price) => setProductPrice(price)} 
            />

            {/* Pet Store Listing Toggle */}
            <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Store className="h-5 w-5 text-primary" />
                  <div>
                    <Label htmlFor="pet-store-toggle" className="font-medium">
                      List in Pet Store
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Make this product available in the platform's Pet Store
                    </p>
                  </div>
                </div>
                <Switch
                  id="pet-store-toggle"
                  checked={listInPetStore}
                  onCheckedChange={setListInPetStore}
                />
              </div>

              {listInPetStore && (
                <div className="pt-2 border-t space-y-3">
                  <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                    <Coins className="h-4 w-4" />
                    <span>Products in Pet Store must accept both USD and PawBucks</span>
                  </div>
                  <div>
                    <Label htmlFor="pawbucks-price">PawBucks Price *</Label>
                    <Input
                      id="pawbucks-price"
                      type="number"
                      min="1"
                      value={pawbucksPrice}
                      onChange={(e) => setPawbucksPrice(e.target.value)}
                      placeholder="10000"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      1,000 PawBucks = $1 value. Suggested: {productPrice ? Math.round(parseFloat(productPrice) * 1000) : "—"} PawBucks
                    </p>
                  </div>
                </div>
              )}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive "{productToDelete?.name}" and remove it from your storefront. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProduct}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MerchantProducts;
