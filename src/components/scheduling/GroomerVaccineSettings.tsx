import { useState } from"react";
import { useQuery, useMutation, useQueryClient } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { GradientCard } from"@/components/ui/gradient-card";
import { Badge } from"@/components/ui/badge";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
} from"@/components/ui/dialog";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
import { Edit, Loader2, Plus, Shield, Trash2 } from "lucide-react";
import { toast } from"sonner";

const ENFORCEMENT_LEVELS = [
 { value:"required", label:"Required", description:"Blocks booking if missing/expired", color:"bg-destructive/10 text-destructive border-destructive/20" },
 { value:"warning", label:"Warning", description:"Shows warning but allows booking", color:"bg-warning/10 text-warning border-warning/20" },
 { value:"info", label:"Info Only", description:"Shows info, no restrictions", color:"bg-info/10 text-info border-info/20" },
];

const COMMON_VACCINES = ["Rabies","DHPP","Bordetella","Canine Influenza","Leptospirosis","Lyme Disease"];

interface VaccineRequirement {
 id: string;
 merchant_id: string;
 vaccine_name: string;
 enforcement_level: string;
 max_age_months: number;
 description: string | null;
 is_active: boolean;
}

interface GroomerVaccineSettingsProps {
 merchantId: string;
}

export function GroomerVaccineSettings({ merchantId }: GroomerVaccineSettingsProps) {
 const queryClient = useQueryClient();
 const [dialogOpen, setDialogOpen] = useState(false);
 const [editing, setEditing] = useState<VaccineRequirement | null>(null);

 const [form, setForm] = useState({
 vaccine_name:"",
 enforcement_level:"warning",
 max_age_months:"12",
 description:"",
 });

 const { data: requirements = [], isLoading } = useQuery({
 queryKey: ["groomer-vaccines", merchantId],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("groomer_vaccine_requirements")
 .select("*")
 .eq("merchant_id", merchantId)
 .eq("is_active", true)
 .order("vaccine_name");
 if (error) throw error;
 return data as VaccineRequirement[];
 },
 });

 const saveMutation = useMutation({
 mutationFn: async () => {
 const payload = {
 merchant_id: merchantId,
 vaccine_name: form.vaccine_name.trim(),
 enforcement_level: form.enforcement_level,
 max_age_months: parseInt(form.max_age_months) || 12,
 description: form.description || null,
 };

 if (editing) {
 const { error } = await supabase
 .from("groomer_vaccine_requirements")
 .update(payload)
 .eq("id", editing.id);
 if (error) throw error;
 } else {
 const { error } = await supabase
 .from("groomer_vaccine_requirements")
 .insert(payload);
 if (error) throw error;
 }
 },
 onSuccess: () => {
 toast.success(editing ?"Vaccine requirement updated!" :"Vaccine requirement added!");
 queryClient.invalidateQueries({ queryKey: ["groomer-vaccines", merchantId] });
 closeDialog();
 },
 onError: (e: any) => {
 if (e?.code ==="23505") {
 toast.error("This vaccine is already configured.");
 } else {
 toast.error("Failed to save vaccine requirement");
 }
 },
 });

 const deleteMutation = useMutation({
 mutationFn: async (id: string) => {
 const { error } = await supabase
 .from("groomer_vaccine_requirements")
 .update({ is_active: false })
 .eq("id", id);
 if (error) throw error;
 },
 onSuccess: () => {
 toast.success("Vaccine requirement removed");
 queryClient.invalidateQueries({ queryKey: ["groomer-vaccines", merchantId] });
 },
 });

 const openNew = () => {
 setEditing(null);
 setForm({ vaccine_name:"", enforcement_level:"warning", max_age_months:"12", description:"" });
 setDialogOpen(true);
 };

 const openEdit = (vr: VaccineRequirement) => {
 setEditing(vr);
 setForm({
 vaccine_name: vr.vaccine_name,
 enforcement_level: vr.enforcement_level,
 max_age_months: vr.max_age_months.toString(),
 description: vr.description ||"",
 });
 setDialogOpen(true);
 };

 const closeDialog = () => {
 setDialogOpen(false);
 setEditing(null);
 };

 const existingNames = requirements.map((r) => r.vaccine_name);
 const suggestedVaccines = COMMON_VACCINES.filter((v) => !existingNames.includes(v));

 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h3 className="text-lg font-semibold flex items-center gap-2">
 <Shield className="w-5 h-5 text-primary" />
 Vaccine Requirements
 </h3>
 <p className="text-sm text-muted-foreground">
 Configure which vaccines you require, warn about, or track
 </p>
 </div>
 <Button onClick={openNew} size="sm">
 <Plus className="w-4 h-4 mr-1" /> Add Vaccine
 </Button>
 </div>

 {isLoading ? (
 <div className="flex justify-center py-8">
 <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
 </div>
 ) : requirements.length === 0 ? (
 <GradientCard className="p-8 text-center">
 <Shield className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
 <h4 className="font-semibold mb-1">No Vaccine Rules Set</h4>
 <p className="text-sm text-muted-foreground mb-4">
 Add vaccine requirements to automatically check pet records during booking.
 </p>
 <Button onClick={openNew} size="sm">
 <Plus className="w-4 h-4 mr-1" /> Add First Vaccine
 </Button>
 </GradientCard>
 ) : (
 <div className="space-y-2">
 {requirements.map((vr) => {
 const level = ENFORCEMENT_LEVELS.find((l) => l.value === vr.enforcement_level);
 return (
 <GradientCard key={vr.id} className="p-4 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div>
 <div className="flex items-center gap-2">
 <span className="font-medium">{vr.vaccine_name}</span>
 <Badge variant="outline" className={`text-xs ${level?.color ||""}`}>
 {level?.label}
 </Badge>
 </div>
 <p className="text-xs text-muted-foreground mt-0.5">
 Must be within {vr.max_age_months} months • {level?.description}
 </p>
 </div>
 </div>
 <div className="flex gap-1">
 <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(vr)}>
 <Edit className="w-3.5 h-3.5" />
 </Button>
 <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(vr.id)}>
 <Trash2 className="w-3.5 h-3.5" />
 </Button>
 </div>
 </GradientCard>
 );
 })}
 </div>
 )}

 {/* Add/Edit Dialog */}
 <Dialog open={dialogOpen} onOpenChange={closeDialog}>
 <DialogContent className="sm:max-w-[400px]">
 <DialogHeader>
 <DialogTitle>{editing ?"Edit Vaccine Requirement" :"Add Vaccine Requirement"}</DialogTitle>
 </DialogHeader>
 <div className="space-y-4">
 <div>
 <Label>Vaccine Name *</Label>
 <Input
 value={form.vaccine_name}
 onChange={(e) => setForm({ ...form, vaccine_name: e.target.value })}
 placeholder="e.g., Rabies"
 />
 {!editing && suggestedVaccines.length > 0 && (
 <div className="flex flex-wrap gap-1 mt-2">
 {suggestedVaccines.map((v) => (
 <Button
 key={v}
 variant="outline"
 size="sm"
 className="h-6 text-xs"
 onClick={() => setForm({ ...form, vaccine_name: v })}
 >
 + {v}
 </Button>
 ))}
 </div>
 )}
 </div>
 <div>
 <Label>Enforcement Level</Label>
 <Select value={form.enforcement_level} onValueChange={(v) => setForm({ ...form, enforcement_level: v })}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 {ENFORCEMENT_LEVELS.map((l) => (
 <SelectItem key={l.value} value={l.value}>
 <div>
 <span className="font-medium">{l.label}</span>
 <span className="text-xs text-muted-foreground ml-2">{l.description}</span>
 </div>
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label>Max Vaccine Age (months)</Label>
 <Input
 type="number"
 value={form.max_age_months}
 onChange={(e) => setForm({ ...form, max_age_months: e.target.value })}
 placeholder="12"
 />
 <p className="text-xs text-muted-foreground mt-1">
 Vaccines older than this will be flagged
 </p>
 </div>
 <Button
 className="w-full"
 onClick={() => saveMutation.mutate()}
 disabled={!form.vaccine_name.trim() || saveMutation.isPending}
 >
 {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
 {editing ?"Update" :"Add"} Requirement
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 </div>
 );
}
