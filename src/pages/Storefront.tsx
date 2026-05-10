import { useState, useCallback, useMemo, memo } from"react";
import { useParams, Link, useNavigate, useLocation } from"react-router-dom";
import { supabase } from"@/integrations/supabase/client";
import { Button } from"@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { toast } from"sonner";
import { ShoppingCart, Store, ArrowLeft, CreditCard, Package, RefreshCw, Check, Plus } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { SEO } from"@/components/SEO";
import { useAuth } from"@/hooks/useAuth";
import { Skeleton } from"@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from"@/components/ui/avatar";
import { SubscriptionCheckoutDialog } from"@/components/SubscriptionCheckoutDialog";
import { useQuery, useQueries } from"@tanstack/react-query";
import { merchantSubscriptionPlansService } from"@/services/api/merchantSubscriptionPlans.service";
import { AskQuestionButton } from"@/components/storefront/AskQuestionButton";
import { buildAppUrl } from"@/lib/url";
import { Founding50Badge } from"@/components/shared/Founding50Badge";
import { useStorefrontCart } from"@/hooks/useStorefrontCart";
import { StorefrontCartDrawer, type StorefrontCheckoutParams } from"@/components/storefront/StorefrontCartDrawer";
import { CartIcon } from"@/components/pet-store/CartIcon";

import { Formatters } from "@/utils/formatters";
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
ProductSkeleton.displayName ="ProductSkeleton";

