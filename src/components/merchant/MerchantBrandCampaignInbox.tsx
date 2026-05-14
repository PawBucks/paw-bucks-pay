import { useState } from"react";
import { useQuery, useMutation, useQueryClient } from"@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { ScrollArea } from"@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from"@/components/ui/sheet";
import { Separator } from"@/components/ui/separator";
import { Calendar, CheckCircle2, DollarSign, ExternalLink, Inbox, Info, Loader2, Mail, Megaphone, Target, XCircle } from "lucide-react";
import { toast } from"sonner";
import { getMerchantInvitations, respondToCampaignInvitation } from"@/services/api/brandCampaigns.service";
import { PawBucksLogo } from "@/components/PawBucksLogo";

interface MerchantBrandCampaignInboxProps {
 merchantId: string;
}

export function MerchantBrandCampaignInbox({ merchantId }: MerchantBrandCampaignInboxProps) {
 const queryClient = useQueryClient();
 const [selectedId, setSelectedId] = useState<string | null>(null);

 const { data: invitations = [], isLoading } = useQuery({
 queryKey: ["merchant-brand-invitations", merchantId],
 queryFn: async () => {
 const { data, error } = await getMerchantInvitations(merchantId);
 if (error) throw error;
 return data;
 },
 refetchInterval: 30000,
 });

 const respondMutation = useMutation({
 mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
 respondToCampaignInvitation(id, accept),
 onSuccess: (_, vars) => {
 toast.success(vars.accept ?"Joined campaign! 🎉" :"Invitation declined");
 queryClient.invalidateQueries({ queryKey: ["merchant-brand-invitations"] });
 },
 onError: (e: Error) => toast.error(e.message),
 });

 const pending = invitations.filter((i) => ["pending","sent"].includes(i.status));
 const history = invitations.filter((i) => !["pending","sent"].includes(i.status));

 const selected = invitations.find((i) => i.id === selectedId) || null;
 const selectedCampaign = (selected?.brand_campaigns ?? null) as
 | (Record<string, unknown> & {
 name?: string;
 description?: string | null;
 budget_usd?: number;
 pawbucks_pool?: number;
 pawbucks_per_checkin?: number;
 start_date?: string | null;
 end_date?: string | null;
 targeting_notes?: string | null;
 campaign_color?: string | null;
 brand_accounts?: {
 brand_name?: string;
 logo_url?: string | null;
 description?: string | null;
 website_url?: string | null;
 contact_email?: string | null;
 contact_name?: string | null;
 } | null;
 })
 | null;
 const selectedBrand = selectedCampaign?.brand_accounts ?? null;
 const isPending = selected ? ["pending","sent"].includes(selected.status) : false;

 return (
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <Inbox className="h-4 w-4 text-primary" /> Brand Campaign Invitations
 {pending.length > 0 && (
 <Badge className="bg-primary text-primary-foreground">{pending.length} new</Badge>
 )}
 </CardTitle>
 <CardDescription>Brands inviting your business to participate in funded PawBucks campaigns</CardDescription>
 </CardHeader>
 <CardContent>
 {isLoading ? (
 <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
 ) : invitations.length === 0 ? (
 <div className="py-8 text-center text-sm text-muted-foreground">
 <Megaphone className="h-10 w-10 mx-auto mb-2 opacity-40" aria-hidden="true" />
 No campaign invitations yet
 </div>
 ) : (
 <ScrollArea className="max-h-[500px] pr-2">
 <div className="space-y-3">
 {pending.map((inv) => {
 const brand = (inv.brand_campaigns as { brand_accounts?: { brand_name: string; logo_url: string | null } } | undefined)?.brand_accounts;
 return (
 <div
 key={inv.id}
 className="p-4 rounded-lg border-2 border-primary/30 bg-primary/5 space-y-3 cursor-pointer hover:bg-primary/10 transition-colors"
 onClick={() => setSelectedId(inv.id)}
 >
 <div className="flex items-start gap-3">
 {brand?.logo_url ? (
 <img src={brand.logo_url} alt={brand.brand_name} className="w-10 h-10 rounded-lg object-cover" />
 ) : (
 <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
 {brand?.brand_name?.charAt(0) ||"?"}
 </div>
 )}
 <div className="flex-1 min-w-0">
 <p className="font-semibold text-sm">{brand?.brand_name ||"Brand"}</p>
 <p className="text-xs text-muted-foreground">
 Campaign: <strong>{inv.brand_campaigns?.name ||"—"}</strong>
 </p>
 </div>
 <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); setSelectedId(inv.id); }}>
 <Info className="h-3.5 w-3.5 mr-1" /> Details
 </Button>
 </div>
 {inv.message && (
 <p className="text-sm italic text-muted-foreground border-l-2 border-primary/40 pl-3">
"{inv.message}"
 </p>
 )}
 <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
 <Button size="sm" className="flex-1" onClick={() => respondMutation.mutate({ id: inv.id, accept: true })} disabled={respondMutation.isPending}>
 <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Accept & Join
 </Button>
 <Button size="sm" variant="ghost" onClick={() => respondMutation.mutate({ id: inv.id, accept: false })} disabled={respondMutation.isPending}>
 <XCircle className="h-3.5 w-3.5 mr-1" /> Decline
 </Button>
 </div>
 </div>
 );
 })}
 {history.length > 0 && (
 <>
 <p className="text-xs uppercase tracking-wide text-muted-foreground pt-3">History</p>
 {history.map((inv) => (
 <div
 key={inv.id}
 className="flex items-center gap-3 p-3 rounded-lg border opacity-70 cursor-pointer hover:opacity-100 hover:bg-muted transition"
 onClick={() => setSelectedId(inv.id)}
 >
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium truncate">{inv.brand_campaigns?.name ||"Campaign"}</p>
 <p className="text-xs text-muted-foreground">
 {inv.responded_at ? new Date(inv.responded_at).toLocaleDateString() :""}
 </p>
 </div>
 <Badge variant={inv.status ==="accepted" ?"default" :"secondary"}>{inv.status}</Badge>
 </div>
 ))}
 </>
 )}
 </div>
 </ScrollArea>
 )}
 </CardContent>

 <Sheet open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
 <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
 {selected && (
 <>
 <SheetHeader className="space-y-3">
 <div className="flex items-center gap-3">
 {selectedBrand?.logo_url ? (
 <img src={selectedBrand.logo_url} alt={selectedBrand.brand_name} className="w-12 h-12 rounded-lg object-cover" />
 ) : (
 <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
 {selectedBrand?.brand_name?.charAt(0) ||"?"}
 </div>
 )}
 <div className="flex-1 min-w-0 text-left">
 <SheetTitle className="text-base truncate">{selectedBrand?.brand_name ||"Brand"}</SheetTitle>
 <SheetDescription className="text-left">
 <Badge variant={isPending ?"default" : selected.status ==="accepted" ?"secondary" :"outline"} className="mt-1">
 {selected.status}
 </Badge>
 </SheetDescription>
 </div>
 </div>
 </SheetHeader>

 <div className="mt-6 space-y-5">
 {/* Campaign header */}
 <div className="space-y-2">
 <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
 <Megaphone className="h-3.5 w-3.5" aria-hidden="true" /> Campaign
 </p>
 <h3 className="text-lg font-bold leading-tight" style={selectedCampaign?.campaign_color ? { color: selectedCampaign.campaign_color } : undefined}>
 {selectedCampaign?.name ||"—"}
 </h3>
 {selectedCampaign?.description && (
 <p className="text-sm text-muted-foreground">{selectedCampaign.description}</p>
 )}
 </div>

 {selected.message && (
 <>
 <Separator />
 <div className="space-y-2">
 <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
 <Mail className="h-3.5 w-3.5" aria-hidden="true" /> Personal Message
 </p>
 <p className="text-sm italic border-l-2 border-primary/40 pl-3">"{selected.message}"</p>
 </div>
 </>
 )}

 <Separator />

 {/* Terms grid */}
 <div className="space-y-3">
 <p className="text-xs uppercase tracking-wide text-muted-foreground">Terms & Rewards</p>
 <div className="grid grid-cols-2 gap-3">
 <div className="p-3 rounded-lg border bg-card">
 <p className="text-xs text-muted-foreground flex items-center gap-1"><PawBucksLogo className="h-3 w-3" /> Per Check-in</p>
 <p className="text-base font-bold mt-1">
 {selectedCampaign?.pawbucks_per_checkin?.toLocaleString() || 0} PB
 </p>
 </div>
 <div className="p-3 rounded-lg border bg-card">
 <p className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" aria-hidden="true" /> Total Budget</p>
 <p className="text-base font-bold mt-1">
 ${selectedCampaign?.budget_usd?.toLocaleString() || 0}
 </p>
 </div>
 <div className="p-3 rounded-lg border bg-card">
 <p className="text-xs text-muted-foreground flex items-center gap-1"><PawBucksLogo className="h-3 w-3" /> Pool Available</p>
 <p className="text-base font-bold mt-1">
 {selectedCampaign?.pawbucks_pool?.toLocaleString() || 0} PB
 </p>
 </div>
 <div className="p-3 rounded-lg border bg-card">
 <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" aria-hidden="true" /> Window</p>
 <p className="text-xs font-semibold mt-1">
 {selectedCampaign?.start_date ? new Date(selectedCampaign.start_date).toLocaleDateString() :"—"}
 {" →"}
 {selectedCampaign?.end_date ? new Date(selectedCampaign.end_date).toLocaleDateString() :"Open"}
 </p>
 </div>
 </div>
 </div>

 {selectedCampaign?.targeting_notes && (
 <>
 <Separator />
 <div className="space-y-2">
 <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
 <Target className="h-3.5 w-3.5" aria-hidden="true" /> Targeting Notes
 </p>
 <p className="text-sm">{selectedCampaign.targeting_notes}</p>
 </div>
 </>
 )}

 {(selectedBrand?.description || selectedBrand?.website_url || selectedBrand?.contact_email) && (
 <>
 <Separator />
 <div className="space-y-2">
 <p className="text-xs uppercase tracking-wide text-muted-foreground">About the Brand</p>
 {selectedBrand?.description && (
 <p className="text-sm text-muted-foreground">{selectedBrand.description}</p>
 )}
 <div className="flex flex-col gap-1 text-xs">
 {selectedBrand?.website_url && (
 <a href={selectedBrand.website_url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
 <ExternalLink className="h-3 w-3" /> {selectedBrand.website_url}
 </a>
 )}
 {selectedBrand?.contact_email && (
 <a href={`mailto:${selectedBrand.contact_email}`} className="text-primary hover:underline flex items-center gap-1">
 <Mail className="h-3 w-3" aria-hidden="true" /> {selectedBrand.contact_email}
 </a>
 )}
 </div>
 </div>
 </>
 )}

 <Separator />

 <div className="space-y-2">
 <p className="text-xs uppercase tracking-wide text-muted-foreground">Participation Terms</p>
 <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
 <li>Check-ins reward customers with branded PawBucks funded by the brand.</li>
 <li>Rewards stop automatically when the pool is depleted or the campaign ends.</li>
 <li>You may leave the campaign at any time from your dashboard.</li>
 <li>No upfront cost — the brand funds 100% of the rewards pool.</li>
 </ul>
 </div>

 {isPending ? (
 <div className="flex gap-2 pt-2 sticky bottom-0 bg-background pb-1">
 <Button
 className="flex-1"
 onClick={() => {
 respondMutation.mutate(
 { id: selected.id, accept: true },
 { onSuccess: () => setSelectedId(null) },
 );
 }}
 disabled={respondMutation.isPending}
 >
 <CheckCircle2 className="h-4 w-4 mr-1" /> Accept & Join
 </Button>
 <Button
 variant="outline"
 onClick={() => {
 respondMutation.mutate(
 { id: selected.id, accept: false },
 { onSuccess: () => setSelectedId(null) },
 );
 }}
 disabled={respondMutation.isPending}
 >
 <XCircle className="h-4 w-4 mr-1" /> Decline
 </Button>
 </div>
 ) : (
 <div className="text-xs text-muted-foreground pt-2">
 Responded {selected.responded_at ? new Date(selected.responded_at).toLocaleString() :""}
 </div>
 )}
 </div>
 </>
 )}
 </SheetContent>
 </Sheet>
 </Card>
 );
}
