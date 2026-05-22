import { useState, useEffect } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Textarea } from"@/components/ui/textarea";
import { Switch } from"@/components/ui/switch";
import { Badge } from"@/components/ui/badge";
import { Separator } from"@/components/ui/separator";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogTrigger,
} from"@/components/ui/dialog";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from"@/components/ui/table";
import { Bone, Coffee, Dog, Gem, Gift, Loader2, Pencil, Plus, Scissors, Stamp, Star, Stethoscope, Trophy, Users } from "lucide-react";
import { PawBucksIcon } from "@/components/PawBucksIcon";
import { toast } from"sonner";
import { format } from"date-fns";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type LoyaltyProgram = {
 id: string;
 name: string;
 description: string | null;
 emoji: string;
 punches_required: number;
 reward_description: string;
 reward_type: string;
 qualifying_description: string | null;
 is_active: boolean;
 created_at: string;
};

type ProgramStats = {
 program_id: string;
 active_cards: number;
 total_punches: number;
 rewards_earned: number;
};

type CustomerPunchRow = {
  user_id: string;
  current_punches: number;
  total_punches_earned: number;
  cards_completed: number;
  updated_at: string;
  full_name: string | null;
  email: string | null;
};

interface MerchantLoyaltyProgramTabProps {
 merchantId: string;
}

