import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Inbox, CheckCircle2, XCircle, Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { getMerchantInvitations, respondToCampaignInvitation } from "@/services/api/brandCampaigns.service";

interface MerchantBrandCampaignInboxProps {
  merchantId: string;
}

export function MerchantBrandCampaignInbox({ merchantId }: MerchantBrandCampaignInboxProps) {
  const queryClient = useQueryClient();

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
      toast.success(vars.accept ? "Joined campaign! 🎉" : "Invitation declined");
      queryClient.invalidateQueries({ queryKey: ["merchant-brand-invitations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = invitations.filter((i) => ["pending", "sent"].includes(i.status));
  const history = invitations.filter((i) => !["pending", "sent"].includes(i.status));

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
            <Megaphone className="h-10 w-10 mx-auto mb-2 opacity-40" />
            No campaign invitations yet
          </div>
        ) : (
          <ScrollArea className="max-h-[500px] pr-2">
            <div className="space-y-3">
              {pending.map((inv) => {
                const brand = (inv.brand_campaigns as { brand_accounts?: { brand_name: string; logo_url: string | null } } | undefined)?.brand_accounts;
                return (
                  <div key={inv.id} className="p-4 rounded-lg border-2 border-primary/30 bg-primary/5 space-y-3">
                    <div className="flex items-start gap-3">
                      {brand?.logo_url ? (
                        <img src={brand.logo_url} alt={brand.brand_name} className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
                          {brand?.brand_name?.charAt(0) || "?"}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{brand?.brand_name || "Brand"}</p>
                        <p className="text-xs text-muted-foreground">
                          Campaign: <strong>{inv.brand_campaigns?.name || "—"}</strong>
                        </p>
                      </div>
                    </div>
                    {inv.message && (
                      <p className="text-sm italic text-muted-foreground border-l-2 border-primary/40 pl-3">
                        "{inv.message}"
                      </p>
                    )}
                    <div className="flex gap-2">
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
                    <div key={inv.id} className="flex items-center gap-3 p-3 rounded-lg border opacity-70">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{inv.brand_campaigns?.name || "Campaign"}</p>
                        <p className="text-xs text-muted-foreground">
                          {inv.responded_at ? new Date(inv.responded_at).toLocaleDateString() : ""}
                        </p>
                      </div>
                      <Badge variant={inv.status === "accepted" ? "default" : "secondary"}>{inv.status}</Badge>
                    </div>
                  ))}
                </>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
