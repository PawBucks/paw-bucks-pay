import { useState } from"react";
import { useQuery, useMutation, useQueryClient } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { Card } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Switch } from"@/components/ui/switch";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogTrigger,
} from"@/components/ui/dialog";
import { FileText, FlaskConical, Image, Plus, Trash2 } from "lucide-react";
import { format } from"date-fns";
import { toast } from"sonner";

interface LabIntegrationManagerProps {
 vetId: string;
}

const LAB_VENDORS = [
 { value:"idexx", label:"IDEXX Reference Laboratories", logo:"", supportsDicom: true },
 { value:"antech", label:"Antech Diagnostics", logo:"", supportsDicom: true },
 { value:"zoetis", label:"Zoetis Reference Labs", logo:"", supportsDicom: false },
 { value:"heska", label:"Heska", logo:"", supportsDicom: false },
 { value:"abaxis", label:"Abaxis/Zoetis VETSCAN", logo:"", supportsDicom: false },
 { value:"other", label:"Other Lab", logo:"", supportsDicom: false },
];

export function LabIntegrationManager({ vetId }: LabIntegrationManagerProps) {
 const queryClient = useQueryClient();
 const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
 const [formData, setFormData] = useState({
 lab_vendor:"",
 lab_name:"",
 account_id:"",
 api_endpoint:"",
 supports_dicom: false,
 auto_import: true,
 });

 const { data: integrations, isLoading } = useQuery({
 queryKey: ["lab-integrations", vetId],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("vet_lab_integrations")
 .select("id, vet_id, lab_vendor, lab_name, account_id, api_endpoint, is_active, supports_dicom, auto_import, last_import_at, settings, created_at, updated_at")
 .eq("vet_id", vetId)
 .order("created_at", { ascending: false });

 if (error) throw error;
 return data;
 },
 });

 const addIntegrationMutation = useMutation({
 mutationFn: async (data: typeof formData) => {
 const vendor = LAB_VENDORS.find((v) => v.value === data.lab_vendor);
 const { error } = await supabase.from("vet_lab_integrations").insert({
 vet_id: vetId,
 lab_vendor: data.lab_vendor,
 lab_name: data.lab_name || vendor?.label ||"Unknown Lab",
 account_id: data.account_id || null,
 api_endpoint: data.api_endpoint || null,
 supports_dicom: data.supports_dicom,
 auto_import: data.auto_import,
 is_active: false,
 });
 if (error) throw error;
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["lab-integrations", vetId] });
 setIsAddDialogOpen(false);
 setFormData({
 lab_vendor:"",
 lab_name:"",
 account_id:"",
 api_endpoint:"",
 supports_dicom: false,
 auto_import: true,
 });
 toast.success("Lab integration added successfully");
 },
 onError: () => {
 toast.error("Failed to add lab integration");
 },
 });

 const toggleActiveMutation = useMutation({
 mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
 const { error } = await supabase
 .from("vet_lab_integrations")
 .update({ is_active: isActive })
 .eq("id", id);
 if (error) throw error;
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["lab-integrations", vetId] });
 toast.success("Lab integration status updated");
 },
 });

 const deleteIntegrationMutation = useMutation({
 mutationFn: async (id: string) => {
 const { error } = await supabase
 .from("vet_lab_integrations")
 .delete()
 .eq("id", id);
 if (error) throw error;
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["lab-integrations", vetId] });
 toast.success("Lab integration removed");
 },
 });

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h3 className="text-lg font-semibold flex items-center gap-2">
 <FlaskConical className="h-5 w-5 text-primary" />
 External Lab Integrations
 </h3>
 <p className="text-sm text-muted-foreground">
 Connect to reference labs for automatic result import
 </p>
 </div>
 <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
 <DialogTrigger asChild>
 <Button>
 <Plus className="h-4 w-4 mr-2" />
 Add Lab
 </Button>
 </DialogTrigger>
 <DialogContent className="max-w-md">
 <DialogHeader>
 <DialogTitle>Add Lab Integration</DialogTitle>
 </DialogHeader>
 <div className="space-y-4">
 <div>
 <Label>Lab Vendor</Label>
 <Select
 value={formData.lab_vendor}
 onValueChange={(v) => {
 const vendor = LAB_VENDORS.find((l) => l.value === v);
 setFormData({
 ...formData,
 lab_vendor: v,
 supports_dicom: vendor?.supportsDicom || false,
 });
 }}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select lab vendor" />
 </SelectTrigger>
 <SelectContent>
 {LAB_VENDORS.map((lab) => (
 <SelectItem key={lab.value} value={lab.value}>
 {lab.logo} {lab.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 {formData.lab_vendor ==="other" && (
 <div>
 <Label>Lab Name</Label>
 <Input
 value={formData.lab_name}
 onChange={(e) => setFormData({ ...formData, lab_name: e.target.value })}
 placeholder="Enter lab name"
 />
 </div>
 )}

 <div>
 <Label>Account ID</Label>
 <Input
 value={formData.account_id}
 onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
 placeholder="Your lab account number"
 />
 </div>

 <div>
 <Label>API Endpoint (if applicable)</Label>
 <Input
 value={formData.api_endpoint}
 onChange={(e) => setFormData({ ...formData, api_endpoint: e.target.value })}
 placeholder="https://api.lab.com/v1"
 />
 </div>

 <div className="flex items-center justify-between">
 <div>
 <Label>DICOM Support</Label>
 <p className="text-xs text-muted-foreground">
 Enable imaging result import
 </p>
 </div>
 <Switch
 checked={formData.supports_dicom}
 onCheckedChange={(v) => setFormData({ ...formData, supports_dicom: v })}
 />
 </div>

 <div className="flex items-center justify-between">
 <div>
 <Label>Auto-Import Results</Label>
 <p className="text-xs text-muted-foreground">
 Automatically import new results
 </p>
 </div>
 <Switch
 checked={formData.auto_import}
 onCheckedChange={(v) => setFormData({ ...formData, auto_import: v })}
 />
 </div>

 <Button
 className="w-full"
 onClick={() => addIntegrationMutation.mutate(formData)}
 disabled={!formData.lab_vendor || addIntegrationMutation.isPending}
 >
 {addIntegrationMutation.isPending ?"Adding..." :"Add Lab Integration"}
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 </div>

 {/* Lab Integrations Grid */}
 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
 {isLoading ? (
 <Card className="p-6 col-span-full text-center text-muted-foreground">
 Loading lab integrations...
 </Card>
 ) : integrations && integrations.length > 0 ? (
 integrations.map((integration) => {
 const vendor = LAB_VENDORS.find((v) => v.value === integration.lab_vendor);
 return (
 <Card key={integration.id} className="p-4">
 <div className="flex items-start justify-between mb-3">
 <div className="flex items-center gap-3">
 <div className="text-2xl">{vendor?.logo ||""}</div>
 <div>
 <h4 className="font-medium">{integration.lab_name}</h4>
 <p className="text-xs text-muted-foreground">
 Account: {integration.account_id ||"Not set"}
 </p>
 </div>
 </div>
 <Badge variant={integration.is_active ?"default" :"secondary"}>
 {integration.is_active ?"Active" :"Inactive"}
 </Badge>
 </div>

 <div className="flex items-center gap-2 mb-3">
 {integration.supports_dicom && (
 <Badge variant="outline" className="text-xs">
 <Image className="h-3 w-3 mr-1" aria-hidden="true" />
 DICOM
 </Badge>
 )}
 {integration.auto_import && (
 <Badge variant="outline" className="text-xs">
 <FileText className="h-3 w-3 mr-1" aria-hidden="true" />
 Auto-Import
 </Badge>
 )}
 </div>

 <div className="text-xs text-muted-foreground mb-3">
 {integration.last_import_at ? (
 <span>Last import: {format(new Date(integration.last_import_at),"MMM d, HH:mm")}</span>
 ) : (
 <span>Never imported</span>
 )}
 </div>

 <div className="flex gap-2">
 <Button
 variant={integration.is_active ?"secondary" :"default"}
 size="sm"
 className="flex-1"
 onClick={() =>
 toggleActiveMutation.mutate({
 id: integration.id,
 isActive: !integration.is_active,
 })
 }
 >
 {integration.is_active ?"Deactivate" :"Activate"}
 </Button>
 <Button
 variant="destructive"
 size="sm"
 onClick={() => deleteIntegrationMutation.mutate(integration.id)}
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 </div>
 </Card>
 );
 })
 ) : (
 <Card className="p-8 col-span-full text-center">
 <FlaskConical className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
 <h4 className="font-medium mb-2">No Lab Integrations</h4>
 <p className="text-sm text-muted-foreground mb-4">
 Connect to external laboratories to automatically import test results
 </p>
 <Button onClick={() => setIsAddDialogOpen(true)}>
 <Plus className="h-4 w-4 mr-2" />
 Add Your First Lab
 </Button>
 </Card>
 )}
 </div>
 </div>
 );
}
