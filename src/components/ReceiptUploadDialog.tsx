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
import { Upload, CalendarIcon, ImageIcon, X, Loader2, Receipt, Sparkles, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/useSubscription";
import { getSubscriptionTier } from "@/lib/constants";

interface ReceiptUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

type PlatformMerchant = {
  id: string;
  business_name: string;
  logo_url: string | null;
};

const CREDIT_RATES: Record<string, number> = {
  free: 1,
  pawpass: 2,
  pawpass_plus: 3,
};

export const ReceiptUploadDialog = ({ open, onOpenChange, userId }: ReceiptUploadDialogProps) => {
  const { subscription } = useSubscription();
  const [receiptImage, setReceiptImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [receiptDate, setReceiptDate] = useState<Date | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);

  // Unified: partner vs non-partner
  const [submissionType, setSubmissionType] = useState<"partner" | "non_partner">("partner");
  const [platformMerchants, setPlatformMerchants] = useState<PlatformMerchant[]>([]);
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>("");
  const [merchantsLoading, setMerchantsLoading] = useState(false);

  const currentTier = getSubscriptionTier(subscription.product_id, subscription.subscription_tier);
  const creditRate = CREDIT_RATES[currentTier] || CREDIT_RATES.free;
  const tierLabel = currentTier === 'pawpass_plus' ? 'PawPass+' : currentTier === 'pawpass' ? 'PawPass' : 'Free';

  // Load approved platform merchants
  useEffect(() => {
    if (open && submissionType === "partner") {
      loadPlatformMerchants();
    }
  }, [open, submissionType]);

  const loadPlatformMerchants = async () => {
    setMerchantsLoading(true);
    try {
      const { data, error } = await supabase
        .from("merchants")
        .select("id, business_name, logo_url")
        .eq("approval_status", "approved")
        .eq("is_paused", false)
        .order("business_name");

      if (!error && data) {
        setPlatformMerchants(data);
      }
    } finally {
      setMerchantsLoading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please upload an image file");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Image must be less than 10MB");
        return;
      }
      setReceiptImage(file);
      setImagePreview(URL.createObjectURL(file));

      // Auto-OCR to prefill fields
      processReceiptOcr(file);
    }
  };

  const processReceiptOcr = async (file: File) => {
    setIsProcessingOcr(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(",")[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(file);
      const imageBase64 = await base64Promise;

      const { data, error } = await supabase.functions.invoke("process-receipt-ocr", {
        body: { imageBase64 },
      });

      if (!error && data?.success && data?.data) {
        const ocr = data.data;
        if (ocr.amount && !purchaseAmount) setPurchaseAmount(String(ocr.amount));
        if (ocr.vendor_name && !merchantName) setMerchantName(ocr.vendor_name);
        if (ocr.date && !receiptDate) {
          const parsed = new Date(ocr.date);
          if (!isNaN(parsed.getTime())) setReceiptDate(parsed);
        }
        toast.success("Receipt scanned! Fields auto-filled.");
      }
    } catch {
      // OCR failure is non-critical
    } finally {
      setIsProcessingOcr(false);
    }
  };

  const removeImage = () => {
    setReceiptImage(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
  };

  const resetForm = () => {
    removeImage();
    setPurchaseAmount("");
    setMerchantName("");
    setReceiptDate(undefined);
    setSelectedMerchantId("");
    setSubmissionType("partner");
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!receiptImage) {
      toast.error("Please upload a receipt image");
      return;
    }
    if (!purchaseAmount || isNaN(parseFloat(purchaseAmount)) || parseFloat(purchaseAmount) <= 0) {
      toast.error("Please enter a valid purchase amount");
      return;
    }
    if (submissionType === "partner" && !selectedMerchantId) {
      toast.error("Please select the merchant");
      return;
    }
    if (submissionType === "non_partner" && !merchantName.trim()) {
      toast.error("Please enter the merchant/brand name");
      return;
    }
    if (!receiptDate) {
      toast.error("Please select the receipt date");
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload image
      const fileExt = receiptImage.name.split(".").pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(fileName, receiptImage);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("receipts")
        .getPublicUrl(fileName);

      // Get merchant name for partner submissions
      let finalMerchantName = merchantName.trim();
      if (submissionType === "partner") {
        const selected = platformMerchants.find((m) => m.id === selectedMerchantId);
        finalMerchantName = selected?.business_name || "Platform Merchant";
      }

      // Calculate estimated PawBucks
      const amount = parseFloat(purchaseAmount);
      const estimatedPawBucks = Math.round(amount * creditRate * 10); // e.g. 1% of $100 = $1 = 10 PB

      const { error: insertError } = await supabase
        .from("receipt_submissions")
        .insert({
          user_id: userId,
          receipt_image_url: urlData.publicUrl,
          purchase_amount: amount,
          merchant_name: finalMerchantName,
          receipt_date: format(receiptDate, "yyyy-MM-dd"),
          status: "pending",
          submission_type: submissionType,
          merchant_id: submissionType === "partner" ? selectedMerchantId : null,
          credit_rate_percent: creditRate,
          subscription_tier: currentTier,
        });

      if (insertError) throw insertError;

      await supabase.from("notifications").insert({
        user_id: userId,
        title: "Receipt Submitted Successfully",
        message: `We've received your receipt from ${finalMerchantName} for $${amount.toFixed(2)}. You'll earn approximately ${estimatedPawBucks.toLocaleString()} PawBucks (${creditRate}% ${tierLabel} rate). Review takes 24-72 hours.`,
        category: "transactional",
      });

      toast.success(`Receipt submitted! Estimated ${estimatedPawBucks.toLocaleString()} PawBucks at your ${tierLabel} rate.`);
      handleClose();
    } catch (error) {
      console.error("Error submitting receipt:", error);
      toast.error("Failed to submit receipt. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const estimatedPB = purchaseAmount && !isNaN(parseFloat(purchaseAmount)) && parseFloat(purchaseAmount) > 0
    ? Math.round(parseFloat(purchaseAmount) * creditRate * 10)
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Submit Receipt for PawBucks
          </DialogTitle>
          <DialogDescription>
            Upload a receipt to earn PawBucks rewards. You're earning at the <strong>{tierLabel} rate ({creditRate}%)</strong>.
          </DialogDescription>
        </DialogHeader>

        {/* Tier Badge */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">
            Your Rate: {creditRate}% ({tierLabel})
          </span>
          {estimatedPB > 0 && (
            <span className="ml-auto text-sm font-bold text-primary">
              ~{estimatedPB.toLocaleString()} PB
            </span>
          )}
        </div>

        <div className="space-y-4 py-2">
          {/* Submission Type Toggle */}
          <div className="space-y-2">
            <Label>Where did you shop?</Label>
          <div className={cn("grid gap-2", currentTier === 'pawpass_plus' ? "grid-cols-2" : "grid-cols-1")}>
              <Button
                type="button"
                variant={submissionType === "partner" ? "default" : "outline"}
                size="sm"
                onClick={() => setSubmissionType("partner")}
                className="w-full"
              >
                <Store className="w-4 h-4 mr-1" />
                PawBucks Partner
              </Button>
              {currentTier === 'pawpass_plus' && (
                <Button
                  type="button"
                  variant={submissionType === "non_partner" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSubmissionType("non_partner")}
                  className="w-full"
                >
                  <Receipt className="w-4 h-4 mr-1" />
                  Other Pet Store
                </Button>
              )}
            </div>
          </div>

          {/* Merchant Selection */}
          {submissionType === "partner" ? (
            <div className="space-y-2">
              <Label>Select Merchant *</Label>
              <Select value={selectedMerchantId} onValueChange={setSelectedMerchantId}>
                <SelectTrigger>
                  <SelectValue placeholder={merchantsLoading ? "Loading merchants..." : "Choose a merchant"} />
                </SelectTrigger>
                <SelectContent>
                  {platformMerchants.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.business_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                For merchants whose POS system doesn't integrate with PawBucks
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="merchantName">Pet Merchant/Brand *</Label>
              <Input
                id="merchantName"
                placeholder="e.g., Petco, Chewy, PetSmart"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
              />
            </div>
          )}

          {/* Non-partner disclaimer */}
          {submissionType === "non_partner" && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                <strong>Note:</strong> Non-partner PawBucks vest after 30 days and are subject to a 20,000 PawBucks monthly cap.
              </p>
            </div>
          )}

          {/* Receipt Image Upload */}
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

          {/* Purchase Amount */}
          <div className="space-y-2">
            <Label htmlFor="purchaseAmount">Purchase Amount (USD) *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="purchaseAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={purchaseAmount}
                onChange={(e) => setPurchaseAmount(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>

          {/* Receipt Date */}
          <div className="space-y-2">
            <Label>Receipt Date *</Label>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !receiptDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {receiptDate ? format(receiptDate, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={receiptDate}
                  onSelect={(date) => {
                    setReceiptDate(date);
                    setDatePickerOpen(false);
                  }}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={handleClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Submit Receipt
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
