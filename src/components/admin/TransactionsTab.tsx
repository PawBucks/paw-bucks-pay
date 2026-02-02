import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Transaction = {
  id: string;
  amount: number;
  cashback_earned: number;
  rewards_earned: number;
  application_fee: number | null;
  description?: string;
  status: string;
  created_at: string;
  user_id: string;
  stripe_payment_intent_id?: string | null;
  merchants?: {
    business_name: string;
  };
  profiles?: {
    full_name: string | null;
  };
};

export function TransactionsTab() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  // Use RPC data for summary cards to ensure consistency with OverviewTab
  const [summaryStats, setSummaryStats] = useState({
    totalTransactions: 0,
    platformRevenue: 0,
    totalRewards: 0, // in PawBucks
  });

  useEffect(() => {
    loadTransactions();
    loadSummaryStats();
  }, []);

  // Debounce search term for better performance
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      const filtered = transactions.filter(t =>
        t.merchants?.business_name?.toLowerCase().includes(searchLower) ||
        t.description?.toLowerCase().includes(searchLower) ||
        t.profiles?.full_name?.toLowerCase().includes(searchLower)
      );
      setFilteredTransactions(filtered);
    } else {
      setFilteredTransactions(transactions);
    }
  }, [debouncedSearchTerm, transactions]);

  const loadTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, merchants(business_name), profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setTransactions(data || []);
      setFilteredTransactions(data || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
      toast.error('Failed to load transactions');
    }
  };

  // Load summary stats from RPC to match OverviewTab exactly
  const loadSummaryStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_admin_analytics');
      
      if (error) throw error;
      
      if (data && data[0]) {
        setSummaryStats({
          totalTransactions: data[0].total_transactions || 0,
          platformRevenue: data[0].platform_revenue || 0,
          totalRewards: data[0].total_rewards || 0, // in PawBucks
        });
      }
    } catch (error) {
      console.error('Error loading summary stats:', error);
    }
  };

  const handleRefundClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setRefundDialogOpen(true);
  };

  const handleRefund = async () => {
    if (!selectedTransaction) return;
    
    setRefundingId(selectedTransaction.id);
    setRefundDialogOpen(false);
    
    try {
      const { data, error } = await supabase.functions.invoke('admin-issue-refund', {
        body: {
          transactionId: selectedTransaction.id,
          reason: 'requested_by_customer',
        },
      });

      if (error) throw error;
      
      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success('Transaction refunded successfully');
      loadTransactions();
      loadSummaryStats();
    } catch (error: any) {
      console.error('Error refunding transaction:', error);
      toast.error(error.message || 'Failed to refund transaction');
    } finally {
      setRefundingId(null);
      setSelectedTransaction(null);
    }
  };

  // Convert PawBucks to USD (1 PawBuck = $0.001)
  const totalRewardsUSD = summaryStats.totalRewards * 0.001;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Transaction Management</h2>
        <p className="text-muted-foreground">View and manage all platform transactions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Total Transactions</div>
          <div className="text-2xl font-bold">{summaryStats.totalTransactions.toLocaleString()}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Platform Revenue (3%)</div>
          <div className="text-2xl font-bold">${summaryStats.platformRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Total Rewards</div>
          <div className="text-2xl font-bold">${totalRewardsUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search transactions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Pet Owner</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Cashback</TableHead>
              <TableHead>PawBucks</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.map((transaction) => {
              const isRefund = transaction.status === 'refunded';
              const canRefund = transaction.status === 'completed';
              return (
                <TableRow key={transaction.id}>
                  <TableCell>{new Date(transaction.created_at).toLocaleString()}</TableCell>
                  <TableCell className="font-medium">
                    {transaction.merchants?.business_name || 'N/A'}
                  </TableCell>
                  <TableCell>
                    {transaction.profiles?.full_name || 'N/A'}
                  </TableCell>
                  <TableCell className={isRefund ? 'text-destructive' : ''}>
                    {isRefund ? '-' : ''}${transaction.amount.toFixed(2)}
                  </TableCell>
                  <TableCell className={isRefund ? 'text-destructive' : 'text-green-600'}>
                    {isRefund ? '-' : ''}${(transaction.rewards_earned * 0.001).toFixed(2)}
                  </TableCell>
                  <TableCell className={isRefund ? 'text-destructive' : 'text-purple-600'}>
                    {isRefund ? '-' : ''}{transaction.rewards_earned}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={transaction.status === 'completed' ? 'default' : 'secondary'}
                      className={isRefund ? 'bg-destructive text-destructive-foreground hover:bg-destructive/80' : ''}
                    >
                      {transaction.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {canRefund && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRefundClick(transaction)}
                        disabled={refundingId === transaction.id}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        {refundingId === transaction.id ? 'Refunding...' : 'Refund'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Refund</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to refund this transaction of ${selectedTransaction?.amount.toFixed(2)}? 
              This will reverse the Stripe payment and deduct any earned PawBucks from the customer's account.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRefund} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Refund Transaction
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