export function MerchantLoyaltyProgramTab({ merchantId }: MerchantLoyaltyProgramTabProps) {
 const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
 const [stats, setStats] = useState<Record<string, ProgramStats>>({});
 const [loading, setLoading] = useState(true);
 const [dialogOpen, setDialogOpen] = useState(false);
 const [editingProgram, setEditingProgram] = useState<LoyaltyProgram | null>(null);
 const [saving, setSaving] = useState(false);
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null);
  const [customersByProgram, setCustomersByProgram] = useState<Record<string, CustomerPunchRow[]>>({});
  const [loadingCustomers, setLoadingCustomers] = useState<string | null>(null);

 // Form state
 const [formName, setFormName] = useState("");
 const [formDescription, setFormDescription] = useState("");
 const [formEmoji, setFormEmoji] = useState("⭐");
 const [formPunches, setFormPunches] = useState(10);
 const [formReward, setFormReward] = useState("");
 const [formQualifying, setFormQualifying] = useState("");

 const loadPrograms = async () => {
 try {
 const { data, error } = await supabase
 .from("merchant_loyalty_programs")
 .select("*")
 .eq("merchant_id", merchantId)
 .order("created_at", { ascending: false });

 if (error) throw error;
 setPrograms(data || []);

 // Load stats for each program
 if (data && data.length > 0) {
 const programIds = data.map((p) => p.id);
 
 const { data: cards } = await supabase
 .from("customer_punch_cards")
 .select("program_id, current_punches, cards_completed")
 .in("program_id", programIds);

 const statsMap: Record<string, ProgramStats> = {};
 programIds.forEach((id) => {
 const programCards = (cards || []).filter((c) => c.program_id === id);
 statsMap[id] = {
 program_id: id,
 active_cards: programCards.length,
 total_punches: programCards.reduce((sum, c) => sum + c.current_punches, 0),
 rewards_earned: programCards.reduce((sum, c) => sum + c.cards_completed, 0),
 };
 });
 setStats(statsMap);
 }
 } catch (error) {
 console.error("Error loading programs:", error);
 toast.error("Failed to load loyalty programs");
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 loadPrograms();
 }, [merchantId]);

  const loadCustomersForProgram = async (program: LoyaltyProgram) => {
    setLoadingCustomers(program.id);
    try {
      const { data: cards, error: cardsErr } = await supabase
        .from("customer_punch_cards")
        .select("user_id, current_punches, total_punches_earned, cards_completed, updated_at")
        .eq("program_id", program.id)
        .order("current_punches", { ascending: false });
      if (cardsErr) throw cardsErr;

      const { data: contacts, error: contactsErr } = await supabase.rpc(
        "get_merchant_customer_contacts",
        { p_merchant_id: merchantId }
      );
      if (contactsErr) throw contactsErr;

      const contactMap = new Map<string, { full_name: string | null; email: string | null }>();
      (contacts || []).forEach((c: any) => {
        contactMap.set(c.id, { full_name: c.full_name ?? null, email: c.email ?? null });
      });

      const rows: CustomerPunchRow[] = (cards || []).map((c) => ({
        user_id: c.user_id,
        current_punches: c.current_punches,
        total_punches_earned: c.total_punches_earned,
        cards_completed: c.cards_completed,
        updated_at: c.updated_at,
        full_name: contactMap.get(c.user_id)?.full_name ?? null,
        email: contactMap.get(c.user_id)?.email ?? null,
      }));

      setCustomersByProgram((prev) => ({ ...prev, [program.id]: rows }));
    } catch (err) {
      console.error("Error loading customers:", err);
      toast.error("Failed to load customers for this program");
    } finally {
      setLoadingCustomers(null);
    }
  };

  const toggleExpanded = (program: LoyaltyProgram) => {
    if (expandedProgram === program.id) {
      setExpandedProgram(null);
      return;
    }
    setExpandedProgram(program.id);
    if (!customersByProgram[program.id]) {
      loadCustomersForProgram(program);
    }
  };

 const resetForm = () => {
 setFormName("");
 setFormDescription("");
 setFormEmoji("⭐");
 setFormPunches(10);
 setFormReward("");
 setFormQualifying("");
 setEditingProgram(null);
 };

 const openCreateDialog = () => {
 resetForm();
 setDialogOpen(true);
 };

 const openEditDialog = (program: LoyaltyProgram) => {
 setEditingProgram(program);
 setFormName(program.name);
 setFormDescription(program.description ||"");
 setFormEmoji(program.emoji);
 setFormPunches(program.punches_required);
 setFormReward(program.reward_description);
 setFormQualifying(program.qualifying_description ||"");
 setDialogOpen(true);
 };

 const handleSave = async () => {
 if (!formName.trim() || !formReward.trim()) {
 toast.error("Please fill in the program name and reward description");
 return;
 }
 if (formPunches < 2 || formPunches > 100) {
 toast.error("Punches required must be between 2 and 100");
 return;
 }

 setSaving(true);
 try {
 const payload = {
 merchant_id: merchantId,
 name: formName.trim(),
 description: formDescription.trim() || null,
 emoji: formEmoji,
 punches_required: formPunches,
 reward_description: formReward.trim(),
 reward_type:"free_service",
 qualifying_description: formQualifying.trim() || null,
 };

 if (editingProgram) {
 const { error } = await supabase
 .from("merchant_loyalty_programs")
 .update(payload)
 .eq("id", editingProgram.id);
 if (error) throw error;
 toast.success("Program updated!");
 } else {
 const { error } = await supabase
 .from("merchant_loyalty_programs")
 .insert(payload);
 if (error) throw error;
 toast.success("Loyalty program created!");
 }

 setDialogOpen(false);
 resetForm();
 loadPrograms();
 } catch (error) {
 console.error("Error saving program:", error);
 toast.error("Failed to save program");
 } finally {
 setSaving(false);
 }
 };

 const handleToggleActive = async (program: LoyaltyProgram) => {
 try {
 const { error } = await supabase
 .from("merchant_loyalty_programs")
 .update({ is_active: !program.is_active })
 .eq("id", program.id);
 if (error) throw error;
 toast.success(program.is_active ?"Program paused" :"Program activated");
 loadPrograms();
 } catch (error) {
 console.error("Error toggling program:", error);
 toast.error("Failed to update program");
 }
 };

 const iconOptions = [
   { key: "star", Icon: Star }, { key: "paw", Icon: PawBucksIcon }, { key: "gift", Icon: Gift },
   { key: "coffee", Icon: Coffee }, { key: "scissors", Icon: Scissors }, { key: "stethoscope", Icon: Stethoscope },
   { key: "bone", Icon: Bone }, { key: "dog", Icon: Dog }, { key: "trophy", Icon: Trophy }, { key: "gem", Icon: Gem },
 ];

 if (loading) {
 return (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="w-6 h-6 animate-spin text-primary" />
 </div>
 );
 }

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-2xl font-bold flex items-center gap-2">
 <Stamp className="w-6 h-6 text-primary" />
 Loyalty Programs
 </h2>
 <p className="text-muted-foreground text-sm mt-1">
 Create punch card programs to reward your repeat customers
 </p>
 </div>
 <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
 <DialogTrigger asChild>
 <Button onClick={openCreateDialog}>
 <Plus className="w-4 h-4 mr-2" />
 New Program
 </Button>
 </DialogTrigger>
 <DialogContent className="sm:max-w-lg">
 <DialogHeader>
 <DialogTitle>
 {editingProgram ?"Edit Loyalty Program" :"Create Loyalty Program"}
 </DialogTitle>
 </DialogHeader>
 <div className="space-y-4 mt-2">
 <div className="space-y-2">
 <Label>Program Name</Label>
 <Input
 placeholder="e.g., Hike Rewards"
 value={formName}
 onChange={(e) => setFormName(e.target.value)}
 maxLength={100}
 />
 </div>

 <div className="space-y-2">
 <Label>Icon</Label>
 <div className="flex flex-wrap gap-2">
 {iconOptions.map(({ key, Icon }) => (
 <button
 key={key}
 type="button"
 onClick={() => setFormEmoji(key)}
 className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center border-2 transition-colors ${
 formEmoji === key
 ?"border-primary bg-primary/10"
 :"border-border hover:border-primary"
 }`}
 >
 <Icon className="h-5 w-5" aria-hidden />
 </button>
 ))}
 </div>
 </div>

 <div className="space-y-2">
 <Label>Description (optional)</Label>
 <Textarea
 placeholder="Describe how the program works for your customers"
 value={formDescription}
 onChange={(e) => setFormDescription(e.target.value)}
 maxLength={500}
 rows={2}
 />
 </div>

 <div className="space-y-2">
 <Label>Punches Required for Reward</Label>
 <Input
 type="number"
 min={2}
 max={100}
 value={formPunches}
 onChange={(e) => setFormPunches(parseInt(e.target.value) || 2)}
 />
 <p className="text-xs text-muted-foreground">
 Customer completes {formPunches} qualifying purchases to earn the reward
 </p>
 </div>

 <div className="space-y-2">
 <Label>Reward Description</Label>
 <Input
 placeholder="e.g., 1 Free Hike"
 value={formReward}
 onChange={(e) => setFormReward(e.target.value)}
 maxLength={200}
 />
 </div>

 <div className="space-y-2">
 <Label>What Counts as a Punch? (optional)</Label>
 <Input
 placeholder="e.g., Any hike purchase of $30 or more"
 value={formQualifying}
 onChange={(e) => setFormQualifying(e.target.value)}
 maxLength={200}
 />
 <p className="text-xs text-muted-foreground">
 Every completed transaction through PawBucks Pay automatically counts as a punch
 </p>
 </div>

 <Button onClick={handleSave} disabled={saving} className="w-full">
 {saving ? (
 <Loader2 className="w-4 h-4 animate-spin mr-2" />
 ) : null}
 {editingProgram ?"Update Program" :"Create Program"}
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 </div>

 {/* Programs List */}
 {programs.length === 0 ? (
 <Card className="border-dashed">
 <CardContent className="py-12 text-center">
 <Gift className="w-12 h-12 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
 <h3 className="text-lg font-semibold mb-2">No Loyalty Programs Yet</h3>
 <p className="text-muted-foreground text-sm mb-4">
 Create your first punch card program to start rewarding loyal customers
 </p>
 <Button onClick={openCreateDialog}>
 <Plus className="w-4 h-4 mr-2" />
 Create Your First Program
 </Button>
 </CardContent>
 </Card>
 ) : (
 <div className="grid gap-4 md:grid-cols-2">
 {programs.map((program) => {
 const programStats = stats[program.id] || {
 active_cards: 0,
 total_punches: 0,
 rewards_earned: 0,
 };

 return (
 <Card key={program.id} className={!program.is_active ?"opacity-60" :""}>
 <CardHeader className="pb-3">
 <div className="flex items-start justify-between">
 <div className="flex items-center gap-3">
 <span className="text-3xl">{program.emoji}</span>
 <div>
 <CardTitle className="text-lg">{program.name}</CardTitle>
 {program.description && (
 <p className="text-sm text-muted-foreground mt-1">
 {program.description}
 </p>
 )}
 </div>
 </div>
 <div className="flex items-center gap-2">
 <Badge variant={program.is_active ?"default" :"secondary"}>
 {program.is_active ?"Active" :"Paused"}
 </Badge>
 </div>
 </div>
 </CardHeader>
 <CardContent className="space-y-4">
 {/* Punch card visualization */}
 <div className="bg-muted rounded-lg p-4">
 <div className="flex items-center justify-between mb-2">
 <span className="text-sm font-medium">
 {program.punches_required} punches → {program.reward_description}
 </span>
 </div>
 <div className="flex flex-wrap gap-1.5">
 {Array.from({ length: program.punches_required }).map((_, i) => (
 <div
 key={i}
 className="w-6 h-6 rounded-full border-2 border-primary/30 flex items-center justify-center"
 >
 <Stamp className="w-3 h-3 text-primary/30" />
 </div>
 ))}
 <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
 <Gift className="w-3 h-3 text-primary-foreground" aria-hidden="true" />
 </div>
 </div>
 {program.qualifying_description && (
 <p className="text-xs text-muted-foreground mt-2">
 Qualifying: {program.qualifying_description}
 </p>
 )}
 </div>

 {/* Stats */}
 <div className="grid grid-cols-3 gap-3 text-center">
 <div>
 <div className="flex items-center justify-center gap-1 text-muted-foreground">
 <Users className="w-3.5 h-3.5" aria-hidden="true" />
 </div>
 <p className="text-lg font-bold">{programStats.active_cards}</p>
 <p className="text-xs text-muted-foreground">Customers</p>
 </div>
 <div>
 <div className="flex items-center justify-center gap-1 text-muted-foreground">
 <Stamp className="w-3.5 h-3.5" />
 </div>
 <p className="text-lg font-bold">{programStats.total_punches}</p>
 <p className="text-xs text-muted-foreground">Punches</p>
 </div>
 <div>
 <div className="flex items-center justify-center gap-1 text-muted-foreground">
 <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
 </div>
 <p className="text-lg font-bold">{programStats.rewards_earned}</p>
 <p className="text-xs text-muted-foreground">Rewards</p>
 </div>
 </div>

 <Separator />

 {/* Actions */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Switch
 checked={program.is_active}
 onCheckedChange={() => handleToggleActive(program)}
 />
 <span className="text-sm text-muted-foreground">
 {program.is_active ?"Active" :"Paused"}
 </span>
 </div>
 <Button
 variant="outline"
 size="sm"
 onClick={() => openEditDialog(program)}
 >
 <Pencil className="w-3.5 h-3.5 mr-1" />
 Edit
 </Button>
 </div>

              {/* Customers per program */}
              <Collapsible
                open={expandedProgram === program.id}
                onOpenChange={() => toggleExpanded(program)}
              >
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between mt-1">
                    <span className="inline-flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4" />
                      View customers ({programStats.active_cards})
                    </span>
                    {expandedProgram === program.id ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 border rounded-lg overflow-hidden">
                    {loadingCustomers === program.id ? (
                      <div className="py-6 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      </div>
                    ) : (customersByProgram[program.id]?.length ?? 0) === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        No customers have started this punch card yet.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Customer</TableHead>
                            <TableHead className="text-right">Punches</TableHead>
                            <TableHead className="text-right">Rewards</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customersByProgram[program.id].map((row) => {
                            const remaining = Math.max(
                              program.punches_required - row.current_punches,
                              0
                            );
                            const ready = row.current_punches >= program.punches_required;
                            return (
                              <TableRow key={row.user_id}>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="font-medium text-sm">
                                      {row.full_name || "Customer"}
                                    </span>
                                    {row.email && (
                                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                        {row.email}
                                      </span>
                                    )}
                                    <span className="text-[11px] text-muted-foreground">
                                      Last activity {format(new Date(row.updated_at), "MMM d, yyyy")}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="inline-flex flex-col items-end">
                                    <span className="font-semibold text-sm">
                                      {row.current_punches} / {program.punches_required}
                                    </span>
                                    {ready ? (
                                      <Badge className="mt-1 text-[10px]">Reward ready</Badge>
                                    ) : (
                                      <span className="text-[11px] text-muted-foreground">
                                        {remaining} to go
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right text-sm">
                                  {row.cards_completed}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
 </CardContent>
 </Card>
 );
 })}
 </div>
 )}
 </div>
 );
}
