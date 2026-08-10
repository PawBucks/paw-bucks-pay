import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Ticket, XCircle } from "lucide-react";
import { toast } from "sonner";

interface RedeemOfferCodeDialogProps {
  /** Optional offer context (used as a fallback when the code has no offer link) */
  offerId?: string;
  onRedeemed?: () => void;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "secondary" | "ghost";
}

type Result =
  | { ok: true; offerTitle: string | null; userName: string; coinsSpent: number }
  | { ok: false; message: string };

const CODE_PATTERN = /^PBK-[A-Z0-9]{8}$/;

function normalizeCode(raw: string) {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = cleaned.startsWith("PBK") ? cleaned.slice(3) : cleaned;
  return body.length ? `PBK-${body.slice(0, 8)}` : "";
}

export function RedeemOfferCodeDialog({
  offerId,
  onRedeemed,
  triggerLabel = "Redeem Code",
  triggerVariant = "outline",
}: RedeemOfferCodeDialogProps) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const reset = () => {
    setCode("");
    setResult(null);
    setSubmitting(false);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  const handleRedeem = async () => {
    const formatted = normalizeCode(code);
    if (!CODE_PATTERN.test(formatted)) {
      setResult({ ok: false, message: "Enter a full code in the format PBK-XXXXXXXX." });
      return;
    }

    setSubmitting(true);
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Your session expired. Please sign in again.");

      const { data, error } = await supabase.functions.invoke("merchant-confirm-redemption", {
        body: { redemption_code: formatted, offer_id: offerId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      // Edge function returns 400 with { error } for invalid/used codes.
      const payloadError = (data as { error?: string } | null)?.error;
      if (error || payloadError) {
        let message = payloadError || error?.message || "Unable to redeem this code.";
        if (error && !payloadError) {
          try {
            const ctx = (error as { context?: Response }).context;
            if (ctx && typeof ctx.json === "function") {
              const body = await ctx.json();
              if (body?.error) message = body.error;
            }
          } catch {
            /* keep default message */
          }
        }
        setResult({ ok: false, message });
        return;
      }

      setResult({
        ok: true,
        offerTitle: data?.offer_title ?? null,
        userName: data?.user_name ?? "Customer",
        coinsSpent: data?.coins_spent ?? 0,
      });
      setCode("");
      toast.success("Redemption confirmed");
      onRedeemed?.();
    } catch (err) {
      setResult({
        ok: false,
        message: err instanceof Error ? err.message : "Unable to redeem this code.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant}>
          <Ticket className="mr-2 h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Redeem a customer code</DialogTitle>
          <DialogDescription>
            Enter the redemption code shown in the customer's PawBucks app to mark the offer as redeemed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="redemption-code">Redemption code</Label>
          <Input
            id="redemption-code"
            value={code}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            placeholder="PBK-XXXXXXXX"
            className="font-mono tracking-widest uppercase"
            onChange={(e) => setCode(normalizeCode(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !submitting) handleRedeem();
            }}
          />
          <p className="text-xs text-muted-foreground">
            Codes always start with PBK- followed by 8 characters.
          </p>
        </div>

        {result && (
          <Alert variant={result.ok ? "default" : "destructive"}>
            <AlertDescription className="flex items-start gap-2">
              {result.ok ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
              )}
              <span>
                {result.ok ? (
                  <>
                    <strong>Redeemed</strong> — {result.offerTitle || "Offer"} for {result.userName}
                    {result.coinsSpent > 0 && <> ({result.coinsSpent.toLocaleString()} PB)</>}
                  </>
                ) : (
                  result.message
                )}
              </span>
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleRedeem} disabled={submitting || code.length < 12}>
            {submitting ? "Redeeming..." : "Confirm Redemption"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
