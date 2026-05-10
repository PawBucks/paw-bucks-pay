import { useState, useEffect } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogHeader,
 DialogTitle,
 DialogTrigger,
} from"@/components/ui/dialog";
import { Card } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { toast } from"sonner";
import { Copy, Trash2, Plus } from "lucide-react";
import { format } from"date-fns";

interface AccessCode {
 id: string;
 vet_name: string;
 vet_email: string | null;
 vet_clinic: string | null;
 access_code: string;
 is_active: boolean;
 expires_at: string | null;
 created_at: string;
 last_accessed_at: string | null;
}

interface ShareHealthRecordsDialogProps {
 petId: string;
 petName: string;
}

export function ShareHealthRecordsDialog({ petId, petName }: ShareHealthRecordsDialogProps) {
 const [isOpen, setIsOpen] = useState(false);
 const [accessCodes, setAccessCodes] = useState<AccessCode[]>([]);
 const [isLoading, setIsLoading] = useState(false);
 const [isCreating, setIsCreating] = useState(false);
 const [showCreateForm, setShowCreateForm] = useState(false);
 
 const [vetName, setVetName] = useState("");
 const [vetEmail, setVetEmail] = useState("");
 const [vetClinic, setVetClinic] = useState("");

 const generateAccessCode = () => {
 const chars ="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
 let code ="";
 for (let i = 0; i < 8; i++) {
 code += chars.charAt(Math.floor(Math.random() * chars.length));
 }
 return `PET-${code}`;
 };

 const loadAccessCodes = async () => {
 setIsLoading(true);
 try {
 const { data, error } = await supabase
 .from("pet_health_access_codes")
 .select("*")
 .eq("pet_id", petId)
 .order("created_at", { ascending: false });

 if (error) throw error;
 setAccessCodes(data || []);
 } catch (error) {
 console.error("Error loading access codes:", error);
 toast.error("Failed to load access codes");
 } finally {
 setIsLoading(false);
 }
 };

 useEffect(() => {
 if (isOpen) {
 loadAccessCodes();
 }
 }, [isOpen, petId]);

 const handleCreateCode = async () => {
 if (!vetName.trim()) {
 toast.error("Please enter the vet's name");
 return;
 }

 setIsCreating(true);
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) {
 toast.error("You must be logged in");
 return;
 }

 const accessCode = generateAccessCode();
 const expiresAt = new Date();
 expiresAt.setMonth(expiresAt.getMonth() + 6); // 6 months expiry

 const { error } = await supabase
 .from("pet_health_access_codes")
 .insert({
 pet_id: petId,
 owner_id: user.id,
 vet_name: vetName.trim(),
 vet_email: vetEmail.trim() || null,
 vet_clinic: vetClinic.trim() || null,
 access_code: accessCode,
 expires_at: expiresAt.toISOString(),
 });

 if (error) throw error;

 toast.success("Access code created successfully!");
 setVetName("");
 setVetEmail("");
 setVetClinic("");
 setShowCreateForm(false);
 loadAccessCodes();
 } catch (error) {
 console.error("Error creating access code:", error);
 toast.error("Failed to create access code");
 } finally {
 setIsCreating(false);
 }
 };

 const handleCopyCode = (code: string) => {
 navigator.clipboard.writeText(code);
 toast.success("Access code copied to clipboard!");
 };

 const handleRevokeCode = async (id: string) => {
 try {
 const { error } = await supabase
 .from("pet_health_access_codes")
 .update({ is_active: false })
 .eq("id", id);

 if (error) throw error;
 toast.success("Access code revoked");
 loadAccessCodes();
 } catch (error) {
 console.error("Error revoking access code:", error);
 toast.error("Failed to revoke access code");
 }
 };

 const handleDeleteCode = async (id: string) => {
 try {
 const { error } = await supabase
 .from("pet_health_access_codes")
 .delete()
 .eq("id", id);

 if (error) throw error;
 toast.success("Access code deleted");
 loadAccessCodes();
 } catch (error) {
 console.error("Error deleting access code:", error);
 toast.error("Failed to delete access code");
 }
 };

 return (
 <Dialog open={isOpen} onOpenChange={setIsOpen}>
 <DialogTrigger asChild>
 <Button variant="outline" className="gap-2">
 <span className="w-4 h-4" aria-hidden="true">🔗</span>
 Share Records
 </Button>
 </DialogTrigger>
 <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <span className="w-5 h-5 text-primary" aria-hidden="true">🔑</span>
 Share Health Records
 </DialogTitle>
 <DialogDescription>
 Generate personalized access codes to share {petName}'s health records with veterinarians.
 </DialogDescription>
 </DialogHeader>

 <div className="space-y-4 mt-4">
 {!showCreateForm ? (
 <Button onClick={() => setShowCreateForm(true)} className="w-full gap-2">
 <Plus className="w-4 h-4" />
 Create New Access Code
 </Button>
 ) : (
 <Card className="p-4 space-y-4 border-primary/20">
 <h4 className="font-medium">New Access Code for Vet</h4>
 <div className="space-y-3">
 <div>
 <Label htmlFor="vetName">Vet Name *</Label>
 <Input
 id="vetName"
 placeholder="Dr. Smith"
 value={vetName}
 onChange={(e) => setVetName(e.target.value)}
 />
 </div>
 <div>
 <Label htmlFor="vetClinic">Clinic Name</Label>
 <Input
 id="vetClinic"
 placeholder="Happy Paws Clinic"
 value={vetClinic}
 onChange={(e) => setVetClinic(e.target.value)}
 />
 </div>
 <div>
 <Label htmlFor="vetEmail">Vet Email (optional)</Label>
 <Input
 id="vetEmail"
 type="email"
 placeholder="vet@clinic.com"
 value={vetEmail}
 onChange={(e) => setVetEmail(e.target.value)}
 />
 </div>
 </div>
 <div className="flex gap-2">
 <Button
 variant="outline"
 onClick={() => setShowCreateForm(false)}
 className="flex-1"
 >
 Cancel
 </Button>
 <Button
 onClick={handleCreateCode}
 disabled={isCreating}
 className="flex-1"
 >
 {isCreating ?"Creating..." :"Generate Code"}
 </Button>
 </div>
 </Card>
 )}

 <div className="space-y-3">
 <h4 className="font-medium text-sm text-muted-foreground">
 Active Access Codes ({accessCodes.filter(c => c.is_active).length})
 </h4>
 
 {isLoading ? (
 <p className="text-center text-muted-foreground py-4">Loading...</p>
 ) : accessCodes.length === 0 ? (
 <p className="text-center text-muted-foreground py-4">
 No access codes created yet
 </p>
 ) : (
 accessCodes.map((code) => (
 <Card
 key={code.id}
 className={`p-4 space-y-3 ${!code.is_active ?"opacity-60" :""}`}
 >
 <div className="flex items-start justify-between gap-2">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1">
 <span className="w-4 h-4 text-muted-foreground" aria-hidden="true">👤</span>
 <span className="font-medium truncate">{code.vet_name}</span>
 {!code.is_active && (
 <Badge variant="secondary">Revoked</Badge>
 )}
 </div>
 {code.vet_clinic && (
 <div className="flex items-center gap-2 text-sm text-muted-foreground">
 <span className="w-3 h-3" aria-hidden="true">🏢</span>
 <span className="truncate">{code.vet_clinic}</span>
 </div>
 )}
 </div>
 </div>

 <div className="flex items-center gap-2 bg-muted rounded-md p-2">
 <code className="flex-1 text-sm font-mono">{code.access_code}</code>
 <Button
 variant="ghost"
 size="icon"
 onClick={() => handleCopyCode(code.access_code)}
 disabled={!code.is_active}
 >
 <Copy className="w-4 h-4" />
 </Button>
 </div>

 <div className="flex items-center justify-between text-xs text-muted-foreground">
 <div className="flex items-center gap-1">
 <span className="w-3 h-3" aria-hidden="true">⏰</span>
 Created {format(new Date(code.created_at),"MMM d, yyyy")}
 </div>
 {code.expires_at && (
 <span>
 Expires {format(new Date(code.expires_at),"MMM d, yyyy")}
 </span>
 )}
 </div>

 {code.is_active && (
 <div className="flex gap-2 pt-2 border-t">
 <Button
 variant="outline"
 size="sm"
 onClick={() => handleRevokeCode(code.id)}
 className="flex-1"
 >
 Revoke Access
 </Button>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => handleDeleteCode(code.id)}
 className="text-destructive hover:text-destructive"
 >
 <Trash2 className="w-4 h-4" />
 </Button>
 </div>
 )}
 </Card>
 ))
 )}
 </div>
 </div>
 </DialogContent>
 </Dialog>
 );
}
