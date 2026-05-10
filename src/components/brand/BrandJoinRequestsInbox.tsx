import { useState } from"react";
import { useQuery, useMutation, useQueryClient } from"@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { ScrollArea } from"@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from"@/components/ui/dialog";
import { Textarea } from"@/components/ui/textarea";
import { Inbox, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from"sonner";
import {
 getBrandJoinRequests,
 respondToBrandCampaignJoinRequest,
 type BrandCampaignJoinRequest,
} from"@/services/api/brandCampaigns.service";

interface BrandJoinRequestsInboxProps {
 brandId: string;
}

export function BrandJoinRequestsInbox({ brandId }: BrandJoinRequestsInboxProps) {
 const queryClient = useQueryClient();
 const [selected, setSelected] = useState<BrandCampaignJoinRequest | null>(null);
 const [responseMessage, setResponseMessage] = useState("");

 const { data: requests = [], isLoading } = useQuery({
 queryKey: ["brand-join-requests", brandId],
 queryFn: async () => {
 const { data, error } = await getBrandJoinRequests(brandId);
 if (error) throw error;
 return data;
 },
 refetchInterval: 30000,
 });

 const respondMutation = useMutation({
 mutationFn: ({ id, approve, msg }: { id: string; approve: boolean; msg?: string }) =>
 respondToBrandCampaignJoinRequest(id, approve, msg),
 onSuccess: (_, vars) => {
 toast.success(
 vars.approve ?"Merchant approved & added to campaign 🎉" :"Request declined",
 {
 description: vars.approve
 ?"📧 Approval email sent to the merchant."
 :"📧 Decline email sent to the merchant.",
 },
 );
 queryClient.invalidateQueries({ queryKey: ["brand-join-requests"] });
 queryClient.invalidateQueries({ queryKey: ["campaign-merchants"] });
 setSelected(null);
 setResponseMessage("");
 },
 onError: (e: Error) => toast.error(e.message),
 });

 const pending = requests.filter((r) => r.status ==="pending");
 const history = requests.filter((r) => r.status !=="pending");

 const statusBadge = (s: string) => {
 if (s ==="approved") return <Badge className="bg-[hsl(var(--success))] text-white">Approved</Badge>;
 if (s ==="declined") return <Badge variant="outline">Declined</Badge>;
 if (s ==="cancelled") return <Badge variant="secondary">Cancelled</Badge>;
 return <Badge><span className="h-3 w-3 mr-1" aria-hidden="true">⏰</span>Pending</Badge>;
 };

 return (
 <>
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <Inbox className="h-4 w-4 text-primary" /> Merchant Join Requests
 {pending.length > 0 && (
 <Badge className="bg-primary text-primary-foreground">{pending.length} new</Badge>
 )}
 </CardTitle>
 <CardDescription>
 Merchants requesting to participate in your campaigns
 </CardDescription>
 </CardHeader>
 <CardContent>
 {isLoading ? (
 <div className="py-6 flex justify-center">
 <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
 </div>
 ) : requests.length === 0 ? (
 <div className="py-8 text-center text-sm text-muted-foreground">
 <span className="h-10 w-10 mx-auto mb-2 opacity-40" aria-hidden="true">🏪</span>
 No join requests yet
 </div>
 ) : (
 <ScrollArea className="max-h-[520px] pr-2">
 <div className="space-y-3">
 {pending.map((req) => (
 <div
 key={req.id}
 className="p-4 rounded-lg border-2 border-primary/30 bg-primary/5 space-y-3 cursor-pointer hover:bg-primary/10 transition"
 onClick={() => setSelected(req)}
 >
 <div className="flex items-start gap-3">
 {req.merchants?.logo_url ? (
 <img src={req.merchants.logo_url} alt={req.merchants.business_name} className="w-10 h-10 rounded-lg object-cover" />
 ) : (
 <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
 {req.merchants?.business_name?.charAt(0) ||"?"}
 </div>
 )}
 <div className="flex-1 min-w-0">
 <p className="font-semibold text-sm truncate">{req.merchants?.business_name ||"Merchant"}</p>
 <p className="text-xs text-muted-foreground truncate">
 wants to join <strong>{req.brand_campaigns?.name ||"—"}</strong>
 </p>
 </div>
 </div>
 {req.message && (
 <p className="text-sm italic text-muted-foreground border-l-2 border-primary/40 pl-3">
"{req.message}"
 </p>
 )}
 <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
 <Button
 size="sm"
 className="flex-1"
 onClick={() => respondMutation.mutate({ id: req.id, approve: true })}
 disabled={respondMutation.isPending}
 >
 <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
 </Button>
 <Button
 size="sm"
 variant="ghost"
 onClick={() => respondMutation.mutate({ id: req.id, approve: false })}
 disabled={respondMutation.isPending}
 >
 <XCircle className="h-3.5 w-3.5 mr-1" /> Decline
 </Button>
 </div>
 </div>
 ))}

 {history.length > 0 && (
 <>
 <p className="text-xs uppercase tracking-wide text-muted-foreground pt-3">History</p>
 {history.map((req) => (
 <div
 key={req.id}
 className="flex items-center gap-3 p-3 rounded-lg border opacity-80 cursor-pointer hover:opacity-100 hover:bg-muted transition"
 onClick={() => setSelected(req)}
 >
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium truncate">
 {req.merchants?.business_name} → {req.brand_campaigns?.name}
 </p>
 <p className="text-xs text-muted-foreground">
 {req.responded_at ? new Date(req.responded_at).toLocaleDateString() : new Date(req.requested_at).toLocaleDateString()}
 </p>
 </div>
 {statusBadge(req.status)}
 </div>
 ))}
 </>
 )}
 </div>
 </ScrollArea>
 )}
 </CardContent>
 </Card>

 <Dialog open={!!selected} onOpenChange={(o) => !o && (setSelected(null), setResponseMessage(""))}>
 <DialogContent className="max-w-md">
 {selected && (
 <>
 <DialogHeader>
 <DialogTitle>{selected.merchants?.business_name ||"Merchant"}</DialogTitle>
 <DialogDescription>
 Requesting to join <strong>{selected.brand_campaigns?.name}</strong>
 </DialogDescription>
 </DialogHeader>
 <div className="space-y-3 py-2">
 <div>
 <p className="text-xs uppercase text-muted-foreground mb-1">Status</p>
 {statusBadge(selected.status)}
 </div>
 {selected.message && (
 <div>
 <p className="text-xs uppercase text-muted-foreground mb-1">Their Message</p>
 <p className="text-sm italic border-l-2 border-primary/40 pl-3">"{selected.message}"</p>
 </div>
 )}
 {selected.status ==="pending" && (
 <div>
 <p className="text-xs uppercase text-muted-foreground mb-1">Response (optional)</p>
 <Textarea
 value={responseMessage}
 onChange={(e) => setResponseMessage(e.target.value)}
 rows={3}
 placeholder="Add a note for the merchant…"
 />
 </div>
 )}
 {selected.response_message && (
 <div>
 <p className="text-xs uppercase text-muted-foreground mb-1">Your Response</p>
 <p className="text-sm">{selected.response_message}</p>
 </div>
 )}
 </div>
 <DialogFooter>
 {selected.status ==="pending" ? (
 <>
 <Button
 variant="ghost"
 onClick={() => respondMutation.mutate({ id: selected.id, approve: false, msg: responseMessage.trim() || undefined })}
 disabled={respondMutation.isPending}
 >
 <XCircle className="h-4 w-4 mr-1" /> Decline
 </Button>
 <Button
 onClick={() => respondMutation.mutate({ id: selected.id, approve: true, msg: responseMessage.trim() || undefined })}
 disabled={respondMutation.isPending}
 >
 <CheckCircle2 className="h-4 w-4 mr-1" /> Approve & Add
 </Button>
 </>
 ) : (
 <Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>
 )}
 </DialogFooter>
 </>
 )}
 </DialogContent>
 </Dialog>
 </>
 );
}