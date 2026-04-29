import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, RotateCcw, ChevronDown, ChevronRight, CreditCard, Coins, DollarSign, Receipt, User, Store, Clock, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { RefundPaymentDialog } from '@/components/shared/RefundPaymentDialog';
import { format } from 'date-fns';

type Transaction = {
  id: string;
  amount: number;
  cashback_earned: number;
  rewards_earned: number;
  application_fee: number | null;
  stripe_amount: number | null;
  pawbucks_used: number | null;
  payment_method: string | null;
  description?: string;
  status: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  merchant_id: string;
  stripe_payment_intent_id?: string | null;
  merchants?: {
    business_name: string;
  };
  profiles?: {
    full_name: string | null;
    email?: string | null;
  };
};

const formatPaymentMethod = (method: string | null): string => {
  if (!method) return 'Card';
  const map: Record<string, string> = {
    card: 'Card',
    credit_card: 'Credit Card',
    cash: 'Cash',
    check: 'Check',
    bank_transfer: 'Bank Transfer',
    venmo: 'Venmo',
    paypal: 'PayPal',
    zelle: 'Zelle',
    other: 'Other',
  };
  return map[method] || method.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const DetailRow = ({ label, value, icon: Icon, className = '' }: { label: string; value: React.ReactNode; icon?: any; className?: string }) => (
  <div className="flex items-center gap-2 py-1.5">
    {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
    <span className="text-xs text-muted-foreground min-w-[140px]">{label}</span>
    <span className={`text-sm font-medium ${className}`}>{value}</span>
  </div>
);

export function TransactionsTab() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [summaryStats, setSummaryStats] = useState({
    totalTransactions: 0,
    platformRevenue: 0,
    totalRewards: 0,
  });

  useEffect(() => {
    loadTransactions();
    loadSummaryStats();
  }, []);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      const filtered = transactions.filter(t =>
        t.merchants?.business_name?.toLowerCase().includes(searchLower) ||
        t.description?.toLowerCase().includes(searchLower) ||
        t.profiles?.full_name?.toLowerCase().includes(searchLower) ||
        t.id?.toLowerCase().includes(searchLower)
      );
      setFilteredTransactions(filtered);
    } else {
      setFilteredTransactions(transactions);
    }
  }, [debouncedSearchTerm, transactions]);

  const loadTransactions = async () => {
    console.log('[Admin TransactionsTab] Loading transactions...');
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, merchants!transactions_merchant_id_fkey(business_name), profiles!transactions_user_id_fkey(full_name, email)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('[Admin TransactionsTab] Error loading transactions:', error);
        throw error;
      }
      console.log('[Admin TransactionsTab] Loaded transactions:', data?.length || 0);
      setTransactions((data || []) as Transaction[]);
      setFilteredTransactions((data || []) as Transaction[]);
    } catch (error) {
      console.error('[Admin TransactionsTab] Error loading transactions:', error);
      toast.error('Failed to load transactions');
    }
  };

  const loadSummaryStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_admin_analytics');
      if (error) throw error;
      if (data && data[0]) {
        setSummaryStats({
          totalTransactions: data[0].total_transactions || 0,
          platformRevenue: data[0].platform_revenue || 0,
          totalRewards: data[0].total_rewards || 0,
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

  const handleRefund = async (params: { amount: number; reason: string; note: string; refundApplicationFee: boolean }) => {
    if (!selectedTransaction) return;
    setRefundingId(selectedTransaction.id);
    setRefundDialogOpen(false);
    try {
      const { data, error } = await supabase.functions.invoke('admin-issue-refund', {
        body: {
          transactionId: selectedTransaction.id,
          amount: params.amount,
          reason: params.reason,
          note: params.note,
          refundApplicationFee: params.refundApplicationFee,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Refund of $${params.amount.toFixed(2)} processed successfully`);
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

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const totalRewardsUSD = summaryStats.totalRewards * 0.001;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Transaction Management</h2>
        <p className="text-muted-foreground">View and manage all platform transactions with full financial breakdown</p>
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
          placeholder="Search by merchant, pet owner, description, or transaction ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Pet Owner</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Stripe</TableHead>
              <TableHead className="text-right">PawBucks Used</TableHead>
              <TableHead className="text-right">Fee</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.map((transaction) => {
              const isRefund = transaction.status === 'refunded';
              const canRefund = transaction.status === 'completed';
              const isExpanded = expandedId === transaction.id;
              const pawbucksUsed = transaction.pawbucks_used || 0;
              const pawbucksUSD = pawbucksUsed * 0.001;
              const stripeAmount = transaction.stripe_amount ?? (transaction.amount - pawbucksUSD);
              const platformFee = transaction.application_fee || 0;
              const rewardsEarnedPB = transaction.rewards_earned || 0;
              const cashbackEarnedPB = transaction.cashback_earned || 0;
              const rewardsUSD = rewardsEarnedPB * 0.001;
              const hasPawbucks = pawbucksUsed > 0;

              return (
                <>
                  <TableRow
                    key={transaction.id}
                    className={`cursor-pointer ${isExpanded ? 'bg-muted/30' : ''}`}
                    onClick={() => toggleExpand(transaction.id)}
                  >
                    <TableCell className="px-2">
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      }
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {format(new Date(transaction.created_at), "MMM d, yyyy")}
                      <br />
                      <span className="text-muted-foreground">{format(new Date(transaction.created_at), "h:mm a")}</span>
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-xs">
                      {transaction.description || '—'}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {transaction.merchants?.business_name || 'N/A'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {transaction.profiles?.full_name || 'N/A'}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${isRefund ? 'text-destructive' : ''}`}>
                      {isRefund ? '-' : ''}${transaction.amount.toFixed(2)}
                    </TableCell>
                    <TableCell className={`text-right text-sm ${isRefund ? 'text-destructive' : ''}`}>
                      ${stripeAmount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {hasPawbucks ? (
                        <div className="flex items-center justify-end gap-1">
                          <Coins className="w-3.5 h-3.5 text-warning" />
                          <span className="text-sm font-medium text-warning">
                            {pawbucksUsed.toLocaleString()} PB
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className={`text-right text-xs ${isRefund ? 'text-destructive' : 'text-muted-foreground'}`}>
                      ${platformFee.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-normal">
                        {formatPaymentMethod(transaction.payment_method)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={transaction.status === 'completed' ? 'default' : 'secondary'}
                        className={isRefund ? 'bg-destructive text-destructive-foreground hover:bg-destructive/80' : ''}
                      >
                        {transaction.status}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
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

                  {isExpanded && (
                    <TableRow key={`${transaction.id}-detail`} className="bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={12} className="p-0">
                        <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-dashed border-border/60">
                          {/* Column 1: Identification */}
                          <div className="space-y-1">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Identification</h4>
                            <DetailRow icon={Hash} label="Transaction ID" value={
                              <span className="font-mono text-xs">{transaction.id?.slice(0, 8) ?? '—'}...{transaction.id?.slice(-4) ?? ''}</span>
                            } />
                            <DetailRow icon={Store} label="Merchant" value={transaction.merchants?.business_name || 'N/A'} />
                            <DetailRow icon={Hash} label="Merchant ID" value={
                              <span className="font-mono text-xs">{transaction.merchant_id?.slice(0, 8) ?? '—'}...</span>
                            } />
                            <DetailRow icon={User} label="Pet Owner" value={transaction.profiles?.full_name || 'N/A'} />
                            {transaction.profiles?.email && (
                              <DetailRow icon={User} label="Email" value={transaction.profiles.email} />
                            )}
                            <DetailRow icon={Hash} label="User ID" value={
                              <span className="font-mono text-xs">{transaction.user_id?.slice(0, 8) ?? '—'}...</span>
                            } />
                            {transaction.stripe_payment_intent_id && (
                              <DetailRow icon={CreditCard} label="Stripe PI" value={
                                <span className="font-mono text-xs">{transaction.stripe_payment_intent_id}</span>
                              } />
                            )}
                          </div>

                          {/* Column 2: Financial Breakdown */}
                          <div className="space-y-1">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Financial Breakdown</h4>
                            <DetailRow icon={DollarSign} label="Total Amount" value={`$${transaction.amount.toFixed(2)}`} className="font-bold" />
                            <DetailRow icon={CreditCard} label="Stripe Charged" value={`$${stripeAmount.toFixed(2)}`} />
                            {hasPawbucks ? (
                              <>
                                <DetailRow icon={Coins} label="PawBucks Applied" value={
                                  <span className="text-warning font-semibold">
                                    {pawbucksUsed.toLocaleString()} PB (${pawbucksUSD.toFixed(2)})
                                  </span>
                                } />
                                <div className="border-l-2 border-warning/30/50 pl-3 ml-5 mt-1 mb-1">
                                  <p className="text-xs text-muted-foreground">
                                    Customer redeemed <strong>{pawbucksUsed.toLocaleString()}</strong> PawBucks
                                    worth <strong>${pawbucksUSD.toFixed(2)}</strong>, reducing the Stripe charge
                                    from ${transaction.amount.toFixed(2)} to ${stripeAmount.toFixed(2)}.
                                  </p>
                                </div>
                              </>
                            ) : (
                              <DetailRow icon={Coins} label="PawBucks Applied" value={
                                <span className="text-muted-foreground">None</span>
                              } />
                            )}
                            <DetailRow icon={Receipt} label="Success Fee (3%)" value={`$${platformFee.toFixed(2)}`} className="text-warning" />
                            <DetailRow icon={DollarSign} label="Merchant Net" value={
                              `$${(transaction.amount - platformFee).toFixed(2)}`
                            } className="text-accent font-semibold" />
                          </div>

                          {/* Column 3: Rewards & Meta */}
                          <div className="space-y-1">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Rewards & Metadata</h4>
                            <DetailRow icon={Coins} label="Rewards Earned" value={
                              <span className="text-success dark:text-success">
                                {rewardsEarnedPB.toLocaleString()} PB (${rewardsUSD.toFixed(2)})
                              </span>
                            } />
                            <DetailRow icon={Coins} label="Cashback (Legacy)" value={
                              `${cashbackEarnedPB.toLocaleString()} PB ($${(cashbackEarnedPB * 0.001).toFixed(2)})`
                            } />
                            <DetailRow icon={CreditCard} label="Payment Method" value={formatPaymentMethod(transaction.payment_method)} />
                            <DetailRow icon={Clock} label="Created" value={format(new Date(transaction.created_at), "MMM d, yyyy 'at' h:mm:ss a")} />
                            {transaction.updated_at && transaction.updated_at !== transaction.created_at && (
                              <DetailRow icon={Clock} label="Last Updated" value={format(new Date(transaction.updated_at), "MMM d, yyyy 'at' h:mm:ss a")} />
                            )}
                            <DetailRow icon={Receipt} label="Description" value={transaction.description || '—'} />
                            <div className="pt-2 mt-2 border-t border-border/40">
                              <Badge
                                variant={transaction.status === 'completed' ? 'default' : 'secondary'}
                                className={`text-xs ${isRefund ? 'bg-destructive text-destructive-foreground' : ''}`}
                              >
                                {transaction.status.toUpperCase()}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
            {filteredTransactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                  No transactions found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <RefundPaymentDialog
        open={refundDialogOpen}
        onOpenChange={setRefundDialogOpen}
        transactionAmount={selectedTransaction?.amount || 0}
        customerName={selectedTransaction?.profiles?.full_name || undefined}
        onRefund={handleRefund}
        isRefunding={!!refundingId}
      />
    </div>
  );
}
