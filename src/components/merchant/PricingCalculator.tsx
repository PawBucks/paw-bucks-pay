import { useState, useMemo } from"react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Calculator, ArrowRight, DollarSign, Info, Settings2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from"@/components/ui/tooltip";
import { Button } from"@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from"@/components/ui/collapsible";

import { Formatters } from "@/utils/formatters";
// Default Stripe processing fees
const DEFAULT_PERCENTAGE_FEE = 3; // 3%
const DEFAULT_FIXED_FEE = 0; // No fixed fee

interface PricingCalculatorProps {
 onApplyPrice?: (price: string) => void;
 compact?: boolean;
}

export const PricingCalculator = ({ onApplyPrice, compact = false }: PricingCalculatorProps) => {
 const [desiredAmount, setDesiredAmount] = useState("");
 const [percentageFee, setPercentageFee] = useState(DEFAULT_PERCENTAGE_FEE.toString());
 const [fixedFee, setFixedFee] = useState(DEFAULT_FIXED_FEE.toString());
 const [showCustomFees, setShowCustomFees] = useState(false);

 const calculation = useMemo(() => {
 const desired = parseFloat(desiredAmount);
 const pctFee = parseFloat(percentageFee) / 100; // Convert from percentage to decimal
 const fxdFee = parseFloat(fixedFee);
 
 if (isNaN(desired) || desired <= 0 || isNaN(pctFee) || pctFee < 0 || isNaN(fxdFee) || fxdFee < 0) {
 return null;
 }

 // Simple markup formula: suggested_price = desired_amount + (desired_amount * percentage_fee) + fixed_fee
 // For 3% fee on $100: $100 + ($100 * 0.03) + $0 = $103
 const processingFee = (desired * pctFee) + fxdFee;
 const suggestedPrice = desired + processingFee;

 return {
 desiredAmount: desired,
 suggestedPrice: Math.round(suggestedPrice * 100) / 100, // Round to nearest cent
 processingFee: Math.round(processingFee * 100) / 100,
 netAmount: desired, // Merchant receives exactly what they want
 pctFee: parseFloat(percentageFee),
 fxdFee: fxdFee,
 };
 }, [desiredAmount, percentageFee, fixedFee]);

 const formatCurrency = (amount: number) => {
 return new Intl.NumberFormat('en-US', {
 style:'currency',
 currency:'USD',
 }).format(amount);
 };

 if (compact) {
 return (
 <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2 text-sm font-medium">
 <Calculator className="h-4 w-4 text-primary" />
 <span>Fee Recovery Calculator</span>
 <TooltipProvider>
 <Tooltip>
 <TooltipTrigger asChild>
 <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
 </TooltipTrigger>
 <TooltipContent className="max-w-xs">
 <p>Calculate the price to charge so you receive your desired amount after processing fees. Default: 3%</p>
 </TooltipContent>
 </Tooltip>
 </TooltipProvider>
 </div>
 <Button
 type="button"
 variant="ghost"
 size="sm"
 className="h-7 px-2 text-xs"
 onClick={() => setShowCustomFees(!showCustomFees)}
 >
 <Settings2 className="h-3.5 w-3.5 mr-1" />
 {showCustomFees ?"Hide" :"Custom Fees"}
 </Button>
 </div>

 {showCustomFees && (
 <div className="flex gap-3 p-3 bg-background rounded-md border">
 <div className="flex-1">
 <Label htmlFor="pct-fee-compact" className="text-xs text-muted-foreground">
 Percentage Fee (%)
 </Label>
 <Input
 id="pct-fee-compact"
 type="number"
 step="0.1"
 min="0"
 max="100"
 value={percentageFee}
 onChange={(e) => setPercentageFee(e.target.value)}
 placeholder="3"
 className="h-8 text-sm"
 />
 </div>
 <div className="flex-1">
 <Label htmlFor="fixed-fee-compact" className="text-xs text-muted-foreground">
 Fixed Fee ($)
 </Label>
 <div className="relative">
 <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
 <Input
 id="fixed-fee-compact"
 type="number"
 step="0.01"
 min="0"
 value={fixedFee}
 onChange={(e) => setFixedFee(e.target.value)}
 placeholder="0"
 className="h-8 text-sm pl-7"
 />
 </div>
 </div>
 </div>
 )}

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
 onClick={() => onApplyPrice(Formatters.money(calculation.suggestedPrice))}
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
 Fee: {formatCurrency(calculation.processingFee)} ({calculation.pctFee}% + {Formatters.currency(calculation.fxdFee)}) → You receive: {formatCurrency(calculation.netAmount)}
 </p>
 )}
 </div>
 );
 }

 return (
 <Card>
 <CardHeader>
 <div className="flex items-start justify-between">
 <div>
 <CardTitle className="flex items-center gap-2">
 <Calculator className="h-5 w-5 text-primary" />
 Fee Recovery Calculator
 </CardTitle>
 <CardDescription>
 Calculate the price to charge so you receive your desired amount after processing fees
 </CardDescription>
 </div>
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => setShowCustomFees(!showCustomFees)}
 >
 <Settings2 className="h-4 w-4 mr-2" />
 {showCustomFees ?"Hide Custom Fees" :"Custom Fees"}
 </Button>
 </div>
 </CardHeader>
 <CardContent className="space-y-6">
 <Collapsible open={showCustomFees} onOpenChange={setShowCustomFees}>
 <CollapsibleContent className="space-y-4">
 <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg border">
 <div>
 <Label htmlFor="pct-fee">Percentage Fee (%)</Label>
 <Input
 id="pct-fee"
 type="number"
 step="0.1"
 min="0"
 max="100"
 value={percentageFee}
 onChange={(e) => setPercentageFee(e.target.value)}
 placeholder="2.9"
 className="mt-1.5"
 />
 <p className="text-xs text-muted-foreground mt-1">Default: 3%</p>
 </div>
 <div>
 <Label htmlFor="fixed-fee">Fixed Fee ($)</Label>
 <div className="relative mt-1.5">
 <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input
 id="fixed-fee"
 type="number"
 step="0.01"
 min="0"
 value={fixedFee}
 onChange={(e) => setFixedFee(e.target.value)}
 placeholder="0.30"
 className="pl-9"
 />
 </div>
 <p className="text-xs text-muted-foreground mt-1">Default: $0.00</p>
 </div>
 </div>
 </CollapsibleContent>
 </Collapsible>

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

 <div className="rounded-lg border bg-muted p-4 space-y-3">
 <h4 className="font-medium text-sm flex items-center gap-2">
 <span className="h-4 w-4" aria-hidden="true">💳</span>
 Breakdown
 </h4>
 <div className="space-y-2 text-sm">
 <div className="flex justify-between">
 <span className="text-muted-foreground">Customer pays</span>
 <span className="font-medium">{formatCurrency(calculation.suggestedPrice)}</span>
 </div>
 <div className="flex justify-between text-destructive">
 <span>Processing fee ({calculation.pctFee}% + {Formatters.currency(calculation.fxdFee)})</span>
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
 onClick={() => onApplyPrice(Formatters.money(calculation.suggestedPrice))}
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
