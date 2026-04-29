import { memo } from"react";
import { Card, CardContent, CardFooter } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { ShoppingCart, Coins, CreditCard, Plus, Store, Package, Sparkles, TrendingUp, AlertTriangle } from"lucide-react";
import { Formatters } from"@/utils/formatters";
import { StarRating } from"./StarRating";
import { PromotionalBadge } from"./PromotionalBadge";
import { useNavigate } from"react-router-dom";

interface ProductCardProps {
 item: {
 id: string;
 name: string;
 description: string | null;
 price: number;
 price_pawbucks: number;
 image_url: string | null;
 category: string;
 item_type: string;
 stock_quantity: number;
 rating_avg?: number;
 rating_count?: number;
 merchant_id: string | null;
 };
 merchantName?: string | null;
 merchantSlug?: string | null;
 promo?: {
 discountPercentage: number;
 badgeEmoji: string;
 badgeName: string;
 expiresAt: string;
 } | null;
 inCartQuantity?: number;
 isSubscriber?: boolean;
 isAuthenticated?: boolean;
 onAddToCart: (itemId: string) => void;
 onBuyNow: (item: any) => void;
 isAdding?: boolean;
}

export const ProductCard = memo(({
 item,
 merchantName,
 merchantSlug,
 promo,
 inCartQuantity,
 isSubscriber,
 isAuthenticated,
 onAddToCart,
 onBuyNow,
 isAdding,
}: ProductCardProps) => {
 const navigate = useNavigate();
 const hasPromo = !!promo;
 const discountedPrice = hasPromo
 ? Math.round(item.price * (1 - promo!.discountPercentage / 100))
 : item.price;
 const ratingAvg = item.rating_avg ?? 0;
 const ratingCount = item.rating_count ?? 0;
 const lowStock = item.stock_quantity > 0 && item.stock_quantity <= 5;
 const outOfStock = item.stock_quantity === 0;

 return (
 <Card className={`group flex flex-col overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer ${hasPromo ?'ring-2 ring-primary/40' :''} ${outOfStock ?'opacity-70' :''}`}
 onClick={() => navigate(`/pet-store/${item.id}`)}
 >
 {/* Image */}
 <div className="relative aspect-square overflow-hidden bg-muted/30">
 {hasPromo && (
 <PromotionalBadge
 discountPercentage={promo!.discountPercentage}
 badgeEmoji={promo!.badgeEmoji}
 badgeName={promo!.badgeName}
 expiresAt={promo!.expiresAt}
 variant="overlay"
 />
 )}
 {item.image_url ? (
 <img
 src={item.image_url}
 alt={item.name}
 className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
 loading="lazy"
 />
 ) : (
 <div className="w-full h-full flex items-center justify-center">
 <Package className="h-12 w-12 text-muted-foreground/30" />
 </div>
 )}

 {/* PawPass badge */}
 {isSubscriber && (
 <div className="absolute top-2 left-2">
 <Badge className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground border-0 text-[10px] px-1.5 py-0.5 shadow">
 <Sparkles className="h-2.5 w-2.5 mr-0.5" /> PawPass
 </Badge>
 </div>
 )}

 {/* Best seller indicator */}
 {ratingCount >= 10 && ratingAvg >= 4.0 && (
 <div className="absolute bottom-2 left-2">
 <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 bg-warning/90 text-white border-0">
 <TrendingUp className="h-2.5 w-2.5 mr-0.5" /> Best Seller
 </Badge>
 </div>
 )}
 </div>

 {/* Content */}
 <CardContent className="flex-1 pt-3 pb-2 px-3 space-y-1.5">
 {/* Product name */}
 <h3 className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
 {item.name}
 </h3>

 {/* Star rating */}
 {ratingCount > 0 && (
 <StarRating rating={ratingAvg} count={ratingCount} size="sm" />
 )}

 {/* Sold by merchant */}
 {merchantName && (
 <p className="text-[11px] text-muted-foreground">
 Sold by{""}
 {merchantSlug ? (
 <button
 onClick={(e) => { e.stopPropagation(); navigate(`/storefront/${merchantSlug}`); }}
 className="text-primary hover:underline"
 >
 {merchantName}
 </button>
 ) : (
 <span>{merchantName}</span>
 )}
 </p>
 )}

 {/* Price block */}
 <div className="space-y-0.5">
 {hasPromo ? (
 <div className="flex items-baseline gap-1.5 flex-wrap">
 <span className="text-lg font-bold text-foreground">
 ${(discountedPrice / 100).toFixed(2)}
 </span>
 <span className="text-xs text-muted-foreground line-through">
 ${(item.price / 100).toFixed(2)}
 </span>
 <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
 -{promo!.discountPercentage}%
 </Badge>
 </div>
 ) : (
 <span className="text-lg font-bold text-foreground">
 ${(item.price / 100).toFixed(2)}
 </span>
 )}

 </div>


 {/* Type + Category badges */}
 <div className="flex gap-1 flex-wrap">
 <Badge variant={item.item_type ==='service' ?'default' :'outline'} className="text-[10px] px-1.5 py-0 h-4">
 {item.item_type ==='service' ?'Service' :'Product'}
 </Badge>
 <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
 {item.category}
 </Badge>
 </div>

 {/* Stock status */}
 {lowStock && (
 <p className="text-[11px] text-warning font-medium flex items-center gap-1">
 <AlertTriangle className="h-3 w-3" />
 Only {item.stock_quantity} left in stock!
 </p>
 )}
 {outOfStock && (
 <p className="text-xs text-destructive font-medium">Currently unavailable</p>
 )}
 </CardContent>

 {/* Actions */}
 <CardFooter className="px-3 pb-3 pt-0 flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
 {isAuthenticated ? (
 <>
 <Button
 className="w-full h-9 text-sm"
 variant={inCartQuantity ?"secondary" :"default"}
 onClick={() => onAddToCart(item.id)}
 disabled={outOfStock || isAdding}
 size="sm"
 >
 {outOfStock ? (
"Out of Stock"
 ) : inCartQuantity ? (
 <>
 <Plus className="mr-1 h-3.5 w-3.5" />
 Add More ({inCartQuantity})
 </>
 ) : (
 <>
 <ShoppingCart className="mr-1 h-3.5 w-3.5" />
 Add to Cart
 </>
 )}
 </Button>
 <Button
 variant="outline"
 size="sm"
 className="w-full h-8 text-xs"
 onClick={() => onBuyNow({ ...item, price: discountedPrice })}
 disabled={outOfStock}
 >
 <CreditCard className="mr-1 h-3 w-3" />
 Buy Now ${(discountedPrice / 100).toFixed(2)}
 </Button>
 </>
 ) : (
 <Button className="w-full h-9 text-sm" onClick={() => navigate(`/auth?redirect=${encodeURIComponent(`/pet-store/${item.id}`)}`)} size="sm">
 Sign in to Shop
 </Button>
 )}
 </CardFooter>
 </Card>
 );
});
ProductCard.displayName ="ProductCard";
