import { memo } from "react";
import { GradientCard } from "@/components/ui/gradient-card";
import { format } from "date-fns";

type Transaction = {
  id: string;
  amount: number;
  cashback_earned: number;
  rewards_earned?: number;
  description: string;
  created_at: string;
};

type MerchantTransactionListProps = {
  transactions: Transaction[];
  title?: string;
  showCard?: boolean;
};

const MerchantTransactionListComponent = ({
  transactions,
  title = "Recent Transactions",
  showCard = true,
}: MerchantTransactionListProps) => {
  const content = (
    <>
      {title && <h3 className="text-xl font-semibold mb-4">{title}</h3>}
      {transactions.length > 0 ? (
        <div className="space-y-3">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center justify-between p-4 rounded-lg border bg-card"
            >
              <div>
                <p className="font-medium">{transaction.description}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(transaction.created_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-accent">
                  +${transaction.amount.toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {/* Convert PawBucks to USD (1 PawBuck = $0.001) */}
                  Rewards: ${((transaction.rewards_earned ?? transaction.cashback_earned) * 0.001).toFixed(2)}
                </p>
              </div>
            </div>
          ))}
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
