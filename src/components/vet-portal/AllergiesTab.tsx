import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Plus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import type { PetAllergy } from "./types";

interface AllergiesTabProps {
  petId: string;
  vetId: string;
  onUpdate: () => void;
}

export const AllergiesTab = ({ petId, vetId, onUpdate }: AllergiesTabProps) => {
  const [allergies, setAllergies] = useState<PetAllergy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    allergy_name: "",
    allergy_type: "food",
    severity: "moderate",
    reaction_description: "",
    first_observed_date: "",
    notes: "",
  });

  useEffect(() => {
    loadAllergies();
  }, [petId]);

  const loadAllergies = async () => {
    try {
      const { data, error } = await supabase
        .from("pet_allergies")
        .select("*")
        .eq("pet_id", petId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAllergies((data as PetAllergy[]) || []);
    } catch (error) {
      console.error("Error loading allergies:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.allergy_name) {
      toast.error("Please enter the allergy name");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("pet_allergies").insert({
        pet_id: petId,
        vet_id: vetId,
        allergy_name: formData.allergy_name,
        allergy_type: formData.allergy_type,
        severity: formData.severity,
        reaction_description: formData.reaction_description || null,
        first_observed_date: formData.first_observed_date || null,
        notes: formData.notes || null,
      });

      if (error) throw error;
      toast.success("Allergy added");
      setDialogOpen(false);
      loadAllergies();
      onUpdate();
      setFormData({
        allergy_name: "",
        allergy_type: "food",
        severity: "moderate",
        reaction_description: "",
        first_observed_date: "",
        notes: "",
      });
    } catch (error: any) {
      console.error("Error saving allergy:", error);
      toast.error(error.message || "Failed to save allergy");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAllergyStatus = async (allergy: PetAllergy) => {
    try {
      const { error } = await supabase
        .from("pet_allergies")
        .update({ is_active: !allergy.is_active })
        .eq("id", allergy.id);

      if (error) throw error;
      loadAllergies();
      onUpdate();
      toast.success(`Allergy ${allergy.is_active ? "deactivated" : "reactivated"}`);
    } catch (error) {
      console.error("Error updating allergy:", error);
      toast.error("Failed to update allergy");
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "severe":
        return "destructive";
      case "moderate":
        return "default";
      case "mild":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading allergies...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Allergy
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Allergy Record</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="allergy_name">Allergy Name *</Label>
                <Input
                  id="allergy_name"
                  value={formData.allergy_name}
                  onChange={(e) => setFormData({ ...formData, allergy_name: e.target.value })}
                  placeholder="e.g., Penicillin, Chicken, Flea bites"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="allergy_type">Type</Label>
                  <Select
                    value={formData.allergy_type}
                    onValueChange={(value) => setFormData({ ...formData, allergy_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="food">Food</SelectItem>
                      <SelectItem value="medication">Medication</SelectItem>
                      <SelectItem value="environmental">Environmental</SelectItem>
                      <SelectItem value="contact">Contact</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="severity">Severity</Label>
                  <Select
                    value={formData.severity}
                    onValueChange={(value) => setFormData({ ...formData, severity: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mild">Mild</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="severe">Severe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="reaction">Reaction Description</Label>
                <Textarea
                  id="reaction"
                  value={formData.reaction_description}
                  onChange={(e) => setFormData({ ...formData, reaction_description: e.target.value })}
                  placeholder="Describe the allergic reaction..."
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="first_observed">First Observed Date</Label>
                <Input
                  id="first_observed"
                  type="date"
                  value={formData.first_observed_date}
                  onChange={(e) => setFormData({ ...formData, first_observed_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional information..."
                  rows={2}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {allergies.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No allergies recorded.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {allergies.map((allergy) => (
            <Card
              key={allergy.id}
              className={`p-4 ${!allergy.is_active ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      allergy.severity === "severe"
                        ? "bg-destructive/10 /30"
                        : allergy.severity === "moderate"
                        ? "bg-warning/10 /30"
                        : "bg-warning/10 /30"
                    }`}
                  >
                    <AlertTriangle
                      className={`w-5 h-5 ${
                        allergy.severity === "severe"
                          ? "text-destructive"
                          : allergy.severity === "moderate"
                          ? "text-warning"
                          : "text-warning"
                      }`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{allergy.allergy_name}</h3>
                      {!allergy.is_active && (
                        <Badge variant="outline" className="text-muted-foreground">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Badge variant="outline" className="capitalize">
                        {allergy.allergy_type}
                      </Badge>
                      <Badge variant={getSeverityColor(allergy.severity) as any} className="capitalize">
                        {allergy.severity}
                      </Badge>
                    </div>
                    {allergy.reaction_description && (
                      <p className="text-sm text-muted-foreground mt-2">
                        <strong>Reaction:</strong> {allergy.reaction_description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`active-${allergy.id}`} className="text-xs text-muted-foreground">
                    Active
                  </Label>
                  <Switch
                    id={`active-${allergy.id}`}
                    checked={allergy.is_active}
                    onCheckedChange={() => toggleAllergyStatus(allergy)}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
