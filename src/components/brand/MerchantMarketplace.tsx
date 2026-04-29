import { useState, useMemo } from"react";
import { useQuery, useMutation, useQueryClient } from"@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Badge } from"@/components/ui/badge";
import { Textarea } from"@/components/ui/textarea";
import { Checkbox } from"@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from"@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from"@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { ScrollArea } from"@/components/ui/scroll-area";
import { Store, Search, Send, Loader2, Users, CheckCircle2, Clock, XCircle } from"lucide-react";
import { toast } from"sonner";
import {
 getMarketplaceMerchants,
 getCampaignInvitations,
 inviteMerchantsToCampaign,
 getCampaignMerchants,
 type BrandCampaign,
} from"@/services/api/brandCampaigns.service";

interface MerchantMarketplaceProps {
 brandId: string;
 campaigns: BrandCampaign[];
}

const CATEGORIES = [
"Pet Store","Grooming","Veterinary","Boarding","Training",
"Walking","Daycare","Photography","Pet Sitting","Other",
];

export function MerchantMarketplace({ brandId, campaigns }: MerchantMarketplaceProps) {
 const queryClient = useQueryClient();
 const [search, setSearch] = useState("");
 const [category, setCategory] = useState<string>("all");
 const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
 const [campaignId, setCampaignId] = useState<string>(campaigns[0]?.id ||"");
 const [message, setMessage] = useState("");
 const [showInviteDialog, setShowInviteDialog] = useState(false);

 const activeCampaigns = useMemo(
 () => campaigns.filter((c) => ["active","draft","pending_payment","paused"].includes(c.status)),
 [campaigns]
 );

 const { data: merchants = [], isLoading: merchantsLoading } = useQuery({
 queryKey: ["marketplace-merchants", search, category],
 queryFn: async () => {
 const { data, error } = await getMarketplaceMerchants(
 search || undefined,
 category ==="all" ? undefined : category,
 );
 if (error) throw error;
 return data;
 },
 });

 const { data: invitations = [] } = useQuery({
 queryKey: ["brand-invitations", brandId],
 queryFn: async () => {
 const { data, error } = await getCampaignInvitations(brandId);
 if (error) throw error;
 return data;
 },
 refetchInterval: 30000,
 });

 const { data: enrolledByCampaign = {} } = useQuery({
 queryKey: ["brand-enrolled-merchants", brandId],
 queryFn: async () => {
 const result: Record<string, Set<string>> = {};
 for (const c of activeCampaigns) {
 const { data } = await getCampaignMerchants(c.id);
 result[c.id] = new Set((data || []).map((m) => m.merchant_id));
 }
 return result;
 },
 enabled: activeCampaigns.length > 0,
 });

 const toggleSelect = (id: string) => {
 setSelectedIds((prev) => {
 const next = new Set(prev);
 if (next.has(id)) next.delete(id);
 else next.add(id);
 return next;
 });
 };

 const inviteMutation = useMutation({
 mutationFn: async () => {
 if (!campaignId) throw new Error("Choose a campaign");
 if (selectedIds.size === 0) throw new Error("Select at least one merchant");
 return inviteMerchantsToCampaign(campaignId, Array.from(selectedIds), message || undefined);
 },
 onSuccess: (result) => {
 const { data, error } = result;
 if (error) {
 toast.error((error as Error).message ||"Failed to send invitations");
 return;
 }
 const counts = (data as { results?: Array<{ status: string }> } | null)?.results || [];
 const invited = counts.filter((r) => r.status ==="invited").length;
 const skipped = counts.filter((r) => r.status ==="skipped_existing" || r.status ==="already_enrolled").length;
 toast.success(`${invited} invitation${invited === 1 ?"" :"s"} sent${skipped ? ` (${skipped} skipped)` :""}`);
 setSelectedIds(new Set());
 setMessage("");
 setShowInviteDialog(false);
 queryClient.invalidateQueries({ queryKey: ["brand-invitations"] });
 queryClient.invalidateQueries({ queryKey: ["brand-enrolled-merchants"] });
 },
 onError: (e: Error) => toast.error(e.message),
 });

 const inviteStatusFor = (merchantId: string, campId: string):"enrolled" |"invited" | null => {
 if (enrolledByCampaign[campId]?.has(merchantId)) return"enrolled";
 const inv = invitations.find((i) => i.merchant_id === merchantId && i.campaign_id === campId);
 if (inv && ["pending","sent"].includes(inv.status)) return"invited";
 return null;
 };

 return (
 <div className="space-y-4">
 <Tabs defaultValue="browse">
 <TabsList className="w-full justify-start">
 <TabsTrigger value="browse" className="gap-1.5">
 <Store className="h-4 w-4" />
 Browse Merchants
 </TabsTrigger>
 <TabsTrigger value="invitations" className="gap-1.5">
 <Send className="h-4 w-4" />
 Invitations ({invitations.length})
 </TabsTrigger>
 </TabsList>

 {/* Browse */}
 <TabsContent value="browse" className="mt-4 space-y-4">
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <Store className="h-4 w-4 text-primary" />
 Merchant Marketplace
 </CardTitle>
 <CardDescription>
 Browse {merchants.length} merchant{merchants.length === 1 ?"" :"s"} accepting PawBucks. Select and invite to your campaign.
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-3">
 <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
 <div className="md:col-span-2 relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder="Search merchants by name..."
 className="pl-9"
 />
 </div>
 <Select value={category} onValueChange={setCategory}>
 <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All categories</SelectItem>
 {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>

 {selectedIds.size > 0 && (
 <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
 <span className="text-sm">
 <strong>{selectedIds.size}</strong> merchant{selectedIds.size === 1 ?"" :"s"} selected
 </span>
 <div className="flex items-center gap-2">
 <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
 Clear
 </Button>
 <Button size="sm" onClick={() => setShowInviteDialog(true)} disabled={activeCampaigns.length === 0}>
 <Send className="h-3.5 w-3.5 mr-1.5" /> Invite to Campaign
 </Button>
 </div>
 </div>
 )}

 {merchantsLoading ? (
 <div className="py-8 flex justify-center">
 <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
 </div>
 ) : merchants.length === 0 ? (
 <div className="py-8 text-center text-sm text-muted-foreground">
 No merchants match your filters
 </div>
 ) : (
 <ScrollArea className="h-[480px] pr-2">
 <div className="space-y-2">
 {merchants.map((m) => {
 const isSelected = selectedIds.has(m.id);
 return (
 <div
 key={m.id}
 className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
 isSelected ?"border-primary bg-primary/5" :"hover:border-primary/40"
 }`}
 >
 <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(m.id)} />
 {m.logo_url ? (
 <img src={m.logo_url} alt={m.business_name} className="w-10 h-10 rounded-lg object-cover" />
 ) : (
 <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
 <Store className="h-5 w-5 text-muted-foreground" />
 </div>
 )}
 <div className="flex-1 min-w-0">
 <p className="font-semibold text-sm truncate">{m.business_name}</p>
 <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
 {m.business_type && <Badge variant="secondary" className="text-[10px]">{m.business_type}</Badge>}
 {m.address && <span className="truncate">{m.address}</span>}
 </div>
 </div>
 {/* Invitation status badges per active campaign */}
 <div className="flex flex-col gap-0.5 items-end">
 {activeCampaigns.slice(0, 2).map((c) => {
 const status = inviteStatusFor(m.id, c.id);
 if (!status) return null;
 return (
 <Badge key={c.id} variant="outline" className="text-[10px] gap-1">
 {status ==="enrolled" ? (
 <><CheckCircle2 className="h-2.5 w-2.5" /> {c.name}</>
 ) : (
 <><Clock className="h-2.5 w-2.5" /> Invited</>
 )}
 </Badge>
 );
 })}
 </div>
 </div>
 );
 })}
 </div>
 </ScrollArea>
 )}
 </CardContent>
 </Card>
 </TabsContent>

 {/* Invitations */}
 <TabsContent value="invitations" className="mt-4">
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <Send className="h-4 w-4 text-primary" />
 Invitation Inbox
 </CardTitle>
 <CardDescription>Track responses from merchants you've invited</CardDescription>
 </CardHeader>
 <CardContent>
 {invitations.length === 0 ? (
 <div className="py-8 text-center text-sm text-muted-foreground">
 No invitations sent yet — head to Browse to start inviting merchants
 </div>
 ) : (
 <ScrollArea className="h-[480px] pr-2">
 <div className="space-y-2">
 {invitations.map((inv) => (
 <div key={inv.id} className="flex items-center gap-3 p-3 rounded-lg border">
 <div className="flex-1 min-w-0">
 <p className="font-semibold text-sm truncate">
 {inv.merchants?.business_name ||"Unknown merchant"}
 </p>
 <p className="text-xs text-muted-foreground truncate">
 Campaign: {inv.brand_campaigns?.name ||"—"}
 </p>
 <p className="text-[11px] text-muted-foreground mt-0.5">
 {inv.invited_at ? new Date(inv.invited_at).toLocaleString() :""}
 </p>
 </div>
 <StatusBadge status={inv.status} />
 </div>
 ))}
 </div>
 </ScrollArea>
 )}
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>

 {/* Invite dialog */}
 <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Send className="h-5 w-5 text-primary" />
 Invite {selectedIds.size} Merchant{selectedIds.size === 1 ?"" :"s"}
 </DialogTitle>
 <DialogDescription>
 They'll receive an in-app notification to accept and join your campaign.
 </DialogDescription>
 </DialogHeader>

 <div className="space-y-4 py-2">
 <div className="space-y-2">
 <Label>Campaign</Label>
 <Select value={campaignId} onValueChange={setCampaignId}>
 <SelectTrigger><SelectValue placeholder="Select a campaign" /></SelectTrigger>
 <SelectContent>
 {activeCampaigns.map((c) => (
 <SelectItem key={c.id} value={c.id}>
 {c.name} ({c.status})
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label>Personal message (optional)</Label>
 <Textarea
 value={message}
 onChange={(e) => setMessage(e.target.value)}
 placeholder="We'd love to partner with you on this campaign..."
 rows={3}
 maxLength={500}
 />
 </div>
 </div>

 <DialogFooter>
 <Button variant="ghost" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
 <Button onClick={() => inviteMutation.mutate()} disabled={inviteMutation.isPending || !campaignId}>
 {inviteMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
 Send Invitations
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 );
}

function StatusBadge({ status }: { status: string }) {
 const cfg: Record<string, { icon: typeof CheckCircle2; cls: string; label: string }> = {
 accepted: { icon: CheckCircle2, cls:"bg-success/15 text-success", label:"Accepted" },
 declined: { icon: XCircle, cls:"bg-destructive/15 text-destructive", label:"Declined" },
 pending: { icon: Clock, cls:"bg-warning/15 text-warning", label:"Pending" },
 sent: { icon: Clock, cls:"bg-warning/15 text-warning", label:"Pending" },
 };
 const c = cfg[status] || cfg.pending;
 const Icon = c.icon;
 return <Badge className={c.cls}><Icon className="h-3 w-3 mr-1" /> {c.label}</Badge>;
}
