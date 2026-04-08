import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Upload, CalendarIcon, ImageIcon, X, Loader2, Sparkles, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/useSubscription";
import { getSubscriptionTier } from "@/lib/constants";

interface PartnerReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

type PlatformMerchant = {
  id: string;
  business_name: string;
  logo_url: string | null;
};

// PawBucks per $1 spent — tiered by subscription
const PB_RATES: Record<string, number> = {
  free: 10,
  pawpass: 20,
  pawpass_plus: 30,
};

export const PartnerReceiptDialog = ({ open, onOpenChange, userId }: PartnerReceiptDialogProps) => {
  const { subscription } = useSubscription();
  const [receiptImage, setReceiptImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [receiptDate, setReceiptDate] = useState<Date | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);

  const [platformMerchants, setPlatformMerchants] = useState<PlatformMerchant[]>([]);
  const [selectedMerchantId, setSelectedMerchantId] = useState("");
  const [merchantsLoading, setMerchantsLoading] = useState(false);

  const currentTier = getSubscriptionTier(subscription.product_id, subscription.subscription_tier);
  const pbPerDollar = PB_RATES[currentTier] || PB_RATES.free;
  const tierLabel = currentTier === "pawpass_plus" ? "PawPass+" : currentTier === "pawpass" ? "PawPass" : "Free";
  // Credit rate percent for DB storage (1%, 2%, 3%)
  const creditRatePercent = currentTier === "pawpass_plus" ? 3 : currentTier === "pawpass" ? 2 : 1;

  useEffect(() => {
    if (open) loadPlatformMerchants();
  }, [open]);

  const loadPlatformMerchants = async () => {
    setMerchantsLoading(true);
    try {
      const { data } = await supabase
        .from("merchants")
        .select("id, business_name, logo_url")
        .eq("approval_status", "approved")
        .eq("is_paused", false)
        .order("business_name");
      if (data) setPlatformMerchants(data);
    } finally {
      setMerchantsLoading(false);
    }
  };

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
    setReceiptDate(undefined);
    setSelectedMerchantId("");
  };

  const handleClose = () => { resetForm(); onOpenChange(false); };

  const handleSubmit = async () => {
    if (!receiptImage) { toast.error("Please upload a receipt image"); return; }
    if (!purchaseAmount || isNaN(parseFloat(purchaseAmount)) || parseFloat(purchaseAmount) <= 0) {
      toast.error("Please enter a valid purchase amount"); return;
    }
    if (!selectedMerchantId) { toast.error("Please select the merchant"); return; }
    if (!receiptDate) { toast.error("Please select the receipt date"); return; }

    setIsSubmitting(true);
    try {
      const fileExt = receiptImage.name.split(".").pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("receipts").upload(fileName, receiptImage);
      if (uploadError) throw uploadError;

      const selected = platformMerchants.find((m) => m.id === selectedMerchantId);
      const merchantName = selected?.business_name || "Platform Merchant";
      const amount = parseFloat(purchaseAmount);
      const estimatedPB = Math.round(amount * pbPerDollar);

      const { error: insertError } = await supabase.from("receipt_submissions").insert({
        user_id: userId,
        receipt_image_url: fileName,
        purchase_amount: amount,
        merchant_name: merchantName,
        receipt_date: format(receiptDate, "yyyy-MM-dd"),
        status: "pending",
        submission_type: "partner",
        merchant_id: selectedMerchantId,
        credit_rate_percent: creditRatePercent,
        subscription_tier: currentTier,
      });
      if (insertError) throw insertError;

      await supabase.from("notifications").insert({
        user_id: userId,
        title: "Receipt Submitted Successfully",
        message: `Receipt from ${merchantName} for $${amount.toFixed(2)} received. You'll earn ~${estimatedPB.toLocaleString()} PawBucks (${pbPerDollar} PB/$1 ${tierLabel} rate). Review takes 24-72 hours.`,
        category: "transactional",
      });

      // Send confirmation email to pet owner (fire-and-forget)
      supabase.functions.invoke("send-receipt-confirmation", {
        body: {
          merchantName,
          purchaseAmount: amount,
          receiptDate: format(receiptDate, "PPP"),
          estimatedPawBucks: estimatedPB,
          pbPerDollar,
          tierLabel,
          submissionType: "partner",
        },
      }).catch((err) => console.error("Receipt confirmation email failed:", err));

      // Notify merchant about the new receipt submission (fire-and-forget)
      if (selectedMerchantId) {
        supabase.functions.invoke("notify-merchant-receipt", {
          body: {
            merchantId: selectedMerchantId,
            merchantName,
            purchaseAmount: amount,
            receiptDate: format(receiptDate, "PPP"),
          },
        }).catch((err) => console.error("Merchant notification email failed:", err));
      }

      toast.success(`Receipt submitted! ~${estimatedPB.toLocaleString()} PawBucks estimated at your ${tierLabel} rate.`);
      handleClose();
    } catch (error) {
      console.error("Error submitting receipt:", error);
      toast.error("Failed to submit receipt. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const estimatedPB = purchaseAmount && !isNaN(parseFloat(purchaseAmount)) && parseFloat(purchaseAmount) > 0
    ? Math.round(parseFloat(purchaseAmount) * pbPerDollar) : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            Partner Receipt Submission
          </DialogTitle>
          <DialogDescription>
            Submit a receipt from a PawBucks partner whose POS doesn't integrate directly.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">
            {tierLabel} Rate: {pbPerDollar} PB per $1
          </span>
          {estimatedPB > 0 && (
            <span className="ml-auto text-sm font-bold text-primary">~{estimatedPB.toLocaleString()} PB</span>
          )}
        </div>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Select Merchant *</Label>
            <Select value={selectedMerchantId} onValueChange={setSelectedMerchantId}>
              <SelectTrigger>
                <SelectValue placeholder={merchantsLoading ? "Loading merchants..." : "Choose a partner merchant"} />
              </SelectTrigger>
              <SelectContent>
                {platformMerchants.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.business_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              For merchants whose POS system doesn't integrate with PawBucks
            </p>
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
            <Label htmlFor="partnerAmount">Purchase Amount (USD) *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input id="partnerAmount" type="number" step="0.01" min="0" placeholder="0.00" value={purchaseAmount} onChange={(e) => setPurchaseAmount(e.target.value)} className="pl-7" />
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
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={handleClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
            {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</>) : (<><Upload className="mr-2 h-4 w-4" />Submit Receipt</>)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
