import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Textarea } from"@/components/ui/textarea";
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogHeader,
 DialogTitle,
} from"@/components/ui/dialog";
import { Loader2, AlertCircle, Clock } from"lucide-react";
import { Alert, AlertDescription, AlertTitle } from"@/components/ui/alert";

import { Formatters } from "@/utils/formatters";
type FundingRequestDialogProps = {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 maxBorrowable: number;
 sales90Days: number;
 daysActive: number;
 fundingEligible: boolean;
 onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
 isSubmitting: boolean;
};

export const FundingRequestDialog = ({
 open,
 onOpenChange,
 maxBorrowable,
 sales90Days,
 daysActive,
 fundingEligible,
 onSubmit,
 isSubmitting,
}: FundingRequestDialogProps) => {
 const daysRemaining = Math.max(0, 90 - daysActive);

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Request Funding</DialogTitle>
 <DialogDescription>
 Get an advance on your future earnings to grow your business
 </DialogDescription>
 </DialogHeader>

 {!fundingEligible ? (
 <div className="space-y-4">
 <Alert variant="default" className="border-warning bg-warning/10">
 <Clock className="h-4 w-4 text-warning" />
 <AlertTitle className="text-warning">Not Yet Eligible</AlertTitle>
 <AlertDescription className="text-muted-foreground">
 You need <strong>{daysRemaining} more days</strong> of active sales on the platform to request funding. 
 Merchants must have at least 90 days of sales history.
 </AlertDescription>
 </Alert>

 <div className="bg-muted rounded-lg p-4">
 <div className="flex justify-between text-sm mb-2">
 <span className="text-muted-foreground">Your progress:</span>
 <span className="font-medium">{daysActive} / 90 days</span>
 </div>
 <div className="w-full bg-muted-foreground/20 rounded-full h-2">
 <div 
 className="bg-primary h-2 rounded-full transition-all" 
 style={{ width: `${Math.min(100, (daysActive / 90) * 100)}%` }}
 />
 </div>
 </div>

 <Button
 type="button"
 variant="outline"
 onClick={() => onOpenChange(false)}
 className="w-full"
 >
 Close
 </Button>
 </div>
 ) : (
 <form onSubmit={onSubmit} className="space-y-4">
 <div className="bg-muted rounded-lg p-4 mb-4">
 <div className="flex justify-between text-sm mb-2">
 <span className="text-muted-foreground">Available to borrow:</span>
 <span className="font-bold">{Formatters.currency(maxBorrowable)}</span>
 </div>
 <p className="text-xs text-muted-foreground">
 Up to 80% of your average 90-day sales ({Formatters.currency(sales90Days)})
 </p>
 </div>

 <div className="space-y-2">
 <Label htmlFor="requestedAmount">Requested Amount ($)</Label>
 <Input
 id="requestedAmount"
 name="requestedAmount"
 type="number"
 step="0.01"
 min="100"
 max={maxBorrowable}
 placeholder="0.00"
 required
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="reason">Reason for Funding</Label>
 <Textarea
 id="reason"
 name="reason"
 placeholder="Inventory, equipment, marketing, etc."
 rows={3}
 required
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="estimatedMonthlySales">Estimated Monthly Sales ($)</Label>
 <Input
 id="estimatedMonthlySales"
 name="estimatedMonthlySales"
 type="number"
 step="0.01"
 min="0"
 placeholder="0.00"
 required
 />
 </div>

 <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
 <p className="text-sm font-semibold mb-1">Funding Terms</p>
 <ul className="text-xs text-muted-foreground space-y-1">
 <li>• 5% fee on funded amount</li>
 <li>• Repaid automatically from future transactions</li>
 <li>• No fixed repayment schedule</li>
 <li>• Funds deposited within 1-2 business days</li>
 </ul>
 </div>

 <div className="flex gap-3">
 <Button
 type="button"
 variant="outline"
 onClick={() => onOpenChange(false)}
 className="flex-1"
 disabled={isSubmitting}
 >
 Cancel
 </Button>
 <Button type="submit" className="flex-1" disabled={isSubmitting || maxBorrowable < 100}>
 {isSubmitting ? (
 <>
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 Submitting...
 </>
 ) : (
"Request Funding"
 )}
 </Button>
 </div>
 </form>
 )}
 </DialogContent>
 </Dialog>
 );
};
