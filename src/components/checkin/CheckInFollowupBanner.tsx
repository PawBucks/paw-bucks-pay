import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShoppingBag, Clock, X, Receipt, DollarSign, Upload, Check, Eye, Search, Tag, Info } from "lucide-react";
import { toast } from "sonner";
import { PartnerReceiptDialog } from "@/components/receipts/PartnerReceiptDialog";
import { NonPartnerReceiptDialog } from "@/components/receipts/NonPartnerReceiptDialog";
import { useSubscription } from "@/hooks/useSubscription";
import { getSubscriptionTier } from "@/lib/constants";

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

const NO_PURCHASE_REASONS = [
  { label: "Just browsing", icon: Eye, value: "browsing" },
  { label: "Price too high", icon: Tag, value: "price_too_high" },
  { label: "Didn't find what I wanted", icon: Search, value: "not_found" },
  { label: "Just picking up info", icon: Info, value: "picking_up_info" },
];

export const CheckInFollowupBanner = ({ userId }: CheckInFollowupBannerProps) => {
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [showSpendInput, setShowSpendInput] = useState<string | null>(null);
  const [spendAmount, setSpendAmount] = useState("");
  const [showNoPurchase, setShowNoPurchase] = useState<string | null>(null);
  const [showReceiptUpload, setShowReceiptUpload] = useState(false);
  const [activeFollowupForReceipt, setActiveFollowupForReceipt] = useState<Followup | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [creditedFollowup, setCreditedFollowup] = useState<{ id: string; amount: number; pawbucks: number } | null>(null);
  const { subscription } = useSubscription();

  const currentTier = getSubscriptionTier(subscription.product_id, subscription.subscription_tier);

  const getPBPerDollar = () => {
    if (currentTier === "pawpass_plus") return 30;
    if (currentTier === "pawpass") return 20;
    return 10;
  };

  const getTierLabel = () => {
    if (currentTier === "pawpass_plus") return "PawPass+";
    if (currentTier === "pawpass") return "PawPass";
    return "Free";
  };

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

  const handleYes = (followupId: string) => {
    setShowSpendInput(followupId);
    setShowNoPurchase(null);
    setSpendAmount("");
  };

  const handleSubmitSpend = async (followupId: string) => {
    const amount = parseFloat(spendAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setSubmitting(true);
    const followup = followups.find((f) => f.id === followupId);
    const pbPerDollar = getPBPerDollar();
    const estimatedPB = Math.floor(amount * pbPerDollar);

    // Mark followup as answered
    await supabase
      .from("checkin_followups")
      .update({ status: "answered", response: "yes", answered_at: new Date().toISOString() })
      .eq("id", followupId);

    // Issue provisional credit instantly
    const { error: creditError } = await supabase.from("pawbucks_activity").insert({
      user_id: userId,
      type: "earn",
      amount: estimatedPB,
      source: "checkin_provisional",
      description: `Provisional credit — ${followup?.entity_name} ($${amount.toFixed(2)})`,
      pawbucks_status: "pending",
      vest_date: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), // 72hr admin review window
    });

    if (creditError) {
      console.error("Failed to issue provisional credit:", creditError);
      toast.error("Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    // Show success with receipt prompt
    setCreditedFollowup({ id: followupId, amount, pawbucks: estimatedPB });
    setActiveFollowupForReceipt(followup || null);
    setFollowups((prev) => prev.filter((f) => f.id !== followupId));
    setShowSpendInput(null);
    setSpendAmount("");
    setSubmitting(false);

    toast.success(`🎉 +${estimatedPB.toLocaleString()} PawBucks credited provisionally!`);
  };

  const handleStillShopping = async (followupId: string) => {
    setRespondingTo(followupId);
    const followup = followups.find((f) => f.id === followupId);

    // 15 min follow-up
    const newNotifyAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await supabase
      .from("checkin_followups")
      .update({ status: "answered", response: "still_shopping", answered_at: new Date().toISOString() })
      .eq("id", followupId);

    if (followup) {
      const { data: followupData } = await supabase
        .from("checkin_followups")
        .select("checkin_id")
        .eq("id", followupId)
        .single();

      await supabase.from("checkin_followups").insert({
        checkin_id: followupData?.checkin_id,
        user_id: userId,
        merchant_id: followup.merchant_id,
        vet_id: followup.vet_id,
        entity_name: followup.entity_name,
        notify_at: newNotifyAt,
        attempt_number: followup.attempt_number + 1,
      });
    }

    toast.success("No worries, keep shopping! We'll check back in 15 minutes. 🐾");
    setFollowups((prev) => prev.filter((f) => f.id !== followupId));
    setRespondingTo(null);
  };

  const handleNo = (followupId: string) => {
    setShowNoPurchase(followupId);
    setShowSpendInput(null);
  };

  const handleSelectReason = async (followupId: string, reason: string) => {
    setSubmitting(true);
    await supabase
      .from("checkin_followups")
      .update({
        status: "answered",
        response: "no",
        visit_purpose: reason,
        answered_at: new Date().toISOString(),
      })
      .eq("id", followupId);

    toast.success("Thanks for letting us know!");
    setFollowups((prev) => prev.filter((f) => f.id !== followupId));
    setShowNoPurchase(null);
    setSubmitting(false);
  };

  const estimatedPB = spendAmount ? Math.floor(parseFloat(spendAmount || "0") * getPBPerDollar()) : 0;

  if (followups.length === 0 && !showReceiptUpload && !creditedFollowup) return null;

  return (
    <>
      {/* Post-credit receipt prompt */}
      {creditedFollowup && !showReceiptUpload && (
        <GradientCard className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Check className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-primary">
                +{creditedFollowup.pawbucks.toLocaleString()} PawBucks credited! 🎉
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Provisional credit for ${creditedFollowup.amount.toFixed(2)} • Admin will verify within 72 hours
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => setShowReceiptUpload(true)}
              className="flex-1"
            >
              <Upload className="w-3.5 h-3.5 mr-1" />
              Upload Receipt (Recommended)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setCreditedFollowup(null);
                setActiveFollowupForReceipt(null);
              }}
              className="flex-1"
            >
              Skip for Now
            </Button>
          </div>
        </GradientCard>
      )}

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

          {/* Spend amount input (Yes path) */}
          {showSpendInput === followup.id ? (
            <div className="space-y-3 pt-1">
              <Label className="text-sm font-medium">How much did you spend?</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={spendAmount}
                  onChange={(e) => setSpendAmount(e.target.value)}
                  className="pl-8"
                  autoFocus
                />
              </div>
              {estimatedPB > 0 && (
                <div className="bg-primary/10 rounded-lg px-3 py-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Estimated PawBucks ({getTierLabel()} • {getPBPerDollar()} PB/$1)</span>
                  <span className="text-sm font-bold text-primary">+{estimatedPB.toLocaleString()} PB</span>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowSpendInput(null);
                    setSpendAmount("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSubmitSpend(followup.id)}
                  disabled={submitting || !spendAmount || parseFloat(spendAmount) <= 0}
                  className="flex-1"
                >
                  <Receipt className="w-3.5 h-3.5 mr-1" />
                  Claim PawBucks
                </Button>
              </div>
            </div>
          ) : showNoPurchase === followup.id ? (
            /* No purchase reason selection */
            <div className="space-y-2 pt-1">
              <Label className="text-sm font-medium">What was the purpose of your visit?</Label>
              <div className="grid grid-cols-2 gap-2">
                {NO_PURCHASE_REASONS.map((reason) => (
                  <Button
                    key={reason.value}
                    size="sm"
                    variant="outline"
                    onClick={() => handleSelectReason(followup.id, reason.value)}
                    disabled={submitting}
                    className="justify-start text-xs h-9"
                  >
                    <reason.icon className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                    {reason.label}
                  </Button>
                ))}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowNoPurchase(null)}
                className="w-full text-xs"
              >
                Cancel
              </Button>
            </div>
          ) : (
            /* Main action buttons */
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleYes(followup.id)}
                disabled={respondingTo === followup.id}
                className="flex-1"
              >
                <Receipt className="w-3.5 h-3.5 mr-1" />
                Yes
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStillShopping(followup.id)}
                disabled={respondingTo === followup.id}
                className="flex-1"
              >
                <Clock className="w-3.5 h-3.5 mr-1" />
                Still Shopping
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleNo(followup.id)}
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
            if (!open) {
              setActiveFollowupForReceipt(null);
              setCreditedFollowup(null);
            }
          }}
          userId={userId}
        />
      )}
      {activeFollowupForReceipt?.vet_id && (
        <NonPartnerReceiptDialog
          open={showReceiptUpload}
          onOpenChange={(open) => {
            setShowReceiptUpload(open);
            if (!open) {
              setActiveFollowupForReceipt(null);
              setCreditedFollowup(null);
            }
          }}
          userId={userId}
        />
      )}
    </>
  );
};
