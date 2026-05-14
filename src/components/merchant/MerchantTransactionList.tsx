import { memo } from"react";
import { RotateCcw, User } from "lucide-react";
import { GradientCard } from"@/components/ui/gradient-card";
import { format } from"date-fns";

import { Formatters } from "@/utils/formatters";
type Transaction = {
 id: string;
 amount: number;
 cashback_earned: number;
 rewards_earned?: number;
 description: string;
 created_at: string;
 status?: string;
 profiles?: {
 full_name: string | null;
 email: string | null;
 } | null;
};

type MerchantTransactionListProps = {
 transactions: Transaction[];
 title?: string;
 showCard?: boolean;
};

const MerchantTransactionListComponent = ({
 transactions,
 title ="Recent Transactions",
 showCard = true,
}: MerchantTransactionListProps) => {
 const content = (
 <>
 {title && <h3 className="text-xl font-semibold mb-4">{title}</h3>}
 {transactions.length > 0 ? (
 <div className="space-y-3">
 {transactions.map((transaction) => {
 const customerName = transaction.profiles?.full_name ||"Unknown Customer";
 const isRefunded = transaction.status ==='refunded';
 
 return (
 <div
 key={transaction.id}
 className={`flex items-center justify-between p-4 rounded-lg border ${
 isRefunded ?'bg-destructive/5 border-destructive/20' :'bg-card'
 }`}
 >
 <div className="flex items-start gap-3">
 <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
 isRefunded ?'bg-destructive/10' :'bg-primary/10'
 }`}>
 {isRefunded ? (
 <RotateCcw className="w-4 h-4 text-destructive" />
 ) : (
 <User className="w-4 h-4 text-primary" aria-hidden="true" />
 )}
 </div>
 <div>
 <p className="font-medium">
 {customerName}
 {isRefunded && (
 <span className="ml-2 text-xs font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
 Refunded
 </span>
 )}
 </p>
 <p className="text-sm text-muted-foreground">
 {transaction.description ||"Transaction"}
 </p>
 <p className="text-xs text-muted-foreground">
 {format(new Date(transaction.created_at),"MMM d, yyyy'at' h:mm a")}
 </p>
 </div>
 </div>
 <div className="text-right">
 <p className={`font-bold ${isRefunded ?'text-destructive line-through' :'text-accent'}`}>
 +{Formatters.currency(transaction.amount)}
 </p>
 <p className={`text-sm ${isRefunded ?'text-destructive line-through' :'text-muted-foreground'}`}>
 {/* Convert PawBucks to USD (1 PawBuck = $0.001) */}
 Rewards: {Formatters.currency(((transaction.rewards_earned ?? transaction.cashback_earned) * 0.001))}
 </p>
 </div>
 </div>
 );
 })}
 </div>
 ) : (
 <div className="text-center py-8">
 <p className="text-muted-foreground">No transactions yet</p>
 </div>
 )}
 </>
 );

 if (showCard) {
 return <GradientCard>{content}</GradientCard>;
 }

 return content;
};

export const MerchantTransactionList = memo(MerchantTransactionListComponent);
