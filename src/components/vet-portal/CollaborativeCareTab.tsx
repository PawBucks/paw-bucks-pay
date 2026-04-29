import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Share2,
  Plus,
  Trash2,
  Users,
  AlertCircle,
  Heart,
  Brain,
  Pill,
  FileText,
  Shield,
} from "lucide-react";
import { format } from "date-fns";
import { getCategoryIcon, getCategoryLabel } from "@/lib/categoryMapping";

interface CollaborativeCareTabProps {
  vetId: string;
}

type ShareType = 'medical_notes' | 'behavioral' | 'physical_limitations' | 'allergies' | 'medications' | 'full_record';

const shareTypeConfig: Record<ShareType, { label: string; icon: typeof Heart; color: string }> = {
  medical_notes: { label: "Medical Notes", icon: FileText, color: "bg-info/10 text-info" },
  behavioral: { label: "Behavioral Triggers", icon: Brain, color: "bg-primary/10 text-primary" },
  physical_limitations: { label: "Physical Limitations", icon: AlertCircle, color: "bg-warning/10 text-warning" },
  allergies: { label: "Allergies", icon: Shield, color: "bg-destructive/10 text-destructive" },
  medications: { label: "Current Medications", icon: Pill, color: "bg-success/10 text-success" },
  full_record: { label: "Full Record Access", icon: FileText, color: "bg-muted text-muted-foreground" },
};

export function CollaborativeCareTab({ vetId }: CollaborativeCareTabProps) {
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedPet, setSelectedPet] = useState<string>("");
  const [selectedMerchant, setSelectedMerchant] = useState<string>("");
  const [selectedShareType, setSelectedShareType] = useState<ShareType>("medical_notes");
  const [notes, setNotes] = useState("");

  // Fetch existing care shares
  const { data: careShares, isLoading: sharesLoading } = useQuery({
    queryKey: ["vet-care-shares", vetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vet_care_shares")
        .select(`
          *,
          pet:pet_profiles(id, name, type, breed),
          merchant:merchants(id, business_name, business_type)
        `)
        .eq("vet_id", vetId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch patients for dropdown
  const { data: patients } = useQuery({
    queryKey: ["vet-patients-for-share", vetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vet_messages")
        .select("pet_id, pet:pet_profiles(id, name, type, breed, user_id)")
        .eq("vet_id", vetId);

      if (error) throw error;
      
      // Get unique pets
      const uniquePets = new Map();
      data?.forEach(item => {
        if (item.pet && !uniquePets.has(item.pet.id)) {
          uniquePets.set(item.pet.id, item.pet);
        }
      });
      return Array.from(uniquePets.values());
    },
  });

  // Fetch merchants for dropdown (care providers)
  const { data: merchants } = useQuery({
    queryKey: ["care-merchants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchants")
        .select("id, business_name, business_type");

      if (error) throw error;
      
      // Filter for care-related business types
      const careTypes = [
        "masseuse", "trainer", "training", "sitter", "pet_sitting",
        "walker", "walking", "hiker", "hiking", "runner", "running",
        "groomer", "grooming", "daycare", "behaviorist"
      ];
      return (data as Array<{id: string; business_name: string; business_type: string | null}>)?.filter(m => 
        careTypes.some(t => m.business_type?.toLowerCase().includes(t))
      ) || [];
    },
  });

  // Create share mutation
  const createShare = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vet_care_shares").insert({
        pet_id: selectedPet,
        vet_id: vetId,
        merchant_id: selectedMerchant,
        share_type: selectedShareType,
        notes: notes || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Care share created successfully");
      queryClient.invalidateQueries({ queryKey: ["vet-care-shares"] });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete share mutation
  const deleteShare = useMutation({
    mutationFn: async (shareId: string) => {
      const { error } = await supabase
        .from("vet_care_shares")
        .delete()
        .eq("id", shareId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Care share removed");
      queryClient.invalidateQueries({ queryKey: ["vet-care-shares"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setSelectedPet("");
    setSelectedMerchant("");
    setSelectedShareType("medical_notes");
    setNotes("");
  };

  if (sharesLoading) {
    return <div className="text-center py-8">Loading collaborative care data...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Collaborative Care Network
          </h2>
          <p className="text-sm text-muted-foreground">
            Securely share medical information with other pet care providers
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Share with Provider
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Share Pet Information</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Select Pet</Label>
                <Select value={selectedPet} onValueChange={setSelectedPet}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a pet" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients?.map((pet: any) => (
                      <SelectItem key={pet.id} value={pet.id}>
                        {pet.name} ({pet.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Select Provider</Label>
                <Select value={selectedMerchant} onValueChange={setSelectedMerchant}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a care provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants?.map((merchant) => {
                      const Icon = getCategoryIcon(merchant.business_type);
                      return (
                        <SelectItem key={merchant.id} value={merchant.id}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {merchant.business_name} ({getCategoryLabel(merchant.business_type)})
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Information to Share</Label>
                <Select 
                  value={selectedShareType} 
                  onValueChange={(v) => setSelectedShareType(v as ShareType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(shareTypeConfig).map(([key, config]) => {
                      const Icon = config.icon;
                      return (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {config.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Additional Notes (Optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any specific instructions for the provider..."
                  rows={3}
                />
              </div>

              <Button
                onClick={() => createShare.mutate()}
                disabled={!selectedPet || !selectedMerchant || createShare.isPending}
                className="w-full"
              >
                {createShare.isPending ? "Creating..." : "Create Care Share"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Shares */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pet</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Shared Information</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {careShares && careShares.length > 0 ? (
              careShares.map((share: any) => {
                const config = shareTypeConfig[share.share_type as ShareType];
                const Icon = config?.icon || FileText;
                const MerchantIcon = getCategoryIcon(share.merchant?.business_type);
                
                return (
                  <TableRow key={share.id}>
                    <TableCell>
                      <div className="font-medium">{share.pet?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {share.pet?.type} • {share.pet?.breed}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MerchantIcon className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{share.merchant?.business_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {getCategoryLabel(share.merchant?.business_type)}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={config?.color}>
                        <Icon className="h-3 w-3 mr-1" />
                        {config?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {share.notes || "-"}
                    </TableCell>
                    <TableCell>
                      {format(new Date(share.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteShare.mutate(share.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No active care shares. Share pet information with trainers, groomers, and other providers.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Info Card */}
      <Card className="p-4 bg-info/10 /30 border-info/20">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-info mt-0.5" />
          <div>
            <h4 className="font-medium text-info">
              Secure Information Sharing
            </h4>
            <p className="text-sm text-info">
              Shared information is encrypted and only accessible to the selected provider. 
              You can revoke access at any time. Providers will see relevant care instructions 
              to ensure the best care for your patients.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
