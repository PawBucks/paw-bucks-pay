import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { differenceInDays, format } from "date-fns";

import { Formatters } from "@/utils/formatters";
export type PawBucksSource ="earned" |"promotional" |"none";

const PAWBUCKS_TO_USD = 0.001;

interface PawBucksSourceSelectorProps {
 earnedBalance: number;
 promotionalBalance: number;
 selectedSource: PawBucksSource;
 onSourceChange: (source: PawBucksSource) => void;
 promotionalLabel?: string;
 /** ISO date when the soonest-expiring earned PawBucks expire. */
 earnedNextExpiresAt?: string | null;
 /** ISO date when the soonest-expiring promotional credit expires. */
 promotionalNextExpiresAt?: string | null;
}

const ExpiryLine = ({ iso, tone }: { iso: string; tone:"earned" |"promotional" }) => {
  const date = new Date(iso);
  const days = differenceInDays(date, new Date());
  const urgent = days <= 7;
  const colorClass = urgent
    ? "text-destructive"
    : tone === "promotional"
    ? "text-success"
    : "text-primary";
  const label =
    days <= 0 ? "Expires today" : days === 1 ? "Expires tomorrow" : `Expires in ${days} days`;
  return (
    <p className={`text-[11px] flex items-center gap-1 mt-0.5 ${colorClass}`}>
      <span className="w-3 h-3" aria-hidden="true">⏰</span>
      {label} · {format(date, "MMM d")}
    </p>
  );
};

export const PawBucksSourceSelector = ({
 earnedBalance,
 promotionalBalance,
 selectedSource,
 onSourceChange,
 promotionalLabel ="Pet Fund Credit",
 earnedNextExpiresAt = null,
 promotionalNextExpiresAt = null,
}: PawBucksSourceSelectorProps) => {
 return (
 <div className="bg-muted border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-foreground">Choose PawBucks source:</p>
        <TooltipProvider>
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                aria-label="PawBucks source information"
              >
                <Info className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="bg-popover border border-border shadow-lg p-3 z-50 max-w-xs"
              sideOffset={5}
            >
              <div className="space-y-2">
                <p className="font-semibold text-foreground">PawBucks Sources</p>
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2">
                    <PawBucksLogo className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Earned PawBucks</p>
                      <p className="text-xs text-muted-foreground">
                        Rewards from purchases. Expire 60 days after you receive them.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 text-success mt-0.5 flex-shrink-0" aria-hidden="true">🎁</span>
                    <div>
                      <p className="text-sm font-medium text-foreground">Promotional Credits</p>
                      <p className="text-xs text-muted-foreground">
                        Pet Fund, Welcome credits, and campaign bonuses. Expire 30 days after release.
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground pt-1 border-t border-border">
                  You can only use one source per purchase. We recommend using promotional credits first since they expire sooner (30 days vs. 60 days).
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <p className="text-xs text-muted-foreground">
        You can use earned PawBucks or promotional credit, but not both in the same purchase.
      </p>
 <RadioGroup
 value={selectedSource}
 onValueChange={(val) => onSourceChange(val as PawBucksSource)}
 className="gap-2 mt-2"
 >
 <label
 htmlFor="source-earned"
 className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
 selectedSource ==="earned"
 ?"border-primary bg-primary/5"
 :"border-border hover:border-primary/40"
 }`}
 >
 <RadioGroupItem value="earned" id="source-earned" />
 <PawBucksLogo className="w-4 h-4 text-primary flex-shrink-0" />
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium">Earned PawBucks</p>
 <p className="text-xs text-muted-foreground">
 {earnedBalance.toLocaleString()} PB ({Formatters.currency((earnedBalance * PAWBUCKS_TO_USD))})
 </p>
  {earnedNextExpiresAt && earnedBalance > 0 && (
    <ExpiryLine iso={earnedNextExpiresAt} tone="earned" />
  )}
 </div>
 </label>

 <label
 htmlFor="source-promotional"
 className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
 selectedSource ==="promotional"
 ?"border-success bg-success/5"
 :"border-border hover:border-success/40"
 }`}
 >
 <RadioGroupItem value="promotional" id="source-promotional" />
 <span className="w-4 h-4 text-success flex-shrink-0" aria-hidden="true">🎁</span>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium">{promotionalLabel}</p>
 <p className="text-xs text-muted-foreground">
 {promotionalBalance.toLocaleString()} PB ({Formatters.currency((promotionalBalance * PAWBUCKS_TO_USD))})
 </p>
  {promotionalNextExpiresAt && promotionalBalance > 0 && (
    <ExpiryLine iso={promotionalNextExpiresAt} tone="promotional" />
  )}
 </div>
 </label>
 </RadioGroup>
 </div>
 );
};
