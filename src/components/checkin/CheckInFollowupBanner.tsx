import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ShoppingBag, Clock, X, MessageSquare, Receipt, Send } from "lucide-react";
import { toast } from "sonner";
import { PartnerReceiptDialog } from "@/components/receipts/PartnerReceiptDialog";
import { NonPartnerReceiptDialog } from "@/components/receipts/NonPartnerReceiptDialog";

interface Followup {
  id: string;
  entity_name: string;
  merchant_id: string | null;
  vet_id: string | null;
  status: string;
  attempt_number: number;
}

interface CheckInFollowupBannerProps {
  userId: string;
}

export const CheckInFollowupBanner = ({ userId }: CheckInFollowupBannerProps) => {
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [showVisitPurpose, setShowVisitPurpose] = useState<string | null>(null);
  const [visitPurpose, setVisitPurpose] = useState("");
  const [showReceiptUpload, setShowReceiptUpload] = useState(false);
  const [activeFollowupForReceipt, setActiveFollowupForReceipt] = useState<Followup | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadFollowups();
  }, [userId]);

  const loadFollowups = async () => {
    const { data } = await supabase
      .from("checkin_followups")
      .select("id, entity_name, merchant_id, vet_id, status, attempt_number")
      .eq("user_id", userId)
      .eq("status", "notified")
      .order("created_at", { ascending: false });

    if (data) setFollowups(data);
  };

  const handleResponse = async (followupId: string, response: "yes" | "still_shopping" | "no") => {
    setRespondingTo(followupId);
    const followup = followups.find((f) => f.id === followupId);

    if (response === "yes") {
      // Mark as answered, then prompt receipt upload
      await supabase
        .from("checkin_followups")
        .update({ status: "answered", response: "yes", answered_at: new Date().toISOString() })
        .eq("id", followupId);

      setActiveFollowupForReceipt(followup || null);
      setShowReceiptUpload(true);
      setFollowups((prev) => prev.filter((f) => f.id !== followupId));
    } else if (response === "still_shopping") {
      // Create a new follow-up 30 min from now
      const newNotifyAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      await supabase
        .from("checkin_followups")
        .update({ status: "answered", response: "still_shopping", answered_at: new Date().toISOString() })
        .eq("id", followupId);

      // Insert new follow-up for 30 min later
      if (followup) {
        await supabase.from("checkin_followups").insert({
          checkin_id: (await supabase.from("checkin_followups").select("checkin_id").eq("id", followupId).single()).data?.checkin_id,
          user_id: userId,
          merchant_id: followup.merchant_id,
          vet_id: followup.vet_id,
          entity_name: followup.entity_name,
          notify_at: newNotifyAt,
          attempt_number: followup.attempt_number + 1,
        });
      }

      toast.success("No worries, keep shopping! We'll check back in 30 minutes.");
      setFollowups((prev) => prev.filter((f) => f.id !== followupId));
    } else if (response === "no") {
      setShowVisitPurpose(followupId);
    }

    setRespondingTo(null);
  };

  const handleSubmitVisitPurpose = async (followupId: string) => {
    if (!visitPurpose.trim()) {
      toast.error("Please tell us the purpose of your visit");
      return;
    }

    setSubmitting(true);
    await supabase
      .from("checkin_followups")
      .update({
        status: "answered",
        response: "no",
        visit_purpose: visitPurpose.trim(),
        answered_at: new Date().toISOString(),
      })
      .eq("id", followupId);

    toast.success("Thanks for letting us know!");
    setFollowups((prev) => prev.filter((f) => f.id !== followupId));
    setShowVisitPurpose(null);
    setVisitPurpose("");
    setSubmitting(false);
  };

  if (followups.length === 0 && !showReceiptUpload) return null;

  return (
    <>
      {followups.map((followup) => (
        <GradientCard key={followup.id} className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <ShoppingBag className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                Did you make a purchase at {followup.entity_name} today?
              </p>
              {followup.attempt_number > 1 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Just checking back in! 🐾
                </p>
              )}
            </div>
          </div>

          {showVisitPurpose === followup.id ? (
            <div className="space-y-3 pt-1">
              <Label className="text-sm">What was the purpose of your visit today?</Label>
              <Textarea
                placeholder="e.g., Just browsing, picking up a friend's order, vet appointment..."
                value={visitPurpose}
                onChange={(e) => setVisitPurpose(e.target.value)}
                rows={2}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowVisitPurpose(null);
                    setVisitPurpose("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSubmitVisitPurpose(followup.id)}
                  disabled={submitting}
                >
                  <Send className="w-3.5 h-3.5 mr-1" />
                  Submit
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleResponse(followup.id, "yes")}
                disabled={respondingTo === followup.id}
                className="flex-1"
              >
                <Receipt className="w-3.5 h-3.5 mr-1" />
                Yes
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleResponse(followup.id, "still_shopping")}
                disabled={respondingTo === followup.id}
                className="flex-1"
              >
                <Clock className="w-3.5 h-3.5 mr-1" />
                Still Shopping
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleResponse(followup.id, "no")}
                disabled={respondingTo === followup.id}
                className="flex-1"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                No
              </Button>
            </div>
          )}
        </GradientCard>
      ))}

      {/* Receipt upload dialogs */}
      {activeFollowupForReceipt?.merchant_id && (
        <PartnerReceiptDialog
          open={showReceiptUpload}
          onOpenChange={(open) => {
            setShowReceiptUpload(open);
            if (!open) setActiveFollowupForReceipt(null);
          }}
          userId={userId}
        />
      )}
      {activeFollowupForReceipt?.vet_id && (
        <NonPartnerReceiptDialog
          open={showReceiptUpload}
          onOpenChange={(open) => {
            setShowReceiptUpload(open);
            if (!open) setActiveFollowupForReceipt(null);
          }}
          userId={userId}
        />
      )}
    </>
  );
};
