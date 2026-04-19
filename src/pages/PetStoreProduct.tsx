import { useState, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSharedAccount, getEffectiveWalletUserId } from "@/hooks/useSharedAccount";
import { supabase } from "@/integrations/supabase/client";
import { Formatters } from "@/utils/formatters";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Coins, ShoppingCart, CreditCard, ChevronLeft, ChevronRight,
  Package, AlertTriangle, TrendingUp, Sparkles, Star, ThumbsUp,
  Check, Shield, Truck, Store,
} from "lucide-react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { SEO } from "@/components/SEO";
import { StarRating } from "@/components/pet-store/StarRating";
import { PromotionalBadge } from "@/components/pet-store/PromotionalBadge";
import { CartIcon } from "@/components/pet-store/CartIcon";
import { CartDrawer, type CartCheckoutParams } from "@/components/pet-store/CartDrawer";
import { usePromotionalItems } from "@/hooks/usePromotionalItems";
import { useShoppingCart } from "@/hooks/useShoppingCart";

export default function PetStoreProduct() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const sharedAccount = useSharedAccount(user?.id);
  const effectiveUserId = getEffectiveWalletUserId(user?.id, sharedAccount);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);

  const { cartItems, itemCount, totalUsd, totalPawbucks, addToCart, updateQuantity, removeFromCart, clearCart, markConverted } = useShoppingCart();

  const { data: wallet } = useQuery({
    queryKey: ["pawbucks-wallet", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return null;
      const { data, error } = await supabase.from("pawbucks_wallet").select("*").eq("user_id", effectiveUserId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveUserId && !sharedAccount.isLoading,
  });

  const { data: subscription } = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("subscriptions").select("status").eq("user_id", user.id).eq("status", "active").maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const isSubscriber = !!subscription;
  const cashbackRate = isSubscriber ? 20 : 10;

  // Fetch item
  const { data: item, isLoading } = useQuery({
    queryKey: ["pet-store-item", itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pet_store_items")
        .select("*, merchants:merchant_id(id, business_name, storefront_slug)")
        .eq("id", itemId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!itemId,
  });

  // Fetch reviews
  const { data: reviews = [] } = useQuery({
    queryKey: ["pet-store-reviews", itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pet_store_reviews")
        .select("*, profiles:user_id(display_name)")
        .eq("item_id", itemId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!itemId,
  });

  const { data: promotionalData } = usePromotionalItems(user?.id);
  const promo = itemId ? promotionalData?.itemMap?.get(itemId) : null;

  const merchant = (item as any)?.merchants;
  const images: string[] = useMemo(() => {
    if (!item) return [];
    const urls: string[] = [];
    if ((item as any).image_urls?.length) urls.push(...(item as any).image_urls);
    else if (item.image_url) urls.push(item.image_url);
    return urls;
  }, [item]);

  const hasPromo = !!promo;
  const discountedPrice = hasPromo ? Math.round(item!.price * (1 - promo!.discountPercentage / 100)) : item?.price ?? 0;
  const ratingAvg = item?.rating_avg ?? 0;
  const ratingCount = item?.rating_count ?? 0;
  const lowStock = item ? item.stock_quantity > 0 && item.stock_quantity <= 5 : false;
  const outOfStock = item?.stock_quantity === 0;
  const inCart = cartItems.find(ci => ci.item_id === itemId);
  const pawbucksEarned = Math.round((discountedPrice / 100) * cashbackRate);

  const handleAddToCart = () => {
    if (!user) { navigate(`/auth?redirect=${encodeURIComponent(location.pathname)}`); return; }
    addToCart.mutate({ itemId: itemId! }, { onSuccess: () => toast.success("Added to cart! 🛒") });
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); navigate("/auth"); };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col">
        <Header isAuthenticated={!!user} onLogout={handleSignOut} />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col">
        <Header isAuthenticated={!!user} onLogout={handleSignOut} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <Package className="h-16 w-16 text-muted-foreground/30" />
          <h2 className="text-xl font-semibold">Product not found</h2>
          <Button onClick={() => navigate("/pet-store")}>Back to Store</Button>
        </div>
      </div>
    );
  }

  // Rating breakdown
  const ratingBreakdown = [5, 4, 3, 2, 1].map(star => {
    const count = reviews.filter((r: any) => r.rating === star).length;
    return { star, count, pct: ratingCount > 0 ? Math.round((count / ratingCount) * 100) : 0 };
  });

  return (
    <>
      <SEO
        title={`${item.name} | PawBucks Pet Store`}
        description={item.description || `Shop ${item.name} at PawBucks Pet Store`}
      />
      <div className="min-h-[100dvh] bg-background flex flex-col">
        <Header isAuthenticated={!!user} onLogout={handleSignOut} />

        <main className="flex-1 container mx-auto px-4 pt-4 pb-24 md:pb-8 max-w-6xl">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
            <button onClick={() => navigate("/pet-store")} className="hover:text-primary transition-colors">Pet Store</button>
            <span>/</span>
            <span className="capitalize">{item.category}</span>
            <span>/</span>
            <span className="text-foreground truncate max-w-[200px]">{item.name}</span>
          </nav>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10">
            {/* Left: Image Gallery */}
            <div className="space-y-3">
              <div className="relative aspect-square rounded-xl overflow-hidden bg-muted/30 border">
                {hasPromo && (
                  <PromotionalBadge
                    discountPercentage={promo!.discountPercentage}
                    badgeEmoji={promo!.badgeEmoji}
                    badgeName={promo!.badgeName}
                    expiresAt={promo!.expiresAt}
                    variant="overlay"
                  />
                )}
                {images.length > 0 ? (
                  <img
                    src={images[selectedImageIndex] || images[0]}
                    alt={item.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-20 w-20 text-muted-foreground/20" />
                  </div>
                )}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={() => setSelectedImageIndex(i => (i - 1 + images.length) % images.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm rounded-full p-1.5 shadow hover:bg-background transition-colors"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setSelectedImageIndex(i => (i + 1) % images.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm rounded-full p-1.5 shadow hover:bg-background transition-colors"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>
              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((url, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImageIndex(idx)}
                      className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                        idx === selectedImageIndex ? "border-primary" : "border-transparent hover:border-muted-foreground/30"
                      }`}
                    >
                      <img src={url} alt={`${item.name} ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Product Info */}
            <div className="space-y-4">
              {/* Badges */}
              <div className="flex gap-2 flex-wrap">
                <Badge variant={item.item_type === 'service' ? 'default' : 'outline'} className="text-xs">
                  {item.item_type === 'service' ? 'Service' : 'Product'}
                </Badge>
                <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                {isSubscriber && (
                  <Badge className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground border-0 text-xs">
                    <Sparkles className="h-3 w-3 mr-1" /> PawPass
                  </Badge>
                )}
                {ratingCount >= 10 && ratingAvg >= 4.0 && (
                  <Badge variant="secondary" className="bg-amber-500/90 text-white border-0 text-xs">
                    <TrendingUp className="h-3 w-3 mr-1" /> Best Seller
                  </Badge>
                )}
              </div>

              {/* Title */}
              <h1 className="text-xl sm:text-2xl font-bold leading-tight">{item.name}</h1>

              {/* Rating */}
              {ratingCount > 0 && (
                <div className="flex items-center gap-2">
                  <StarRating rating={ratingAvg} count={ratingCount} size="md" />
                </div>
              )}

              {/* Merchant */}
              {merchant?.business_name && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Store className="h-3.5 w-3.5" />
                  Sold by{" "}
                  {merchant.storefront_slug ? (
                    <button onClick={() => navigate(`/storefront/${merchant.storefront_slug}`)} className="text-primary hover:underline font-medium">
                      {merchant.business_name}
                    </button>
                  ) : (
                    <span className="font-medium">{merchant.business_name}</span>
                  )}
                </p>
              )}

              <Separator />

              {/* Price */}
              <div className="space-y-2">
                {hasPromo ? (
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-3xl font-bold text-foreground">${(discountedPrice / 100).toFixed(2)}</span>
                      <span className="text-lg text-muted-foreground line-through">${(item.price / 100).toFixed(2)}</span>
                      <Badge variant="destructive" className="text-sm px-2">-{promo!.discountPercentage}%</Badge>
                    </div>
                  </div>
                ) : (
                  <span className="text-3xl font-bold text-foreground">${(item.price / 100).toFixed(2)}</span>
                )}




                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Earn <span className="font-semibold text-primary">{Formatters.number(pawbucksEarned)} PB</span> back with card ({cashbackRate}x)
                </p>
              </div>

              {/* Stock */}
              {lowStock && (
                <p className="text-sm text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" />
                  Only {item.stock_quantity} left in stock — order soon!
                </p>
              )}
              {outOfStock && (
                <p className="text-sm text-destructive font-semibold">Currently unavailable</p>
              )}
              {!outOfStock && !lowStock && item.stock_quantity > 0 && (
                <p className="text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-1.5">
                  <Check className="h-4 w-4" /> In Stock
                </p>
              )}

              <Separator />

              {/* Actions */}
              <div className="space-y-3">
                {user ? (
                  <>
                    <Button
                      className="w-full h-12 text-base"
                      variant={inCart ? "secondary" : "default"}
                      onClick={handleAddToCart}
                      disabled={outOfStock || addToCart.isPending}
                    >
                      {outOfStock ? "Out of Stock" : inCart ? (
                        <><ShoppingCart className="mr-2 h-5 w-5" /> Add More ({inCart.quantity} in cart)</>
                      ) : (
                        <><ShoppingCart className="mr-2 h-5 w-5" /> Add to Cart</>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full h-11"
                      onClick={() => {
                        handleAddToCart();
                        setCartOpen(true);
                      }}
                      disabled={outOfStock}
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      Buy Now — ${(discountedPrice / 100).toFixed(2)}
                    </Button>
                  </>
                ) : (
                  <Button className="w-full h-12 text-base" onClick={() => navigate(`/auth?redirect=${encodeURIComponent(location.pathname)}`)}>
                    Sign in to Shop
                  </Button>
                )}
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2">
                <span className="flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> Secure Checkout</span>
                <span className="flex items-center gap-1"><Truck className="h-3.5 w-3.5" /> Fast Delivery</span>
                <span className="flex items-center gap-1"><Coins className="h-3.5 w-3.5 text-primary" /> Earn Rewards</span>
              </div>
            </div>
          </div>

          {/* Description */}
          {item.description && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold mb-3">About this item</h2>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{item.description}</p>
            </div>
          )}

          <Separator className="my-8" />

          {/* Reviews Section */}
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Customer Reviews</h2>

            {ratingCount > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
                {/* Rating summary */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl font-bold">{ratingAvg.toFixed(1)}</span>
                    <div>
                      <StarRating rating={ratingAvg} showCount={false} size="md" />
                      <p className="text-xs text-muted-foreground mt-0.5">{ratingCount.toLocaleString()} ratings</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {ratingBreakdown.map(({ star, pct }) => (
                      <div key={star} className="flex items-center gap-2 text-xs">
                        <span className="w-8 text-right">{star} ★</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-8 text-muted-foreground">{pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Individual reviews */}
                <div className="space-y-4">
                  {reviews.map((review: any) => (
                    <Card key={review.id} className="overflow-hidden">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <StarRating rating={review.rating} showCount={false} size="sm" />
                            {review.is_verified_purchase && (
                              <Badge variant="secondary" className="text-[10px] h-4">
                                <Check className="h-2.5 w-2.5 mr-0.5" /> Verified Purchase
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(review.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {review.title && <p className="font-medium text-sm">{review.title}</p>}
                        {review.body && <p className="text-sm text-muted-foreground">{review.body}</p>}
                        <div className="flex items-center justify-between pt-1">
                          <p className="text-xs text-muted-foreground">
                            By {(review as any).profiles?.display_name || "Pet Parent"}
                          </p>
                          {review.helpful_count > 0 && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <ThumbsUp className="h-3 w-3" /> {review.helpful_count} found helpful
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Star className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm">No reviews yet. Be the first to review this product!</p>
              </div>
            )}
          </div>
        </main>

        {/* Floating cart icon */}
        {user && (
          <div className="fixed bottom-20 right-4 md:bottom-6 z-50">
            <CartIcon itemCount={itemCount} onClick={() => setCartOpen(true)} />
          </div>
        )}

        <CartDrawer
          open={cartOpen}
          onOpenChange={setCartOpen}
          items={cartItems}
          totalUsd={totalUsd}
          totalPawbucks={totalPawbucks}
          onUpdateQuantity={(cartItemId, qty) => updateQuantity.mutate({ cartItemId, quantity: qty })}
          onRemoveItem={(cartItemId) => removeFromCart.mutate(cartItemId)}
          onClearCart={() => clearCart.mutate()}
          onCheckout={() => {}}
          isUpdating={updateQuantity.isPending || removeFromCart.isPending || clearCart.isPending}
          isCheckingOut={false}
          pawbucksBalance={wallet?.balance || 0}
        />

        {user && <BottomNav />}
      </div>
    </>
  );
}
