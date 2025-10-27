import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type PaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  merchantId: string;
  merchantName: string;
  cashbackRate: number;
  userId: string;
  onSuccess: () => void;
};

export const PaymentDialog = ({
  open,
  onOpenChange,
  merchantId,
  merchantName,
  cashbackRate,
  userId,
  onSuccess,
}: PaymentDialogProps) => {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const paymentAmount = parseFloat(amount);
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        throw new Error("Please enter a valid amount");
      }

      // Calculate cashback
      const cashbackAmount = (paymentAmount * cashbackRate) / 100;
      const rewardsEarned = Math.floor(paymentAmount); // 1 point per dollar

      // Create transaction
      const { error } = await supabase.from("transactions").insert({
        pet_owner_id: userId,
        merchant_id: merchantId,
        amount: paymentAmount,
        cashback_amount: cashbackAmount,
        rewards_earned: rewardsEarned,
        description: description || `Payment to ${merchantName}`,
        status: "completed",
      });

      if (error) throw error;

      toast.success(
        `Payment successful! You earned $${cashbackAmount.toFixed(2)} cashback and ${rewardsEarned} points!`
      );
      
      setAmount("");
      setDescription("");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(error.message || "Payment failed");
    } finally {
      setIsLoading(false);
    }
  };

  const cashbackPreview = amount && !isNaN(parseFloat(amount))
    ? ((parseFloat(amount) * cashbackRate) / 100).toFixed(2)
    : "0.00";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay {merchantName}</DialogTitle>
          <DialogDescription>
            Earn {cashbackRate}% cashback on your purchase
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handlePayment} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount ($)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              placeholder="Pet grooming, food, etc."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {amount && (
            <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-medium">${parseFloat(amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cashback ({cashbackRate}%):</span>
                <span className="font-bold text-accent">+${cashbackPreview}</span>
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Confirm Payment"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};