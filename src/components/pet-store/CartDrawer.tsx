import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Minus, Plus, Trash2, ShoppingCart, Coins, CreditCard, Loader2, Package } from "lucide-react";
import { CartItem } from "@/hooks/useShoppingCart";
import { Formatters } from "@/utils/formatters";
import { motion, AnimatePresence } from "framer-motion";

const PAWBUCKS_TO_USD = 0.001;

export type CartCheckoutMode = "card" | "pawbucks" | "split";

export interface CartCheckoutParams {
  mode: CartCheckoutMode;
  pawbucksAmount: number; // PawBucks to spend
  cardAmountCents: number; // USD cents to charge on card
}

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CartItem[];
  totalUsd: number; // cents
  totalPawbucks: number;
  onUpdateQuantity: (cartItemId: string, quantity: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onClearCart: () => void;
  onCheckout: (params: CartCheckoutParams) => void;
  isUpdating?: boolean;
  pawbucksBalance?: number;
  isCheckingOut?: boolean;
}

export function CartDrawer({
  open,
  onOpenChange,
  items,
  totalUsd,
  totalPawbucks,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onCheckout,
  isUpdating,
  pawbucksBalance = 0,
  isCheckingOut = false,
}: CartDrawerProps) {
  const hasOutOfStock = items.some((item) => item.quantity > item.item.stock_quantity);

  // Split payment slider state: percentage of total paid with PawBucks (0-100)
  const [pawbucksPercent, setPawbucksPercent] = useState(0);

  // Max PawBucks the user can apply (capped by balance and total)
  const totalUsdDollars = totalUsd / 100;
  const maxPawbucksForTotal = Math.floor(totalUsdDollars / PAWBUCKS_TO_USD);
  const maxApplicablePawbucks = Math.min(pawbucksBalance, maxPawbucksForTotal);
  const maxPercent = maxPawbucksForTotal > 0
    ? Math.floor((maxApplicablePawbucks / maxPawbucksForTotal) * 100)
    : 0;

  // Derived amounts
  const pawbucksToSpend = Math.floor((pawbucksPercent / 100) * maxPawbucksForTotal);
  const actualPawbucks = Math.min(pawbucksToSpend, maxApplicablePawbucks);
  const pawbucksUsdValue = actualPawbucks * PAWBUCKS_TO_USD;
  const cardAmountDollars = Math.max(totalUsdDollars - pawbucksUsdValue, 0);
  const cardAmountCents = Math.round(cardAmountDollars * 100);

  // Minimum Stripe charge is $0.50
  const MIN_STRIPE_CENTS = 50;
  const needsMinStripe = cardAmountCents > 0 && cardAmountCents < MIN_STRIPE_CENTS;

  // Determine checkout mode
  const getMode = (): CartCheckoutMode => {
    if (actualPawbucks === 0) return "card";
    if (cardAmountCents === 0) return "pawbucks";
    return "split";
  };

  // Reset slider when cart changes
  useEffect(() => {
    setPawbucksPercent(0);
  }, [totalUsd, totalPawbucks]);

  const canCheckout =
    items.length > 0 &&
    !hasOutOfStock &&
    !isUpdating &&
    !isCheckingOut &&
    !needsMinStripe;

  // Full PawBucks checkout possible?
  const canAffordFullPawbucks = pawbucksBalance >= maxPawbucksForTotal && maxPawbucksForTotal > 0;

  const handleCheckout = () => {
    onCheckout({
      mode: getMode(),
      pawbucksAmount: actualPawbucks,
      cardAmountCents,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Shopping Cart
            {items.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {items.reduce((sum, i) => sum + i.quantity, 0)} items
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center">
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
            <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-3">
              <AnimatePresence mode="popLayout">
                {items.map((item) => {
                  const outOfStock = item.quantity > item.item.stock_quantity;
                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      className={`flex gap-3 p-3 rounded-lg border ${
                        outOfStock ? "border-destructive/50 bg-destructive/5" : "bg-card"
                      }`}
                    >
                      {item.item.image_url ? (
                        <img
                          src={item.item.image_url}
                          alt={item.item.name}
                          className="w-16 h-16 rounded-md object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                          <Package className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">{item.item.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-sm font-semibold">
                            ${(item.item.price / 100).toFixed(2)}
                          </span>
                          <span className="text-xs text-primary font-medium">
                            {Formatters.number(item.item.price_pawbucks)} PB
                          </span>
                        </div>
                        {outOfStock && (
                          <span className="text-xs text-destructive font-medium">
                            Only {item.item.stock_quantity} left
                          </span>
                        )}

                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() =>
                                onUpdateQuantity(item.id, item.quantity - 1)
                              }
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
                              onClick={() =>
                                onUpdateQuantity(item.id, item.quantity + 1)
                              }
                              disabled={
                                isUpdating ||
                                item.quantity >= item.item.stock_quantity
                              }
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => onRemoveItem(item.id)}
                            disabled={isUpdating}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            <div className="border-t pt-4 space-y-3">
              {/* Order total */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Order Total</span>
                <span className="font-bold text-lg">${totalUsdDollars.toFixed(2)}</span>
              </div>

              {/* PawBucks slider — only show if user has PawBucks */}
              {pawbucksBalance > 0 && (
                <div className="bg-muted/50 border border-border rounded-lg p-3 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium flex items-center gap-1.5">
                      <Coins className="h-4 w-4 text-primary" />
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
                        ? `${Formatters.number(actualPawbucks)} PB ($${pawbucksUsdValue.toFixed(2)})`
                        : "No PawBucks applied"}
                    </span>
                    {canAffordFullPawbucks && (
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

              {/* Payment breakdown */}
              <div className="space-y-1.5 text-sm">
                {actualPawbucks > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Coins className="h-3.5 w-3.5" /> PawBucks
                    </span>
                    <span className="font-medium text-primary">
                      {Formatters.number(actualPawbucks)} PB (−${pawbucksUsdValue.toFixed(2)})
                    </span>
                  </div>
                )}
                {cardAmountCents > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <CreditCard className="h-3.5 w-3.5" /> Card
                    </span>
                    <span className="font-medium">
                      ${cardAmountDollars.toFixed(2)}
                    </span>
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
                ) : getMode() === "pawbucks" ? (
                  <>
                    <Coins className="mr-2 h-4 w-4" />
                    Pay with PawBucks
                  </>
                ) : getMode() === "split" ? (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Pay ${cardAmountDollars.toFixed(2)} + {Formatters.number(actualPawbucks)} PB
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Pay ${totalUsdDollars.toFixed(2)} with Card
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