const Storefront = memo(() => {
 const { accountId } = useParams<{ accountId: string }>();
 const navigate = useNavigate();
 const location = useLocation();
 const { user, loading: authLoading } = useAuth();
 
 const [purchasingProductId, setPurchasingProductId] = useState<string | null>(null);
 const [cartOpen, setCartOpen] = useState(false);
 const [isCheckingOut, setIsCheckingOut] = useState(false);

 // Shopping cart
 const {
 items: cartItems,
 itemCount,
 totalCents,
 addToCart,
 updateQuantity,
 removeItem,
 clearCart,
 } = useStorefrontCart(accountId);

 // Parallel queries for merchant data, products, and auto-redeem preference
 const queryResults = useQueries({
 queries: [
 // Merchant data lookup by slug
 {
 queryKey: ["storefront-merchant", accountId],
 queryFn: async () => {
 if (!accountId) return null;
 const { data: merchantBySlug } = await supabase
 .from('merchants_public')
 .select('id, business_name, description, cashback_rate, storefront_slug, logo_url, address, business_type, business_categories, accepts_pawbucks, tos_url, privacy_policy_url, shipping_returns_policy_url')
 .eq('storefront_slug', accountId)
 .maybeSingle();

 if (merchantBySlug) {
 return { ...merchantBySlug, acceptsPawBucks: merchantBySlug.accepts_pawbucks ?? false, foundBySlug: true };
 }

 const { data: merchantById } = await supabase
 .from('merchants_public')
 .select('id, business_name, description, cashback_rate, storefront_slug, logo_url, address, business_type, business_categories, accepts_pawbucks, tos_url, privacy_policy_url, shipping_returns_policy_url')
 .eq('id', accountId)
 .maybeSingle();

 if (merchantById) {
 return { ...merchantById, acceptsPawBucks: merchantById.accepts_pawbucks ?? false, foundBySlug: false };
 }
 return null;
 },
 staleTime: 1000 * 60 * 10,
 enabled: !!accountId,
 },
 // Auto-redeem preference
 {
 queryKey: ["auto-redeem-preference", user?.id],
 queryFn: async () => {
 if (!user?.id) return { enabled: false, mode:'off' };
 const { data } = await supabase.from('profiles').select('auto_redeem_mode').eq('id', user.id).single();
 const mode = data?.auto_redeem_mode ||'off';
 return { enabled: mode !=='off', mode };
 },
 staleTime: 1000 * 60 * 5,
 enabled: !!user?.id,
 },
 ],
 });

 const merchantData = queryResults[0].data;
 const merchantLoading = queryResults[0].isLoading;
 const autoRedeemPref = queryResults[1].data as { enabled: boolean; mode: string } | undefined;

 const merchantIdForProducts = merchantData?.id;
 const { data: productsData, isLoading: productsLoading } = useQuery({
 queryKey: ["storefront-products", merchantIdForProducts],
 queryFn: async () => {
 if (!merchantIdForProducts) return { products: [], connectedAccountId: null };
 const { data, error } = await supabase.functions.invoke("list-connect-products", {
 body: { merchantId: merchantIdForProducts },
 });
 if (error) throw error;
 return { products: data.products || [], connectedAccountId: data.connectedAccountId || null };
 },
 staleTime: 1000 * 60 * 5,
 enabled: !!merchantIdForProducts,
 });

 const products = productsData?.products || [];
 const merchantConnectedAccountId = productsData?.connectedAccountId || null;

 // Subscription plans
 const { data: subscriptionPlans = [] } = useQuery({
 queryKey: ["storefront-subscription-plans", merchantIdForProducts],
 queryFn: async () => {
 if (!merchantIdForProducts) return [];
 const { data } = await merchantSubscriptionPlansService.getPublishedPlans(merchantIdForProducts);
 return (data || []).map(p => ({ ...p, features: Array.isArray(p.features) ? p.features as string[] : [] }));
 },
 staleTime: 1000 * 60 * 5,
 enabled: !!merchantIdForProducts,
 });

 // Subscription checkout state
 const [showSubDialog, setShowSubDialog] = useState(false);
 const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
 const [connectedAccountId, setConnectedAccountId] = useState<string | null>(null);

 // PawBucks wallet balance
 const { data: walletData } = useQuery({
 queryKey: ["pawbucks-wallet", user?.id],
 queryFn: async () => {
 if (!user?.id) return null;
 const { data } = await supabase.from("pawbucks_wallet").select("balance").eq("user_id", user.id).single();
 return data;
 },
 staleTime: 1000 * 60 * 2,
 enabled: !!user?.id,
 });

 const handleSubscribe = useCallback(async (plan: SubscriptionPlan) => {
 if (!user) {
 toast.error("Please sign in to subscribe", { action: { label:"Sign In", onClick: () => navigate(`/auth?redirect=${encodeURIComponent(location.pathname)}`) } });
 return;
 }
 if (!merchantConnectedAccountId) {
 toast.error("This merchant hasn't completed payment setup.");
 return;
 }
 setConnectedAccountId(merchantConnectedAccountId);
 setSelectedPlan(plan);
 setShowSubDialog(true);
 }, [user, navigate, merchantConnectedAccountId]);

 // Derived values
 const merchantName = merchantData?.business_name ||"";
 const merchantId = merchantData?.id || null;
 const merchantDescription = merchantData?.description ||"";
 const merchantLogo = merchantData?.logo_url || null;
 const merchantAddress = merchantData?.address || null;
 const merchantBusinessType = merchantData?.business_type || null;
 const cashbackRate = merchantData?.cashback_rate || 10;
 const merchantAcceptsPawBucks = merchantData?.acceptsPawBucks ?? false;

 const loading = merchantLoading || productsLoading;

 const getEstimatedPawBucks = useCallback((price: number) => Math.floor(price * cashbackRate), [cashbackRate]);

 // Add product to cart
 const handleAddToCart = useCallback((product: Product) => {
 if (!user) {
 toast.error("Please sign in to shop", { action: { label:"Sign In", onClick: () => navigate(`/auth?redirect=${encodeURIComponent(location.pathname)}`) } });
 return;
 }
 if (!product.price?.id || product.price.unit_amount == null) return;

 addToCart({
 productId: product.id,
 priceId: product.price.id,
 name: product.name,
 description: product.description,
 image: product.images?.[0] || null,
 unitAmount: product.price.unit_amount,
 currency: product.price.currency,
 formatted: product.price.formatted,
 });
 toast.success("Added to cart! 🛒");
 }, [user, navigate, addToCart]);

 // Cart checkout
 const handleCartCheckout = useCallback(async (params: StorefrontCheckoutParams) => {
 if (!user || cartItems.length === 0 || !merchantIdForProducts) return;

 // Full PawBucks checkout
 if (params.mode ==="pawbucks") {
 setIsCheckingOut(true);
 try {
 const { data, error } = await supabase.functions.invoke("create-connect-checkout", {
 body: {
 merchantId: merchantIdForProducts,
 items: cartItems.map(ci => ({ priceId: ci.priceId, quantity: ci.quantity, name: ci.name })),
 pawbucksToUse: params.pawbucksAmount,
 autoRedeem: autoRedeemPref?.enabled ?? false,
 successUrl: buildAppUrl(`/checkout-success?store=${accountId}`),
 cancelUrl: buildAppUrl(`/storefront/${accountId}`),
 },
 });
 if (error) throw error;
 if (data.paid_with_pawbucks) {
 toast.success(data.message ||"Purchase completed with PawBucks!");
 clearCart();
 if (data.redirect_url) window.location.href = data.redirect_url;
 return;
 }
 if (data.checkout_url) {
 clearCart();
 window.location.href = data.checkout_url;
 }
 } catch (error: any) {
 toast.error(error?.message ||"Checkout failed");
 } finally {
 setIsCheckingOut(false);
 }
 return;
 }

 // Card or split
 setIsCheckingOut(true);
 setCartOpen(false);
 try {
 const { data, error } = await supabase.functions.invoke("create-connect-checkout", {
 body: {
 merchantId: merchantIdForProducts,
 items: cartItems.map(ci => ({ priceId: ci.priceId, quantity: ci.quantity, name: ci.name })),
 pawbucksToUse: params.pawbucksAmount || 0,
 autoRedeem: autoRedeemPref?.enabled ?? false,
 successUrl: buildAppUrl(`/checkout-success?store=${accountId}`),
 cancelUrl: buildAppUrl(`/storefront/${accountId}`),
 },
 });
 if (error) throw error;

 if (data.pawbucks_applied) {
 toast.success(`Applied ${data.pawbucks_applied.formatted}`, { duration: 2000 });
 }
 if (data.checkout_url) {
 clearCart();
 setTimeout(() => { window.location.href = data.checkout_url; }, 500);
 } else {
 throw new Error("No checkout URL returned");
 }
 } catch (error: any) {
 toast.error(error?.message ||"Failed to start checkout");
 } finally {
 setIsCheckingOut(false);
 }
 }, [user, cartItems, merchantIdForProducts, accountId, clearCart]);

 if (loading || authLoading) {
 return (
 <div className="min-h-screen bg-background">
 <div className="relative overflow-hidden border-b">
 <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
 <div className="container relative py-12">
 <Skeleton className="h-8 w-32 mb-6" />
 <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
 <Skeleton className="h-24 w-24 rounded-md" />
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
 {[1, 2, 3, 4].map((i) => <ProductSkeleton key={i} />)}
 </div>
 </div>
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
 <SEO 
 title={`${merchantName ||"Store"} - Shop Products`}
 description={`Browse and purchase products from ${merchantName ||"this store"}. Earn PawBucks on every purchase!`}
 />

 {/* Editorial Hero Header */}
 <div className="relative bg-gradient-to-b from-primary/[0.06] via-primary/[0.02] to-transparent border-b border-border/40 overflow-hidden">
  <div
   aria-hidden="true"
   className="pointer-events-none absolute -top-32 -right-24 w-[420px] h-[420px] rounded-full opacity-60"
   style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.18) 0%, transparent 70%)" }}
  />
  <div className="container relative mx-auto px-4 pt-10 pb-8 max-w-4xl">
   {merchantId && (
    <Link to={`/merchant/${merchantId}`}>
     <Button variant="ghost" size="sm" className="mb-6 -ml-2 hover:bg-primary/10 group">
      <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
      Back to Profile
     </Button>
    </Link>
   )}

   {/* Eyebrow */}
   <div className="text-[0.7rem] font-medium tracking-[0.18em] uppercase text-primary mb-3 flex items-center gap-2">
    <span className="w-3.5 h-3.5" aria-hidden="true">🏪</span>
    The Storefront
   </div>

   <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
    {/* Left: Store Info */}
    <div className="flex flex-col sm:flex-row gap-6 items-start flex-1 min-w-0">
     <Avatar className="h-24 w-24 rounded-md border-4 border-background shadow-xl ring-2 ring-primary/20 shrink-0">
      <AvatarImage src={merchantLogo || undefined} alt={merchantName} className="object-cover" />
      <AvatarFallback className="rounded-md bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-3xl font-bold">
       {merchantName?.charAt(0) || <span className="h-10 w-10" aria-hidden="true">🏪</span>}
      </AvatarFallback>
     </Avatar>

     <div className="space-y-3 min-w-0">
      <div>
       <h1
        className="font-serif font-black leading-[1.05] tracking-[-0.025em] text-foreground mb-2"
        style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: "clamp(1.85rem, 4.5vw, 2.75rem)" }}
       >
        {merchantName || "Store"}
       </h1>
       <div className="flex items-center gap-2 flex-wrap">
        {merchantBusinessType && (
         <Badge variant="secondary" className="capitalize">{merchantBusinessType.replace(/_/g, ' ')}</Badge>
        )}
        {merchantIdForProducts && (
         <Founding50Badge entityType="merchant" entityId={merchantIdForProducts} size="md" />
        )}
        <span className="text-xs text-muted-foreground">Official Storefront</span>
       </div>
      </div>

      {merchantDescription && (
       <p className="text-base text-muted-foreground max-w-xl leading-relaxed">{merchantDescription}</p>
      )}

      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
       {merchantAddress && (
        <div className="flex items-center gap-1.5">
         <span className="h-4 w-4 text-primary" aria-hidden="true">📍</span>
         <span className="truncate max-w-[220px]">{merchantAddress}</span>
        </div>
       )}
       <div className="flex items-center gap-1.5">
        <span className="h-4 w-4 text-primary" aria-hidden="true">⏰</span>
        <span>Usually responds quickly</span>
       </div>
      </div>

      {merchantId && (
       <AskQuestionButton merchantId={merchantId} merchantName={merchantName || "Store"} />
      )}
     </div>
    </div>

    {/* Right: Rewards & Trust + Cart */}
    <div className="flex flex-col gap-4 sm:items-end">
     {user && (
      <CartIcon itemCount={itemCount} onClick={() => setCartOpen(true)} />
     )}

     <div className="inline-flex items-center gap-3 px-5 py-3 rounded-md bg-gradient-to-r from-warning/15 to-warning/15 border border-warning/30">
      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-warning to-warning flex items-center justify-center shadow-lg">
       <Sparkles className="h-5 w-5 text-white" />
      </div>
      <div>
       <p className="text-sm font-medium text-foreground">Earn Rewards</p>
       <p className="text-lg font-bold text-warning">Up to {cashbackRate * 3}x PawBucks</p>
      </div>
     </div>

     <div className="flex flex-wrap gap-3">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 text-success text-sm">
       <span className="h-4 w-4" aria-hidden="true">🛡️</span> Secure
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-info/10 text-info text-sm">
       <span className="h-4 w-4" aria-hidden="true">💳</span> Stripe
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-warning/10 text-warning text-sm">
       <span className="h-4 w-4" aria-hidden="true">⭐</span> Verified
      </div>
     </div>
    </div>
   </div>
  </div>
 </div>

 {/* Products Section */}
 <div className="container py-10 md:py-14">
 {products.length === 0 && subscriptionPlans.length === 0 ? (
 <Card className="border-dashed border-2 bg-gradient-to-br from-muted/30 to-muted">
 <CardContent className="flex flex-col items-center justify-center py-20">
 <div className="h-24 w-24 rounded-md bg-gradient-to-br from-muted to-muted/80 flex items-center justify-center mb-8 shadow-inner">
 <span className="h-12 w-12 text-muted-foreground" aria-hidden="true">📦</span>
 </div>
 <h3 className="text-2xl font-semibold mb-3">No products available yet</h3>
 <p className="text-muted-foreground text-center max-w-md mb-8">
 This store is setting up their catalog. Check back soon for amazing products!
 </p>
 {merchantId && (
 <Link to={`/merchant/${merchantId}`}>
 <Button variant="outline" size="lg">
 <ArrowLeft className="h-4 w-4 mr-2" /> View Merchant Profile
 </Button>
 </Link>
 )}
 </CardContent>
 </Card>
 ) : (
 <>
 <div className="flex items-center justify-between mb-8">
 <div>
 <h2 className="text-2xl font-bold">Shop Products</h2>
 <p className="text-muted-foreground mt-1">
 {products.length + subscriptionPlans.length} {(products.length + subscriptionPlans.length) === 1 ?'item' :'items'} available
 </p>
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
 {/* Subscription Plans */}
 {subscriptionPlans.map((plan) => {
 const formattedPrice = `${Formatters.currency((plan.amount / 100))}`;
 const intervalLabel = plan.billing_interval_count === 1 
 ? plan.billing_interval 
 : `${plan.billing_interval_count} ${plan.billing_interval}s`;
 
 return (
 <Card 
 key={`plan-${plan.id}`}
 className="group overflow-hidden hover:shadow-2xl transition-all duration-300 hover:border-primary/40 hover:-translate-y-1.5 bg-card/80 backdrop-blur-sm border-primary/20"
 >
 <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
 <RefreshCw className="h-16 w-16 text-primary/40" />
 <div className="absolute top-3 left-3">
 <Badge className="bg-primary text-primary-foreground border-0">
 <RefreshCw className="h-3 w-3 mr-1" /> Subscription
 </Badge>
 </div>
 {plan.trial_days > 0 && (
 <div className="absolute top-3 right-3">
 <Badge variant="outline" className="bg-success/20 text-success border-success/30">
 {plan.trial_days} day trial
 </Badge>
 </div>
 )}
 </div>

 <CardHeader className="pb-2 pt-4">
 <CardTitle className="line-clamp-1 text-lg group-hover:text-primary transition-colors">{plan.name}</CardTitle>
 {plan.description && <CardDescription className="line-clamp-2 text-sm">{plan.description}</CardDescription>}
 </CardHeader>

 <CardContent className="space-y-4 pt-2">
 <div className="flex items-baseline gap-1">
 <span className="text-2xl font-bold text-foreground">{formattedPrice}</span>
 <span className="text-muted-foreground">/ {intervalLabel}</span>
 </div>

 {plan.features.length > 0 && (
 <ul className="space-y-1">
 {plan.features.slice(0, 3).map((feature, i) => (
 <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
 <Check className="h-3 w-3 text-success flex-shrink-0" />
 <span className="line-clamp-1">{feature}</span>
 </li>
 ))}
 </ul>
 )}

 <Button onClick={() => handleSubscribe(plan)} className="w-full group/btn shadow-lg shadow-primary/20" size="lg">
 <CreditCard className="h-4 w-4 mr-2 group-hover/btn:scale-110 transition-transform" /> Subscribe
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
 const inCart = cartItems.find((ci) => ci.priceId === product.price?.id);

 return (
 <Card 
 key={product.id} 
 className="group overflow-hidden hover:shadow-2xl transition-all duration-300 hover:border-primary/40 hover:-translate-y-1.5 bg-card/80 backdrop-blur-sm"
 >
 {/* Product Image */}
 <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-muted to-muted">
 {product.images && product.images.length > 0 ? (
 <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" width={400} height={400} />
 ) : (
 <div className="w-full h-full flex items-center justify-center">
 <Package className="h-16 w-16 text-muted-foreground/50" />
 </div>
 )}
 {estimatedPawBucks > 0 && (
 <div className="absolute top-3 right-3">
 <Badge className="bg-gradient-to-r from-warning to-warning text-white border-0 shadow-lg">
 <Sparkles className="h-3 w-3 mr-1" /> +{estimatedPawBucks} PB
 </Badge>
 </div>
 )}
 </div>

 <CardHeader className="pb-2 pt-4">
 <CardTitle className="line-clamp-1 text-lg group-hover:text-primary transition-colors">{product.name}</CardTitle>
 {product.description && <CardDescription className="line-clamp-2 text-sm">{product.description}</CardDescription>}
 </CardHeader>

 <CardContent className="space-y-4 pt-2">
 <div className="text-2xl font-bold text-foreground">{product.price?.formatted ||"N/A"}</div>

 {/* Add to Cart / In Cart buttons */}
 {user ? (
 <div className="space-y-2">
 <Button
 onClick={() => handleAddToCart(product)}
 disabled={!product.price}
 className="w-full group/btn shadow-lg shadow-primary/20"
 variant={inCart ?"secondary" :"default"}
 size="lg"
 >
 {inCart ? (
 <>
 <Plus className="h-4 w-4 mr-2" />
 Add More ({inCart.quantity} in cart)
 </>
 ) : (
 <>
 <ShoppingCart className="h-4 w-4 mr-2 group-hover/btn:scale-110 transition-transform" />
 Add to Cart
 </>
 )}
 </Button>
 </div>
 ) : (
 <Button onClick={() => navigate(`/auth?redirect=${encodeURIComponent(location.pathname)}`)} className="w-full" size="lg">
 Sign in to Shop
 </Button>
 )}
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
 <Avatar className="h-12 w-12 rounded-md border-2 border-primary/20">
 <AvatarImage src={merchantLogo || undefined} alt={merchantName} />
 <AvatarFallback className="rounded-md bg-primary/10 text-primary font-bold">{merchantName?.charAt(0) ||"S"}</AvatarFallback>
 </Avatar>
 
 <div className="flex flex-col items-center gap-2 text-center">
 <p className="font-medium text-foreground">{merchantName}</p>
 <p className="text-sm text-muted-foreground flex items-center gap-2">
 <Sparkles className="h-4 w-4 text-primary" /> Powered by PawBucks Marketplace
 </p>
 </div>

 {(merchantData?.tos_url || merchantData?.privacy_policy_url || merchantData?.shipping_returns_policy_url) && (
 <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
 {merchantData.tos_url && (
 <a href={merchantData.tos_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline">Terms of Service</a>
 )}
 {merchantData.privacy_policy_url && (
 <a href={merchantData.privacy_policy_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline">Privacy Policy</a>
 )}
 {merchantData.shipping_returns_policy_url && (
 <a href={merchantData.shipping_returns_policy_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline">Shipping & Returns</a>
 )}
 </div>
 )}

 <div className="flex items-center gap-6 text-sm text-muted-foreground">
 <span className="flex items-center gap-1.5"><span className="h-4 w-4 text-success" aria-hidden="true">🛡️</span> Secure Payments</span>
 <span className="text-border">•</span>
 <span className="flex items-center gap-1.5"><span className="h-4 w-4 text-info" aria-hidden="true">💳</span> Powered by Stripe</span>
 </div>
 </div>
 </div>
 </div>

 {/* Cart Drawer */}
 <StorefrontCartDrawer
 open={cartOpen}
 onOpenChange={setCartOpen}
 items={cartItems}
 totalCents={totalCents}
 onUpdateQuantity={updateQuantity}
 onRemoveItem={removeItem}
 onClearCart={clearCart}
 onCheckout={handleCartCheckout}
 isCheckingOut={isCheckingOut}
 pawbucksBalance={walletData?.balance || 0}
 merchantAcceptsPawBucks={merchantAcceptsPawBucks}
 />

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
 onSuccess={() => { setShowSubDialog(false); setSelectedPlan(null); }}
 />
 )}
 </div>
 );
});

Storefront.displayName ="Storefront";

export default Storefront;
