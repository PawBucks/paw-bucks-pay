import { useEffect, useMemo, useState } from "react";
import { GradientCard } from "@/components/ui/gradient-card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Info, Loader2, Shield, Sparkles } from "lucide-react";

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  PAWBUCKS_BASE_CAP_OPTIONS,
  PAWBUCKS_PROMO_CAP_MAX,
  defaultPawBucksCapPct,
  effectivePawBucksCapPct,
  isPromoActive,
} from "@/lib/pawbucksCap";

type Props = {
  merchantId: string;
  businessType: string;
  acceptsPawbucks: boolean;
  capEnabled: boolean;
  capPct: number | null;
  promoCapPct: number | null;
  promoStartsAt: string | null;
  promoEndsAt: string | null;
  onUpdated?: () => void;
};

// Convert ISO string ↔ value for <input type="datetime-local">
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

export function PawBucksCapCard({
  merchantId,
  businessType,
  acceptsPawbucks,
  capEnabled,
  capPct,
  promoCapPct,
  promoStartsAt,
  promoEndsAt,
  onUpdated,
}: Props) {
  const [enabled, setEnabled] = useState(capEnabled);
  const [pct, setPct] = useState<number | null>(capPct);
  const [showPromo, setShowPromo] = useState(!!promoCapPct);
  const [pPct, setPPct] = useState<number | "">(promoCapPct ?? "");
  const [pStart, setPStart] = useState<string>(toLocalInput(promoStartsAt));
  const [pEnd, setPEnd] = useState<string>(toLocalInput(promoEndsAt));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEnabled(capEnabled);
    setPct(capPct);
    setShowPromo(!!promoCapPct);
    setPPct(promoCapPct ?? "");
    setPStart(toLocalInput(promoStartsAt));
    setPEnd(toLocalInput(promoEndsAt));
  }, [capEnabled, capPct, promoCapPct, promoStartsAt, promoEndsAt]);

  const typeDefault = defaultPawBucksCapPct(businessType);
  const effectiveBase = pct ?? typeDefault;

  const merchantSnap = useMemo(
    () => ({
      business_type: businessType,
      pawbucks_cap_enabled: enabled,
      pawbucks_cap_pct: pct,
      pawbucks_promo_cap_pct:
        showPromo && typeof pPct === "number" ? pPct : null,
      pawbucks_promo_starts_at: showPromo ? fromLocalInput(pStart) : null,
      pawbucks_promo_ends_at: showPromo ? fromLocalInput(pEnd) : null,
    }),
    [enabled, pct, showPromo, pPct, pStart, pEnd, businessType]
  );
  const liveCap = effectivePawBucksCapPct(merchantSnap);
  const promoLive = isPromoActive(merchantSnap);

  const handleSave = async () => {
    // Client-side validation mirrors server trigger
    if (showPromo) {
      if (typeof pPct !== "number" || pPct < 10 || pPct > PAWBUCKS_PROMO_CAP_MAX) {
        toast.error(`Promo cap must be between 10% and ${PAWBUCKS_PROMO_CAP_MAX}%`);
        return;
      }
      if (!pStart || !pEnd) {
        toast.error("Promo requires both a start and end time");
        return;
      }
      if (new Date(pStart).getTime() >= new Date(pEnd).getTime()) {
        toast.error("Promo start must be before end");
        return;
      }
    }

    setSaving(true);
    const { error } = await supabase
      .from("merchants")
      .update({
        pawbucks_cap_enabled: enabled,
        pawbucks_cap_pct: enabled ? pct : null,
        pawbucks_promo_cap_pct: showPromo && typeof pPct === "number" ? pPct : null,
        pawbucks_promo_starts_at: showPromo ? fromLocalInput(pStart) : null,
        pawbucks_promo_ends_at: showPromo ? fromLocalInput(pEnd) : null,
      })
      .eq("id", merchantId);
    setSaving(false);

    if (error) {
      toast.error(error.message || "Failed to save cap settings");
      return;
    }
    toast.success("PawBucks cap settings updated");
    onUpdated?.();
  };

  if (!acceptsPawbucks) return null;

  return (
    <GradientCard>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-info/10 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-info" aria-hidden="true" />
          </div>
          <div>
            <h3 className="font-semibold leading-tight">PawBucks Acceptance Cap</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Limit how much of a transaction's subtotal a customer can pay with PawBucks.
              When off, customers can apply any amount.
            </p>
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
          aria-label="Enable PawBucks cap"
        />
      </div>

      {enabled && (
        <div className="mt-4 pt-4 border-t space-y-5">
          {/* Base cap selection */}
          <div className="space-y-2">
            <Label>Base cap</Label>
            <div className="grid grid-cols-3 gap-2">
              {PAWBUCKS_BASE_CAP_OPTIONS.map((opt) => {
                const selected = pct === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setPct(opt)}
                    className={`px-3 py-3 rounded-lg border-2 text-sm font-semibold transition-all ${
                      selected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border hover:border-primary hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    {opt}%
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              {pct
                ? `Customers can apply PawBucks up to ${pct}% of the subtotal.`
                : `If left unset, your default is ${typeDefault}% based on your business type.`}
            </p>
          </div>

          {/* Promo boost */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-warning" />
                Temporary promo boost
              </Label>
              <Switch checked={showPromo} onCheckedChange={setShowPromo} />
            </div>
            {showPromo && (
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                <div className="space-y-1.5">
                  <Label htmlFor="promo-pct" className="text-xs">
                    Boosted cap (10–{PAWBUCKS_PROMO_CAP_MAX}%)
                  </Label>
                  <Input
                    id="promo-pct"
                    type="number"
                    min={10}
                    max={PAWBUCKS_PROMO_CAP_MAX}
                    step={1}
                    value={pPct === "" ? "" : pPct}
                    onChange={(e) =>
                      setPPct(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    placeholder="e.g. 40"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="promo-start" className="text-xs">Starts</Label>
                    <Input
                      id="promo-start"
                      type="datetime-local"
                      value={pStart}
                      onChange={(e) => setPStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="promo-end" className="text-xs">Ends</Label>
                    <Input
                      id="promo-end"
                      type="datetime-local"
                      value={pEnd}
                      onChange={(e) => setPEnd(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  After the promo ends, your base cap of {effectiveBase}% takes over automatically.
                </p>
              </div>
            )}
          </div>

          {/* Live preview */}
          <div className="flex items-center justify-between rounded-lg bg-info/5 border border-info/20 px-3 py-2">
            <span className="text-sm text-muted-foreground">Currently in effect</span>
            <div className="flex items-center gap-2">
              {promoLive && (
                <Badge variant="secondary" className="bg-warning/15 text-warning border-warning/30">
                  Promo active
                </Badge>
              )}
              <Badge className="bg-info text-info-foreground">
                {liveCap != null ? `${liveCap}% cap` : "No cap"}
              </Badge>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save cap settings"
          )}
        </Button>
      </div>
    </GradientCard>
  );
}