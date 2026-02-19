import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type RefundPaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionAmount: number;
  customerName?: string;
  onRefund: (params: {
    amount: number;
    reason: string;
    note: string;
    refundApplicationFee: boolean;
  }) => void;
  isRefunding?: boolean;
};

export function RefundPaymentDialog({
  open,
  onOpenChange,
  transactionAmount,
  customerName,
  onRefund,
  isRefunding = false,
}: RefundPaymentDialogProps) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [refundApplicationFee, setRefundApplicationFee] = useState(true);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setAmount(transactionAmount.toFixed(2));
      setReason('');
      setNote('');
      setRefundApplicationFee(true);
    }
  }, [open, transactionAmount]);

  const parsedAmount = parseFloat(amount) || 0;
  const isPartial = parsedAmount < transactionAmount && parsedAmount > 0;
  const isValidAmount = parsedAmount > 0 && parsedAmount <= transactionAmount;

  const handleSubmit = () => {
    if (!isValidAmount) return;
    onRefund({
      amount: parsedAmount,
      reason: reason || 'requested_by_customer',
      note,
      refundApplicationFee,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Refund payment</DialogTitle>
          <DialogDescription>
            Refunds take 5–10 days to appear on a customer's statement. Stripe's fees for the original payment won't be returned, but there are no additional fees for the refund.
            {customerName && (
              <span className="block mt-1 font-medium text-foreground">Customer: {customerName}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="refund-amount" className="font-semibold">Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
              <Input
                id="refund-amount"
                type="number"
                step="0.01"
                min="0.01"
                max={transactionAmount}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7"
                placeholder="0.00"
              />
            </div>
            {isPartial && (
              <p className="text-xs text-muted-foreground">
                Partial refund of ${parsedAmount.toFixed(2)} out of ${transactionAmount.toFixed(2)}
              </p>
            )}
            {!isValidAmount && amount !== '' && (
              <p className="text-xs text-destructive">
                Amount must be between $0.01 and ${transactionAmount.toFixed(2)}
              </p>
            )}
          </div>

          {/* Refund application fee */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="refund-app-fee"
              checked={refundApplicationFee}
              onCheckedChange={(checked) => setRefundApplicationFee(checked === true)}
            />
            <Label htmlFor="refund-app-fee" className="text-sm font-normal cursor-pointer">
              Refund the application fee
            </Label>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="refund-reason" className="font-semibold">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="refund-reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="requested_by_customer">Requested by customer</SelectItem>
                <SelectItem value="duplicate">Duplicate</SelectItem>
                <SelectItem value="fraudulent">Fraudulent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="refund-note" className="font-semibold">Note</Label>
            <p className="text-xs text-muted-foreground">
              This field is optional and surfaced only to internal users on the payment.
            </p>
            <Textarea
              id="refund-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add more details about this refund."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex flex-row gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRefunding}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValidAmount || isRefunding}
            className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isRefunding ? 'Processing...' : 'Refund'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
