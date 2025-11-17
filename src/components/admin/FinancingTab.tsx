import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, X, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

type FundingRequest = {
  id: string;
  requested_amount: number;
  reason: string;
  estimated_monthly_sales: number;
  status: string;
  created_at: string;
  merchants?: {
    business_name: string;
  };
};

type VetLoan = {
  id: string;
  requested_amount: number;
  invoice_amount: number;
  term_months: number;
  status: string;
  created_at: string;
  purpose?: string;
};

export function FinancingTab() {
  const [fundingRequests, setFundingRequests] = useState<FundingRequest[]>([]);
  const [vetLoans, setVetLoans] = useState<VetLoan[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<FundingRequest | null>(null);
  const [fundingDialogOpen, setFundingDialogOpen] = useState(false);
  const [fundingAmount, setFundingAmount] = useState('');
  const [repaymentRate, setRepaymentRate] = useState('10');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFinancingData();
  }, []);

  const loadFinancingData = async () => {
    try {
      // Load funding requests
      const { data: requests, error: requestsError } = await supabase
        .from('funding_requests')
        .select('*, merchants(business_name)')
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;
      setFundingRequests(requests || []);

      // Load vet loans
      const { data: loans, error: loansError } = await supabase
        .from('vet_loans')
        .select('*')
        .order('created_at', { ascending: false });

      if (loansError) throw loansError;
      setVetLoans(loans || []);
    } catch (error) {
      console.error('Error loading financing data:', error);
      toast.error('Failed to load financing data');
    }
  };

  const handleApproveFunding = async () => {
    if (!selectedRequest || !fundingAmount) return;

    setLoading(true);
    try {
      // Update funding request status
      const { error: updateError } = await supabase
        .from('funding_requests')
        .update({ status: 'approved' })
        .eq('id', selectedRequest.id);

      if (updateError) throw updateError;

      // Create funding deal
      const { error: dealError } = await supabase
        .from('funding_deals')
        .insert([{
          merchant_id: selectedRequest.id,
          amount_funded: parseFloat(fundingAmount),
          repayment_rate: parseFloat(repaymentRate),
        }]);

      if (dealError) throw dealError;

      await supabase.rpc('log_admin_action', {
        _action: 'APPROVE_FUNDING',
        _entity_type: 'funding_request',
        _entity_id: selectedRequest.id,
        _changes: { amount: fundingAmount, rate: repaymentRate },
      });

      toast.success('Funding approved successfully');
      setFundingDialogOpen(false);
      loadFinancingData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDenyFunding = async (id: string) => {
    try {
      const { error } = await supabase
        .from('funding_requests')
        .update({ status: 'denied' })
        .eq('id', id);

      if (error) throw error;

      await supabase.rpc('log_admin_action', {
        _action: 'DENY_FUNDING',
        _entity_type: 'funding_request',
        _entity_id: id,
        _changes: {},
      });

      toast.success('Funding request denied');
      loadFinancingData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Financing & Loans</h2>
        <p className="text-muted-foreground">Manage merchant financing and consumer vet loans</p>
      </div>

      <Tabs defaultValue="merchant" className="space-y-4">
        <TabsList>
          <TabsTrigger value="merchant">Merchant Financing</TabsTrigger>
          <TabsTrigger value="consumer">Vet Loans</TabsTrigger>
        </TabsList>

        <TabsContent value="merchant" className="space-y-4">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Amount Requested</TableHead>
                  <TableHead>Monthly Sales</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fundingRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      {request.merchants?.business_name || 'N/A'}
                    </TableCell>
                    <TableCell>${request.requested_amount.toLocaleString()}</TableCell>
                    <TableCell>${request.estimated_monthly_sales.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          request.status === 'approved' ? 'default' :
                          request.status === 'denied' ? 'destructive' :
                          'secondary'
                        }
                      >
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(request.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      {request.status === 'pending' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedRequest(request);
                              setFundingAmount(request.requested_amount.toString());
                              setFundingDialogOpen(true);
                            }}
                          >
                            <Check className="w-4 h-4 text-green-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDenyFunding(request.id)}
                          >
                            <X className="w-4 h-4 text-red-500" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="consumer" className="space-y-4">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requested Amount</TableHead>
                  <TableHead>Invoice Amount</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vetLoans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell>${loan.requested_amount.toLocaleString()}</TableCell>
                    <TableCell>${loan.invoice_amount.toLocaleString()}</TableCell>
                    <TableCell>{loan.term_months} months</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          loan.status === 'approved' ? 'default' :
                          loan.status === 'denied' ? 'destructive' :
                          'secondary'
                        }
                      >
                        {loan.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(loan.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={fundingDialogOpen} onOpenChange={setFundingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Merchant Funding</DialogTitle>
            <DialogDescription>Set funding amount and repayment terms</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Funding Amount ($)</Label>
              <Input
                type="number"
                value={fundingAmount}
                onChange={(e) => setFundingAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
            <div className="space-y-2">
              <Label>Repayment Rate (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={repaymentRate}
                onChange={(e) => setRepaymentRate(e.target.value)}
                placeholder="10"
              />
            </div>
            <Button onClick={handleApproveFunding} disabled={loading} className="w-full">
              {loading ? 'Approving...' : 'Approve Funding'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
