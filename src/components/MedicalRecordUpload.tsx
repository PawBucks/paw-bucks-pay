import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, Paperclip, X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";

type MedicalRecordUploadProps = {
  petId: string;
  onSuccess?: () => void;
};

type LineItem = {
  id: string;
  title: string;
  record_type: string;
  quantity: string;
  price: string;
  description: string;
  file: File | null;
};

const recordTypes = [
  { value: "vaccination", label: "Vaccination" },
  { value: "checkup", label: "Check-up" },
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
  const [visitDate, setVisitDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [visitNotes, setVisitNotes] = useState("");
  const [vetName, setVetName] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: crypto.randomUUID(),
      title: "",
      record_type: "",
      quantity: "",
      price: "",
      description: "",
      file: null,
    },
  ]);

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        id: crypto.randomUUID(),
        title: "",
        record_type: "",
        quantity: "",
        price: "",
        description: "",
        file: null,
      },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length === 1) {
      toast.error("Must have at least one item");
      return;
    }
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Validate all line items have required fields
      const hasInvalidItems = lineItems.some(item => !item.title || !item.record_type);
      if (hasInvalidItems) {
        toast.error("Please fill in title and type for all items");
        setIsLoading(false);
        return;
      }

      // Create the visit
      const { data: visit, error: visitError } = await supabase
        .from("pet_medical_visits")
        .insert({
          pet_id: petId,
          user_id: user.id,
          visit_date: visitDate,
          notes: visitNotes || null,
          vet_name: vetName || null,
          doctor_name: doctorName || null,
        })
        .select()
        .single();

      if (visitError) throw visitError;

      // Upload each line item
      for (const item of lineItems) {
        let fileUrl = null;

        // Upload file if present
        if (item.file) {
          const fileExt = item.file.name.split(".").pop();
          const filePath = `${user.id}/${petId}/${crypto.randomUUID()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("medical-records")
            .upload(filePath, item.file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from("medical-records")
            .getPublicUrl(filePath);

          fileUrl = publicUrl;
        }

        // Insert the record
        const { error: recordError } = await supabase
          .from("pet_medical_records")
          .insert({
            visit_id: visit.id,
            pet_id: petId,
            user_id: user.id,
            record_type: item.record_type,
            title: item.title,
            record_date: visitDate,
            quantity: item.quantity ? parseInt(item.quantity) : null,
            price: item.price ? parseFloat(item.price) : null,
            description: item.description || null,
            file_url: fileUrl,
          } as any);

        if (recordError) throw recordError;
      }

      toast.success("Medical records uploaded successfully");
      setOpen(false);
      setVisitDate(new Date().toISOString().split('T')[0]);
      setVisitNotes("");
      setVetName("");
      setDoctorName("");
      setLineItems([
        {
          id: crypto.randomUUID(),
          title: "",
          record_type: "",
          quantity: "",
          price: "",
          description: "",
          file: null,
        },
      ]);
      onSuccess?.();
    } catch (error) {
      console.error("Error uploading medical records:", error);
      toast.error("Failed to upload medical records");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="w-4 h-4 mr-2" />
          Add Visit Records
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Medical Visit</DialogTitle>
          <DialogDescription>
            Record a vet visit with multiple itemized records. You can add procedures, medications, tests, etc.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4 pb-4 border-b">
            <div className="space-y-2">
              <Label htmlFor="visit_date">Visit Date *</Label>
              <Input
                id="visit_date"
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vet_name">Vet Clinic Name</Label>
              <Input
                id="vet_name"
                value={vetName}
                onChange={(e) => setVetName(e.target.value)}
                placeholder="e.g., Happy Paws Veterinary Clinic"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doctor_name">Doctor's Name</Label>
              <Input
                id="doctor_name"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                placeholder="e.g., Dr. Jane Smith"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="visit_notes">Visit Notes (optional)</Label>
              <Textarea
                id="visit_notes"
                value={visitNotes}
                onChange={(e) => setVisitNotes(e.target.value)}
                placeholder="General notes about the visit..."
                rows={2}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base">Line Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="w-4 h-4 mr-1" />
                Add Item
              </Button>
            </div>

            {lineItems.map((item, index) => (
              <Card key={item.id} className="p-4 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">Item {index + 1}</span>
                  {lineItems.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLineItem(item.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input
                      value={item.title}
                      onChange={(e) => updateLineItem(item.id, "title", e.target.value)}
                      placeholder="e.g., Rabies Vaccine"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Type *</Label>
                    <Select
                      value={item.record_type}
                      onValueChange={(value) => updateLineItem(item.id, "record_type", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(item.id, "quantity", e.target.value)}
                      placeholder="1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Price ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.price}
                      onChange={(e) => updateLineItem(item.id, "price", e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={item.description}
                    onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                    placeholder="Additional details..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Attach File (optional)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      onChange={(e) => updateLineItem(item.id, "file", e.target.files?.[0] || null)}
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      className="flex-1"
                    />
                    {item.file && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => updateLineItem(item.id, "file", null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  {item.file && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Paperclip className="w-3 h-3" />
                      {item.file.name}
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Visit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
