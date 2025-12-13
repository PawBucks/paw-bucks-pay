import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { format } from "date-fns";
import { GradientCard } from "@/components/ui/gradient-card";

type Transaction = {
  id: string;
  amount: number;
  cashback_earned: number;
  rewards_earned?: number;
  description: string;
  created_at: string;
};

type VirtualTransactionListProps = {
  transactions: Transaction[];
  title?: string;
  showCard?: boolean;
  estimatedItemHeight?: number;
};

const TransactionItem = ({ transaction }: { transaction: Transaction }) => (
  <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
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
        Rewards: ${((transaction.rewards_earned ?? 0) * 0.001).toFixed(2)}
      </p>
    </div>
  </div>
);

export const VirtualTransactionList = ({
  transactions,
  title = "Recent Transactions",
  showCard = true,
  estimatedItemHeight = 80,
}: VirtualTransactionListProps) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedItemHeight,
    overscan: 5,
  });

  const content = (
    <>
      {title && <h3 className="text-xl font-semibold mb-4">{title}</h3>}
      {transactions.length > 0 ? (
        <div
          ref={parentRef}
          className="h-[400px] overflow-auto"
          style={{ contain: "strict" }}
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => (
              <div
                key={virtualItem.key}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <div className="pb-3">
                  <TransactionItem transaction={transactions[virtualItem.index]} />
                </div>
              </div>
            ))}
          </div>
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
