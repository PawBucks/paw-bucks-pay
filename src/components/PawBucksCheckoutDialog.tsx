import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Coins, Check, Sparkles, CreditCard } from "lucide-react";
import { PawBucksInfoTooltip } from "@/components/PawBucksInfoTooltip";

// Pet Owner conversion rate: 1000 PawBucks = $1.00 (1 PawBuck = $0.001)
const PAWBUCKS_TO_USD = 0.001;
// Minimum Stripe charge for subscriptions
const MINIMUM_STRIPE_AMOUNT = 0.50;

type PawBucksCheckoutDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  priceAmount: number; // in dollars
  isRecurring: boolean;
  merchantName: string;
  merchantAcceptsPawBucks: boolean;
  cashbackRate: number;
  userId: string;
  onProceed: (pawbucksToUse: number) => void;
  isLoading?: boolean;
};

export const PawBucksCheckoutDialog = ({
  open,
  onOpenChange,
  productName,
  priceAmount,
  isRecurring,
  merchantName,
  merchantAcceptsPawBucks,
  cashbackRate,
  userId,
  onProceed,
  isLoading = false,
}: PawBucksCheckoutDialogProps) => {
  const [pawbucksToUse, setPawbucksToUse] = useState(0);
  const [pawbucksBalance, setPawbucksBalance] = useState(0);
  const [loadingBalance, setLoadingBalance] = useState(true);

  // Load PawBucks balance when dialog opens
  useEffect(() => {
    if (open && userId && merchantAcceptsPawBucks) {
      loadPawbucksBalance();
    } else if (open && !merchantAcceptsPawBucks) {
      setLoadingBalance(false);
    }
  }, [open, userId, merchantAcceptsPawBucks]);

  const loadPawbucksBalance = async () => {
    setLoadingBalance(true);
    try {
      const { data } = await supabase
        .from('pawbucks_wallet')
        .select('balance')
        .eq('user_id', userId)
        .single();
      
      setPawbucksBalance(data?.balance || 0);
    } catch (error) {
      console.error("Error loading PawBucks balance:", error);
      setPawbucksBalance(0);
    } finally {
      setLoadingBalance(false);
    }
  };

  // Calculate values
  const pawbucksUsdValue = pawbucksToUse * PAWBUCKS_TO_USD;
  
  // For subscriptions, ensure minimum Stripe charge
  const minStripeForSubscription = isRecurring ? MINIMUM_STRIPE_AMOUNT : 0;
  const maxPawBucksUsd = priceAmount - minStripeForSubscription;
  const maxPawBucks = Math.min(
    pawbucksBalance, 
    Math.max(0, Math.floor(maxPawBucksUsd / PAWBUCKS_TO_USD))
  );
  
  const stripeAmount = Math.max(minStripeForSubscription, priceAmount - pawbucksUsdValue);
  const cashbackPawBucks = stripeAmount > 0 ? Math.round(stripeAmount * cashbackRate) : 0;

  const handleProceed = () => {
    onProceed(pawbucksToUse);
    setPawbucksToUse(0);
  };

  const handleClose = () => {
    setPawbucksToUse(0);
    onOpenChange(false);
  };

  // If merchant doesn't accept PawBucks or user has no balance, show simplified version
  const showSimpleCheckout = !merchantAcceptsPawBucks || pawbucksBalance === 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {showSimpleCheckout ? (
              <>
                <CreditCard className="w-5 h-5 text-primary" />
                Confirm Purchase
              </>
            ) : (
              <>
                <Coins className="w-5 h-5 text-primary" />
                Use PawBucks?
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {showSimpleCheckout ? (
              `Purchase "${productName}" from ${merchantName}`
            ) : (
              <>
                Would you like to apply PawBucks to this {isRecurring ? 'subscription' : 'purchase'}?
                <PawBucksInfoTooltip variant="redemption" />
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {loadingBalance ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Product Info */}
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="font-medium text-sm mb-1">{productName}</p>
              <p className="text-xl font-bold">${priceAmount.toFixed(2)}{isRecurring && <span className="text-sm font-normal text-muted-foreground">/period</span>}</p>
              {isRecurring && (
                <p className="text-xs text-muted-foreground mt-1">
                  {pawbucksToUse > 0 
                    ? "PawBucks discount applies to first payment only"
                    : "Recurring subscription"
                  }
                </p>
              )}
            </div>

            {/* PawBucks Section - only if merchant accepts and user has balance */}
            {merchantAcceptsPawBucks && pawbucksBalance > 0 && maxPawBucks > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Coins className="w-4 h-4 text-primary" />
                    Apply PawBucks
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Balance: {pawbucksBalance.toLocaleString()} PB
                  </span>
                </div>

                {/* Slider instruction hint */}
                {pawbucksToUse === 0 && (
                  <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 px-3 py-2 rounded-md animate-pulse">
                    <span className="text-base">👆</span>
                    <span className="font-medium">Drag the slider right to apply your PawBucks discount</span>
                  </div>
                )}

                <Slider
                  value={[pawbucksToUse]}
                  onValueChange={([value]) => setPawbucksToUse(value)}
                  max={maxPawBucks}
                  min={0}
                  step={100}
                  className="w-full"
                />

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {pawbucksToUse === 0 ? (
                      <span className="italic">No PawBucks applied</span>
                    ) : (
                      <>{pawbucksToUse.toLocaleString()} PawBucks</>
                    )}
                  </span>
                  <span className={`font-medium ${pawbucksToUse > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                    {pawbucksToUse > 0 ? `= $${pawbucksUsdValue.toFixed(2)} off` : '$0.00 off'}
                  </span>
                </div>

                {pawbucksToUse > 0 && stripeAmount <= MINIMUM_STRIPE_AMOUNT && !isRecurring && (
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <Check className="w-4 h-4" />
                    Entire purchase covered by PawBucks!
                  </div>
                )}

                {isRecurring && pawbucksToUse > 0 && (
                  <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                    💡 A minimum ${MINIMUM_STRIPE_AMOUNT.toFixed(2)} charge is required to set up recurring billing.
                  </div>
                )}
              </div>
            )}

            {/* Info when no PawBucks available */}
            {merchantAcceptsPawBucks && pawbucksBalance === 0 && (
              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg flex items-start gap-2">
                <Coins className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>This merchant accepts PawBucks, but you don't have any yet. Earn PawBucks by making purchases!</span>
              </div>
            )}

            {/* Payment Summary */}
            <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Price:</span>
                <span>${priceAmount.toFixed(2)}</span>
              </div>
              
              {pawbucksToUse > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">PawBucks Discount:</span>
                  <span className="text-primary font-medium">−${pawbucksUsdValue.toFixed(2)}</span>
                </div>
              )}
              
              <div className="flex justify-between text-sm pt-2 border-t">
                <span className="font-medium">Card Payment:</span>
                <span className="font-bold">${stripeAmount.toFixed(2)}</span>
              </div>
              
              {stripeAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    Cashback ({cashbackRate}x):
                  </span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    +{cashbackPawBucks.toLocaleString()} PawBucks
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleProceed}
            disabled={isLoading || loadingBalance}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : stripeAmount <= 0 ? (
              "Pay with PawBucks"
            ) : (
              `Pay $${stripeAmount.toFixed(2)}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
