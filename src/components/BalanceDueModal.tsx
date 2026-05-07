import { useState } from"react";
import { supabase } from"@/integrations/supabase/client";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogDescription,
} from"@/components/ui/dialog";
import { Button } from"@/components/ui/button";
import { Card, CardContent } from"@/components/ui/card";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from"@/components/ui/table";
import { Badge } from"@/components/ui/badge";
import { Separator } from"@/components/ui/separator";
import { CreditCard, Coins, Calendar, AlertCircle, ChevronRight, Shield, Info } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { toast } from"sonner";

import { Formatters } from "@/utils/formatters";
interface BalanceDueModalProps {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 slice: {
 id: string;
 original_amount: number;
 actual_amount: number;
 gap_amount: number;
 invoice?: {
 invoice_number: string;
 client_name: string;
 };
 claim?: {
 claim_number: string;
 policy?: {
 pet?: { name: string };
 vet_insurance_providers?: { name: string };
 copay_percentage?: number;
 deductible_amount?: number;
 deductible_met?: number;
 };
 };
 };
 pawBucksBalance: number;
 subscriptionTier:"free" |"pawpass" |"pawpass_plus";
 originalTransactionAmount: number;
 onActionComplete: () => void;
}

interface BreakdownItem {
 label: string;
 amount: number;
 type:"original" |"deduction" |"remaining";
 note?: string;
}

