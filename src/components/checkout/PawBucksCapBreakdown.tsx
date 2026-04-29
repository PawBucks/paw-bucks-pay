import { Info, Sparkles, Coins } from "lucide-react";
import {
  effectivePawBucksCapPct,
  isPromoActive,
  defaultPawBucksCapPct,
  type MerchantCapFields,
} from "@/lib/pawbucksCap";

const PAWBUCKS_TO_USD = 0.001;

type Props = {
  merchantCap: MerchantCapFields | null | undefined;
  /** Subtotal in USD that the cap is computed against (pre-tax/tip). */
  subtotalUsd: number;
  merchantName?: string;
  className?: string;
};

/**
 * Explains the active PawBucks acceptance cap near the redemption slider:
 *  • Whether the base cap or a promo boost is in effect
 *  • The cap percent and the computed max USD / PB
 *  • Promo window end time when applicable
 */
export const PawBucksCapBreakdown = ({
  merchantCap,
  subtotalUsd,
  merchantName,
  className,
}: Props) => {
  if (!merchantCap?.pawbucks_cap_enabled) return null;

  const pct = effectivePawBucksCapPct(merchantCap);
  if (pct == null) return null;

  const promo = isPromoActive(merchantCap);
  const basePct =
    merchantCap.pawbucks_cap_pct ?? defaultPawBucksCapPct(merchantCap.business_type);
  const isUsingDefault = merchantCap.pawbucks_cap_pct == null && !promo;

  const safeSubtotal = Math.max(0, subtotalUsd);
  const maxUsd = (safeSubtotal * pct) / 100;
  const maxPb = Math.floor(maxUsd / PAWBUCKS_TO_USD);

  const promoEnd = merchantCap.pawbucks_promo_ends_at
    ? new Date(merchantCap.pawbucks_promo_ends_at)
    : null;
  const promoEndLabel = promoEnd
    ? promoEnd.toLocaleString("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : null;

  const containerClasses = promo
    ? "border-warning/30 bg-warning/5"
    : "border-info/20 bg-info/5";
  const accentText = promo ? "text-warning" : "text-info";
  const Icon = promo ? Sparkles : Info;

  return (
    <div
      className={`rounded-md border px-3 py-2 text-xs space-y-1.5 ${containerClasses} ${className ?? ""}`}
      role="note"
      aria-label="PawBucks acceptance cap details"
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`flex items-center gap-1.5 font-medium ${accentText}`}>
          <Icon className="w-3.5 h-3.5" />
          {promo ? "Promo boost active" : "PawBucks cap"}
        </span>
        <span className={`font-semibold tabular-nums ${accentText}`}>{pct}%</span>
      </div>

      <p className="text-muted-foreground leading-snug">
        {promo ? (
          <>
            {merchantName ?? "This merchant"} is temporarily accepting up to{" "}
            <strong className="text-foreground">{pct}%</strong> of the subtotal
            in PawBucks
            {basePct ? (
              <>
                {" "}(boosted from{" "}
                <span className="line-through">{basePct}%</span>)
              </>
            ) : null}
            {promoEndLabel ? <> · ends {promoEndLabel}</> : null}.
          </>
        ) : (
          <>
            {merchantName ?? "This merchant"} accepts up to{" "}
            <strong className="text-foreground">{pct}%</strong> of the subtotal
            in PawBucks
            {isUsingDefault ? <> (category default)</> : null}.
          </>
        )}
      </p>

      <div className="flex items-center justify-between pt-1 border-t border-border/40">
        <span className="text-muted-foreground">
          On ${safeSubtotal.toFixed(2)} subtotal
        </span>
        <span className="flex items-center gap-1 font-semibold text-foreground tabular-nums">
          <Coins className="w-3 h-3 text-primary" />
          max ${maxUsd.toFixed(2)}
          <span className="text-muted-foreground font-normal">
            ({maxPb.toLocaleString()} PB)
          </span>
        </span>
      </div>
    </div>
  );
};

export default PawBucksCapBreakdown;