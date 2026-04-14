import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Minus, Plus, Trash2, ShoppingCart, Coins, CreditCard, Loader2, Package } from "lucide-react";
import { CartItem } from "@/hooks/useShoppingCart";
import { Formatters } from "@/utils/formatters";
import { motion, AnimatePresence } from "framer-motion";

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CartItem[];
  totalUsd: number;
  totalPawbucks: number;
  onUpdateQuantity: (cartItemId: string, quantity: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onClearCart: () => void;
  onCheckoutWithCard: () => void;
  onCheckoutWithPawbucks: () => void;
  isUpdating?: boolean;
  pawbucksBalance?: number;
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
  onCheckoutWithCard,
  onCheckoutWithPawbucks,
  isUpdating,
  pawbucksBalance = 0,
}: CartDrawerProps) {
  const canAffordPawbucks = pawbucksBalance >= totalPawbucks;
  const hasOutOfStock = items.some((item) => item.quantity > item.item.stock_quantity);

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
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Subtotal (USD)</span>
                <span className="font-bold text-lg">${(totalUsd / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Subtotal (PawBucks)</span>
                <span className="font-bold text-lg text-primary flex items-center gap-1">
                  <Coins className="h-4 w-4" />
                  {Formatters.number(totalPawbucks)}
                </span>
              </div>

              {pawbucksBalance > 0 && (
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>Your PawBucks balance</span>
                  <span>{Formatters.number(pawbucksBalance)}</span>
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <Button
                  className="w-full"
                  onClick={onCheckoutWithCard}
                  disabled={hasOutOfStock || isUpdating}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Pay ${(totalUsd / 100).toFixed(2)} with Card
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={onCheckoutWithPawbucks}
                  disabled={!canAffordPawbucks || hasOutOfStock || isUpdating}
                >
                  <Coins className="mr-2 h-4 w-4" />
                  Pay {Formatters.number(totalPawbucks)} PawBucks
                </Button>
              </div>

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
