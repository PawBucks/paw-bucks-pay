import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowRight, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Row = {
  id: string;
  merchant_id: string;
  current_fee_model: string;
  requested_fee_model: string;
  reason: string | null;
  created_at: string;
  merchants?: { business_name: string; email: string | null } | null;
};

const label = (m: string) =>
  m === "acquisition_only" ? "Acquisition-Only" : "Full Ecosystem";

export function AccountTypeChangeRequestsPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [denyTarget, setDenyTarget] = useState<Row | null>(null);
  const [denyNotes, setDenyNotes] = useState("");
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("merchant_account_type_change_requests")
      .select("id, merchant_id, current_fee_model, requested_fee_model, reason, created_at, merchants(business_name, email)")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (row: Row) => {
    setWorking(true);
    try {
      // Apply the change via the existing admin update flow
      const { error: fnErr } = await supabase.functions.invoke("admin-update-merchant", {
        body: { merchantId: row.merchant_id, feeModel: row.requested_fee_model },
      });
      if (fnErr) throw fnErr;
      // Trigger will mark request approved automatically; ensure reviewed_by is set
      const { data: userRes } = await supabase.auth.getUser();
      await supabase
        .from("merchant_account_type_change_requests")
        .update({
          reviewed_by: userRes.user?.id ?? null,
          reviewed_at: new Date().toISOString(),
          status: "approved",
        })
        .eq("id", row.id);
      toast.success("Account type change applied");
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to apply change");
    } finally {
      setWorking(false);
    }
  };

  const deny = async () => {
    if (!denyTarget) return;
    setWorking(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("merchant_account_type_change_requests")
        .update({
          status: "denied",
          admin_notes: denyNotes.trim() || null,
          reviewed_by: userRes.user?.id ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", denyTarget.id);
      if (error) throw error;
      toast.success("Request denied");
      setDenyTarget(null);
      setDenyNotes("");
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to deny");
    } finally {
      setWorking(false);
    }
  };

  if (!loading && rows.length === 0) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold">Account Type Change Requests</h3>
          <p className="text-sm text-muted-foreground">
            Pending merchant requests to switch fee model
          </p>
        </div>
        <Badge variant="secondary">{rows.length} pending</Badge>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 border rounded-md"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">
                {r.merchants?.business_name || r.merchant_id}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                <Badge variant="outline">{label(r.current_fee_model)}</Badge>
                <ArrowRight className="w-3 h-3" />
                <Badge>{label(r.requested_fee_model)}</Badge>
                <span className="text-xs">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              </div>
              {r.reason && (
                <p className="text-sm mt-1 text-muted-foreground italic">"{r.reason}"</p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDenyTarget(r)}
                disabled={working}
              >
                <X className="w-4 h-4 mr-1" /> Deny
              </Button>
              <Button size="sm" onClick={() => approve(r)} disabled={working}>
                <Check className="w-4 h-4 mr-1" /> Approve & Apply
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!denyTarget} onOpenChange={(o) => !o && setDenyTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deny Change Request</DialogTitle>
            <DialogDescription>
              Optionally include a note explaining the decision.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={denyNotes}
            onChange={(e) => setDenyNotes(e.target.value)}
            placeholder="Reason for denial (optional)"
            rows={4}
            maxLength={1000}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDenyTarget(null)} disabled={working}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deny} disabled={working}>
              {working ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirm Denial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}