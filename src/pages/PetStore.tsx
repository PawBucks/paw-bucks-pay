import { useState, useCallback, useMemo, useEffect } from"react";
import { useAuth } from"@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from"@tanstack/react-query";
import { usePullToRefresh } from"@/hooks/usePullToRefresh";
import { useSharedAccount, getEffectiveWalletUserId } from"@/hooks/useSharedAccount";
import { supabase } from"@/integrations/supabase/client";
import { Formatters } from"@/utils/formatters";
import { Button } from"@/components/ui/button";
import { Card, CardContent } from"@/components/ui/card";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
import { Badge } from"@/components/ui/badge";
import { Input } from"@/components/ui/input";
import { Separator } from"@/components/ui/separator";
import { toast } from"sonner";
import { Store, Search, SlidersHorizontal, X } from "lucide-react";
import { useNavigate, useSearchParams } from"react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from"@/components/ui/dialog";
import { Elements, PaymentElement, useStripe, useElements } from"@stripe/react-stripe-js";
import { Loader2 } from "lucide-react";
import { BottomNav } from"@/components/BottomNav";
import { AdPlacement } from"@/components/AdPlacement";
import { Header } from"@/components/Header";
import { SEO } from"@/components/SEO";
import { seoMeta } from"@/lib/seoMeta";
import { PullToRefresh } from"@/components/PullToRefresh";
import { CartIcon } from"@/components/pet-store/CartIcon";
import { CartDrawer, type CartCheckoutParams } from"@/components/pet-store/CartDrawer";
import { ProductCard } from"@/components/pet-store/ProductCard";
import { usePromotionalItems } from"@/hooks/usePromotionalItems";
import { useShoppingCart } from"@/hooks/useShoppingCart";
import { getStripePromise } from"@/lib/stripe";
import { buildAppUrl } from"@/lib/url";

const CATEGORIES = ["All","Food","Treats","Toys","Bedding","Accessories","Healthcare","Grooming","Sanitation"];
const ITEM_TYPES = ["All","Product","Service"] as const;
const SORT_OPTIONS = [
 { value:"featured", label:"Featured" },
 { value:"price-low", label:"Price: Low to High" },
 { value:"price-high", label:"Price: High to Low" },
 { value:"rating", label:"Avg. Customer Review" },
 { value:"newest", label:"Newest Arrivals" },
] as const;

type SortOption = (typeof SORT_OPTIONS)[number]["value"];

type PetStorePaymentFormProps = {
 itemId: string;
 itemName: string;
 quantity: number;
 totalAmountDollars: number;
 cashbackRate: number;
 onSuccess: () => void;
 onCancel: () => void;
};

const PetStorePaymentForm = ({
 itemId,
 itemName,
 quantity,
 totalAmountDollars,
 cashbackRate,
 onSuccess,
 onCancel,
}: PetStorePaymentFormProps) => {
 const stripe = useStripe();
 const elements = useElements();
 const [isLoading, setIsLoading] = useState(false);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!stripe || !elements) return;
 setIsLoading(true);
 try {
 const result = await stripe.confirmPayment({
 elements,
 confirmParams: { return_url: buildAppUrl("/pet-store") },
 redirect:'if_required',
 });
 if (result.error) throw result.error;

 // Call backend to confirm, deduct stock, award PawBucks, and send receipt
 const paymentIntentId = result.paymentIntent?.id;
 if (paymentIntentId) {
 const { data: confirmData, error: confirmError } = await supabase.functions.invoke(
'confirm-pet-store-payment',
 { body: { paymentIntentId } }
 );
 if (confirmError || confirmData?.error || !confirmData?.success) {
 throw new Error(confirmError?.message || confirmData?.error ||"Payment succeeded, but order finalization failed");
 }
 console.log("[PET-STORE] Payment confirmed:", confirmData);
 const earned = confirmData?.pawbucksEarned || Math.round(totalAmountDollars * cashbackRate);
 toast.success(`Payment successful! You earned ${earned.toLocaleString()} PawBucks!`);
 } else {
 const pawbucksEarned = Math.round(totalAmountDollars * cashbackRate);
 toast.success(`Payment successful! You earned ${pawbucksEarned} PawBucks!`);
 }
 onSuccess();
 } catch (error: any) {
 console.error("Payment error:", error);
 toast.error(error.message ||"Payment failed");
 } finally {
 setIsLoading(false);
 }
 };

 const pawbucksEarned = Math.round(totalAmountDollars * cashbackRate);

 return (
 <form onSubmit={handleSubmit} className="space-y-4">
 <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 mb-4">
 <div className="flex justify-between text-sm mb-2">
 <span className="text-muted-foreground">Item:</span>
 <span className="font-medium">{itemName} x{quantity}</span>
 </div>
 <div className="flex justify-between text-sm mb-2">
 <span className="text-muted-foreground">Amount:</span>
 <span className="font-medium">{Formatters.currency(totalAmountDollars)}</span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">You'll earn ({cashbackRate}x):</span>
 <span className="font-bold text-accent flex items-center gap-1">
 <span className="h-3 w-3" aria-hidden="true">🐾</span>
 {pawbucksEarned} PawBucks
 </span>
 </div>
 </div>
 <PaymentElement />
 <div className="flex gap-3">
 <Button type="button" variant="outline" onClick={onCancel} className="flex-1" disabled={isLoading}>Cancel</Button>
 <Button type="submit" className="flex-1" disabled={isLoading || !stripe}>
 {isLoading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>) :"Pay Now"}
 </Button>
 </div>
 </form>
 );
};

