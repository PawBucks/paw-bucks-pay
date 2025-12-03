import { memo, useMemo } from "react";
import { GradientCard } from "@/components/ui/gradient-card";
import {
  DollarSign,
  Percent,
  TrendingUp,
  CreditCard,
  ShoppingCart,
} from "lucide-react";

type Analytics = {
  total_sales: number;
  total_cashback: number;
  repayment_rate: number | null;
  remaining_balance: number;
  total_transactions: number;
  total_customers: number;
  avg_transaction_amount: number;
  funding_deal_status?: string | null;
};

type MerchantAnalyticsCardsProps = {
  analytics: Analytics | null;
};

const MerchantAnalyticsCardsComponent = ({ analytics }: MerchantAnalyticsCardsProps) => {
  const formattedValues = useMemo(() => ({
    totalSales: analytics?.total_sales?.toFixed(2) || "0.00",
    totalCashback: analytics?.total_cashback?.toFixed(2) || "0.00",
    remainingBalance: analytics?.remaining_balance?.toFixed(2) || "0.00",
    repaymentRate: analytics?.repayment_rate ? `${analytics.repayment_rate}%` : "N/A",
    totalTransactions: analytics?.total_transactions || 0,
  }), [analytics]);
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5 mb-8">
      <GradientCard gradient>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-accent" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Sales</p>
            <p className="text-2xl font-bold">
              ${formattedValues.totalSales}
            </p>
          </div>
        </div>
      </GradientCard>

      <GradientCard>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Percent className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Cashback Given</p>
            <p className="text-2xl font-bold">
              ${formattedValues.totalCashback}
            </p>
          </div>
        </div>
      </GradientCard>

      <GradientCard>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-secondary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Repayment Remaining</p>
            <p className="text-2xl font-bold">
              ${formattedValues.remainingBalance}
            </p>
          </div>
        </div>
      </GradientCard>

      <GradientCard>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Repayment Rate</p>
            <p className="text-2xl font-bold">
              {formattedValues.repaymentRate}
            </p>
          </div>
        </div>
      </GradientCard>

      <GradientCard>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
            <ShoppingCart className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Transactions</p>
            <p className="text-2xl font-bold">{formattedValues.totalTransactions}</p>
          </div>
        </div>
      </GradientCard>
    </div>
  );
};

export const MerchantAnalyticsCards = memo(MerchantAnalyticsCardsComponent);
