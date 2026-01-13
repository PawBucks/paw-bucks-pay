import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';
import { toast } from 'sonner';

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

  useEffect(() => {
    loadTransactions();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = transactions.filter(t =>
        t.merchants?.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredTransactions(filtered);
    } else {
      setFilteredTransactions(transactions);
    }
  }, [searchTerm, transactions]);

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

  // Use actual application_fee from completed transactions (matches OverviewTab)
  const totalRevenue = filteredTransactions
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + (t.application_fee || 0), 0);
  // rewards_earned is in PawBucks, convert to USD (1 PawBuck = $0.001)
  const totalRewardsUSD = filteredTransactions.reduce((sum, t) => sum + (t.rewards_earned * 0.001), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Transaction Management</h2>
        <p className="text-muted-foreground">View and manage all platform transactions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Total Transactions</div>
          <div className="text-2xl font-bold">{filteredTransactions.length}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Platform Revenue (3%)</div>
          <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Total Rewards</div>
          <div className="text-2xl font-bold">${totalRewardsUSD.toFixed(2)}</div>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.map((transaction) => {
              const isRefund = transaction.status === 'refunded';
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
                  <TableCell className="text-green-600">
                    ${(transaction.rewards_earned * 0.001).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-purple-600">
                    {transaction.rewards_earned}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={transaction.status === 'completed' ? 'default' : 'secondary'}
                      className={isRefund ? 'bg-destructive text-destructive-foreground hover:bg-destructive/80' : ''}
                    >
                      {transaction.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
