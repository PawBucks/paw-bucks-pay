import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Plus, Send, Archive, Edit, CheckCircle2, XCircle, Inbox } from "lucide-react";
import { toast } from "sonner";
import {
  listPromotions,
  createPromotion,
  updatePromotion,
  archivePromotion,
  listInvitationsForPromotion,
  type PlatformPromotion,
  type RecipientType,
  type PromotionStatus,
} from "@/services/api/platformPromotions.service";
import { PromotionInviteDialog } from "./PromotionInviteDialog";
import { PromotionInvitationsLog } from "./PromotionInvitationsLog";

import { Formatters } from "@/utils/formatters";
const emptyForm = {
  title: "",
  description: "",
  perks: "",
  reward_amount_usd: "",
  recipient_type: "both" as RecipientType,
  status: "active" as PromotionStatus,
  start_date: "",
  end_date: "",
};

export function PromotionsTab() {
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformPromotion | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [inviteFor, setInviteFor] = useState<PlatformPromotion | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: promotions = [], isLoading } = useQuery({
    queryKey: ["platform-promotions"],
    queryFn: async () => {
      const { data, error } = await listPromotions();
      if (error) throw error;
      return (data || []) as unknown as PlatformPromotion[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Title is required");
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        perks: form.perks.trim() || null,
        reward_amount_usd: form.reward_amount_usd ? Number(form.reward_amount_usd) : null,
        recipient_type: form.recipient_type,
        status: form.status,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      };
      const { error } = editing
        ? await updatePromotion(editing.id, payload as any)
        : await createPromotion(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editing ? "Promotion updated" : "Promotion created");
      queryClient.invalidateQueries({ queryKey: ["platform-promotions"] });
      setEditorOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await archivePromotion(id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Promotion archived");
      queryClient.invalidateQueries({ queryKey: ["platform-promotions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setEditorOpen(true);
  };

  const openEdit = (p: PlatformPromotion) => {
    setEditing(p);
    setForm({
      title: p.title,
      description: p.description ?? "",
      perks: p.perks ?? "",
      reward_amount_usd: p.reward_amount_usd ? String(p.reward_amount_usd) : "",
      recipient_type: p.recipient_type,
      status: p.status,
      start_date: p.start_date ?? "",
      end_date: p.end_date ?? "",
    });
    setEditorOpen(true);
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="promotions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="promotions"><span className="h-4 w-4 mr-1" aria-hidden="true">📣</span> Promotions</TabsTrigger>
          <TabsTrigger value="invitations"><Inbox className="h-4 w-4 mr-1" /> Sent Invitations</TabsTrigger>
        </TabsList>

        <TabsContent value="promotions" className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><span className="h-5 w-5 text-primary" aria-hidden="true">📣</span> Platform Promotions</CardTitle>
            <CardDescription>
              Create promotions and invite Merchants and Vets to opt in. Recipients can accept or decline from their dashboards.
            </CardDescription>
          </div>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> New Promotion</Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : promotions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <span className="h-10 w-10 mx-auto mb-2 opacity-40" aria-hidden="true">📣</span>
              <p>No promotions yet. Create one to start inviting partners.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {promotions.map((p) => (
                <PromotionRow
                  key={p.id}
                  promotion={p}
                  expanded={expanded === p.id}
                  onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
                  onEdit={() => openEdit(p)}
                  onArchive={() => archiveMutation.mutate(p.id)}
                  onInvite={() => setInviteFor(p)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="invitations">
          <PromotionInvitationsLog />
        </TabsContent>
      </Tabs>

      {/* Editor */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Promotion" : "Create Promotion"}</DialogTitle>
            <DialogDescription>Define the offer Merchants and/or Vets will be invited to.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Founding 50 Partner Program" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What is this promotion about?" />
            </div>
            <div className="space-y-1.5">
              <Label>Perks / Benefits</Label>
              <Textarea rows={3} value={form.perks} onChange={(e) => setForm({ ...form, perks: e.target.value })} placeholder="What does the partner receive if they accept?" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Reward (USD, optional)</Label>
                <Input type="number" step="0.01" min="0" value={form.reward_amount_usd}
                  onChange={(e) => setForm({ ...form, reward_amount_usd: e.target.value })} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label>Recipients</Label>
                <Select value={form.recipient_type} onValueChange={(v: RecipientType) => setForm({ ...form, recipient_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Merchants & Vets</SelectItem>
                    <SelectItem value="merchant">Merchants only</SelectItem>
                    <SelectItem value="vet">Vets only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Start date</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>End date</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v: PromotionStatus) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editing ? "Save changes" : "Create promotion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {inviteFor && (
        <PromotionInviteDialog
          promotion={inviteFor}
          open={!!inviteFor}
          onOpenChange={(o) => !o && setInviteFor(null)}
        />
      )}
    </div>
  );
}

function PromotionRow({
  promotion: p,
  expanded,
  onToggle,
  onEdit,
  onArchive,
  onInvite,
}: {
  promotion: PlatformPromotion;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onInvite: () => void;
}) {
  const { data: invitations = [] } = useQuery({
    queryKey: ["promotion-invitations", p.id],
    queryFn: async () => {
      const { data, error } = await listInvitationsForPromotion(p.id);
      if (error) throw error;
      return data || [];
    },
    enabled: expanded,
  });

  const counts = (invitations as any[]).reduce(
    (acc, i) => {
      acc[i.status] = (acc[i.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const statusColor =
    p.status === "active" ? "bg-[hsl(var(--success))] text-white"
    : p.status === "archived" ? "bg-muted text-muted-foreground"
    : "bg-secondary text-secondary-foreground";

  return (
    <div className="rounded-lg border bg-card">
      <div className="p-4 flex items-start justify-between gap-3">
        <button onClick={onToggle} className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold truncate">{p.title}</p>
            <Badge className={statusColor}>{p.status}</Badge>
            <Badge variant="outline" className="capitalize">{p.recipient_type === "both" ? "Merchants & Vets" : p.recipient_type}</Badge>
            {p.reward_amount_usd != null && (
              <Badge variant="secondary">{Formatters.currency(Number(p.reward_amount_usd))}</Badge>
            )}
          </div>
          {p.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
        </button>
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <Button size="sm" onClick={onInvite} disabled={p.status !== "active"}>
            <Send className="h-3 w-3 mr-1" /> Invite
          </Button>
          <Button size="sm" variant="outline" onClick={onEdit}><Edit className="h-3 w-3 mr-1" /> Edit</Button>
          {p.status !== "archived" && (
            <Button size="sm" variant="ghost" onClick={onArchive}><Archive className="h-3 w-3 mr-1" /> Archive</Button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="border-t p-4 space-y-2 text-sm">
          <div className="flex gap-3 flex-wrap">
            <Badge variant="secondary"><span className="h-3 w-3 mr-1" aria-hidden="true">⏰</span> Pending: {counts.pending || 0}</Badge>
            <Badge className="bg-[hsl(var(--success))] text-white"><CheckCircle2 className="h-3 w-3 mr-1" /> Accepted: {counts.accepted || 0}</Badge>
            <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" /> Declined: {counts.declined || 0}</Badge>
          </div>
          {(invitations as any[]).length === 0 ? (
            <p className="text-muted-foreground">No invitations sent yet.</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-auto">
              {(invitations as any[]).map((i) => (
                <div key={i.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/50">
                  <span className="capitalize">{i.recipient_type} · {i.recipient_id.slice(0, 8)}…</span>
                  <Badge variant={i.status === "accepted" ? "default" : i.status === "declined" ? "outline" : "secondary"}>
                    {i.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}