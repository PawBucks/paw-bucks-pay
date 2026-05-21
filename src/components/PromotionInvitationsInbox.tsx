import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle2, Clock, DollarSign, Gift, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  getMerchantPromotionInvitations,
  getVetPromotionInvitations,
  respondToPromotionInvitation,
} from "@/services/api/platformPromotions.service";

import { Formatters } from "@/utils/formatters";
interface Props {
  recipientType: "merchant" | "vet";
  recipientId: string;
}

export function PromotionInvitationsInbox({ recipientType, recipientId }: Props) {
  const queryClient = useQueryClient();
  const queryKey = ["promotion-invitations-inbox", recipientType, recipientId];

  const { data: invitations = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const fetcher = recipientType === "merchant" ? getMerchantPromotionInvitations : getVetPromotionInvitations;
      const { data, error } = await fetcher(recipientId);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      const { error } = await respondToPromotionInvitation(id, accept);
      if (error) throw error;
      return accept;
    },
    onSuccess: (accept) => {
      toast.success(accept ? "Promotion accepted!" : "Invitation declined");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = invitations as any[];
  const pending = list.filter((i) => i.status === "pending");
  const past = list.filter((i) => i.status !== "pending");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Gift className="h-4 w-4 text-primary" aria-hidden="true" />
          Platform Promotions
          {pending.length > 0 && <Badge>{pending.length} new</Badge>}
        </CardTitle>
        <CardDescription>Special programs offered by PawBucks. Accept to opt in.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : list.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <Gift className="h-10 w-10 mx-auto mb-2 opacity-40" aria-hidden="true" />
            No promotion invitations yet. We'll notify you when one arrives.
          </div>
        ) : (
          <>
            {pending.map((i) => (
              <InvitationCard key={i.id} invitation={i}
                onAccept={() => respondMutation.mutate({ id: i.id, accept: true })}
                onDecline={() => respondMutation.mutate({ id: i.id, accept: false })}
                pending={respondMutation.isPending}
              />
            ))}
            {past.length > 0 && (
              <div className="pt-3 border-t space-y-2">
                <p className="text-xs uppercase text-muted-foreground tracking-wider">Past invitations</p>
                {past.map((i) => <InvitationCard key={i.id} invitation={i} readOnly />)}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function InvitationCard({
  invitation: i, onAccept, onDecline, pending, readOnly,
}: {
  invitation: any;
  onAccept?: () => void;
  onDecline?: () => void;
  pending?: boolean;
  readOnly?: boolean;
}) {
  const p = i.promotion;
  if (!p) return null;

  const statusBadge = i.status === "accepted" ? (
    <Badge className="bg-[hsl(var(--success))] text-white"><CheckCircle2 className="h-3 w-3 mr-1" /> Accepted</Badge>
  ) : i.status === "declined" ? (
    <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" /> Declined</Badge>
  ) : (
    <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" aria-hidden="true" /> Pending</Badge>
  );

  return (
    <div className="p-4 rounded-lg border bg-card space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{p.title}</p>
          {p.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{p.description}</p>}
        </div>
        {statusBadge}
      </div>

      {p.perks && (
        <div className="text-xs bg-muted/50 rounded p-2">
          <p className="font-medium mb-0.5">What you get</p>
          <p className="text-muted-foreground whitespace-pre-line">{p.perks}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {p.reward_amount_usd != null && (
          <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" aria-hidden="true" /> {Formatters.currency(Number(p.reward_amount_usd))}</span>
        )}
        {p.end_date && (
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" aria-hidden="true" /> Ends {new Date(p.end_date).toLocaleDateString()}</span>
        )}
      </div>

      {i.message && (
        <p className="text-xs italic text-muted-foreground border-l-2 pl-2">"{i.message}"</p>
      )}

      {!readOnly && i.status === "pending" && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={onAccept} disabled={pending}>
            {pending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
            Accept
          </Button>
          <Button size="sm" variant="outline" onClick={onDecline} disabled={pending}>
            <XCircle className="h-3 w-3 mr-1" /> Decline
          </Button>
        </div>
      )}
    </div>
  );
}