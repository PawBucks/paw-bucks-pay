import { memo } from "react";
import { GradientCard } from "@/components/ui/gradient-card";
import { Wallet, Gift, TrendingUp } from "lucide-react";

type WalletStatsProps = {
  balance: number;
  rewardsPoints: number;
};

export const WalletStats = memo(({ balance, rewardsPoints }: WalletStatsProps) => {
  return (
    <>
      <GradientCard gradient>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Wallet Balance</p>
            <p className="text-2xl font-bold">${balance?.toFixed(2) || "0.00"}</p>
          </div>
        </div>
      </GradientCard>

      <GradientCard>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
            <Gift className="w-6 h-6 text-accent" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Rewards Points</p>
            <p className="text-2xl font-bold">{rewardsPoints || 0}</p>
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
            <p className="text-2xl font-bold">$0.00</p>
          </div>
        </div>
      </GradientCard>
    </>
  );
});

WalletStats.displayName = "WalletStats";