export default function PetStore() { const { user, signOut } = useAuth();
 const navigate = useNavigate();
 const queryClient = useQueryClient();
 const sharedAccount = useSharedAccount(user?.id);
 const effectiveUserId = getEffectiveWalletUserId(user?.id, sharedAccount);
 const [selectedCategory, setSelectedCategory] = useState("All");
 const [selectedType, setSelectedType] = useState("All");
 const [searchQuery, setSearchQuery] = useState("");
 const [sortBy, setSortBy] = useState<SortOption>("featured");
 const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
 const [selectedItem, setSelectedItem] = useState<any>(null);
 const [clientSecret, setClientSecret] = useState("");
 const [isCreatingIntent, setIsCreatingIntent] = useState(false);
 const [cartOpen, setCartOpen] = useState(false);
 const [showFilters, setShowFilters] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Auto-open cart drawer when navigated with ?cart=open (e.g. from abandoned cart notification)
  useEffect(() => {
    if (searchParams.get("cart") === "open") {
      setCartOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("cart");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

 // Shopping cart
 const {
 cart,
 cartItems,
 itemCount,
 totalUsd,
 totalPawbucks,
 addToCart,
 updateQuantity,
 removeFromCart,
 clearCart,
 markConverted,
 } = useShoppingCart();

 // PawBucks wallet
 const { data: wallet } = useQuery({
 queryKey: ["pawbucks-wallet", effectiveUserId],
 queryFn: async () => {
 if (!effectiveUserId) return null;
 const { data, error } = await supabase
 .from("pawbucks_wallet")
 .select("*")
 .eq("user_id", effectiveUserId)
 .single();
 if (error) throw error;
 return data;
 },
 enabled: !!effectiveUserId && !sharedAccount.isLoading,
 });

 const { data: subscription } = useQuery({
 queryKey: ["subscription", user?.id],
 queryFn: async () => {
 if (!user) return null;
 const { data, error } = await supabase
 .from("subscriptions")
 .select("status")
 .eq("user_id", user.id)
 .eq("status","active")
 .maybeSingle();
 if (error) throw error;
 return data;
 },
 enabled: !!user,
 });

 const isSubscriber = !!subscription;
 const cashbackRate = isSubscriber ? 20 : 10;

 const { data: promotionalData } = usePromotionalItems(user?.id);
 const promotionalItemMap = promotionalData?.itemMap || new Map();

 // Auto-redeem preference
 const { data: autoRedeemPref } = useQuery({
 queryKey: ["auto-redeem-preference", user?.id],
 queryFn: async () => {
 if (!user?.id) return { enabled: false, mode:'off' };
 const { data } = await supabase.from('profiles').select('auto_redeem_mode').eq('id', user.id).single();
 const mode = data?.auto_redeem_mode ||'off';
 return { enabled: mode !=='off', mode };
 },
 staleTime: 1000 * 60 * 5,
 enabled: !!user?.id,
 });

 // Fetch items with merchant info
 const { data: items, isLoading } = useQuery({
 queryKey: ["pet-store-items"],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("pet_store_items")
 .select("*, merchants:merchant_id(id, business_name, storefront_slug)")
 .eq("is_active", true)
 .order("created_at", { ascending: false });
 if (error) throw error;
 return data;
 },
 });

 // PawBucks purchase for entire cart (server-side via edge function)
 const cartPawbucksPurchase = useMutation({
 mutationFn: async () => {
 if (!user || !effectiveUserId) throw new Error("Must be logged in");
 if (!wallet || wallet.balance < totalPawbucks) throw new Error("Insufficient PawBucks balance");

 const items = cartItems.map(ci => ({ itemId: ci.item.id, quantity: ci.quantity }));
 const cartId = cartItems[0] ? undefined : undefined;

 // Get cart ID from the shopping cart hook
 const { data: cartData } = await supabase
 .from("shopping_carts")
 .select("id")
 .eq("user_id", user.id)
 .eq("status","active")
 .maybeSingle();

 const { data, error } = await supabase.functions.invoke('pet-store-pawbucks-purchase', {
 body: { items, cartId: cartData?.id },
 });

 if (error) throw new Error(error.message ||"Purchase failed");
 if (data?.error) throw new Error(data.error);

 return data;
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["pawbucks-wallet"] });
 queryClient.invalidateQueries({ queryKey: ["pet-store-items"] });
 queryClient.invalidateQueries({ queryKey: ["shopping-cart"] });
 queryClient.invalidateQueries({ queryKey: ["shopping-cart-items"] });
 setCartOpen(false);
 toast.success("Purchase successful! 🎉");
 },
 onError: (error: any) => toast.error(error.message ||"Purchase failed"),
 });

 const handleAddToCart = (itemId: string) => {
 if (!user) { navigate("/auth"); return; }
 addToCart.mutate({ itemId }, { onSuccess: () => toast.success("Added to cart! 🛒") });
 };

 const handlePurchaseWithCard = async (item: any) => {
 if (!user) { navigate("/auth"); return; }
 setSelectedItem(null);
 setIsCreatingIntent(true);
 setPaymentDialogOpen(true);
 try {
 const { data, error } = await supabase.functions.invoke('create-pet-store-payment', {
 body: { itemId: item.id, quantity: 1, autoRedeem: autoRedeemPref?.enabled ?? false },
 });
 if (error) throw error;
 if (data?.error) throw new Error(data.error);
 
 // Auto-redeem may have fully covered the purchase
 if (data?.paid_with_pawbucks) {
 toast.success(data.message ||"Purchase completed with PawBucks!");
 setPaymentDialogOpen(false);
 queryClient.invalidateQueries({ queryKey: ["pawbucks-wallet"] });
 queryClient.invalidateQueries({ queryKey: ["pet-store-items"] });
 return;
 }
 
 setSelectedItem({
 id: item.id,
 name: data?.orderSummary || item.name,
 quantity: data?.totalQuantity || 1,
 priceDollars: data?.cardAmount ?? data?.finalPrice ?? (item.price / 100),
 });
 setClientSecret(data.clientSecret);
 } catch (error: any) {
 toast.error(error.message ||"Failed to initialize payment");
 setPaymentDialogOpen(false);
 } finally {
 setIsCreatingIntent(false);
 }
 };

 const handleCartCheckout = async (params: CartCheckoutParams) => {
 if (!user || cartItems.length === 0) return;
 if (params.mode ==="pawbucks") { cartPawbucksPurchase.mutate(); return; }

 const firstItem = cartItems[0];
 setSelectedItem(null);
 setIsCreatingIntent(true);
 setPaymentDialogOpen(true);
 setCartOpen(false);
 try {
 const items = cartItems.map(ci => ({ itemId: ci.item.id, quantity: ci.quantity }));
 const { data, error } = await supabase.functions.invoke('create-pet-store-payment', {
 body: { items, pawbucksAmount: params.pawbucksAmount || 0, cartId: cart?.id, autoRedeem: autoRedeemPref?.enabled ?? false },
 });
 if (error) throw error;
 if (data?.error) throw new Error(data.error);
 
 // Auto-redeem may have fully covered the purchase
 if (data?.paid_with_pawbucks) {
 toast.success(data.message ||"Purchase completed with PawBucks!");
 setPaymentDialogOpen(false);
 await markConverted();
 queryClient.invalidateQueries({ queryKey: ["pawbucks-wallet"] });
 queryClient.invalidateQueries({ queryKey: ["pet-store-items"] });
 queryClient.invalidateQueries({ queryKey: ["shopping-cart-items"] });
 return;
 }
 
 setSelectedItem({
 id: firstItem.item.id,
 name: data?.orderSummary || `${cartItems.length} item order`,
 quantity: data?.totalQuantity || cartItems.reduce((sum, item) => sum + item.quantity, 0),
 priceDollars: data?.cardAmount ?? data?.finalPrice ?? (params.cardAmountCents / 100),
 });
 setClientSecret(data.clientSecret);
 } catch (error: any) {
 toast.error(error.message ||"Failed to initialize payment");
 setPaymentDialogOpen(false);
 } finally {
 setIsCreatingIntent(false);
 }
 };

 const handlePaymentSuccess = () => {
 setPaymentDialogOpen(false);
 setSelectedItem(null);
 setClientSecret("");
 markConverted();
 queryClient.invalidateQueries({ queryKey: ["pawbucks-wallet"] });
 queryClient.invalidateQueries({ queryKey: ["pet-store-items"] });
 queryClient.invalidateQueries({ queryKey: ["shopping-cart"] });
 queryClient.invalidateQueries({ queryKey: ["shopping-cart-items"] });
 };

 const handlePaymentCancel = () => {
 setPaymentDialogOpen(false);
 setSelectedItem(null);
 setClientSecret("");
 };

 const handleSignOut = async () => { await signOut(); };

 const handleRefresh = useCallback(async () => {
 await queryClient.invalidateQueries({ queryKey: ["pet-store-items"] });
 await queryClient.invalidateQueries({ queryKey: ["pawbucks-wallet"] });
 }, [queryClient]);

 const { containerRef, isRefreshing, pullDistance, progress } = usePullToRefresh({ onRefresh: handleRefresh });

 // Filter & sort
 const filteredItems = useMemo(() => {
 let result = items?.filter(item => {
 const matchesCategory = selectedCategory ==="All" || item.category === selectedCategory;
 const matchesType = selectedType ==="All" ||
 (selectedType ==="Product" && (item.item_type ==="product" || !item.item_type)) ||
 (selectedType ==="Service" && item.item_type ==="service");
 const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 item.description?.toLowerCase().includes(searchQuery.toLowerCase());
 return matchesCategory && matchesType && matchesSearch;
 }) || [];

 // Sort
 switch (sortBy) {
 case"price-low":
 result = [...result].sort((a, b) => a.price - b.price);
 break;
 case"price-high":
 result = [...result].sort((a, b) => b.price - a.price);
 break;
 case"rating":
 result = [...result].sort((a, b) => (b.rating_avg ?? 0) - (a.rating_avg ?? 0));
 break;
 case"newest":
 result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
 break;
 case"featured":
 default:
 // Featured: prioritize items with promos, then high rating, then newest
 result = [...result].sort((a, b) => {
 const aPromo = promotionalItemMap.has(a.id) ? 1 : 0;
 const bPromo = promotionalItemMap.has(b.id) ? 1 : 0;
 if (aPromo !== bPromo) return bPromo - aPromo;
 const aRating = (a.rating_avg ?? 0) * (a.rating_count ?? 0);
 const bRating = (b.rating_avg ?? 0) * (b.rating_count ?? 0);
 return bRating - aRating;
 });
 break;
 }
 return result;
 }, [items, selectedCategory, selectedType, searchQuery, sortBy, promotionalItemMap]);

 const activeFilterCount = (selectedCategory !=="All" ? 1 : 0) + (selectedType !=="All" ? 1 : 0);
 const totalResults = filteredItems.length;

 return (
 <>
 <SEO
 title={seoMeta.petStore.title}
 description={seoMeta.petStore.description}
 keywords={[...seoMeta.petStore.keywords]}
 canonical={seoMeta.petStore.canonical}
 />
 <div className="min-h-[100dvh] bg-background flex flex-col">
 <Header isAuthenticated={!!user} onLogout={handleSignOut} />

 <PullToRefresh
 ref={containerRef}
 isRefreshing={isRefreshing}
 pullDistance={pullDistance}
 progress={progress}
 className="flex-1"
 >
 <main className="container mx-auto px-4 pt-4 pb-24 md:pb-8 max-w-7xl">
 <div className="mb-4 sm:mb-6">
 <AdPlacement />
 </div>

 {/* Top bar: Title + wallet + cart */}
 <div className="mb-4">
 <div className="flex justify-between items-center gap-3 mb-1">
 <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">PawBucks Pet Store</h1>
 <div className="flex items-center gap-2">
 {user && wallet && (
 <div className="flex items-center gap-1.5 bg-primary/10 px-2.5 py-1 rounded-lg">
 <span className="h-3.5 w-3.5 text-primary" aria-hidden="true">🐾</span>
 <span className="text-xs font-semibold">{Formatters.number(wallet.balance)} PB</span>
 </div>
 )}
 {user && <CartIcon itemCount={itemCount} onClick={() => setCartOpen(true)} />}
 </div>
 </div>
 <p className="text-sm text-muted-foreground">
 Shop for your furry friends — earn PawBucks on every purchase!
 </p>
 </div>

 {/* Search + Filter Bar (Amazon-style) */}
 <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b pb-3 mb-4 -mx-4 px-4">
 <div className="flex gap-2 items-center">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input
 placeholder="Search pet supplies..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="pl-9 pr-8 h-10"
 />
 {searchQuery && (
 <button
 onClick={() => setSearchQuery("")}
 className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
 >
 <X className="h-4 w-4" />
 </button>
 )}
 </div>
 <Button
 variant={showFilters || activeFilterCount > 0 ?"default" :"outline"}
 size="icon"
 className="h-10 w-10 flex-shrink-0"
 onClick={() => setShowFilters(!showFilters)}
 >
 <SlidersHorizontal className="h-4 w-4" />
 {activeFilterCount > 0 && (
 <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-4 w-4 text-[10px] flex items-center justify-center">
 {activeFilterCount}
 </span>
 )}
 </Button>
 </div>

 {/* Collapsible filters */}
 {showFilters && (
 <div className="flex flex-wrap gap-2 mt-3 animate-fade-in">
 <Select value={selectedType} onValueChange={setSelectedType}>
 <SelectTrigger className="w-28 h-8 text-xs">
 <SelectValue placeholder="Type" />
 </SelectTrigger>
 <SelectContent>
 {ITEM_TYPES.map((type) => (
 <SelectItem key={type} value={type}>{type}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 <Select value={selectedCategory} onValueChange={setSelectedCategory}>
 <SelectTrigger className="w-36 h-8 text-xs">
 <SelectValue placeholder="Category" />
 </SelectTrigger>
 <SelectContent>
 {CATEGORIES.map((cat) => (
 <SelectItem key={cat} value={cat}>{cat}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 {activeFilterCount > 0 && (
 <Button
 variant="ghost"
 size="sm"
 className="h-8 text-xs text-muted-foreground"
 onClick={() => { setSelectedCategory("All"); setSelectedType("All"); }}
 >
 Clear filters
 </Button>
 )}
 </div>
 )}

 {/* Results bar */}
 <div className="flex items-center justify-between mt-3">
 <p className="text-xs text-muted-foreground">
 {searchQuery ? (
 <>Showing <span className="font-semibold text-foreground">{totalResults}</span> results for"<span className="font-medium">{searchQuery}</span>"</>
 ) : (
 <><span className="font-semibold text-foreground">{totalResults}</span> results</>
 )}
 </p>
 <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
 <SelectTrigger className="w-44 h-8 text-xs">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {SORT_OPTIONS.map((opt) => (
 <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>

 {/* Category pills (horizontal scroll) */}
 <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide -mx-1 px-1">
 {CATEGORIES.map((cat) => (
 <button
 key={cat}
 onClick={() => setSelectedCategory(cat)}
 className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
 selectedCategory === cat
 ?"bg-primary text-primary-foreground shadow-sm"
 :"bg-muted/60 text-muted-foreground hover:bg-muted"
 }`}
 >
 {cat}
 </button>
 ))}
 </div>

 {/* Product Grid */}
 {isLoading ? (
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4" role="status" aria-label="Loading products">
 {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
 <Card key={i} className="flex flex-col">
 <div className="w-full aspect-square bg-muted rounded-t-lg skeleton-pulse" />
 <CardContent className="pt-3 space-y-2">
 <div className="h-4 w-3/4 bg-muted rounded skeleton-pulse" />
 <div className="h-3 w-1/2 bg-muted rounded skeleton-pulse" />
 <div className="h-5 w-1/3 bg-muted rounded skeleton-pulse" />
 <div className="h-8 w-full bg-muted rounded skeleton-pulse" />
 </CardContent>
 </Card>
 ))}
 </div>
 ) : filteredItems.length === 0 ? (
 <div className="text-center py-16 px-4">
 <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
 <span className="w-8 h-8 text-muted-foreground" aria-hidden="true">🏪</span>
 </div>
 <h3 className="text-xl font-semibold mb-2">No items found</h3>
 <p className="text-muted-foreground mb-4">Try adjusting your search or filters.</p>
 <Button variant="outline" onClick={() => { setSearchQuery(""); setSelectedCategory("All"); setSelectedType("All"); }}>
 Clear Filters
 </Button>
 </div>
 ) : (
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
 {filteredItems.map((item) => {
 const promo = promotionalItemMap.get(item.id);
 const inCart = cartItems.find((ci) => ci.item_id === item.id);
 const merchant = (item as any).merchants;

 return (
 <ProductCard
 key={item.id}
 item={item}
 merchantName={merchant?.business_name || null}
 merchantSlug={merchant?.storefront_slug || null}
 promo={promo || null}
 inCartQuantity={inCart?.quantity}
 isSubscriber={isSubscriber}
 isAuthenticated={!!user}
 onAddToCart={handleAddToCart}
 onBuyNow={handlePurchaseWithCard}
 isAdding={addToCart.isPending}
 />
 );
 })}
 </div>
 )}

 <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
 <DialogContent className="max-w-md">
 <DialogHeader>
 <DialogTitle>Pay with Credit Card</DialogTitle>
 </DialogHeader>
 {isCreatingIntent ? (
 <div className="flex items-center justify-center py-8">
 <Loader2 className="w-8 h-8 animate-spin text-primary" />
 </div>
 ) : clientSecret && selectedItem ? (
 <Elements stripe={getStripePromise()} options={{ clientSecret }}>
 <PetStorePaymentForm
 itemId={selectedItem.id}
 itemName={selectedItem.name}
 quantity={selectedItem.quantity ?? 1}
 totalAmountDollars={selectedItem.priceDollars}
 cashbackRate={cashbackRate}
 onSuccess={handlePaymentSuccess}
 onCancel={handlePaymentCancel}
 />
 </Elements>
 ) : null}
 </DialogContent>
 </Dialog>

 <div className="mt-8 mb-6">
 <AdPlacement position="bottom" />
 </div>
 </main>
 </PullToRefresh>

 {/* Cart Drawer */}
 <CartDrawer
 open={cartOpen}
 onOpenChange={setCartOpen}
 items={cartItems}
 totalUsd={totalUsd}
 totalPawbucks={totalPawbucks}
 onUpdateQuantity={(cartItemId, qty) => updateQuantity.mutate({ cartItemId, quantity: qty })}
 onRemoveItem={(cartItemId) => removeFromCart.mutate(cartItemId)}
 onClearCart={() => clearCart.mutate()}
 onCheckout={handleCartCheckout}
 isUpdating={updateQuantity.isPending || removeFromCart.isPending || clearCart.isPending}
 isCheckingOut={cartPawbucksPurchase.isPending}
 pawbucksBalance={wallet?.balance || 0}
 />

 {user && <BottomNav />}
 </div>
 </>
 );
}
