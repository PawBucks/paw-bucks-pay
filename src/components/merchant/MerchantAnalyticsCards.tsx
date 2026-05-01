import { memo, useMemo } from"react";
import { GradientCard } from"@/components/ui/gradient-card";
import { Formatters } from"@/utils/formatters";
import {
 DollarSign,
 Gift,
 TrendingUp,
 CreditCard,
 ShoppingCart,
} from"lucide-react";

type Analytics = {
 total_sales: number;
 total_cashback: number;
 repayment_rate: number | null;
 remaining_balance: number;
 total_transactions: number;
 total_customers: number;
 avg_transaction_amount: number;
 funding_deal_status?: string | null;
 // New fields from edge function for accurate rewards tracking
 total_fees?: number;
 total_earnings?: number;
};

type MerchantAnalyticsCardsProps = {
 analytics: Analytics | null;
};

const MerchantAnalyticsCardsComponent = ({ analytics }: MerchantAnalyticsCardsProps) => {
 const formattedValues = useMemo(() => {
 // Total Rewards Given uses actual cashback data from database (in PawBucks)
 // Convert PawBucks to USD: 1000 PawBucks = $1 USD
 const totalCashbackPawBucks = analytics?.total_cashback || 0;
 const totalRewardsUSD = totalCashbackPawBucks / 1000;
 
 return {
   totalSales: Formatters.money(analytics?.total_sales ?? 0),
   totalRewards: Formatters.money(totalRewardsUSD),
   remainingBalance: Formatters.money(analytics?.remaining_balance ?? 0),
 repaymentRate: analytics?.repayment_rate ? `${analytics.repayment_rate}x` :"N/A",
   totalTransactions: Formatters.number(analytics?.total_transactions ?? 0),
 };
 }, [analytics]);
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
 <Gift className="w-6 h-6 text-primary" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Total Rewards Given</p>
 <p className="text-2xl font-bold">
 ${formattedValues.totalRewards}
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
 <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
 <ShoppingCart className="w-6 h-6 text-warning" />
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
