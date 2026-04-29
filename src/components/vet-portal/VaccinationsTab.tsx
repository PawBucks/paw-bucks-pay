import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Syringe, Plus, Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Vaccination } from "./types";

interface VaccinationsTabProps {
  petId: string;
  vetId: string;
}

export const VaccinationsTab = ({ petId, vetId }: VaccinationsTabProps) => {
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    vaccine_name: "",
    vaccine_type: "core",
    manufacturer: "",
    lot_number: "",
    administration_date: new Date().toISOString().split("T")[0],
    next_due_date: "",
    administration_site: "",
    route: "subcutaneous",
    dose: "",
    administered_by: "",
  });

  useEffect(() => {
    loadVaccinations();
  }, [petId]);

  const loadVaccinations = async () => {
    try {
      const { data, error } = await supabase
        .from("pet_vaccinations")
        .select("*")
        .eq("pet_id", petId)
        .order("administration_date", { ascending: false });

      if (error) throw error;
      setVaccinations((data as Vaccination[]) || []);
    } catch (error) {
      console.error("Error loading vaccinations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vaccine_name || !formData.administration_date) {
      toast.error("Please fill in required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("pet_vaccinations").insert({
        pet_id: petId,
        vet_id: vetId,
        vaccine_name: formData.vaccine_name,
        vaccine_type: formData.vaccine_type,
        manufacturer: formData.manufacturer || null,
        lot_number: formData.lot_number || null,
        administration_date: formData.administration_date,
        next_due_date: formData.next_due_date || null,
        administration_site: formData.administration_site || null,
        route: formData.route || null,
        dose: formData.dose || null,
        administered_by: formData.administered_by || null,
      });

      if (error) throw error;
      toast.success("Vaccination record added");
      setDialogOpen(false);
      loadVaccinations();
      setFormData({
        vaccine_name: "",
        vaccine_type: "core",
        manufacturer: "",
        lot_number: "",
        administration_date: new Date().toISOString().split("T")[0],
        next_due_date: "",
        administration_site: "",
        route: "subcutaneous",
        dose: "",
        administered_by: "",
      });
    } catch (error: any) {
      console.error("Error saving vaccination:", error);
      toast.error(error.message || "Failed to save vaccination");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isOverdue = (nextDue: string | null) => {
    if (!nextDue) return false;
    return new Date(nextDue) < new Date();
  };

  const isDueSoon = (nextDue: string | null) => {
    if (!nextDue) return false;
    const dueDate = new Date(nextDue);
    const today = new Date();
    const thirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    return dueDate >= today && dueDate <= thirtyDays;
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading vaccinations...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Vaccination
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Vaccination Record</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="vaccine_name">Vaccine Name *</Label>
                <Input
                  id="vaccine_name"
                  value={formData.vaccine_name}
                  onChange={(e) => setFormData({ ...formData, vaccine_name: e.target.value })}
                  placeholder="e.g., Rabies, DHPP, FVRCP"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="vaccine_type">Type</Label>
                  <Select
                    value={formData.vaccine_type}
                    onValueChange={(value) => setFormData({ ...formData, vaccine_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="core">Core</SelectItem>
                      <SelectItem value="non-core">Non-Core</SelectItem>
                      <SelectItem value="required">Required</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="route">Route</Label>
                  <Select
                    value={formData.route}
                    onValueChange={(value) => setFormData({ ...formData, route: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="subcutaneous">Subcutaneous</SelectItem>
                      <SelectItem value="intramuscular">Intramuscular</SelectItem>
                      <SelectItem value="intranasal">Intranasal</SelectItem>
                      <SelectItem value="oral">Oral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="admin_date">Administration Date *</Label>
                  <Input
                    id="admin_date"
                    type="date"
                    value={formData.administration_date}
                    onChange={(e) => setFormData({ ...formData, administration_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="next_due">Next Due Date</Label>
                  <Input
                    id="next_due"
                    type="date"
                    value={formData.next_due_date}
                    onChange={(e) => setFormData({ ...formData, next_due_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="manufacturer">Manufacturer</Label>
                  <Input
                    id="manufacturer"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="lot_number">Lot Number</Label>
                  <Input
                    id="lot_number"
                    value={formData.lot_number}
                    onChange={(e) => setFormData({ ...formData, lot_number: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dose">Dose</Label>
                  <Input
                    id="dose"
                    value={formData.dose}
                    onChange={(e) => setFormData({ ...formData, dose: e.target.value })}
                    placeholder="e.g., 1 mL"
                  />
                </div>
                <div>
                  <Label htmlFor="site">Administration Site</Label>
                  <Input
                    id="site"
                    value={formData.administration_site}
                    onChange={(e) => setFormData({ ...formData, administration_site: e.target.value })}
                    placeholder="e.g., Right shoulder"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="administered_by">Administered By</Label>
                <Input
                  id="administered_by"
                  value={formData.administered_by}
                  onChange={(e) => setFormData({ ...formData, administered_by: e.target.value })}
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

      {vaccinations.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Syringe className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No vaccination records yet.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {vaccinations.map((vax) => (
            <Card key={vax.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-success/10 /30 flex items-center justify-center">
                    <Syringe className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{vax.vaccine_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Administered: {format(new Date(vax.administration_date), "MMM d, yyyy")}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Badge variant="outline" className="capitalize">
                        {vax.vaccine_type}
                      </Badge>
                      {vax.route && (
                        <Badge variant="secondary" className="capitalize">
                          {vax.route}
                        </Badge>
                      )}
                      {vax.manufacturer && (
                        <Badge variant="secondary">{vax.manufacturer}</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {vax.next_due_date && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">
                        Due: {format(new Date(vax.next_due_date), "MMM d, yyyy")}
                      </span>
                      {isOverdue(vax.next_due_date) && (
                        <Badge variant="destructive">Overdue</Badge>
                      )}
                      {isDueSoon(vax.next_due_date) && !isOverdue(vax.next_due_date) && (
                        <Badge variant="outline" className="border-warning text-warning">
                          Due Soon
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
