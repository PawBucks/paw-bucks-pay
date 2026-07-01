import { useEffect, useState } from"react";
import { useNavigate } from"react-router-dom";
import { useAuth } from"@/hooks/useAuth";
import { supabase } from"@/integrations/supabase/client";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Textarea } from"@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogHeader,
 DialogTitle,
} from"@/components/ui/dialog";
import {
 AlertDialog,
 AlertDialogAction,
 AlertDialogCancel,
 AlertDialogContent,
 AlertDialogDescription,
 AlertDialogFooter,
 AlertDialogHeader,
 AlertDialogTitle,
} from"@/components/ui/alert-dialog";
import { toast } from"sonner";
import { ArrowLeft, DollarSign, ExternalLink, Loader2, Package, Pencil, Plus, RefreshCw, Store, Trash2, Upload } from "lucide-react";
import { ImportProductsDialog } from "@/components/merchant/ImportProductsDialog";
import { ProductImageUpload } from"@/components/shared/ProductImageUpload";
import { PricingCalculator } from"@/components/merchant/PricingCalculator";
import { MerchantWorkspaceLayout, WorkspacePageHeader } from "@/components/merchant/workspace/MerchantWorkspaceLayout";
import { Switch } from"@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from"@/components/ui/select";
import { SEO } from"@/components/SEO";
import { Badge } from"@/components/ui/badge";
import { merchantSubscriptionPlansService } from"@/services/api/merchantSubscriptionPlans.service";
import { buildAppUrl } from"@/lib/url";

