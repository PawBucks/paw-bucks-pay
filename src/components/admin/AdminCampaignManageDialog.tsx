import { useMemo, useState } from"react";
import { useMutation, useQuery, useQueryClient } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from"@/components/ui/dialog";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Separator } from"@/components/ui/separator";
import { Textarea } from"@/components/ui/textarea";
import { Badge } from"@/components/ui/badge";
import { ScrollArea } from"@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { Gift, Loader2, Search, Settings, Users, BarChart3, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { toast } from"sonner";
import {
 adminUpdateBrandCampaign,
 adminGrantBrandedPawbucks,
 adminBulkGrantBrandedPawbucks,
 lookupUserIdsByEmails,
 type BrandCampaign,
} from"@/services/api/brandCampaigns.service";
import { useAuth } from"@/hooks/useAuth";

interface Props {
 open: boolean;
 onOpenChange: (v: boolean) => void;
 campaign: BrandCampaign;
}

export const AdminCampaignManageDialog = ({ open, onOpenChange, campaign }: Props) => {
 const queryClient = useQueryClient();
 const { user } = useAuth();

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

 // Bulk grant state
 const [bulkEmails, setBulkEmails] = useState("");
 const [bulkAmount, setBulkAmount] = useState(500);
 const [bulkNote, setBulkNote] = useState("");
 const [bulkPreview, setBulkPreview] = useState<{ matched: { id: string; email: string | null; full_name: string | null }[]; notFound: string[] } | null>(null);
 const [bulkPreviewLoading, setBulkPreviewLoading] = useState(false);

 const parseEmails = (raw: string): string[] => {
   return Array.from(new Set(
     raw.split(/[\s,;\n]+/).map((s) => s.trim().toLowerCase()).filter((s) => /.+@.+\..+/.test(s))
   ));
 };

 const previewBulk = async () => {
   const emails = parseEmails(bulkEmails);
   if (emails.length === 0) {
     toast.error("Enter at least one valid email");
     return;
   }
   setBulkPreviewLoading(true);
   const { data, error } = await lookupUserIdsByEmails(emails);
   setBulkPreviewLoading(false);
   if (error) {
     toast.error("Lookup failed");
     return;
   }
   const matchedEmails = new Set((data || []).map((u) => (u.email || "").toLowerCase()));
   setBulkPreview({
     matched: data || [],
     notFound: emails.filter((e) => !matchedEmails.has(e)),
   });
 };

 const bulkMutation = useMutation({
   mutationFn: async () => {
     if (!user?.id) throw new Error("Not authenticated");
     if (!bulkPreview || bulkPreview.matched.length === 0) throw new Error("Run a preview first");
     if (bulkAmount <= 0) throw new Error("Amount must be positive");
     const needed = bulkPreview.matched.length * bulkAmount;
     const remaining = campaign.pawbucks_pool - campaign.total_distributed;
     if (needed > remaining) throw new Error(`Insufficient pool: need ${needed.toLocaleString()} PB, have ${remaining.toLocaleString()} PB`);
     const batchId = crypto.randomUUID();
     const { data, error } = await adminBulkGrantBrandedPawbucks(
       campaign.id,
       bulkPreview.matched.map((u) => u.id),
       bulkAmount,
       batchId,
       user.id,
       bulkNote || "Admin bulk grant",
     );
     if (error) throw error;
     const r = data as { success: boolean; error?: string; granted_users?: number; skipped_users?: number; total_pb?: number } | null;
     if (r && !r.success) throw new Error(r.error || "Bulk grant failed");
     return r;
   },
   onSuccess: (r) => {
     toast.success(`Granted ${(r?.total_pb ?? 0).toLocaleString()} PB to ${r?.granted_users ?? 0} users${r?.skipped_users ? ` (skipped ${r.skipped_users} duplicates)` : ""}`);
     setBulkPreview(null);
     setBulkEmails("");
     queryClient.invalidateQueries({ queryKey: ["admin-brand-campaigns"] });
     queryClient.invalidateQueries({ queryKey: ["campaign-activity", campaign.id] });
     queryClient.invalidateQueries({ queryKey: ["campaign-distribution", campaign.id] });
   },
   onError: (e: Error) => toast.error(e.message),
 });

 // Distribution & redemption ledger
 type ActivityRow = {
   id: string;
   type: string;
   amount: number;
   merchant_id: string | null;
   description: string | null;
   created_at: string;
   source: string | null;
   actor_user_id: string | null;
   batch_id: string | null;
   user_id: string;
 };
 const { data: ledgerActivity = [] } = useQuery({
   queryKey: ["campaign-distribution", campaign.id, open],
   enabled: open,
   queryFn: async () => {
     const { data, error } = await supabase
       .from("branded_pawbucks_activity")
       .select("id,type,amount,merchant_id,description,created_at,source,actor_user_id,batch_id,user_id")
       .eq("campaign_id", campaign.id)
       .order("created_at", { ascending: false })
       .limit(200);
     if (error) throw error;
     return (data || []) as ActivityRow[];
   },
 });

 const ledgerKpis = useMemo(() => {
   let minted = 0, redeemed = 0, recipients = new Set<string>();
   for (const r of ledgerActivity) {
     if (r.type === "earn") { minted += r.amount; recipients.add(r.user_id); }
     else if (r.type === "redeem") { redeemed += Math.abs(r.amount); }
   }
   return { minted, redeemed, outstanding: minted - redeemed, recipients: recipients.size };
 }, [ledgerActivity]);

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
  <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Settings className="h-5 w-5 text-primary" />
 Manage Campaign — {campaign.name}
 </DialogTitle>
 <DialogDescription>
  Edit parameters, issue branded PawBucks (single or bulk), and audit the distribution & redemption ledger.
 </DialogDescription>
 </DialogHeader>

 <Tabs defaultValue="params">
 <TabsList>
 <TabsTrigger value="params"><Settings className="h-4 w-4 mr-1" /> Parameters</TabsTrigger>
  <TabsTrigger value="grant"><Gift className="h-4 w-4 mr-1" aria-hidden="true" /> Manual Grant</TabsTrigger>
  <TabsTrigger value="bulk"><Users className="h-4 w-4 mr-1" aria-hidden="true" /> Bulk Grant</TabsTrigger>
  <TabsTrigger value="ledger"><BarChart3 className="h-4 w-4 mr-1" aria-hidden="true" /> Distribution & Redemption</TabsTrigger>
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
 {grantMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Gift className="h-4 w-4 mr-2" aria-hidden="true" />}
 Grant {grantAmount.toLocaleString()} PB
 </Button>
 </TabsContent>

  <TabsContent value="bulk" className="space-y-4 pt-3">
    <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
      Paste a list of recipient emails (comma, space, or newline separated). We'll resolve them to users, show a preview, and grant the chosen PawBucks amount to each. Grants are idempotent per batch — re-running won't double-issue.
    </div>
    <div className="space-y-2">
      <Label>Recipient emails</Label>
      <Textarea
        rows={6}
        value={bulkEmails}
        onChange={(e) => { setBulkEmails(e.target.value); setBulkPreview(null); }}
        placeholder="alice@example.com, bob@example.com&#10;carol@example.com"
      />
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        <Label>PB per recipient</Label>
        <Input
          type="number" min={1}
          value={bulkAmount}
          onChange={(e) => setBulkAmount(Number(e.target.value))}
        />
      </div>
      <div className="space-y-2">
        <Label>Internal note (optional)</Label>
        <Input value={bulkNote} onChange={(e) => setBulkNote(e.target.value)} placeholder="Q2 loyalty boost" />
      </div>
    </div>

    <div className="flex gap-2">
      <Button variant="outline" onClick={previewBulk} disabled={bulkPreviewLoading || !bulkEmails.trim()}>
        {bulkPreviewLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />} Preview recipients
      </Button>
      {bulkPreview && (
        <div className="text-sm text-muted-foreground self-center">
          <span className="font-medium text-foreground">{bulkPreview.matched.length}</span> matched
          {bulkPreview.notFound.length > 0 && (
            <> · <span className="text-destructive">{bulkPreview.notFound.length}</span> not found</>
          )}
          {" · "}Total: <span className="font-medium text-foreground">{(bulkPreview.matched.length * bulkAmount).toLocaleString()} PB</span>
        </div>
      )}
    </div>

    {bulkPreview && bulkPreview.notFound.length > 0 && (
      <ScrollArea className="max-h-24 rounded-md border p-2">
        <p className="text-xs font-medium text-destructive mb-1">Emails without a matching account (will be skipped):</p>
        <p className="text-xs text-muted-foreground break-all">{bulkPreview.notFound.join(", ")}</p>
      </ScrollArea>
    )}

    <Button
      className="w-full"
      onClick={() => bulkMutation.mutate()}
      disabled={bulkMutation.isPending || !bulkPreview || bulkPreview.matched.length === 0 || bulkAmount <= 0}
    >
      {bulkMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Users className="h-4 w-4 mr-2" />}
      Grant {bulkAmount.toLocaleString()} PB to {bulkPreview?.matched.length ?? 0} users
    </Button>

    <p className="text-xs text-muted-foreground">
      Pool remaining: {(campaign.pawbucks_pool - campaign.total_distributed).toLocaleString()} PB
    </p>
  </TabsContent>

  <TabsContent value="ledger" className="space-y-4 pt-3">
    <div className="grid grid-cols-4 gap-2">
      <div className="rounded-lg border p-3">
        <p className="text-xs text-muted-foreground">Minted</p>
        <p className="text-lg font-semibold">{ledgerKpis.minted.toLocaleString()} PB</p>
      </div>
      <div className="rounded-lg border p-3">
        <p className="text-xs text-muted-foreground">Redeemed</p>
        <p className="text-lg font-semibold">{ledgerKpis.redeemed.toLocaleString()} PB</p>
      </div>
      <div className="rounded-lg border p-3">
        <p className="text-xs text-muted-foreground">Outstanding</p>
        <p className="text-lg font-semibold">{ledgerKpis.outstanding.toLocaleString()} PB</p>
      </div>
      <div className="rounded-lg border p-3">
        <p className="text-xs text-muted-foreground">Recipients</p>
        <p className="text-lg font-semibold">{ledgerKpis.recipients.toLocaleString()}</p>
      </div>
    </div>

    <Separator />

    <div>
      <h4 className="text-sm font-medium mb-2">Recent activity (last 200)</h4>
      <ScrollArea className="h-72 rounded-md border">
        <div className="divide-y">
          {ledgerActivity.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground text-center">No activity yet for this campaign.</p>
          )}
          {ledgerActivity.map((row) => {
            const isEarn = row.type === "earn";
            return (
              <div key={row.id} className="flex items-start gap-3 p-2.5 text-sm">
                {isEarn ? (
                  <ArrowUpCircle className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
                ) : (
                  <ArrowDownCircle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">
                      {isEarn ? "+" : ""}{row.amount.toLocaleString()} PB
                    </span>
                    {row.source && <Badge variant="secondary" className="text-[10px]">{row.source.replace("_", " ")}</Badge>}
                    {row.batch_id && <Badge variant="outline" className="text-[10px]">batch</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{row.description || (isEarn ? "Granted" : "Redeemed")}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(row.created_at).toLocaleString("en-US", { timeZone: "America/New_York" })} EST · user {row.user_id.slice(0, 8)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  </TabsContent>
 </Tabs>
 </DialogContent>
 </Dialog>
 );
};