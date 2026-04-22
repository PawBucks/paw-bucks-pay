import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, Edit, Coins, RefreshCw, PauseCircle, PlayCircle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

type Merchant = {
  id: string;
  business_name: string;
  business_type: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  cashback_rate: number;
  stripe_account_status?: string;
  created_at: string;
  pawbucks_balance?: number;
  is_paused?: boolean;
  pause_reason?: string;
  approval_status?: 'pending' | 'approved' | 'denied' | null;
  fee_model?: 'full_ecosystem' | 'acquisition_only';
  acquisition_fee_rate?: number;
};

// Fetch merchants with their PawBucks balances
const fetchMerchantsWithBalances = async (): Promise<Merchant[]> => {
  const { data: merchantsData, error } = await supabase
    .from('merchants')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Fetch PawBucks balances for all merchants
  const { data: wallets } = await supabase
    .from('merchant_pawbucks_wallet')
    .select('merchant_id, balance');

  const walletMap = new Map(wallets?.map(w => [w.merchant_id, w.balance]) || []);

  return (merchantsData || []).map(m => ({
    ...m,
    pawbucks_balance: walletMap.get(m.id) ?? 0
  }));
};

export function MerchantsTab() {
  const queryClient = useQueryClient();
  const [filteredMerchants, setFilteredMerchants] = useState<Merchant[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [merchantToPause, setMerchantToPause] = useState<Merchant | null>(null);
  const [pauseReason, setPauseReason] = useState('');

  // Use React Query for merchant data
  const { data: merchants = [], refetch, isLoading } = useQuery({
    queryKey: ['admin-merchants-with-pawbucks'],
    queryFn: fetchMerchantsWithBalances,
    staleTime: 30000,
  });

  // Subscribe to real-time merchant PawBucks activity changes
  useEffect(() => {
    const channel = supabase
      .channel('admin-merchants-pawbucks-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'merchant_pawbucks_activity'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['admin-merchants-with-pawbucks'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'merchant_pawbucks_wallet'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['admin-merchants-with-pawbucks'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Debounce search term for better performance
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (debouncedSearchTerm) {
      const filtered = merchants.filter(m =>
        m.business_name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        m.business_type.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      );
      setFilteredMerchants(filtered);
    } else {
      setFilteredMerchants(merchants);
    }
  }, [debouncedSearchTerm, merchants]);

  const handleRefresh = useCallback(() => {
    refetch();
    toast.success('Merchant data refreshed');
  }, [refetch]);

  const handleUpdateMerchant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMerchant) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('merchants')
        .update({
          business_name: selectedMerchant.business_name,
          contact_person: selectedMerchant.contact_person,
          email: selectedMerchant.email,
          cashback_rate: selectedMerchant.cashback_rate,
        })
        .eq('id', selectedMerchant.id);

      if (error) throw error;

      await supabase.rpc('log_admin_action', {
        _action: 'UPDATE_MERCHANT',
        _entity_type: 'merchant',
        _entity_id: selectedMerchant.id,
        _changes: {
          business_name: selectedMerchant.business_name,
          cashback_rate: selectedMerchant.cashback_rate,
        },
      });

      toast.success('Merchant updated successfully');
      setEditDialogOpen(false);
      refetch();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePause = async () => {
    if (!merchantToPause) return;
    const isPausing = !merchantToPause.is_paused;

    setLoading(true);
    try {
      const updates: any = {
        is_paused: isPausing,
        paused_at: isPausing ? new Date().toISOString() : null,
        pause_reason: isPausing ? (pauseReason || null) : null,
      };

      const { error } = await supabase
        .from('merchants')
        .update(updates)
        .eq('id', merchantToPause.id);

      if (error) throw error;

      await supabase.rpc('log_admin_action', {
        _action: isPausing ? 'PAUSE_MERCHANT' : 'UNPAUSE_MERCHANT',
        _entity_type: 'merchant',
        _entity_id: merchantToPause.id,
        _changes: { is_paused: isPausing, pause_reason: isPausing ? pauseReason : null },
      });

      toast.success(isPausing ? 'Merchant account paused' : 'Merchant account resumed');
      setPauseDialogOpen(false);
      setMerchantToPause(null);
      setPauseReason('');
      refetch();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Merchant Management</h2>
          <p className="text-muted-foreground">Manage all merchants and their settings</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search merchants..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>PawBucks</TableHead>
              <TableHead>Points Rate</TableHead>
              <TableHead>Stripe Status</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMerchants.map((merchant) => (
                <TableRow key={merchant.id} className={merchant.is_paused ? 'opacity-60' : ''}>
                  <TableCell className="font-medium">
                    {merchant.business_name}
                    {merchant.is_paused && (
                      <Badge variant="destructive" className="ml-2 text-xs">Paused</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{merchant.business_type}</Badge>
                  </TableCell>
                  <TableCell>{merchant.contact_person || 'N/A'}</TableCell>
                  <TableCell className="text-muted-foreground">{merchant.phone || 'N/A'}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[180px] truncate" title={merchant.email || ''}>
                    {merchant.email || 'N/A'}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-primary font-medium">
                      <Coins className="w-3 h-3" />
                      {(merchant.pawbucks_balance ?? 0).toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>{merchant.cashback_rate}x</TableCell>
                  <TableCell>
                    <Badge variant={merchant.stripe_account_status === 'active' ? 'default' : 'secondary'}>
                      {merchant.stripe_account_status || 'pending'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {merchant.is_paused ? (
                      <Badge variant="destructive">Paused</Badge>
                    ) : merchant.approval_status === 'pending' ? (
                      <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 border-amber-500/30">
                        Pending
                      </Badge>
                    ) : merchant.approval_status === 'denied' ? (
                      <Badge variant="destructive">Denied</Badge>
                    ) : (
                      <Badge variant="default">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedMerchant(merchant);
                        setEditDialogOpen(true);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setMerchantToPause(merchant);
                        setPauseReason('');
                        setPauseDialogOpen(true);
                      }}
                      title={merchant.is_paused ? 'Resume merchant' : 'Pause merchant'}
                    >
                      {merchant.is_paused ? (
                        <PlayCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <PauseCircle className="w-4 h-4 text-destructive" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Merchant</DialogTitle>
            <DialogDescription>Update merchant information</DialogDescription>
          </DialogHeader>
          {selectedMerchant && (
            <form onSubmit={handleUpdateMerchant} className="space-y-4">
              <div className="space-y-2">
                <Label>Business Name</Label>
                <Input
                  value={selectedMerchant.business_name}
                  onChange={(e) => setSelectedMerchant({ ...selectedMerchant, business_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Person</Label>
                <Input
                  value={selectedMerchant.contact_person || ''}
                  onChange={(e) => setSelectedMerchant({ ...selectedMerchant, contact_person: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={selectedMerchant.email || ''}
                  onChange={(e) => setSelectedMerchant({ ...selectedMerchant, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Points Multiplier (x)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={selectedMerchant.cashback_rate}
                  onChange={(e) => setSelectedMerchant({ ...selectedMerchant, cashback_rate: parseFloat(e.target.value) })}
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Updating...' : 'Update Merchant'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={pauseDialogOpen} onOpenChange={setPauseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {merchantToPause?.is_paused ? 'Resume Merchant Account' : 'Pause Merchant Account'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {merchantToPause?.is_paused
                ? `Are you sure you want to resume "${merchantToPause?.business_name}"? They will regain access to their dashboard and become visible to pet owners again.`
                : `Are you sure you want to pause "${merchantToPause?.business_name}"? This will hide them from the platform and block their dashboard access. They will need to contact support to resume.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!merchantToPause?.is_paused && (
            <div className="space-y-2 py-2">
              <Label>Reason for pausing (optional)</Label>
              <Textarea
                placeholder="e.g. Compliance review, customer complaints, etc."
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
                rows={3}
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTogglePause}
              disabled={loading}
              className={merchantToPause?.is_paused ? '' : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'}
            >
              {loading ? 'Processing...' : merchantToPause?.is_paused ? 'Resume Account' : 'Pause Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
