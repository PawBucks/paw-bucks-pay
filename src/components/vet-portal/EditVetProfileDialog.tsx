import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BusinessHoursEditor, type BusinessHoursEditorHandle } from "@/components/merchant/BusinessHoursEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type Vet = {
  id: string;
  user_id?: string | null;
  name: string;
  location: string;
  contact_email: string;
  clinic_phone?: string | null;
  website_url?: string | null;
  clinic_bio?: string | null;
  logo_url?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vet: Vet;
  userId: string;
  onSaved: () => void;
};

export function EditVetProfileDialog({ open, onOpenChange, vet, userId, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const hoursRef = useRef<BusinessHoursEditorHandle>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData(e.currentTarget);
      let logoUrl = vet.logo_url || null;

      if (logoFile) {
        const ext = logoFile.name.split(".").pop();
        const filePath = `${userId}/vet-${vet.id}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("merchant-logos")
          .upload(filePath, logoFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from("merchant-logos")
          .getPublicUrl(filePath);
        logoUrl = urlData.publicUrl;
      }

      const updates = {
        name: formData.get("name") as string,
        location: formData.get("location") as string,
        contact_email: formData.get("contact_email") as string,
        clinic_phone: (formData.get("clinic_phone") as string) || null,
        website_url: (formData.get("website_url") as string) || null,
        clinic_bio: (formData.get("clinic_bio") as string) || null,
        logo_url: logoUrl,
      };

      const { error } = await supabase
        .from("partner_vets")
        .update(updates)
        .eq("id", vet.id);

      if (error) throw error;

      // Persist business hours alongside the profile update.
      try {
        await hoursRef.current?.save({ vetId: vet.id });
      } catch (err) {
        console.error("Failed to save business hours:", err);
      }

      toast.success("Practice profile updated");
      setLogoFile(null);
      setLogoPreview(null);
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error updating vet profile:", err);
      toast.error(err?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Practice Profile</DialogTitle>
          <DialogDescription>
            Update your practice details and "About" information shown to pet owners.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 space-y-4 pr-2">
            <div className="space-y-2">
              <Label htmlFor="name">Practice Name</Label>
              <Input id="name" name="name" defaultValue={vet.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Business Address</Label>
              <Input
                id="location"
                name="location"
                placeholder="123 Main St, City, State ZIP"
                defaultValue={vet.location}
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_email">Contact Email</Label>
                <Input
                  id="contact_email"
                  name="contact_email"
                  type="email"
                  defaultValue={vet.contact_email}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinic_phone">Phone Number</Label>
                <Input
                  id="clinic_phone"
                  name="clinic_phone"
                  type="tel"
                  placeholder="(310) 555-1234"
                  defaultValue={vet.clinic_phone || ""}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="website_url">Website</Label>
              <Input
                id="website_url"
                name="website_url"
                placeholder="https://www.yourclinic.com"
                defaultValue={vet.website_url || ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clinic_bio">About Your Practice</Label>
              <Textarea
                id="clinic_bio"
                name="clinic_bio"
                rows={5}
                placeholder="Tell pet owners about your practice, philosophy, and the services you offer."
                defaultValue={vet.clinic_bio || ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logo">Practice Logo</Label>
              <Input id="logo" type="file" accept="image/*" onChange={handleLogoChange} />
              {(logoPreview || vet.logo_url) && (
                <div className="w-24 h-24 rounded-lg overflow-hidden border border-border">
                  <img
                    src={logoPreview || vet.logo_url || ""}
                    alt="Logo preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
            {/* Hours of Operation */}
            <BusinessHoursEditor ref={hoursRef} vetId={vet.id} hideSaveButton />
          </div>
          <div className="flex gap-3 pt-4 border-t mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}