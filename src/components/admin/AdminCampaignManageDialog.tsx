import { useState } from"react";
import { useMutation, useQueryClient } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from"@/components/ui/dialog";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Separator } from"@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { Loader2, Settings, Gift, Search } from"lucide-react";
import { toast } from"sonner";
import {
 adminUpdateBrandCampaign,
 adminGrantBrandedPawbucks,
 type BrandCampaign,
} from"@/services/api/brandCampaigns.service";

interface Props {
 open: boolean;
 onOpenChange: (v: boolean) => void;
 campaign: BrandCampaign;
}

export const AdminCampaignManageDialog = ({ open, onOpenChange, campaign }: Props) => {
 const queryClient = useQueryClient();

 // Parameter editor state
 const [params, setParams] = useState({
 pawbucks_per_checkin: campaign.pawbucks_per_checkin,
 daily_spend_cap: campaign.daily_spend_cap ?? 0,
 trigger_type: (campaign.trigger_type ??"checkin") as"checkin" |"checkout" |"both",
 min_purchase_usd: campaign.min_purchase_usd ?? 0,
 end_date: campaign.end_date ? campaign.end_date.slice(0, 10) :"",
 pawbucks_pool: campaign.pawbucks_pool,
 budget_usd: campaign.budget_usd,
 });

 // Manual grant state
 const [grantSearch, setGrantSearch] = useState("");
 const [grantUsers, setGrantUsers] = useState<Array<{ id: string; full_name: string | null; email: string | null }>>([]);
 const [grantSelected, setGrantSelected] = useState<{ id: string; label: string } | null>(null);
 const [grantAmount, setGrantAmount] = useState(1000);
 const [grantNote, setGrantNote] = useState("");

 const updateMutation = useMutation({
 mutationFn: async () => {
 const updates: Record<string, unknown> = {
 pawbucks_per_checkin: params.pawbucks_per_checkin,
 daily_spend_cap: params.daily_spend_cap || null,
 trigger_type: params.trigger_type,
 min_purchase_usd: params.min_purchase_usd,
 pawbucks_pool: params.pawbucks_pool,
 budget_usd: params.budget_usd,
 };
 if (params.end_date) updates.end_date = params.end_date;
 const { data, error } = await adminUpdateBrandCampaign(campaign.id, updates);
 if (error) throw error;
 const r = data as { success: boolean; error?: string } | null;
 if (r && !r.success) throw new Error(r.error ||"Update failed");
 return r;
 },
 onSuccess: () => {
 toast.success("Campaign parameters updated");
 queryClient.invalidateQueries({ queryKey: ["admin-brand-campaigns"] });
 onOpenChange(false);
 },
 onError: (e: Error) => toast.error(e.message),
 });

 const searchUsers = async (q: string) => {
 setGrantSearch(q);
 if (q.length < 2) {
 setGrantUsers([]);
 return;
 }
 const { data } = await supabase
 .from("profiles")
 .select("id, full_name, email")
 .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
 .limit(8);
 setGrantUsers((data || []) as Array<{ id: string; full_name: string | null; email: string | null }>);
 };

 const grantMutation = useMutation({
 mutationFn: async () => {
 if (!grantSelected) throw new Error("Select a recipient");
 if (grantAmount <= 0) throw new Error("Amount must be positive");
 const { data, error } = await adminGrantBrandedPawbucks(
 campaign.id,
 grantSelected.id,
 grantAmount,
 grantNote || undefined,
 );
 if (error) throw error;
 const r = data as { success: boolean; error?: string } | null;
 if (r && !r.success) throw new Error(r.error ||"Grant failed");
 return r;
 },
 onSuccess: () => {
 toast.success(`${grantAmount.toLocaleString()} PB granted to ${grantSelected?.label}`);
 setGrantSelected(null);
 setGrantSearch("");
 setGrantUsers([]);
 setGrantAmount(1000);
 setGrantNote("");
 queryClient.invalidateQueries({ queryKey: ["admin-brand-campaigns"] });
 queryClient.invalidateQueries({ queryKey: ["campaign-activity", campaign.id] });
 },
 onError: (e: Error) => toast.error(e.message),
 });

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Settings className="h-5 w-5 text-primary" />
 Manage Campaign — {campaign.name}
 </DialogTitle>
 <DialogDescription>
 Edit live campaign parameters or manually issue branded PawBucks from the pool.
 </DialogDescription>
 </DialogHeader>

 <Tabs defaultValue="params">
 <TabsList>
 <TabsTrigger value="params"><Settings className="h-4 w-4 mr-1" /> Parameters</TabsTrigger>
 <TabsTrigger value="grant"><Gift className="h-4 w-4 mr-1" /> Manual PB Grant</TabsTrigger>
 </TabsList>

 <TabsContent value="params" className="space-y-4 pt-3">
 <div className="grid grid-cols-2 gap-3">
 <div className="space-y-2">
 <Label>PawBucks per trigger</Label>
 <Input
 type="number" min={0}
 value={params.pawbucks_per_checkin}
 onChange={(e) => setParams((p) => ({ ...p, pawbucks_per_checkin: Number(e.target.value) }))}
 />
 </div>
 <div className="space-y-2">
 <Label>Daily spend cap (USD, 0 = none)</Label>
 <Input
 type="number" min={0}
 value={params.daily_spend_cap}
 onChange={(e) => setParams((p) => ({ ...p, daily_spend_cap: Number(e.target.value) }))}
 />
 </div>
 </div>

 <div className="space-y-2">
 <Label>Trigger</Label>
 <div className="grid grid-cols-3 gap-2">
 {(["checkin","checkout","both"] as const).map((t) => (
 <button
 key={t}
 type="button"
 onClick={() => setParams((p) => ({ ...p, trigger_type: t }))}
 className={`p-2 rounded-lg border-2 text-sm capitalize transition-all ${
 params.trigger_type === t
 ?"border-primary bg-primary/5"
 :"border-border hover:border-primary/40"
 }`}
 >
 {t ==="both" ?"Check-in + Checkout" : t}
 </button>
 ))}
 </div>
 </div>

 {params.trigger_type !=="checkin" && (
 <div className="space-y-2">
 <Label>Minimum purchase (USD)</Label>
 <Input
 type="number" min={0}
 value={params.min_purchase_usd}
 onChange={(e) => setParams((p) => ({ ...p, min_purchase_usd: Number(e.target.value) }))}
 />
 </div>
 )}

 <Separator />

 <div className="grid grid-cols-2 gap-3">
 <div className="space-y-2">
 <Label>Pool size (PB)</Label>
 <Input
 type="number" min={campaign.total_distributed}
 value={params.pawbucks_pool}
 onChange={(e) => setParams((p) => ({ ...p, pawbucks_pool: Number(e.target.value) }))}
 />
 <p className="text-xs text-muted-foreground">
 Distributed: {campaign.total_distributed.toLocaleString()} PB
 </p>
 </div>
 <div className="space-y-2">
 <Label>Budget (USD)</Label>
 <Input
 type="number" min={0}
 value={params.budget_usd}
 onChange={(e) => setParams((p) => ({ ...p, budget_usd: Number(e.target.value) }))}
 />
 </div>
 </div>

 <div className="space-y-2">
 <Label>End date (optional)</Label>
 <Input
 type="date"
 value={params.end_date}
 onChange={(e) => setParams((p) => ({ ...p, end_date: e.target.value }))}
 />
 </div>

 <Button
 className="w-full"
 onClick={() => updateMutation.mutate()}
 disabled={updateMutation.isPending}
 >
 {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
 Save Parameters
 </Button>
 </TabsContent>

 <TabsContent value="grant" className="space-y-4 pt-3">
 <div className="space-y-2">
 <Label>Recipient (search by name or email)</Label>
 <div className="relative">
 <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
 <Input
 className="pl-9"
 value={grantSearch}
 onChange={(e) => searchUsers(e.target.value)}
 placeholder="Type at least 2 characters..."
 />
 </div>
 {grantSelected ? (
 <div className="flex items-center justify-between p-2 rounded-lg border bg-muted/40">
 <span className="text-sm font-medium">Selected: {grantSelected.label}</span>
 <Button size="sm" variant="ghost" onClick={() => setGrantSelected(null)}>Clear</Button>
 </div>
 ) : (
 grantUsers.length > 0 && (
 <div className="border rounded-lg max-h-48 overflow-y-auto">
 {grantUsers.map((u) => (
 <button
 key={u.id}
 onClick={() => {
 setGrantSelected({ id: u.id, label: u.full_name || u.email || u.id });
 setGrantUsers([]);
 setGrantSearch("");
 }}
 className="w-full text-left p-2 hover:bg-muted text-sm border-b last:border-b-0"
 >
 <p className="font-medium">{u.full_name ||"Unnamed"}</p>
 <p className="text-xs text-muted-foreground">{u.email}</p>
 </button>
 ))}
 </div>
 )
 )}
 </div>

 <div className="space-y-2">
 <Label>Amount (PawBucks)</Label>
 <Input
 type="number" min={1}
 value={grantAmount}
 onChange={(e) => setGrantAmount(Number(e.target.value))}
 />
 <p className="text-xs text-muted-foreground">
 Pool remaining: {(campaign.pawbucks_pool - campaign.total_distributed).toLocaleString()} PB
 </p>
 </div>

 <div className="space-y-2">
 <Label>Note (optional)</Label>
 <Input
 value={grantNote}
 onChange={(e) => setGrantNote(e.target.value)}
 placeholder="Reason for grant..."
 />
 </div>

 <Button
 className="w-full"
 onClick={() => grantMutation.mutate()}
 disabled={grantMutation.isPending || !grantSelected || grantAmount <= 0}
 >
 {grantMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Gift className="h-4 w-4 mr-2" />}
 Grant {grantAmount.toLocaleString()} PB
 </Button>
 </TabsContent>
 </Tabs>
 </DialogContent>
 </Dialog>
 );
};