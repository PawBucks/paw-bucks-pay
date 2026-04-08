import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Upload, CalendarIcon, ImageIcon, X, Loader2, Sparkles, Receipt, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface NonPartnerReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

const PB_PER_DOLLAR = 10;
const MONTHLY_DOLLAR_CAP = 20; // $20/month in receipts
const MONTHLY_PB_CAP = MONTHLY_DOLLAR_CAP * PB_PER_DOLLAR; // 20,000 PB/month

export const NonPartnerReceiptDialog = ({ open, onOpenChange, userId }: NonPartnerReceiptDialogProps) => {
  const [receiptImage, setReceiptImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [receiptDate, setReceiptDate] = useState<Date | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [monthlySpent, setMonthlySpent] = useState(0);
  const [loadingCap, setLoadingCap] = useState(true);

  useEffect(() => {
    if (open) loadMonthlyCap();
  }, [open, userId]);

  const loadMonthlyCap = async () => {
    setLoadingCap(true);
    try {
      const now = new Date();
      const { data } = await supabase
        .from("receipt_submissions")
        .select("purchase_amount")
        .eq("user_id", userId)
        .eq("submission_type", "non_partner")
        .neq("status", "rejected")
        .gte("created_at", startOfMonth(now).toISOString())
        .lte("created_at", endOfMonth(now).toISOString());

      const total = data?.reduce((sum, r) => sum + (r.purchase_amount || 0), 0) || 0;
      setMonthlySpent(total);
    } finally {
      setLoadingCap(false);
    }
  };

  const remainingDollarCap = Math.max(0, MONTHLY_DOLLAR_CAP - monthlySpent);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Image must be less than 10MB"); return; }
    setReceiptImage(file);
    setImagePreview(URL.createObjectURL(file));
    processReceiptOcr(file);
  };

  const processReceiptOcr = async (file: File) => {
    setIsProcessingOcr(true);
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke("process-receipt-ocr", { body: { imageBase64: base64 } });
      if (!error && data?.success && data?.data) {
        if (data.data.amount && !purchaseAmount) setPurchaseAmount(String(data.data.amount));
        if (data.data.vendor_name && !merchantName) setMerchantName(data.data.vendor_name);
        if (data.data.date && !receiptDate) {
          const parsed = new Date(data.data.date);
          if (!isNaN(parsed.getTime())) setReceiptDate(parsed);
        }
        toast.success("Receipt scanned! Fields auto-filled.");
      }
    } catch { /* OCR non-critical */ } finally {
      setIsProcessingOcr(false);
    }
  };

  const removeImage = () => {
    setReceiptImage(null);
    if (imagePreview) { URL.revokeObjectURL(imagePreview); setImagePreview(null); }
  };

  const resetForm = () => {
    removeImage();
    setPurchaseAmount("");
    setMerchantName("");
    setReceiptDate(undefined);
  };

  const handleClose = () => { resetForm(); onOpenChange(false); };

  const handleSubmit = async () => {
    if (!receiptImage) { toast.error("Please upload a receipt image"); return; }
    if (!purchaseAmount || isNaN(parseFloat(purchaseAmount)) || parseFloat(purchaseAmount) <= 0) {
      toast.error("Please enter a valid purchase amount"); return;
    }
    if (!merchantName.trim()) { toast.error("Please enter the store name"); return; }
    if (!receiptDate) { toast.error("Please select the receipt date"); return; }

    const amount = parseFloat(purchaseAmount);
    if (amount > remainingDollarCap) {
      toast.error(`You've reached your monthly cap. Only $${remainingDollarCap.toFixed(2)} remaining this month.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const fileExt = receiptImage.name.split(".").pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("receipts").upload(fileName, receiptImage);
      if (uploadError) throw uploadError;

      const estimatedPB = Math.round(amount * PB_PER_DOLLAR);

      const { error: insertError } = await supabase.from("receipt_submissions").insert({
        user_id: userId,
        receipt_image_url: fileName,
        purchase_amount: amount,
        merchant_name: merchantName.trim(),
        receipt_date: format(receiptDate, "yyyy-MM-dd"),
        status: "pending",
        submission_type: "non_partner",
        merchant_id: null,
        credit_rate_percent: 0.5, // 5 PB/$1 = 0.5% of dollar value in PB terms
        subscription_tier: "pawpass_plus",
      });
      if (insertError) throw insertError;

      await supabase.from("notifications").insert({
        user_id: userId,
        title: "Non-Partner Receipt Submitted",
        message: `Receipt from ${merchantName.trim()} for $${amount.toFixed(2)} received. You'll earn ~${estimatedPB.toLocaleString()} PawBucks (${PB_PER_DOLLAR} PB/$1). These vest after 30 days. Review takes 24-72 hours.`,
        category: "transactional",
      });

      // Send confirmation email (fire-and-forget)
      supabase.functions.invoke("send-receipt-confirmation", {
        body: {
          merchantName: merchantName.trim(),
          purchaseAmount: amount,
          receiptDate: format(receiptDate, "PPP"),
          estimatedPawBucks: estimatedPB,
          pbPerDollar: PB_PER_DOLLAR,
          tierLabel: "PawPass+",
          submissionType: "non_partner",
          vestingDays: 30,
        },
      }).catch((err) => console.error("Receipt confirmation email failed:", err));

      toast.success(`Receipt submitted! ~${estimatedPB.toLocaleString()} PawBucks (vests after 30 days).`);
      handleClose();
    } catch (error) {
      console.error("Error submitting receipt:", error);
      toast.error("Failed to submit receipt. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const amount = purchaseAmount && !isNaN(parseFloat(purchaseAmount)) && parseFloat(purchaseAmount) > 0 ? parseFloat(purchaseAmount) : 0;
  const estimatedPB = Math.round(amount * PB_PER_DOLLAR);
  const capPercent = Math.min(100, ((monthlySpent + amount) / MONTHLY_DOLLAR_CAP) * 100);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Other Pet Store Receipt
          </DialogTitle>
          <DialogDescription>
            Submit receipts from any pet store — even those not on PawBucks — and earn rewards.
          </DialogDescription>
        </DialogHeader>

        {/* Rate & Cap Info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="text-sm font-medium">PawPass+ Exclusive: 5 PB per $1</span>
            {estimatedPB > 0 && (
              <span className="ml-auto text-sm font-bold text-primary">~{estimatedPB.toLocaleString()} PB</span>
            )}
          </div>

          {/* Monthly Cap Progress */}
          {!loadingCap && (
            <div className="p-3 rounded-lg bg-muted/50 border">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Monthly Cap</span>
                <span className="font-medium">${monthlySpent.toFixed(0)} / ${MONTHLY_DOLLAR_CAP} used</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", capPercent >= 90 ? "bg-destructive" : capPercent >= 70 ? "bg-yellow-500" : "bg-primary")}
                  style={{ width: `${Math.min(100, (monthlySpent / MONTHLY_DOLLAR_CAP) * 100)}%` }}
                />
              </div>
              {remainingDollarCap <= 0 && (
                <div className="flex items-center gap-1 mt-2 text-xs text-destructive">
                  <AlertTriangle className="w-3 h-3" />
                  Monthly cap reached. Resets next month.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="npMerchantName">Pet Store / Brand Name *</Label>
            <Input id="npMerchantName" placeholder="e.g., Petco, Chewy, PetSmart" value={merchantName} onChange={(e) => setMerchantName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Receipt Photo *</Label>
            {!imagePreview ? (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <ImageIcon className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Click to upload a clear photo</p>
                  <p className="text-xs text-muted-foreground">AI will auto-fill details</p>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleImageSelect} />
              </label>
            ) : (
              <div className="relative">
                <img src={imagePreview} alt="Receipt preview" className="w-full h-32 object-cover rounded-lg" />
                {isProcessingOcr && (
                  <div className="absolute inset-0 bg-background/60 flex items-center justify-center rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Scanning receipt...
                    </div>
                  </div>
                )}
                <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={removeImage}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="npAmount">Purchase Amount (USD) *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input id="npAmount" type="number" step="0.01" min="0" placeholder="0.00" value={purchaseAmount} onChange={(e) => setPurchaseAmount(e.target.value)} className="pl-7" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Receipt Date *</Label>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !receiptDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {receiptDate ? format(receiptDate, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={receiptDate} onSelect={(date) => { setReceiptDate(date); setDatePickerOpen(false); }} disabled={(date) => date > new Date()} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          {/* Vesting notice */}
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-xs text-yellow-700 dark:text-yellow-400">
              <strong>Note:</strong> Non-partner PawBucks vest after 30 days and are subject to a ${MONTHLY_DOLLAR_CAP}/month receipt cap.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={handleClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || remainingDollarCap <= 0} className="flex-1">
            {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</>) : (<><Upload className="mr-2 h-4 w-4" />Submit Receipt</>)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
