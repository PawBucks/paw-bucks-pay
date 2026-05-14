import { GradientCard } from"@/components/ui/gradient-card";
import { Button } from"@/components/ui/button";
import { Switch } from"@/components/ui/switch";
import { AlertCircle, CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { MerchantAnalyticsCards } from"./MerchantAnalyticsCards";
import { MerchantCharts } from"./MerchantCharts";
import { MerchantTransactionList } from"./MerchantTransactionList";
import { ScarcitySignalWidget } from"./ScarcitySignalWidget";
import { AccountTypeCard } from"./AccountTypeCard";
import { PawBucksCapCard } from"./PawBucksCapCard";

import { Formatters } from "@/utils/formatters";
import { PawBucksLogo } from "@/components/PawBucksLogo";
type Merchant = {
 id: string;
 business_name: string;
 business_type: string;
 stripe_account_id?: string;
 accepts_pawbucks?: boolean;
 fee_model?:"full_ecosystem" |"acquisition_only";
 acquisition_fee_rate?: number | null;
  pawbucks_cap_enabled?: boolean | null;
  pawbucks_cap_pct?: number | null;
  pawbucks_promo_cap_pct?: number | null;
  pawbucks_promo_starts_at?: string | null;
  pawbucks_promo_ends_at?: string | null;
};

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

type Transaction = {
 id: string;
 amount: number;
 cashback_earned: number;
 rewards_earned: number;
 description: string;
 created_at: string;
};

type MerchantOverviewTabProps = {
 merchant: Merchant;
 analytics: Analytics | null;
 transactions: Transaction[];
 monthlySalesData: { month: string; amount: number }[];
 cashbackDistribution: { name: string; value: number; color: string }[];
 onConnectStripe: () => void;
 onTogglePawbucks: (checked: boolean) => void;
 connectingStripe: boolean;
 togglingPawbucks: boolean;
 onViewWallet: () => void;
  onRefreshMerchant?: () => void;
};

export function MerchantOverviewTab({
 merchant,
 analytics,
 transactions,
 monthlySalesData,
 cashbackDistribution,
 onConnectStripe,
 onTogglePawbucks,
 connectingStripe,
 togglingPawbucks,
 onViewWallet,
  onRefreshMerchant,
}: MerchantOverviewTabProps) {
 return (
 <div className="space-y-6">
 <div>
 <h2 className="text-3xl font-bold">Dashboard Overview</h2>
 <p className="text-muted-foreground">Track your PawBucks sales, rewards, and repayments in one place.</p>
 </div>

 {/* Account Type */}
 <AccountTypeCard
 merchantId={merchant.id}
 feeModel={merchant.fee_model ==="acquisition_only" ?"acquisition_only" :"full_ecosystem"}
 acquisitionFeeRate={merchant.acquisition_fee_rate ?? 10}
 />

 {/* Stripe Connect Status */}
 {!merchant.stripe_account_id && (
 <GradientCard gradient className="bg-accent/10 border-accent/20">
 <div className="space-y-4">
 <div className="flex items-center justify-between flex-wrap gap-4">
 <div className="flex-1">
 <h3 className="font-semibold mb-1">Connect Your Bank Account</h3>
 <p className="text-sm text-muted-foreground">
 Set up Stripe Connect to receive payments directly to your bank account
 </p>
 </div>
 <Button onClick={onConnectStripe} disabled={connectingStripe}>
 {connectingStripe ? (
 <>
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 Connecting...
 </>
 ) : (
 <>
 <ExternalLink className="w-4 h-4 mr-2" />
 Connect Stripe
 </>
 )}
 </Button>
 </div>

 <div className="text-xs bg-background/50 p-3 rounded-md border border-border/50">
 <p className="font-medium mb-2 text-warning flex items-center gap-2">
 <AlertCircle className="w-3.5 h-3.5" />
 Important: Platform Setup Required
 </p>
 <p className="opacity-90 mb-2">
 If you see an error when clicking"Connect Stripe", it means the platform owner needs to complete a one-time Stripe Connect setup:
 </p>
 <ol className="list-decimal list-inside space-y-1 ml-2 opacity-80">
 <li>Visit <a href="https://dashboard.stripe.com/settings/connect" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80">Stripe Dashboard</a></li>
 <li>Go to Settings → Connect → Platform Profile</li>
 <li>Complete all required fields including loss management selection</li>
 </ol>
 </div>
 </div>
 </GradientCard>
 )}

 {/* PawBucks Acceptance Settings */}
 {merchant.stripe_account_id && (
 <GradientCard>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
 <PawBucksLogo className="w-6 h-6 text-primary" />
 </div>
 <div>
 <h3 className="font-semibold">Accept PawBucks</h3>
 <p className="text-sm text-muted-foreground">
 Allow customers to pay with PawBucks (1000 PawBucks = $1.00)
 </p>
 </div>
 </div>
 <Switch
 checked={merchant.accepts_pawbucks ?? false}
 onCheckedChange={onTogglePawbucks}
 disabled={togglingPawbucks}
 />
 </div>
 {merchant.accepts_pawbucks && (
 <div className="mt-4 pt-4 border-t flex items-center justify-between">
 <p className="flex items-center gap-2 text-sm text-muted-foreground">
 <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
 Customers can now pay using their PawBucks balance
 </p>
 <Button 
 variant="outline" 
 size="sm" 
 onClick={onViewWallet}
 >
 <PawBucksLogo className="w-4 h-4 mr-2" />
 View Wallet
 </Button>
 </div>
 )}
 </GradientCard>
 )}

      {/* PawBucks Acceptance Cap */}
      {merchant.stripe_account_id && merchant.accepts_pawbucks && (
        <PawBucksCapCard
          merchantId={merchant.id}
          businessType={merchant.business_type}
          acceptsPawbucks={!!merchant.accepts_pawbucks}
          capEnabled={!!merchant.pawbucks_cap_enabled}
          capPct={merchant.pawbucks_cap_pct ?? null}
          promoCapPct={merchant.pawbucks_promo_cap_pct ?? null}
          promoStartsAt={merchant.pawbucks_promo_starts_at ?? null}
          promoEndsAt={merchant.pawbucks_promo_ends_at ?? null}
          onUpdated={onRefreshMerchant}
        />
      )}

 {/* Analytics Summary Cards */}
 <MerchantAnalyticsCards analytics={analytics} />

 {/* Scarcity Signal - Visibility Slots */}
 <ScarcitySignalWidget merchantId={merchant.id} businessType={merchant.business_type} />

 {/* Repayment Progress */}
 {analytics?.funding_deal_status ==='active' && analytics?.remaining_balance !== undefined && (
 <GradientCard>
 <h3 className="text-xl font-semibold mb-4">Repayment Progress</h3>
 <div className="space-y-2">
 <div className="flex justify-between text-sm mb-2">
 <span className="text-muted-foreground">Funding Balance Remaining</span>
 <span className="font-bold">{Formatters.currency(analytics.remaining_balance)}</span>
 </div>
 <div className="w-full bg-muted rounded-full h-4 overflow-hidden">
 <div
 className="bg-gradient-to-r from-accent to-secondary h-full transition-all duration-500 rounded-full"
 style={{ width: analytics.remaining_balance > 0 ?'100%' :'0%' }}
 />
 </div>
 <p className="text-xs text-muted-foreground mt-2">
 {analytics.repayment_rate}% of each sale goes toward repayment
 </p>
 </div>
 </GradientCard>
 )}

 {!analytics?.funding_deal_status && (
 <GradientCard className="text-center py-8">
 <CreditCard className="w-12 h-12 mx-auto mb-3 text-muted-foreground" aria-hidden="true" />
 <p className="text-muted-foreground">No active funding deal</p>
 </GradientCard>
 )}

 {/* Charts */}
 <MerchantCharts
 monthlySalesData={monthlySalesData}
 cashbackDistribution={cashbackDistribution}
 />

 {/* Recent Transactions */}
 <MerchantTransactionList transactions={transactions} />
 </div>
 );
}