import { Formatters } from "@/utils/formatters";
import { PawBucksLogo } from "@/components/PawBucksLogo";
import { BrandSelector } from "@/components/brand/BrandSelector";
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
  const [importDialogOpen, setImportDialogOpen] = useState(false);
 const [creating, setCreating] = useState(false);
 const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
 const [productToDelete, setProductToDelete] = useState<Product | null>(null);
 const [deleting, setDeleting] = useState(false);
 const [editDialogOpen, setEditDialogOpen] = useState(false);
 const [editingProduct, setEditingProduct] = useState<Product | null>(null);
 const [editName, setEditName] = useState("");
 const [editDescription, setEditDescription] = useState("");
 const [editPrice, setEditPrice] = useState("");
 const [editActive, setEditActive] = useState(true);
 const [updating, setUpdating] = useState(false);

 // Subscription plan edit/delete state
 const [editPlanDialogOpen, setEditPlanDialogOpen] = useState(false);
 const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
 const [planName, setPlanName] = useState("");
 const [planDescription, setPlanDescription] = useState("");
 const [planPrice, setPlanPrice] = useState("");
 const [planActive, setPlanActive] = useState(true);
 const [updatingPlan, setUpdatingPlan] = useState(false);
 const [deletePlanDialogOpen, setDeletePlanDialogOpen] = useState(false);
 const [planToDelete, setPlanToDelete] = useState<SubscriptionPlan | null>(null);
 const [deletingPlan, setDeletingPlan] = useState(false);

 const openEditPlanDialog = (plan: SubscriptionPlan) => {
 setEditingPlan(plan);
 setPlanName(plan.name);
 setPlanDescription(plan.description ||"");
 setPlanPrice(Formatters.money((plan.amount / 100)));
 setPlanActive(plan.is_active);
 setEditPlanDialogOpen(true);
 };

 const handleUpdatePlan = async () => {
 if (!editingPlan || !merchant) return;
 if (!planName.trim()) {
 toast.error("Plan name is required");
 return;
 }
 const amountCents = Math.round(parseFloat(planPrice) * 100);
 if (isNaN(amountCents) || amountCents < 50) {
 toast.error("Price must be at least $0.50");
 return;
 }
 setUpdatingPlan(true);
 try {
 const { error } = await merchantSubscriptionPlansService.update(editingPlan.id, {
 name: planName.trim(),
 description: planDescription.trim(),
 amount: amountCents,
 isActive: planActive,
 });
 if (error) throw error;
 toast.success("Subscription plan updated");
 setEditPlanDialogOpen(false);
 setEditingPlan(null);
 await loadSubscriptionPlans(merchant.id);
 } catch (error) {
 console.error("Error updating plan:", error);
 toast.error(error instanceof Error ? error.message :"Failed to update plan");
 } finally {
 setUpdatingPlan(false);
 }
 };

 const handleDeletePlan = async () => {
 if (!planToDelete || !merchant) return;
 setDeletingPlan(true);
 try {
 const { error } = await merchantSubscriptionPlansService.delete(planToDelete.id);
 if (error) throw error;
 toast.success("Subscription plan deleted");
 setSubscriptionPlans(subscriptionPlans.filter((p) => p.id !== planToDelete.id));
 } catch (error) {
 console.error("Error deleting plan:", error);
 toast.error(error instanceof Error ? error.message :"Failed to delete plan");
 } finally {
 setDeletingPlan(false);
 setDeletePlanDialogOpen(false);
 setPlanToDelete(null);
 }
 };

 // Form state
 const [productName, setProductName] = useState("");
 const [productDescription, setProductDescription] = useState("");
 const [productPrice, setProductPrice] = useState("");
 const [productItemType, setProductItemType] = useState<"product" |"service">("product");
 const [listInPetStore, setListInPetStore] = useState(false);
 const [pawbucksPrice, setPawbucksPrice] = useState("");
 const [productImageUrls, setProductImageUrls] = useState<string[]>([]);
 const [productSku, setProductSku] = useState("");
 const [productBrandId, setProductBrandId] = useState<string | null>(null);

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
 loadProducts(merchantData.id),
 loadSubscriptionPlans(merchantData.id),
 ]);
 } catch (error) {
 console.error("Error loading merchant data:", error);
 toast.error("Failed to load merchant data");
 } finally {
 setLoading(false);
 }
 };

 const loadProducts = async (merchantId: string) => {
 try {
 const { data: { session } } = await supabase.auth.getSession();

 if (!session) {
 toast.error("Your session has expired. Please sign in again.");
 return;
 }

 const { data, error } = await supabase.functions.invoke("list-connect-products", {
 body: { merchantId },
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
 day: ["day","days"],
 week: ["week","weeks"],
 month: ["month","months"],
 year: ["year","years"],
 };
 const [singular, plural] = labels[interval] || ["period","periods"];
 return count === 1 ? `per ${singular}` : `every ${count} ${plural}`;
 };

 const handleCreateProduct = async () => {
 if (!merchant?.stripe_account_id) return;

 if (!productName || !productPrice) {
 toast.error("Please fill in all required fields");
 return;
 }

 const skuTrimmed = productSku.trim();
 if (!skuTrimmed) {
   toast.error("SKU / Item number is required");
   return;
 }
 if (skuTrimmed.length > 64) {
   toast.error("SKU must be 64 characters or fewer");
   return;
 }

 const priceInCents = Math.round(parseFloat(productPrice) * 100);
 if (isNaN(priceInCents) || priceInCents < 50) {
 toast.error("Price must be at least $0.50");
 return;
 }

 // Validate PawBucks price if listing in Marketplace
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
 currency:"usd",
 imageUrl: productImageUrls[0] || undefined,
          imageUrls: productImageUrls,
 },
 });

 if (error) throw error;

 if (data.success) {
 // If listing in Marketplace, also create a pet_store_items entry
 if (listInPetStore) {
 const { error: petStoreError } = await supabase
 .from("pet_store_items")
 .insert({
 name: productName,
 description: productDescription || null,
 category:"Merchant Products",
 item_type: productItemType,
 price: priceInCents,
 price_pawbucks: parseInt(pawbucksPrice),
 merchant_id: merchant.id,
 is_active: true,
 stock_quantity: 999,
 image_url: productImageUrls[0] || null,
 image_urls: productImageUrls,
 sku: skuTrimmed,
 brand_id: productBrandId,
 });

 if (petStoreError) {
 console.error("Error listing in Marketplace:", petStoreError);
 toast.error("Product created but failed to list in Marketplace");
 } else {
 toast.success("Product created and listed in Marketplace!");
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
 setProductImageUrls([]);
 setProductSku("");
 setProductBrandId(null);
 await loadProducts(merchant.id);
 } else {
 throw new Error(data.error ||"Failed to create product");
 }
 } catch (error) {
 console.error("Error creating product:", error);
 toast.error(error instanceof Error ? error.message :"Failed to create product");
 } finally {
 setCreating(false);
 }
 };

 const getStorefrontUrl = () => {
 if (!merchant?.storefront_slug) return"";
 return buildAppUrl(`/storefront/${merchant.storefront_slug}`);
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
 throw new Error(data.error ||"Failed to delete product");
 }
 } catch (error) {
 console.error("Error deleting product:", error);
 toast.error(error instanceof Error ? error.message :"Failed to delete product");
 } finally {
 setDeleting(false);
 setDeleteDialogOpen(false);
 setProductToDelete(null);
 }
 };

 const openEditDialog = (product: Product) => {
 setEditingProduct(product);
 setEditName(product.name);
 setEditDescription(product.description ||"");
 setEditPrice(product.price?.unit_amount ? Formatters.money((product.price.unit_amount / 100)) :"");
 setEditActive(product.active);
 setEditDialogOpen(true);
 };

 const handleUpdateProduct = async () => {
 if (!editingProduct || !merchant?.stripe_account_id) return;
 if (!editName.trim()) {
 toast.error("Product name is required");
 return;
 }
 const priceInCents = editPrice ? Math.round(parseFloat(editPrice) * 100) : null;
 if (priceInCents !== null && (isNaN(priceInCents) || priceInCents < 50)) {
 toast.error("Price must be at least $0.50");
 return;
 }
 const priceChanged = priceInCents !== null && priceInCents !== (editingProduct.price?.unit_amount ?? null);

 setUpdating(true);
 try {
 const { data, error } = await supabase.functions.invoke("update-connect-product", {
 body: {
 productId: editingProduct.id,
 accountId: merchant.stripe_account_id,
 name: editName.trim(),
 description: editDescription.trim(),
 active: editActive,
 ...(priceChanged ? { priceInCents, currency: editingProduct.price?.currency ||"usd" } : {}),
 },
 });
 if (error) throw error;
 if (!data?.success) throw new Error(data?.error ||"Failed to update product");

 toast.success("Product updated successfully");
 setEditDialogOpen(false);
 setEditingProduct(null);
 await loadProducts(merchant.id);
 } catch (error) {
 console.error("Error updating product:", error);
 toast.error(error instanceof Error ? error.message :"Failed to update product");
 } finally {
 setUpdating(false);
 }
 };

 if (authLoading || loading) {
 return (
 <MerchantWorkspaceLayout>
   <WorkspacePageHeader section="Catalog & Services" title="My Products" subtitle="Manage your store products and pricing" />
   <div className="flex items-center justify-center py-24">
     <Loader2 className="h-8 w-8 animate-spin text-primary" />
   </div>
 </MerchantWorkspaceLayout>
 );
 }

 return (
 <MerchantWorkspaceLayout>
   <SEO title="My Products · Merchant Workspace" description="Manage your store products and view your storefront" />
   <WorkspacePageHeader
     section="Catalog & Services"
     title="My Products"
     subtitle="Manage your store products and pricing"
     actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Import</span>
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Add Product</span>
          </Button>
        </div>
     }
   />
   <div className="p-4 md:p-6 max-w-6xl mx-auto w-full">

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
 onClick={() => window.open(getStorefrontUrl(),"_blank")}
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
 <Package className="h-12 w-12 text-muted-foreground mb-4" aria-hidden="true" />
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
 <div className="flex items-start justify-between gap-2">
 <div className="flex-1 min-w-0">
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
 </div>
 <div className="flex items-center gap-1 flex-shrink-0">
 <Button
 variant="outline"
 size="sm"
 className="h-8 gap-1 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
 onClick={() => openEditPlanDialog(plan)}
 aria-label="Edit plan"
 >
 <Pencil className="h-3.5 w-3.5" />
 <span className="text-xs font-medium">Edit</span>
 </Button>
 <Button
 variant="ghost"
 size="icon"
 className="h-8 w-8 text-muted-foreground hover:text-destructive"
 onClick={() => {
 setPlanToDelete(plan);
 setDeletePlanDialogOpen(true);
 }}
 aria-label="Delete plan"
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 </div>
 </div>
 </CardHeader>
 <CardContent>
 <div className="flex items-center justify-between">
 <div className="flex items-baseline gap-1">
 <div className="flex items-center gap-1 text-2xl font-bold text-primary">
 <DollarSign className="h-5 w-5" aria-hidden="true" />
 {Formatters.money((plan.amount / 100))}
 </div>
 <span className="text-sm text-muted-foreground">
 {formatInterval(plan.billing_interval, plan.billing_interval_count)}
 </span>
 </div>
 <div className={`px-3 py-1 rounded-full text-xs font-medium ${
 plan.is_active 
 ?"bg-success/15 text-success" 
 :"bg-muted text-muted-foreground"
 }`}>
 {plan.is_active ?"Active" :"Inactive"}
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
 <div className="flex items-center gap-1 flex-shrink-0 ml-2">
 <Button
 variant="outline"
 size="sm"
 className="h-8 gap-1 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
 onClick={() => openEditDialog(product)}
 aria-label="Edit product"
 >
 <Pencil className="h-3.5 w-3.5" />
 <span className="text-xs font-medium">Edit</span>
 </Button>
 <Button
 variant="ghost"
 size="icon"
 className="h-8 w-8 text-muted-foreground hover:text-destructive"
 onClick={() => {
 setProductToDelete(product);
 setDeleteDialogOpen(true);
 }}
 aria-label="Delete product"
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 </div>
 </div>
 </CardHeader>
 <CardContent>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2 text-2xl font-bold text-primary">
 <DollarSign className="h-6 w-6" aria-hidden="true" />
 {product.price?.formatted ||"N/A"}
 </div>
 <div className={`px-3 py-1 rounded-full text-xs font-medium ${
 product.active 
 ?"bg-success/15 text-success" 
 :"bg-muted text-muted-foreground"
 }`}>
 {product.active ?"Active" :"Inactive"}
 </div>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 )}

 {/* Create Product Dialog */}
 <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
 <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-hidden sm:max-w-xl flex flex-col">
 <DialogHeader>
 <DialogTitle>Create New Product</DialogTitle>
 <DialogDescription>
 Add a new product to your storefront
 </DialogDescription>
 </DialogHeader>
 <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-4 pr-1 pb-2">
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
   <Label htmlFor="sku">SKU / Item Number *</Label>
   <Input
     id="sku"
     value={productSku}
     onChange={(e) => setProductSku(e.target.value)}
     placeholder="e.g., DOG-FOOD-001"
     maxLength={64}
     required
   />
   <p className="text-xs text-muted-foreground mt-1">
     Unique identifier for this item in your catalog. Must be unique within your store.
   </p>
 </div>
 <div>
   <Label>Brand (optional)</Label>
   <BrandSelector
     value={productBrandId}
     onChange={setProductBrandId}
     merchantId={merchant?.id ?? null}
   />
   <p className="text-xs text-muted-foreground mt-1">
     Tag this item with a brand you're enrolled with to unlock that brand's PawBucks at checkout.
   </p>
 </div>
 <div>
 <Label htmlFor="item-type">Type *</Label>
 <Select value={productItemType} onValueChange={(v:"product" |"service") => setProductItemType(v)}>
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
 <Label>Product Image</Label>
 <ProductImageUpload
 imageUrls={productImageUrls}
 onChange={setProductImageUrls}
 folder={merchant?.id ||"merchant"}
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

 {/* Fee Recovery Calculator */}
 <PricingCalculator 
 compact 
 onApplyPrice={(price) => setProductPrice(price)} 
 />

 {/* Marketplace Listing Toggle */}
 <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Store className="h-5 w-5 text-primary" aria-hidden="true" />
 <div>
 <Label htmlFor="pet-store-toggle" className="font-medium">
 List in Marketplace
 </Label>
 <p className="text-xs text-muted-foreground">
 Make this product available in the platform's Marketplace
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
 <div className="flex items-center gap-2 text-sm text-warning">
 <PawBucksLogo className="h-4 w-4" />
 <span>Products in Marketplace must accept both USD and PawBucks</span>
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
 1,000 PawBucks = $1 value. Suggested: {productPrice ? Math.round(parseFloat(productPrice) * 1000) :"—"} PawBucks
 </p>
 </div>
 </div>
 )}
 </div>

 <div className="sticky bottom-0 -mx-4 sm:-mx-6 mt-6 flex flex-col-reverse gap-2 border-t bg-background px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
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

 {/* Edit Product Dialog */}
 <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
 <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-hidden sm:max-w-xl flex flex-col">
 <DialogHeader>
 <DialogTitle>Edit Product</DialogTitle>
 <DialogDescription>Update your product details</DialogDescription>
 </DialogHeader>
 <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-4 pr-1 pb-2">
 <div>
 <Label htmlFor="edit-name">Name *</Label>
 <Input
 id="edit-name"
 value={editName}
 onChange={(e) => setEditName(e.target.value)}
 />
 </div>
 <div>
 <Label htmlFor="edit-description">Description</Label>
 <Textarea
 id="edit-description"
 value={editDescription}
 onChange={(e) => setEditDescription(e.target.value)}
 rows={3}
 />
 </div>
 <div>
 <Label htmlFor="edit-price">Price (USD)</Label>
 <Input
 id="edit-price"
 type="number"
 step="0.01"
 min="0.50"
 value={editPrice}
 onChange={(e) => setEditPrice(e.target.value)}
 />
 <p className="text-xs text-muted-foreground mt-1">
 Changing price creates a new Stripe price (existing checkouts unaffected). Minimum $0.50.
 </p>
 </div>
 <div className="flex items-center justify-between border rounded-lg p-3">
 <div>
 <Label htmlFor="edit-active" className="font-medium">Active</Label>
 <p className="text-xs text-muted-foreground">Inactive products are hidden from your storefront</p>
 </div>
 <Switch id="edit-active" checked={editActive} onCheckedChange={setEditActive} />
 </div>
 <div className="sticky bottom-0 -mx-4 sm:-mx-6 mt-6 flex flex-col-reverse gap-2 border-t bg-background px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
 <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={updating}>
 Cancel
 </Button>
 <Button onClick={handleUpdateProduct} disabled={updating}>
 {updating ? (
 <>
 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
 Saving...
 </>
 ) : (
"Save Changes"
 )}
 </Button>
 </div>
 </div>
 </DialogContent>
 </Dialog>

 {/* Edit Subscription Plan Dialog */}
 <Dialog open={editPlanDialogOpen} onOpenChange={setEditPlanDialogOpen}>
 <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-hidden sm:max-w-xl flex flex-col">
 <DialogHeader>
 <DialogTitle>Edit Subscription Plan</DialogTitle>
 <DialogDescription>Update your plan details. Billing interval cannot be changed after publishing.</DialogDescription>
 </DialogHeader>
 <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-4 pr-1 pb-2">
 <div>
 <Label htmlFor="edit-plan-name">Name *</Label>
 <Input id="edit-plan-name" value={planName} onChange={(e) => setPlanName(e.target.value)} />
 </div>
 <div>
 <Label htmlFor="edit-plan-description">Description</Label>
 <Textarea id="edit-plan-description" value={planDescription} onChange={(e) => setPlanDescription(e.target.value)} rows={3} />
 </div>
 <div>
 <Label htmlFor="edit-plan-price">Price (USD) *</Label>
 <Input
 id="edit-plan-price"
 type="number"
 step="0.01"
 min="0.50"
 value={planPrice}
 onChange={(e) => setPlanPrice(e.target.value)}
 />
 <p className="text-xs text-muted-foreground mt-1">Minimum $0.50. New subscribers will be charged the new price.</p>
 </div>
 <div className="flex items-center justify-between border rounded-lg p-3">
 <div>
 <Label htmlFor="edit-plan-active" className="font-medium">Active</Label>
 <p className="text-xs text-muted-foreground">Inactive plans are hidden from your storefront</p>
 </div>
 <Switch id="edit-plan-active" checked={planActive} onCheckedChange={setPlanActive} />
 </div>
 <div className="sticky bottom-0 -mx-4 sm:-mx-6 mt-6 flex flex-col-reverse gap-2 border-t bg-background px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
 <Button variant="outline" onClick={() => setEditPlanDialogOpen(false)} disabled={updatingPlan}>
 Cancel
 </Button>
 <Button onClick={handleUpdatePlan} disabled={updatingPlan}>
 {updatingPlan ? (
 <>
 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
 Saving...
 </>
 ) : (
"Save Changes"
 )}
 </Button>
 </div>
 </div>
 </DialogContent>
 </Dialog>

 {/* Delete Subscription Plan Dialog */}
 <AlertDialog open={deletePlanDialogOpen} onOpenChange={setDeletePlanDialogOpen}>
 <AlertDialogContent>
 <AlertDialogHeader>
 <AlertDialogTitle>Delete Subscription Plan?</AlertDialogTitle>
 <AlertDialogDescription>
 This will permanently delete"{planToDelete?.name}". Active subscribers will not be affected, but no new sign-ups will be allowed. This action cannot be undone.
 </AlertDialogDescription>
 </AlertDialogHeader>
 <AlertDialogFooter>
 <AlertDialogCancel disabled={deletingPlan}>Cancel</AlertDialogCancel>
 <AlertDialogAction
 onClick={handleDeletePlan}
 disabled={deletingPlan}
 className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
 >
 {deletingPlan ? (
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

 {/* Delete Confirmation Dialog */}
 <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
 <AlertDialogContent>
 <AlertDialogHeader>
 <AlertDialogTitle>Delete Product?</AlertDialogTitle>
 <AlertDialogDescription>
 This will archive"{productToDelete?.name}" and remove it from your storefront. 
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
      <ImportProductsDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImported={() => merchant && loadProducts(merchant.id)}
      />
   </div>
 </MerchantWorkspaceLayout>
 );
};

export default MerchantProducts;
