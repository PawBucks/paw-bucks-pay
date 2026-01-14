import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VirtualTransactionList } from "./VirtualTransactionList";

type Transaction = {
  id: string;
  amount: number;
  cashback_earned: number;
  rewards_earned?: number;
  description: string;
  created_at: string;
  profiles?: {
    full_name: string | null;
    email: string | null;
  } | null;
};

type TransactionsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: Transaction[];
};

export const TransactionsDialog = ({
  open,
  onOpenChange,
  transactions,
}: TransactionsDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>All Transactions</DialogTitle>
          <DialogDescription>
            Complete history of your business transactions
          </DialogDescription>
        </DialogHeader>
        <VirtualTransactionList
          transactions={transactions}
          title=""
          showCard={false}
        />
      </DialogContent>
    </Dialog>
  );
};
