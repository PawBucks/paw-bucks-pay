import { useState, useEffect } from"react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from"@/components/ui/sheet";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { Separator } from"@/components/ui/separator";
import { Slider } from"@/components/ui/slider";
import { CreditCard, Loader2, Minus, Package, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Formatters } from"@/utils/formatters";
import { motion, AnimatePresence } from"framer-motion";
import type { StorefrontCartItem } from"@/hooks/useStorefrontCart";
import { PawBucksLogo } from "@/components/PawBucksLogo";
import { useMerchantBrandedBalances } from "@/hooks/useMerchantBrandedBalances";

const PAWBUCKS_TO_USD = 0.001; // 1000 PB = $1

export type StorefrontCheckoutMode ="card" |"pawbucks" |"split";

export interface StorefrontCheckoutParams {
 mode: StorefrontCheckoutMode;
 pawbucksAmount: number;
 cardAmountCents: number;
}

interface StorefrontCartDrawerProps {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 items: StorefrontCartItem[];
 totalCents: number;
 onUpdateQuantity: (priceId: string, quantity: number) => void;
 onRemoveItem: (priceId: string) => void;
 onClearCart: () => void;
 onCheckout: (params: StorefrontCheckoutParams) => void;
 isUpdating?: boolean;
 isCheckingOut?: boolean;
 pawbucksBalance?: number;
 merchantAcceptsPawBucks?: boolean;
 merchantId?: string | null;
 userId?: string | null;
}

