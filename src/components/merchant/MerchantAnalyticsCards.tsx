import { memo, useMemo } from"react";
import { GradientCard } from"@/components/ui/gradient-card";
import { Formatters } from"@/utils/formatters";
import { DollarSign, Gift, Receipt, ShoppingCart } from "lucide-react";
import { PawBucksLogo } from "@/components/PawBucksLogo";

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
  total_pawbucks_received?: number;
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
   pawbucksReceived: Formatters.money(analytics?.total_pawbucks_received ?? 0),
   successFees: Formatters.money(analytics?.total_fees ?? 0),
   totalTransactions: Formatters.number(analytics?.total_transactions ?? 0),
 };
 }, [analytics]);
 return (
 <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5 mb-8">
 <GradientCard gradient>
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
 <DollarSign className="w-6 h-6 text-accent" aria-hidden="true" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Total Sales</p>
 <p className="text-2xl font-bold">
 ${formattedValues.totalSales}
 </p>
 <p className="text-xs text-muted-foreground mt-0.5">Net of refunds</p>
 </div>
 </div>
 </GradientCard>

 <GradientCard>
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
 <PawBucksLogo className="w-6 h-6 text-primary" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">PawBucks Received</p>
 <p className="text-2xl font-bold">
 ${formattedValues.pawbucksReceived}
 </p>
 <p className="text-xs text-muted-foreground mt-0.5">From customers (USD)</p>
 </div>
 </div>
 </GradientCard>

 <GradientCard>
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
 <Receipt className="w-6 h-6 text-warning" aria-hidden="true" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Success Fees Paid</p>
 <p className="text-2xl font-bold">
 ${formattedValues.successFees}
 </p>
 <p className="text-xs text-muted-foreground mt-0.5">3% of Stripe portion</p>
 </div>
 </div>
 </GradientCard>

 <GradientCard>
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
 <Gift className="w-6 h-6 text-secondary" aria-hidden="true" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Total Rewards Given</p>
 <p className="text-2xl font-bold">
 ${formattedValues.totalRewards}
 </p>
 <p className="text-xs text-muted-foreground mt-0.5">PawBucks earned by customers</p>
 </div>
 </div>
 </GradientCard>

 <GradientCard>
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
 <ShoppingCart className="w-6 h-6 text-muted-foreground" aria-hidden="true" />
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
