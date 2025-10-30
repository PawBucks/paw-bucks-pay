import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

type MedicalRecordUploadProps = {
  petId: string;
  onSuccess?: () => void;
};

const recordTypes = [
  { value: "vaccination", label: "Vaccination" },
  { value: "checkup", label: "Checkup" },
  { value: "surgery", label: "Surgery" },
  { value: "lab_results", label: "Lab Results" },
  { value: "prescription", label: "Prescription" },
  { value: "dental", label: "Dental" },
  { value: "emergency", label: "Emergency" },
  { value: "other", label: "Other" },
];

export const MedicalRecordUpload = ({ petId, onSuccess }: MedicalRecordUploadProps) => {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [recordType, setRecordType] = useState("checkup");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const title = formData.get("title") as string;
      const description = formData.get("description") as string;
      const recordDate = formData.get("recordDate") as string;
      const quantity = formData.get("quantity") as string;
      const price = formData.get("price") as string;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let fileUrl = null;

      // Upload file if provided
      if (file) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${user.id}/${petId}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("medical-records")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("medical-records")
          .getPublicUrl(fileName);
        
        fileUrl = publicUrl;
      }

      // Insert medical record
      const { error: insertError } = await supabase
        .from("pet_medical_records")
        .insert({
          pet_id: petId,
          user_id: user.id,
          record_type: recordType as any,
          title,
          description: description || null,
          record_date: recordDate,
          quantity: quantity ? parseInt(quantity) : null,
          price: price ? parseFloat(price) : null,
          file_url: fileUrl,
        });

      if (insertError) throw insertError;

      toast.success("Medical record uploaded successfully");
      setOpen(false);
      onSuccess?.();
      
      // Reset form
      setFile(null);
      setRecordType("checkup");
    } catch (error: any) {
      console.error("Error uploading medical record:", error);
      toast.error(error.message || "Failed to upload medical record");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="w-4 h-4 mr-2" />
          Upload Medical Record
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Medical Record</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              name="title"
              placeholder="e.g., Annual Vaccination"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recordType">Record Type *</Label>
            <Select value={recordType} onValueChange={setRecordType} required>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {recordTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recordDate">Date *</Label>
            <Input
              id="recordDate"
              name="recordDate"
              type="date"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              min="0"
              step="1"
              placeholder="e.g., 1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">Price</Label>
            <Input
              id="price"
              name="price"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g., 99.99"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Additional notes..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Attach File (PDF, Image)</Label>
            <Input
              id="file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file && (
              <p className="text-sm text-muted-foreground">{file.name}</p>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Upload
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
