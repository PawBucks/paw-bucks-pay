import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Send, Stethoscope, Store, Users } from "lucide-react";
import { toast } from "sonner";
import { bulkInviteToPromotion, searchMerchants, searchPartnerVets, type PlatformPromotion } from "@/services/api/platformPromotions.service";

interface Props {
  promotion: PlatformPromotion;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function PromotionInviteDialog({ promotion, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const allowMerchants = promotion.recipient_type === "merchant" || promotion.recipient_type === "both";
  const allowVets = promotion.recipient_type === "vet" || promotion.recipient_type === "both";

  const [tab, setTab] = useState<"merchant" | "vet">(allowMerchants ? "merchant" : "vet");
  const [scope, setScope] = useState<"all" | "specific">("specific");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, Set<string>>>({ merchant: new Set(), vet: new Set() });
  const [message, setMessage] = useState("");

  const { data: merchants = [], isLoading: lm } = useQuery({
    queryKey: ["promo-search-merchants", search],
    queryFn: async () => {
      const { data, error } = await searchMerchants(search);
      if (error) throw error;
      return data || [];
    },
    enabled: tab === "merchant" && scope === "specific",
  });

  const { data: vets = [], isLoading: lv } = useQuery({
    queryKey: ["promo-search-vets", search],
    queryFn: async () => {
      const { data, error } = await searchPartnerVets(search);
      if (error) throw error;
      return data || [];
    },
    enabled: tab === "vet" && scope === "specific",
  });

  const toggle = (kind: "merchant" | "vet", id: string) => {
    setSelected((prev) => {
      const next = new Set(prev[kind]);
      next.has(id) ? next.delete(id) : next.add(id);
      return { ...prev, [kind]: next };
    });
  };

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected[tab]);
      if (scope === "specific" && ids.length === 0) throw new Error("Select at least one recipient");
      const { data, error } = await bulkInviteToPromotion({
        promotion_id: promotion.id,
        recipient_type: tab,
        scope,
        recipient_ids: scope === "specific" ? ids : undefined,
        message: message.trim() || undefined,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      const row = Array.isArray(data) ? data[0] : data;
      const invited = row?.invited ?? 0;
      const skipped = row?.skipped ?? 0;
      toast.success(`Invited ${invited} ${tab}${invited === 1 ? "" : "s"}`, {
        description: skipped > 0 ? `${skipped} skipped (already invited)` : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["promotion-invitations", promotion.id] });
      setSelected({ merchant: new Set(), vet: new Set() });
      setMessage("");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Send className="h-4 w-4" /> Invite to "{promotion.title}"</DialogTitle>
          <DialogDescription>Send invitations to merchants and/or vets. Recipients can accept or decline from their dashboard.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => { setTab(v as any); setSearch(""); }}>
          <TabsList>
            {allowMerchants && <TabsTrigger value="merchant"><Store className="h-3 w-3 mr-1" aria-hidden="true" /> Merchants</TabsTrigger>}
            {allowVets && <TabsTrigger value="vet"><Stethoscope className="h-3 w-3 mr-1" aria-hidden="true" /> Vets</TabsTrigger>}
          </TabsList>

          {(["merchant", "vet"] as const).map((kind) => (
            <TabsContent key={kind} value={kind} className="space-y-3">
              <div className="flex gap-2">
                <Button size="sm" variant={scope === "all" ? "default" : "outline"} onClick={() => setScope("all")}>
                  <Users className="h-3 w-3 mr-1" aria-hidden="true" /> All {kind}s
                </Button>
                <Button size="sm" variant={scope === "specific" ? "default" : "outline"} onClick={() => setScope("specific")}>
                  Pick specific
                </Button>
                {scope === "specific" && (
                  <Badge variant="secondary" className="ml-auto">
                    {selected[kind].size} selected
                  </Badge>
                )}
              </div>

              {scope === "specific" && (
                <>
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-9" placeholder={`Search ${kind}s…`} value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                  <ScrollArea className="h-64 rounded-md border">
                    <div className="p-2 space-y-1">
                      {(kind === "merchant" ? lm : lv) ? (
                        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                      ) : (kind === "merchant" ? merchants : vets).length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No {kind}s found</p>
                      ) : (
                        (kind === "merchant" ? merchants : vets).map((r: any) => {
                          const id = r.id as string;
                          const name = kind === "merchant" ? r.business_name : (r.clinic_name || r.name);
                          const sub = kind === "merchant" ? r.email : r.contact_email;
                          const checked = selected[kind].has(id);
                          return (
                            <label key={id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer">
                              <Checkbox checked={checked} onCheckedChange={() => toggle(kind, id)} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{name}</p>
                                {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </>
              )}

              {scope === "all" && (
                <div className="p-3 rounded-md bg-muted text-sm">
                  This will send the invitation to <strong>every {kind}</strong> on the platform. Recipients already invited will be skipped.
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        <div className="space-y-1.5">
          <Label>Message (optional)</Label>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Add a personal note for the recipients…" />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => inviteMutation.mutate()} disabled={inviteMutation.isPending}>
            {inviteMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            Send Invitations
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}