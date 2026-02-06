 import { useState, useEffect } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { toast } from "sonner";
 
 interface BalanceAmount {
   amount: number;
   currency: string;
 }
 
 interface Payout {
   id: string;
   amount: number;
   currency: string;
   status: string;
   arrivalDate: number;
   created: number;
 }
 
interface Charge {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  description: string | null;
  stripeFee: number;        // Actual Stripe processing fee only
  applicationFee: number;   // Platform's application fee (3%)
  totalFees: number;        // Combined total of all fees
  netAmount: number;        // Net amount after all fees
}
 
 interface RefundData {
   count: number;
   amount: number;
 }
 
 interface BreakdownData {
   directPaymentEarnings: number;
   directPaymentFees: number;
   directPaymentCount: number;
   transactionEarnings: number;
   transactionCashbackPawBucks: number;
   transactionRewardsPawBucks: number;
   transactionCount: number;
 }
 
 export interface EarningsData {
   connected: boolean;
   accountId?: string;
   balance: {
     available: BalanceAmount[];
     pending: BalanceAmount[];
   };
   payoutHistory: Payout[];
   recentCharges: Charge[];
   summary: {
     totalEarnings: number;
     totalFees: number;
     transactionCount: number;
     totalRewardsGiven: number;
     refunds: RefundData;
     breakdown: BreakdownData;
   };
   dashboardUrl: string | null;
 }
 
 export function useMerchantEarnings() {
   const [loading, setLoading] = useState(true);
   const [refreshing, setRefreshing] = useState(false);
   const [data, setData] = useState<EarningsData | null>(null);
 
   const fetchEarnings = async (showToast = false) => {
     try {
       if (showToast) setRefreshing(true);
       
       const { data: earnings, error } = await supabase.functions.invoke("get-merchant-earnings");
       
       if (error) throw error;
       
       setData(earnings);
       if (showToast) toast.success("Earnings data refreshed");
     } catch (error) {
       console.error("Error fetching earnings:", error);
       if (showToast) toast.error("Failed to refresh earnings data");
     } finally {
       setLoading(false);
       setRefreshing(false);
     }
   };
 
   useEffect(() => {
     fetchEarnings();
   }, []);
 
   const formatCurrency = (amount: number, currency = "usd") => {
     return new Intl.NumberFormat("en-US", {
       style: "currency",
       currency: currency.toUpperCase(),
     }).format(amount / 100);
   };
 
   const getAvailableBalance = () => {
     if (!data?.balance?.available) return 0;
     return data.balance.available.reduce((sum, b) => sum + b.amount, 0);
   };
 
   const getPendingBalance = () => {
     if (!data?.balance?.pending) return 0;
     return data.balance.pending.reduce((sum, b) => sum + b.amount, 0);
   };
 
   return {
     loading,
     refreshing,
     data,
     fetchEarnings,
     formatCurrency,
     getAvailableBalance,
     getPendingBalance,
   };
 }