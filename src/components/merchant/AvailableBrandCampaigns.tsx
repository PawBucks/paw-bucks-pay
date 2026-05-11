import { useState } from"react";
import { useQuery, useMutation, useQueryClient } from"@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { ScrollArea } from"@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from"@/components/ui/dialog";
import { Textarea } from"@/components/ui/textarea";
import { Input } from"@/components/ui/input";
import { Loader2, Search, Send, CheckCircle2, XCircle } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { toast } from"sonner";
import {
 getAvailableBrandCampaigns,
 requestToJoinBrandCampaign,
 type AvailableBrandCampaign,
} from"@/services/api/brandCampaigns.service";

interface AvailableBrandCampaignsProps {
 merchantId: string;
}

export function AvailableBrandCampaigns({ merchantId }: AvailableBrandCampaignsProps) {
 const queryClient = useQueryClient();
 const [search, setSearch] = useState("");
 const [selected, setSelected] = useState<AvailableBrandCampaign | null>(null);
 const [message, setMessage] = useState("");

 const { data: campaigns = [], isLoading } = useQuery({
 queryKey: ["available-brand-campaigns", merchantId],
 queryFn: async () => {
 const { data, error } = await getAvailableBrandCampaigns(merchantId);
 if (error) throw error;
 return data;
 },
 refetchInterval: 60000,
 });

 const requestMutation = useMutation({
 mutationFn: ({ campaignId, msg }: { campaignId: string; msg?: string }) =>
 requestToJoinBrandCampaign(campaignId, merchantId, msg),
 onSuccess: ({ error }) => {
 if (error) {
 toast.error(error.message ||"Failed to send request");
 return;
 }
 toast.success("Request sent! The brand will review it shortly.", {
 description:"📧 We've emailed the brand owner to notify them of your request.",
 });
 queryClient.invalidateQueries({ queryKey: ["available-brand-campaigns"] });
 queryClient.invalidateQueries({ queryKey: ["merchant-brand-invitations"] });
 setSelected(null);
 setMessage("");
 },
 onError: (e: Error) => toast.error(e.message),
 });

 const filtered = campaigns.filter((c) => {
 if (!search.trim()) return true;
 const q = search.toLowerCase();
 return (
 c.name.toLowerCase().includes(q) ||
 c.brand_name.toLowerCase().includes(q) ||
 (c.description?.toLowerCase().includes(q) ?? false)
 );
 });

 const renderStatus = (c: AvailableBrandCampaign) => {
 if (c.existing_request_status ==="pending") {
 return <Badge variant="secondary"><span className="h-3 w-3 mr-1" aria-hidden="true">⏰</span>Request pending</Badge>;
 }
 if (c.existing_request_status ==="approved") {
 return <Badge className="bg-[hsl(var(--success))] text-white"><CheckCircle2 className="h-3 w-3 mr-1" />Joined</Badge>;
 }
 if (c.existing_request_status ==="declined") {
 return <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" />Previously declined</Badge>;
 }
 if (c.existing_invitation_status ==="pending" || c.existing_invitation_status ==="sent") {
 return <Badge variant="secondary"><Sparkles className="h-3 w-3 mr-1" />Invited — check inbox</Badge>;
 }
 return null;
 };

 const canRequest = (c: AvailableBrandCampaign) =>
 !c.existing_request_status &&
 !["pending","sent","accepted"].includes(c.existing_invitation_status ||"");

 return (
 <>
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <span className="h-4 w-4 text-primary" aria-hidden="true">📣</span>
 Available Brand Campaigns
 {filtered.length > 0 && (
 <Badge variant="secondary">{filtered.length}</Badge>
 )}
 </CardTitle>
 <CardDescription>
 Browse open campaigns and request to join. Brands fund 100% of the rewards pool.
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-3">
 <div className="relative">
 <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
 <Input
 placeholder="Search campaigns or brands…"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="pl-9"
 />
 </div>

 {isLoading ? (
 <div className="py-6 flex justify-center">
 <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
 </div>
 ) : filtered.length === 0 ? (
 <div className="py-8 text-center text-sm text-muted-foreground">
 <span className="h-10 w-10 mx-auto mb-2 opacity-40" aria-hidden="true">📣</span>
 {campaigns.length === 0
 ?"No open campaigns to join right now. Check back soon!"
 :"No campaigns match your search."}
 </div>
 ) : (
 <ScrollArea className="max-h-[520px] pr-2">
 <div className="space-y-3">
 {filtered.map((c) => (
 <div
 key={c.id}
 className="p-4 rounded-lg border bg-card hover:bg-muted/40 transition cursor-pointer space-y-3"
 onClick={() => setSelected(c)}
 >
 <div className="flex items-start gap-3">
 {c.brand_logo_url ? (
 <img src={c.brand_logo_url} alt={c.brand_name} className="w-10 h-10 rounded-lg object-cover" />
 ) : (
 <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
 {c.brand_name.charAt(0)}
 </div>
 )}
 <div className="flex-1 min-w-0">
 <p className="font-semibold text-sm truncate" style={c.campaign_color ? { color: c.campaign_color } : undefined}>
 {c.name}
 </p>
 <p className="text-xs text-muted-foreground truncate">by {c.brand_name}</p>
 </div>
 {renderStatus(c)}
 </div>
 <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
 <span className="flex items-center gap-1">
 <PawBucksLogo className="h-3 w-3" />
 {c.pawbucks_per_checkin?.toLocaleString() || 0} PB / check-in
 </span>
 <span className="flex items-center gap-1">
 <span className="h-3 w-3" aria-hidden="true">💵</span>
 ${Number(c.budget_usd || 0).toLocaleString()} budget
 </span>
 {c.end_date && (
 <span className="flex items-center gap-1">
 <span className="h-3 w-3" aria-hidden="true">📅</span>
 Ends {new Date(c.end_date).toLocaleDateString()}
 </span>
 )}
 </div>
 </div>
 ))}
 </div>
 </ScrollArea>
 )}
 </CardContent>
 </Card>

 <Dialog open={!!selected} onOpenChange={(o) => !o && (setSelected(null), setMessage(""))}>
 <DialogContent className="max-w-md">
 {selected && (
 <>
 <DialogHeader>
 <div className="flex items-center gap-3">
 {selected.brand_logo_url ? (
 <img src={selected.brand_logo_url} alt={selected.brand_name} className="w-12 h-12 rounded-lg object-cover" />
 ) : (
 <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
 {selected.brand_name.charAt(0)}
 </div>
 )}
 <div className="flex-1 min-w-0 text-left">
 <DialogTitle className="text-base truncate">{selected.name}</DialogTitle>
 <DialogDescription>by {selected.brand_name}</DialogDescription>
 </div>
 </div>
 </DialogHeader>

 <div className="space-y-4 py-2">
 {selected.description && (
 <p className="text-sm text-muted-foreground">{selected.description}</p>
 )}

 <div className="grid grid-cols-2 gap-2">
 <div className="p-3 rounded-lg border bg-muted/30">
 <p className="text-xs text-muted-foreground">Per check-in</p>
 <p className="font-bold">{selected.pawbucks_per_checkin?.toLocaleString() || 0} PB</p>
 </div>
 <div className="p-3 rounded-lg border bg-muted/30">
 <p className="text-xs text-muted-foreground">Budget</p>
 <p className="font-bold">${Number(selected.budget_usd || 0).toLocaleString()}</p>
 </div>
 <div className="p-3 rounded-lg border bg-muted/30">
 <p className="text-xs text-muted-foreground">Pool</p>
 <p className="font-bold">{selected.pawbucks_pool?.toLocaleString() || 0} PB</p>
 </div>
 <div className="p-3 rounded-lg border bg-muted/30">
 <p className="text-xs text-muted-foreground">Window</p>
 <p className="text-xs font-semibold">
 {selected.start_date ? new Date(selected.start_date).toLocaleDateString() :"Any"}
 {" →"}
 {selected.end_date ? new Date(selected.end_date).toLocaleDateString() :"Open"}
 </p>
 </div>
 </div>

 {selected.targeting_notes && (
 <div>
 <p className="text-xs uppercase text-muted-foreground mb-1">Targeting Notes</p>
 <p className="text-sm">{selected.targeting_notes}</p>
 </div>
 )}

 {canRequest(selected) ? (
 <div>
 <label className="text-xs uppercase text-muted-foreground">Message to brand (optional)</label>
 <Textarea
 value={message}
 onChange={(e) => setMessage(e.target.value)}
 placeholder="Tell the brand why you'd be a great fit…"
 rows={3}
 className="mt-1"
 />
 </div>
 ) : (
 <div className="text-sm text-muted-foreground">{renderStatus(selected)}</div>
 )}
 </div>

 <DialogFooter>
 <Button variant="ghost" onClick={() => { setSelected(null); setMessage(""); }}>Close</Button>
 {canRequest(selected) && (
 <Button
 onClick={() => requestMutation.mutate({ campaignId: selected.id, msg: message.trim() || undefined })}
 disabled={requestMutation.isPending}
 >
 {requestMutation.isPending ? (
 <Loader2 className="h-4 w-4 mr-1 animate-spin" />
 ) : (
 <Send className="h-4 w-4 mr-1" />
 )}
 Request to Join
 </Button>
 )}
 </DialogFooter>
 </>
 )}
 </DialogContent>
 </Dialog>
 </>
 );
}