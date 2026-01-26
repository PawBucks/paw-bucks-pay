import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator, ArrowRight, CreditCard, DollarSign, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

// Standard Stripe processing fees
const PERCENTAGE_FEE = 0.029; // 2.9%
const FIXED_FEE = 0.30; // $0.30

interface PricingCalculatorProps {
  onApplyPrice?: (price: string) => void;
  compact?: boolean;
}

export const PricingCalculator = ({ onApplyPrice, compact = false }: PricingCalculatorProps) => {
  const [desiredAmount, setDesiredAmount] = useState("");

  const calculation = useMemo(() => {
    const desired = parseFloat(desiredAmount);
    if (isNaN(desired) || desired <= 0) {
      return null;
    }

    // Formula: gross_price = (net_amount + fixed_fee) / (1 - percentage_fee)
    const grossPrice = (desired + FIXED_FEE) / (1 - PERCENTAGE_FEE);
    const processingFee = (grossPrice * PERCENTAGE_FEE) + FIXED_FEE;
    const netAmount = grossPrice - processingFee;

    return {
      desiredAmount: desired,
      suggestedPrice: Math.ceil(grossPrice * 100) / 100, // Round up to nearest cent
      processingFee: Math.round(processingFee * 100) / 100,
      netAmount: Math.round(netAmount * 100) / 100,
    };
  }, [desiredAmount]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (compact) {
    return (
      <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Calculator className="h-4 w-4 text-primary" />
          <span>Fee Recovery Calculator</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Calculate the price to charge so you receive your desired amount after the 2.9% + $0.30 credit card processing fee.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="desired-amount-compact" className="text-xs text-muted-foreground">
              I want to receive
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="desired-amount-compact"
                type="number"
                step="0.01"
                min="0.01"
                value={desiredAmount}
                onChange={(e) => setDesiredAmount(e.target.value)}
                placeholder="100.00"
                className="pl-8"
              />
            </div>
          </div>

          {calculation && (
            <>
              <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mb-2" />
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Charge this price</Label>
                <div className="flex items-center gap-2">
                  <div className="h-9 px-3 rounded-md bg-primary/10 border border-primary/20 flex items-center font-semibold text-primary flex-1">
                    {formatCurrency(calculation.suggestedPrice)}
                  </div>
                  {onApplyPrice && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onApplyPrice(calculation.suggestedPrice.toFixed(2))}
                    >
                      Apply
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {calculation && (
          <p className="text-xs text-muted-foreground">
            Fee: {formatCurrency(calculation.processingFee)} (2.9% + $0.30) → You receive: {formatCurrency(calculation.netAmount)}
          </p>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          Fee Recovery Calculator
        </CardTitle>
        <CardDescription>
          Calculate the price to charge so you receive your desired amount after credit card processing fees (2.9% + $0.30)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="desired-amount">Amount you want to receive</Label>
          <div className="relative mt-1.5">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="desired-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={desiredAmount}
              onChange={(e) => setDesiredAmount(e.target.value)}
              placeholder="100.00"
              className="pl-9 text-lg"
            />
          </div>
        </div>

        {calculation && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3 py-2">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Your desired amount</p>
                <p className="text-xl font-semibold">{formatCurrency(calculation.desiredAmount)}</p>
              </div>
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Price to charge</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(calculation.suggestedPrice)}</p>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Breakdown
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer pays</span>
                  <span className="font-medium">{formatCurrency(calculation.suggestedPrice)}</span>
                </div>
                <div className="flex justify-between text-destructive">
                  <span>Processing fee (2.9% + $0.30)</span>
                  <span>-{formatCurrency(calculation.processingFee)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>You receive</span>
                  <span className="text-primary">{formatCurrency(calculation.netAmount)}</span>
                </div>
              </div>
            </div>

            {onApplyPrice && (
              <Button 
                onClick={() => onApplyPrice(calculation.suggestedPrice.toFixed(2))}
                className="w-full"
              >
                Use {formatCurrency(calculation.suggestedPrice)} as price
              </Button>
            )}
          </div>
        )}

        {!calculation && desiredAmount && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Enter a valid amount to see the suggested price
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default PricingCalculator;
