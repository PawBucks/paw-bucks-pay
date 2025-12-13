import { memo, useMemo } from "react";
import { GradientCard } from "@/components/ui/gradient-card";
import { Wallet, Gift, TrendingUp } from "lucide-react";
import { PawBucksInfoTooltip } from "@/components/PawBucksInfoTooltip";

type WalletStatsProps = {
  balance: number;
  rewardsPoints: number;
  totalSaved?: number;
};

export const WalletStats = memo(({ balance, rewardsPoints, totalSaved = 0 }: WalletStatsProps) => {
  // Memoize formatted values to prevent recalculation on re-renders
  const formattedBalance = useMemo(() => `$${(balance ?? 0).toFixed(2)}`, [balance]);
  const formattedRewards = useMemo(() => rewardsPoints ?? 0, [rewardsPoints]);
  const formattedSaved = useMemo(() => `$${(totalSaved ?? 0).toFixed(2)}`, [totalSaved]);

  return (
    <>
      <GradientCard gradient>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Wallet Balance</p>
            <p className="text-2xl font-bold">{formattedBalance}</p>
          </div>
        </div>
      </GradientCard>

      <GradientCard>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
            <Gift className="w-6 h-6 text-accent" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1">
              <p className="text-sm text-muted-foreground">Rewards Points</p>
              <PawBucksInfoTooltip variant="earning" />
            </div>
            <p className="text-2xl font-bold">{formattedRewards}</p>
          </div>
        </div>
      </GradientCard>

      <GradientCard>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-secondary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Saved</p>
            <p className="text-2xl font-bold">{formattedSaved}</p>
          </div>
        </div>
      </GradientCard>
    </>
  );
});

WalletStats.displayName = "WalletStats";