export function StorefrontCartDrawer({
 open,
 onOpenChange,
 items,
 totalCents,
 onUpdateQuantity,
 onRemoveItem,
 onClearCart,
 onCheckout,
 isUpdating,
 isCheckingOut = false,
 pawbucksBalance = 0,
 merchantAcceptsPawBucks = false,
 merchantId,
 userId,
}: StorefrontCartDrawerProps) {
 const [pawbucksPercent, setPawbucksPercent] = useState(0);
 const { data: brandedBalances = [] } = useMerchantBrandedBalances(userId, merchantId);

 const totalDollars = totalCents / 100;
 const maxPawbucksForTotal = Math.floor(totalDollars / PAWBUCKS_TO_USD);
 const maxApplicable = Math.min(pawbucksBalance, maxPawbucksForTotal);
 const maxPercent =
 maxPawbucksForTotal > 0
 ? Math.floor((maxApplicable / maxPawbucksForTotal) * 100)
 : 0;

 const pawbucksToSpend = Math.floor((pawbucksPercent / 100) * maxPawbucksForTotal);
 const actualPawbucks = Math.min(pawbucksToSpend, maxApplicable);
 const pawbucksUsdValue = actualPawbucks * PAWBUCKS_TO_USD;
 const cardDollars = Math.max(totalDollars - pawbucksUsdValue, 0);
 const cardCents = Math.round(cardDollars * 100);

 const MIN_STRIPE_CENTS = 50;
 const needsMinStripe = cardCents > 0 && cardCents < MIN_STRIPE_CENTS;

 const getMode = (): StorefrontCheckoutMode => {
 if (actualPawbucks === 0) return"card";
 if (cardCents === 0) return"pawbucks";
 return"split";
 };

 // Default slider to MAX apply when cart total changes.
 useEffect(() => {
  setPawbucksPercent(maxPercent);
 }, [totalCents, maxPercent]);

 const canCheckout =
 items.length > 0 && !isUpdating && !isCheckingOut && !needsMinStripe;

 const canAffordFull = pawbucksBalance >= maxPawbucksForTotal && maxPawbucksForTotal > 0;

 const handleCheckout = () => {
 onCheckout({
 mode: getMode(),
 pawbucksAmount: actualPawbucks,
 cardAmountCents: cardCents,
 });
 };

 return (
 <Sheet open={open} onOpenChange={onOpenChange}>
 <SheetContent className="flex flex-col w-full sm:max-w-lg">
 <SheetHeader>
 <SheetTitle className="flex items-center gap-2">
 <ShoppingCart className="h-5 w-5" aria-hidden />
 Shopping Cart
 {items.length > 0 && (
 <Badge variant="secondary" className="ml-1">
 {items.reduce((s, i) => s + i.quantity, 0)} items
 </Badge>
 )}
 </SheetTitle>
 </SheetHeader>

 {items.length === 0 ? (
 <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4">
 <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
 <Package className="w-10 h-10 text-muted-foreground" />
 </div>
 <div>
 <h3 className="font-semibold text-lg">Your cart is empty</h3>
 <p className="text-sm text-muted-foreground mt-1">
 Browse the store and add items you love!
 </p>
 </div>
 <Button variant="outline" onClick={() => onOpenChange(false)}>
 Continue Shopping
 </Button>
 </div>
 ) : (
 <>
 {/* Items list */}
 <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-3">
 <AnimatePresence mode="popLayout">
 {items.map((item) => (
 <motion.div
 key={item.priceId}
 layout
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, x: -100 }}
 className="flex gap-3 p-3 rounded-lg border bg-card"
 >
 {item.image ? (
 <img
 src={item.image}
 alt={item.name}
 className="w-16 h-16 rounded-md object-cover flex-shrink-0"
 />
 ) : (
 <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
 <Package className="w-6 h-6 text-muted-foreground" />
 </div>
 )}

 <div className="flex-1 min-w-0">
 <h4 className="font-medium text-sm truncate">{item.name}</h4>
 <span className="text-sm font-semibold">
 {Formatters.currency((item.unitAmount / 100))}
 </span>

 <div className="flex items-center justify-between mt-2">
 <div className="flex items-center gap-1">
 <Button
 variant="outline"
 size="icon"
 className="h-7 w-7"
 onClick={() => onUpdateQuantity(item.priceId, item.quantity - 1)}
 disabled={isUpdating}
 >
 <Minus className="h-3 w-3" />
 </Button>
 <span className="w-8 text-center text-sm font-medium">
 {item.quantity}
 </span>
 <Button
 variant="outline"
 size="icon"
 className="h-7 w-7"
 onClick={() => onUpdateQuantity(item.priceId, item.quantity + 1)}
 disabled={isUpdating}
 >
 <Plus className="h-3 w-3" />
 </Button>
 </div>

 <Button
 variant="ghost"
 size="icon"
 className="h-7 w-7 text-muted-foreground hover:text-destructive"
 onClick={() => onRemoveItem(item.priceId)}
 disabled={isUpdating}
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 </div>
 </div>
 </motion.div>
 ))}
 </AnimatePresence>
 </div>

 {/* Footer */}
 <div className="border-t pt-4 space-y-3">
 <div className="flex justify-between items-center">
 <span className="text-sm text-muted-foreground">Order Total</span>
 <span className="font-bold text-lg">{Formatters.currency(totalDollars)}</span>
 </div>

 {/* PawBucks slider */}
 {merchantAcceptsPawBucks && pawbucksBalance > 0 && (
 <div className="bg-muted border border-border rounded-lg p-3 space-y-3">
 <div className="flex justify-between items-center text-sm">
 <span className="font-medium flex items-center gap-1.5">
 <PawBucksLogo className="h-4 w-4 text-primary" />
 Use PawBucks
 </span>
 <span className="text-xs text-muted-foreground">
 Balance: {Formatters.number(pawbucksBalance)} PB
 </span>
 </div>

 <Slider
 value={[pawbucksPercent]}
 onValueChange={([val]) => setPawbucksPercent(Math.min(val, maxPercent))}
 max={100}
 step={1}
 className="w-full"
 />

 <div className="flex justify-between items-center text-xs">
 <span className="text-muted-foreground">
 {actualPawbucks > 0
 ? `${Formatters.number(actualPawbucks)} PB (${Formatters.currency(pawbucksUsdValue)})`
 :"No PawBucks applied"}
 </span>
 {canAffordFull && (
 <Button
 variant="link"
 size="sm"
 className="h-auto p-0 text-xs text-primary"
 onClick={() => setPawbucksPercent(maxPercent)}
 >
 Use max
 </Button>
 )}
 </div>

 {needsMinStripe && (
 <p className="text-xs text-destructive">
 Card portion must be at least $0.50 or use PawBucks for the full amount.
 </p>
 )}
 </div>
 )}

 <Separator />

 {/* Breakdown */}
 <div className="space-y-1.5 text-sm">
 {actualPawbucks > 0 && (
 <div className="flex justify-between items-center">
 <span className="text-muted-foreground flex items-center gap-1">
 <PawBucksLogo className="h-3.5 w-3.5" /> PawBucks
 </span>
 <span className="font-medium text-primary">
 {Formatters.number(actualPawbucks)} PB (−{Formatters.currency(pawbucksUsdValue)})
 </span>
 </div>
 )}
 {cardCents > 0 && (
 <div className="flex justify-between items-center">
 <span className="text-muted-foreground flex items-center gap-1">
 <CreditCard className="h-3.5 w-3.5" /> Card
 </span>
 <span className="font-medium">{Formatters.currency(cardDollars)}</span>
 </div>
 )}
 </div>

 {/* Checkout button */}
 <Button
 className="w-full"
 size="lg"
 onClick={handleCheckout}
 disabled={!canCheckout}
 >
 {isCheckingOut ? (
 <>
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 Processing...
 </>
 ) : getMode() ==="pawbucks" ? (
 <>
 <PawBucksLogo className="mr-2 h-4 w-4" />
 Pay with PawBucks
 </>
 ) : getMode() ==="split" ? (
 <>
 <CreditCard className="mr-2 h-4 w-4" />
 Pay {Formatters.currency(cardDollars)} + {Formatters.number(actualPawbucks)} PB
 </>
 ) : (
 <>
 <CreditCard className="mr-2 h-4 w-4" />
 Pay {Formatters.currency(totalDollars)} with Card
 </>
 )}
 </Button>

 <Button
 variant="ghost"
 size="sm"
 className="w-full text-muted-foreground"
 onClick={onClearCart}
 disabled={isUpdating}
 >
 Clear Cart
 </Button>
 </div>
 </>
 )}
 </SheetContent>
 </Sheet>
 );
}