export function BalanceDueModal({
 open,
 onOpenChange,
 slice,
 pawBucksBalance,
 subscriptionTier,
 originalTransactionAmount,
 onActionComplete,
}: BalanceDueModalProps) {
 const [selectedOption, setSelectedOption] = useState<string | null>(null);
 const [isProcessing, setIsProcessing] = useState(false);

 const gapAmount = Number(slice.gap_amount);
 const pawBucksValue = pawBucksBalance * 0.001; // 1000 PB = $1
 const canPayWithPawBucks = pawBucksValue >= gapAmount;
 const installmentAmount = gapAmount / 3;

 const rewardsMultiplier =
 subscriptionTier ==="pawpass_plus" ? 30 : subscriptionTier ==="pawpass" ? 20 : 10;
 const originalRewardsEarned = Math.floor(originalTransactionAmount * rewardsMultiplier);

 // Build the breakdown showing why the balance moved
 const breakdownItems: BreakdownItem[] = [
 {
 label:"Original Insurance Estimate",
 amount: Number(slice.original_amount),
 type:"original",
 },
 ];

 const policy = slice.claim?.policy;
 if (policy) {
 const deductibleRemaining = Math.max(
 0,
 (policy.deductible_amount || 0) - (policy.deductible_met || 0)
 );
 if (deductibleRemaining > 0) {
 breakdownItems.push({
 label:"Annual Deductible Applied",
 amount: -Math.min(deductibleRemaining, Number(slice.original_amount)),
 type:"deduction",
 note:"Your deductible wasn't fully met",
 });
 }

 if (policy.copay_percentage && policy.copay_percentage > 0) {
 const copayAmount = Number(slice.original_amount) * (policy.copay_percentage / 100);
 breakdownItems.push({
 label: `${policy.copay_percentage}% Co-Pay Responsibility`,
 amount: -copayAmount,
 type:"deduction",
 note:"Standard policy co-payment",
 });
 }
 }

 // Add any unexplained gap
 const explainedDeductions = breakdownItems
 .filter((i) => i.type ==="deduction")
 .reduce((sum, i) => sum + Math.abs(i.amount), 0);
 const unexplainedGap = gapAmount - explainedDeductions;

 if (unexplainedGap > 0.01) {
 breakdownItems.push({
 label:"Carrier Adjustment",
 amount: -unexplainedGap,
 type:"deduction",
 note:"Carrier-specific coverage limits or exclusions",
 });
 }

 breakdownItems.push({
 label:"Actual Carrier Payment",
 amount: Number(slice.actual_amount),
 type:"remaining",
 });

 const handleSelectOption = async (option: string) => {
 setSelectedOption(option);
 setIsProcessing(true);

 try {
 const { error } = await supabase.functions.invoke("reconcile-claim-gap", {
 body: {
 sliceId: slice.id,
 action:"select_option",
 option,
 },
 });

 if (error) throw error;

 toast.success(
 option ==="pay_now"
 ?"Redirecting to payment..."
 : option ==="pawbucks"
 ?"PawBucks applied successfully!"
 :"Payment plan created!"
 );

 onActionComplete();
 onOpenChange(false);
 } catch (error) {
 console.error("Error selecting option:", error);
 toast.error("Failed to process your selection");
 } finally {
 setIsProcessing(false);
 }
 };

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-lg bg-gradient-to-b from-warning to-white border-warning/20">
 <DialogHeader>
 <div className="flex items-center gap-2">
 <div className="p-2 rounded-full bg-warning/10">
 <AlertCircle className="h-5 w-5 text-warning" />
 </div>
 <DialogTitle className="text-warning">Action Required</DialogTitle>
 </div>
 <DialogDescription className="text-warning">
 Your insurance carrier paid less than expected for{""}
 <span className="font-medium">{slice.claim?.policy?.pet?.name ||"your pet"}'s</span>{""}
 recent visit.
 </DialogDescription>
 </DialogHeader>

 <div className="space-y-4">
 {/* Balance Summary */}
 <Card className="bg-white border-warning/20">
 <CardContent className="p-4">
 <div className="flex items-center justify-between mb-3">
 <span className="text-sm text-muted-foreground">Remaining Balance</span>
 <Badge className="bg-warning/10 text-warning hover:bg-warning/10">
 {slice.claim?.policy?.vet_insurance_providers?.name ||"Insurance"}
 </Badge>
 </div>
 <p className="text-3xl font-bold text-warning">{Formatters.currency(gapAmount)}</p>
 </CardContent>
 </Card>

 {/* Insurance Breakdown */}
 <div className="space-y-2">
 <div className="flex items-center gap-2 text-sm font-medium text-foreground">
 <Info className="h-4 w-4" />
 Why did the balance shift?
 </div>
 <Card className="bg-muted border-border">
 <CardContent className="p-0">
 <Table>
 <TableHeader>
 <TableRow className="bg-muted">
 <TableHead className="text-xs">Description</TableHead>
 <TableHead className="text-xs text-right">Amount</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {breakdownItems.map((item, index) => (
 <TableRow key={index}>
 <TableCell className="py-2">
 <div>
 <p
 className={`text-sm ${
 item.type ==="remaining" ?"font-medium" :""
 }`}
 >
 {item.label}
 </p>
 {item.note && (
 <p className="text-xs text-muted-foreground">{item.note}</p>
 )}
 </div>
 </TableCell>
 <TableCell
 className={`text-right py-2 font-medium ${
 item.type ==="deduction"
 ?"text-destructive"
 : item.type ==="remaining"
 ?"text-success"
 :""
 }`}
 >
 {item.type ==="deduction" ?"-" :""}{Formatters.currency(Math.abs(item.amount))}
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </CardContent>
 </Card>
 </div>

 <Separator className="bg-warning/10" />

 {/* Action Buttons */}
 <div className="space-y-3">
 <p className="text-sm font-medium text-foreground">Choose how to resolve:</p>

 {/* Pay Now */}
 <Button
 variant="outline"
 className="w-full justify-between h-auto py-3 px-4 border-warning/20 hover:bg-warning/10 hover:border-warning/30"
 onClick={() => handleSelectOption("pay_now")}
 disabled={isProcessing}
 >
 <div className="flex items-center gap-3">
 <div className="p-2 rounded-lg bg-warning/10">
 <CreditCard className="h-5 w-5 text-warning" />
 </div>
 <div className="text-left">
 <p className="font-medium text-warning">Pay Now</p>
 <p className="text-xs text-muted-foreground">
 Credit/Debit Card • {Formatters.currency(gapAmount)}
 </p>
 </div>
 </div>
 <ChevronRight className="h-5 w-5 text-warning" />
 </Button>

 {/* Use PawBucks */}
 <Button
 variant="outline"
 className={`w-full justify-between h-auto py-3 px-4 border-success/20 hover:bg-success/10 hover:border-success/30 ${
 !canPayWithPawBucks ?"opacity-60" :""
 }`}
 onClick={() => handleSelectOption("pawbucks")}
 disabled={isProcessing || !canPayWithPawBucks}
 >
 <div className="flex items-center gap-3">
 <div className="p-2 rounded-lg bg-success/10">
 <Coins className="h-5 w-5 text-success" />
 </div>
 <div className="text-left">
 <p className="font-medium text-success">Use PawBucks</p>
 <p className="text-xs text-muted-foreground">
 {canPayWithPawBucks
 ? `Use ${Math.ceil(gapAmount * 1000).toLocaleString()} PB`
 : `Need ${Math.ceil(gapAmount * 1000).toLocaleString()} PB (You have ${pawBucksBalance.toLocaleString()})`}
 </p>
 </div>
 </div>
 <ChevronRight className="h-5 w-5 text-success" />
 </Button>

 {/* Split Payments */}
 <Button
 variant="outline"
 className="w-full justify-between h-auto py-3 px-4 border-accent/20 hover:bg-accent/10 hover:border-accent/30"
 onClick={() => handleSelectOption("payment_plan")}
 disabled={isProcessing}
 >
 <div className="flex items-center gap-3">
 <div className="p-2 rounded-lg bg-accent/10">
 <Calendar className="h-5 w-5 text-accent" />
 </div>
 <div className="text-left">
 <p className="font-medium text-accent">Split into 3 Payments</p>
 <p className="text-xs text-muted-foreground">
 {Formatters.currency(installmentAmount)}/month • No interest
 </p>
 </div>
 </div>
 <ChevronRight className="h-5 w-5 text-accent" />
 </Button>
 </div>

 {/* Rewards Integrity Note */}
 <Card className="bg-gradient-to-r from-success to-info border-success/20">
 <CardContent className="p-3">
 <div className="flex items-start gap-3">
 <div className="p-1.5 rounded-full bg-success/10">
 <Shield className="h-4 w-4 text-success" />
 </div>
 <div className="flex-1">
 <div className="flex items-center gap-1.5">
 <Sparkles className="h-4 w-4 text-success" />
 <p className="text-sm font-medium text-success">Reward Integrity</p>
 </div>
 <p className="text-xs text-success mt-0.5">
 Your <span className="font-semibold">{rewardsMultiplier}x rewards</span> earned
 on the original {Formatters.currency(originalTransactionAmount)} transaction (
 <span className="font-semibold">
 {originalRewardsEarned.toLocaleString()} PawBucks
 </span>
 ) remain safely in your account.
 </p>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>
 </DialogContent>
 </Dialog>
 );
}
