import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Upload, CalendarIcon, ImageIcon, X, Loader2, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReceiptUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

export const ReceiptUploadDialog = ({ open, onOpenChange, userId }: ReceiptUploadDialogProps) => {
  const [receiptImage, setReceiptImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [receiptDate, setReceiptDate] = useState<Date | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast.error("Please upload an image file");
        return;
      }
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Image must be less than 10MB");
        return;
      }
      setReceiptImage(file);
      setImagePreview(URL.createObjectURL(file));
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
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    // Validate all fields
    if (!receiptImage) {
      toast.error("Please upload a receipt image");
      return;
    }
    if (!purchaseAmount || isNaN(parseFloat(purchaseAmount)) || parseFloat(purchaseAmount) <= 0) {
      toast.error("Please enter a valid purchase amount");
      return;
    }
    if (!merchantName.trim()) {
      toast.error("Please enter the merchant/brand name");
      return;
    }
    if (!receiptDate) {
      toast.error("Please select the receipt date");
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload image to storage
      const fileExt = receiptImage.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, receiptImage);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL for the uploaded image
      const { data: urlData } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName);

      // Insert receipt submission record
      const { error: insertError } = await supabase
        .from('receipt_submissions')
        .insert({
          user_id: userId,
          receipt_image_url: urlData.publicUrl,
          purchase_amount: parseFloat(purchaseAmount),
          merchant_name: merchantName.trim(),
          receipt_date: format(receiptDate, 'yyyy-MM-dd'),
          status: 'pending'
        });

      if (insertError) {
        throw insertError;
      }

      // Create notification for the user
      await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          title: 'Receipt Submitted Successfully',
          message: `We've received your receipt from ${merchantName.trim()} for $${parseFloat(purchaseAmount).toFixed(2)}. Our team will review it and update your PawBucks balance within 24-72 hours.`,
          category: 'transactional'
        });

      toast.success("Receipt submitted successfully! We'll review it within 24-72 hours.");
      handleClose();
    } catch (error) {
      console.error("Error submitting receipt:", error);
      toast.error("Failed to submit receipt. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Upload Receipt
          </DialogTitle>
          <DialogDescription>
            Upload a receipt from any pet merchant to earn PawBucks rewards. We'll review and credit your balance within 24-72 hours.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Receipt Image Upload */}
          <div className="space-y-2">
            <Label>Receipt Photo *</Label>
            {!imagePreview ? (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <ImageIcon className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Click to upload a clear photo</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageSelect}
                />
              </label>
            ) : (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Receipt preview"
                  className="w-full h-32 object-cover rounded-lg"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={removeImage}
                >
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

          {/* Merchant/Brand Name */}
          <div className="space-y-2">
            <Label htmlFor="merchantName">Pet Merchant/Brand *</Label>
            <Input
              id="merchantName"
              placeholder="e.g., Petco, Chewy, PetSmart"
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
            />
          </div>

          {/* Receipt Date */}
          <div className="space-y-2">
            <Label>Receipt Date *</Label>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !receiptDate && "text-muted-foreground"
                  )}
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
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="flex-1"
          >
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
