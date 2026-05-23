import { GradientCard } from "@/components/ui/gradient-card";
import { Badge } from "@/components/ui/badge";
import { Zap, Lock } from "lucide-react";
import { PawBucksLogo } from "@/components/PawBucksLogo";

interface AutoRedeemToggleProps {
  userId?: string;
}

/**
 * Auto-Redeem is now a platform-wide policy for all pet owners:
 * any PawBucks balance is automatically applied to every eligible
 * payment. This component renders a read-only notice; the legacy
 * mode picker has been retired and the DB enforces `mode = 'always'`.
 */
export const AutoRedeemToggle = (_props: AutoRedeemToggleProps) => {
  return (
    <GradientCard>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <PawBucksLogo className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold">Auto-Apply PawBucks</h3>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-primary/15 text-primary">
              <Zap className="w-3 h-3 mr-1" /> Always On
            </Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
              <Lock className="w-3 h-3 mr-1" /> Locked
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Your PawBucks are automatically applied to every eligible payment
            on PawBucks — no extra taps at checkout. This is now the standard
            policy for all pet owners.
          </p>
        </div>
      </div>
    </GradientCard>
  );
};
