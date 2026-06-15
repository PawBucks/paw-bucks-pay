import { useState, useCallback, useMemo, memo } from"react";
import { useParams, Link, useNavigate, useLocation } from"react-router-dom";
import { supabase } from"@/integrations/supabase/client";
import { Button } from"@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { toast } from"sonner";
import { ArrowLeft, Check, Clock, CreditCard, MapPin, MessageCircle, Package, Plus, RefreshCw, Shield, ShoppingCart, Star, Store, BadgeCheck, Mountain } from "lucide-react";
import { PawBucksIcon } from "@/components/PawBucksIcon";

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
import { useSpendablePawBucks } from"@/hooks/useSpendablePawBucks";

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
 .select('id, business_name, description, cashback_rate, storefront_slug, logo_url, address, business_type, business_categories, accepts_pawbucks, tos_url, privacy_policy_url, shipping_returns_policy_url, stripe_account_status')
 .eq('storefront_slug', accountId)
 .maybeSingle();

 if (merchantBySlug) {
 return { ...merchantBySlug, acceptsPawBucks: merchantBySlug.accepts_pawbucks ?? false, foundBySlug: true };
 }

 const { data: merchantById } = await supabase
 .from('merchants_public')
 .select('id, business_name, description, cashback_rate, storefront_slug, logo_url, address, business_type, business_categories, accepts_pawbucks, tos_url, privacy_policy_url, shipping_returns_policy_url, stripe_account_status')
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
 const paymentsActive = (merchantData as any)?.stripe_account_status === "active";

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

  // PawBucks spendable sources: wallet + Pet Fund (welcome credit) + legacy welcome credit.
  // Backend (create-connect-checkout) spends in canonical order; we just need to expose the
  // combined eligible total so the cart slider lets shoppers apply welcome credits at checkout.
  const {
  spendableBalance,
  welcomeCreditBalance,
  petFundBalance,
  petFundMinTransactionUsd,
  } = useSpendablePawBucks(user?.id);

 const handleSubscribe = useCallback(async (plan: SubscriptionPlan) => {
 if (!user) {
 toast.error("Please sign in to subscribe", { action: { label:"Sign In", onClick: () => navigate(`/auth?redirect=${encodeURIComponent(location.pathname)}`) } });
 return;
 }
 if (!paymentsActive) {
 toast.error("Payments are temporarily unavailable for this merchant");
 return;
 }
 if (!merchantConnectedAccountId) {
 toast.error("This merchant hasn't completed payment setup.");
 return;
 }
 setConnectedAccountId(merchantConnectedAccountId);
 setSelectedPlan(plan);
 setShowSubDialog(true);
 }, [user, navigate, merchantConnectedAccountId, paymentsActive]);

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
 if (!paymentsActive) {
 toast.error("This merchant is not accepting payments right now");
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
 toast.success("Added to cart!");
 }, [user, navigate, addToCart, paymentsActive]);

 // Cart checkout
 const handleCartCheckout = useCallback(async (params: StorefrontCheckoutParams) => {
 if (!user || cartItems.length === 0 || !merchantIdForProducts) return;
 if (!paymentsActive) {
 toast.error("This merchant is not accepting payments right now");
 return;
 }

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
         noIndex
        ogImage={merchantLogo || undefined}
        jsonLd={merchantName ? {
          "@context":"https://schema.org",
          "@type":"LocalBusiness",
          name: merchantName,
          description: merchantData?.description || undefined,
          image: merchantLogo || undefined,
          address: merchantData?.address ? {
            "@type":"PostalAddress",
            streetAddress: merchantData.address,
          } : undefined,
          url: merchantId ? `https://pawbucks.app/storefront/${accountId}` : undefined,
        } : undefined}
 />

  {/* Sticky sub-nav */}
  <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
   <div className="container mx-auto px-4 max-w-7xl flex items-center gap-3 py-2.5">
    {merchantId ? (
     <Link to={`/merchant/${merchantId}`} className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
      <ArrowLeft className="h-4 w-4" /> Back to Profile
     </Link>
    ) : <span />}
    <span className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground ml-2 hidden sm:inline">The Storefront</span>
    <div className="ml-auto">
     {user && <CartIcon itemCount={itemCount} onClick={() => setCartOpen(true)} />}
    </div>
   </div>
  </div>

  {/* Hero */}
  <div className="bg-card border-b border-border">
   <div className="container mx-auto px-4 max-w-7xl pt-5 pb-0">
    <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground mb-3.5">
     <Store className="h-3 w-3" /> The Storefront
    </div>

    <div className="flex items-start gap-3.5 mb-3.5">
     <Avatar className="h-[72px] w-[72px] rounded-2xl border border-border shadow-sm shrink-0">
      <AvatarImage src={merchantLogo || undefined} alt={merchantName} className="object-cover" />
      <AvatarFallback className="rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-2xl font-extrabold">
       {merchantName?.slice(0, 2).toUpperCase() || <Store className="h-7 w-7" />}
      </AvatarFallback>
     </Avatar>
     <div className="flex-1 min-w-0">
      <h1 className="text-[22px] font-extrabold tracking-tight text-foreground leading-tight mb-2">
       {merchantName || "Store"}
      </h1>
      <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
       {merchantBusinessType && (
        <Badge variant="secondary" className="capitalize text-[11px] font-semibold px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full">
         {merchantBusinessType.replace(/_/g, ' ')}
        </Badge>
       )}
       {merchantIdForProducts && (
        <Founding50Badge entityType="merchant" entityId={merchantIdForProducts} size="sm" />
       )}
       <span className="text-[11px] text-muted-foreground">· Official Storefront</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
       <Clock className="h-3.5 w-3.5" />
       <span>Usually responds quickly</span>
      </div>
     </div>
    </div>

    {/* Earn banner */}
    <div className="bg-primary/10 border border-primary/20 rounded-xl my-3.5 px-3.5 py-2.5 flex items-center justify-between">
     <div className="flex items-center gap-2">
      <PawBucksIcon className="h-8 w-8 rounded-lg" />
      <div>
       <div className="text-[11px] text-primary/80">Earn Rewards</div>
       <div className="text-sm font-extrabold text-primary">Up to {cashbackRate * 3}x PawBucks</div>
      </div>
     </div>
     <div className="text-[10px] text-primary/70 text-right">PawPass+ subscribers earn most</div>
    </div>
   </div>

   {/* Trust strip */}
   <div className="border-t border-border">
    <div className="container mx-auto px-4 max-w-7xl flex items-center gap-2 overflow-x-auto py-2.5 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
     <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border bg-card text-[11px] font-medium text-muted-foreground whitespace-nowrap">
      <Shield className="h-3 w-3" /> Secure
     </span>
     <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border bg-card text-[11px] font-medium text-muted-foreground whitespace-nowrap">
      <CreditCard className="h-3 w-3" /> Stripe
     </span>
     <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-warning/40 bg-card text-[11px] font-semibold text-warning whitespace-nowrap">
      <BadgeCheck className="h-3 w-3" /> Verified Merchant
     </span>
     <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border bg-card text-[11px] font-medium text-muted-foreground whitespace-nowrap">
      <PawBucksIcon className="h-3 w-3" /> PawBucks Partner
     </span>
    </div>
   </div>
  </div>

  {/* About + Ask */}
  {(merchantDescription || merchantAddress || merchantId) && (
   <div className="container mx-auto px-4 max-w-7xl pt-6">
    <div className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground mb-2">About</div>
    {merchantDescription && (
     <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{merchantDescription}</p>
    )}
    {merchantAddress && (
     <div className="flex items-start gap-1.5 mt-2.5 text-[13px] text-muted-foreground">
      <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
      <span>{merchantAddress}</span>
     </div>
    )}
    {merchantId && (
     <div className="mt-3.5">
      <AskQuestionButton merchantId={merchantId} merchantName={merchantName || "Store"} />
     </div>
    )}
   </div>
  )}

  {/* Products Section */}
  <div className="container mx-auto px-4 max-w-7xl py-6 pb-32">
   <div className="mb-4">
    <h2 className="text-xl font-extrabold tracking-tight text-foreground">Shop Products &amp; Subscription Plans</h2>
    <p className="text-[13px] text-muted-foreground mt-0.5">
     {products.length + subscriptionPlans.length} {(products.length + subscriptionPlans.length) === 1 ? 'item' : 'items'} available
    </p>
   </div>
 {products.length === 0 && subscriptionPlans.length === 0 ? (
 <Card className="border-dashed border-2 bg-gradient-to-br from-muted/30 to-muted">
 <CardContent className="flex flex-col items-center justify-center py-20">
 <div className="h-24 w-24 rounded-md bg-gradient-to-br from-muted to-muted/80 flex items-center justify-center mb-8 shadow-inner">
 <Package className="h-12 w-12 text-muted-foreground" />
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
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
 {/* Subscription Plans */}
 {subscriptionPlans.map((plan) => {
 const formattedPrice = `${Formatters.currency((plan.amount / 100))}`;
 const intervalLabel = plan.billing_interval_count === 1 
 ? plan.billing_interval 
 : `${plan.billing_interval_count} ${plan.billing_interval}s`;
  const estPb = Math.floor((plan.amount / 100) * cashbackRate);

 return (
  <Card
 key={`plan-${plan.id}`}
  className="group overflow-hidden rounded-2xl border border-border bg-card hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
 >
  <div className="relative h-[200px] overflow-hidden bg-gradient-to-br from-primary/15 to-primary/[0.04] flex flex-col items-center justify-center">
  <Mountain className="h-14 w-14 text-primary/70" />
  <div className="text-[11px] font-medium text-muted-foreground mt-1.5">{intervalLabel} plan</div>
  <div className="absolute top-3 left-3">
  <Badge className="bg-primary text-primary-foreground border-0 rounded-full text-[11px] font-semibold px-2.5 py-0.5 inline-flex items-center gap-1">
  <RefreshCw className="h-3 w-3" /> Subscription
  </Badge>
  </div>
 {plan.trial_days > 0 && (
 <div className="absolute top-3 right-3">
  <Badge variant="outline" className="bg-success/15 text-success border-success/30 rounded-full text-[11px]">
 {plan.trial_days} day trial
 </Badge>
 </div>
 )}
 </div>

  <CardContent className="p-4 space-y-3">
  <div>
  <h3 className="text-[18px] font-extrabold tracking-tight text-foreground leading-tight">{plan.name}</h3>
  {plan.description && <p className="text-[13px] text-muted-foreground leading-snug mt-1 line-clamp-3">{plan.description}</p>}
  </div>
 {plan.features.length > 0 && (
  <ul className="space-y-1.5">
  {plan.features.slice(0, 4).map((feature, i) => (
  <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
 <Check className="h-3 w-3 text-success flex-shrink-0" />
  <span className="line-clamp-1">{feature}</span>
 </li>
 ))}
 </ul>
 )}
  <div className="flex items-end justify-between gap-3 pt-1">
  <div>
  <div className="text-[26px] font-extrabold text-foreground leading-none tracking-tight">{formattedPrice} <span className="text-sm font-normal text-muted-foreground">/ {intervalLabel}</span></div>
  </div>
  {estPb > 0 && (
  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-[12px] font-bold text-primary whitespace-nowrap">
  <PawBucksIcon className="h-3 w-3" /> +{Formatters.number(estPb)} PB
  </span>
  )}
  </div>
  <Button onClick={() => handleSubscribe(plan)} className="w-full" size="lg" disabled={!paymentsActive}>
  <CreditCard className="h-4 w-4 mr-2" /> {paymentsActive ? "Subscribe" : "Pay In-Store"}
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
  className="group overflow-hidden rounded-2xl border border-border bg-card hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
 >
  <div className="relative h-[200px] overflow-hidden bg-gradient-to-br from-primary/10 to-primary/[0.03]">
 {product.images && product.images.length > 0 ? (
  <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
 ) : (
 <div className="w-full h-full flex items-center justify-center">
  <Package className="h-14 w-14 text-muted-foreground/40" />
 </div>
 )}
 {estimatedPawBucks > 0 && (
  <div className="absolute bottom-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-foreground/75 text-background text-[12px] font-bold">
  <PawBucksIcon className="h-3 w-3" /> +{Formatters.number(estimatedPawBucks)} PB
 </div>
 )}
 </div>

  <CardContent className="p-4 space-y-3">
  <div>
  <h3 className="text-[18px] font-extrabold tracking-tight text-foreground leading-tight line-clamp-1">{product.name}</h3>
  {product.description && <p className="text-[13px] text-muted-foreground leading-snug mt-1 line-clamp-2">{product.description}</p>}
  </div>
  <div className="text-[26px] font-extrabold text-foreground leading-none tracking-tight">
  {product.price?.formatted || "N/A"}
  </div>
  {user ? (
  <Button
  onClick={() => handleAddToCart(product)}
  disabled={!product.price || !paymentsActive}
  className="w-full"
  variant={inCart ? "secondary" : "default"}
  size="lg"
  >
  {!paymentsActive ? (
  <>Payments unavailable</>
  ) : inCart ? (
  <><Plus className="h-4 w-4 mr-2" /> Add More ({inCart.quantity} in cart)</>
  ) : (
  <><ShoppingCart className="h-4 w-4 mr-2" /> Add to Cart</>
  )}
  </Button>
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
 )}
 </div>

 {/* Footer */}
  <div className="border-t border-border bg-card py-7">
  <div className="container mx-auto px-4 max-w-7xl">
 <div className="flex flex-col items-center gap-6">
  <Avatar className="h-[52px] w-[52px] rounded-xl border border-border">
 <AvatarImage src={merchantLogo || undefined} alt={merchantName} />
  <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-bold">{merchantName?.slice(0, 2).toUpperCase() || "S"}</AvatarFallback>
 </Avatar>

  <div className="flex flex-col items-center gap-2 text-center">
  <p className="font-semibold text-foreground">{merchantName}</p>
  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
  <PawBucksIcon className="h-3.5 w-3.5" /> Powered by PawBucks Marketplace
  </p>
  </div>

 {(merchantData?.tos_url || merchantData?.privacy_policy_url || merchantData?.shipping_returns_policy_url) && (
  <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
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

  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap justify-center">
 <span className="flex items-center gap-1.5"><Shield className="h-4 w-4 text-success" /> Secure Payments</span>
 <span className="text-border">•</span>
 <span className="flex items-center gap-1.5"><CreditCard className="h-4 w-4 text-info" /> Powered by Stripe</span>
 </div>
 </div>
 </div>
 </div>

   {/* Sticky bottom CTA — always visible on storefront */}
   <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t border-border px-4 py-3 pb-safe shadow-[0_-4px_12px_-4px_hsl(var(--foreground)/0.08)]">
    <div className="container mx-auto max-w-7xl flex gap-2.5">
     {merchantId && (
      <AskQuestionButton
       merchantId={merchantId}
       merchantName={merchantName || "Store"}
       trigger={
        <Button variant="outline" size="lg" className="flex-1">
         <MessageCircle className="h-4 w-4 mr-2" /> Message
        </Button>
       }
      />
     )}
     <Button onClick={() => setCartOpen(true)} className="flex-[2]" size="lg" disabled={!paymentsActive}>
      <ShoppingCart className="h-4 w-4 mr-2" />
       {!paymentsActive
        ? "Pay In-Store"
        : itemCount > 0
        ? `View Cart (${itemCount}) · ${Formatters.currency(totalCents / 100)}`
        : "View Cart"}
     </Button>
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
  pawbucksBalance={
  spendableBalance +
  welcomeCreditBalance +
  // Only include Pet Fund welcome credit if the cart meets its minimum purchase threshold.
  ((petFundBalance > 0 && totalCents / 100 >= (petFundMinTransactionUsd || 0)) ? petFundBalance : 0)
  }
 merchantAcceptsPawBucks={merchantAcceptsPawBucks}
 merchantId={merchantId}
 userId={user?.id ?? null}
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
