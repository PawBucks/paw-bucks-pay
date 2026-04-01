import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { VerificationChecklist } from './VerificationChecklist';
import { 
  CheckCircle2, XCircle, Clock, Store, Stethoscope, RefreshCw,
  AlertCircle, Mail, Phone, MapPin, Calendar, ClipboardCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

type PendingMerchant = {
  id: string;
  business_name: string;
  business_type: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  approval_status: 'pending' | 'approved' | 'denied';
  created_at: string;
};

type PendingVet = {
  id: string;
  name: string;
  clinic_name: string | null;
  contact_email: string;
  clinic_phone: string | null;
  location: string;
  practice_type: string | null;
  approval_status: 'pending' | 'approved' | 'denied';
  created_at: string;
};

const fetchPendingMerchants = async (): Promise<PendingMerchant[]> => {
  const { data, error } = await supabase
    .from('merchants')
    .select('id, business_name, business_type, contact_person, email, phone, address, approval_status, created_at')
    .eq('approval_status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

const fetchPendingVets = async (): Promise<PendingVet[]> => {
  const { data, error } = await supabase
    .from('partner_vets')
    .select('id, name, clinic_name, contact_email, clinic_phone, location, practice_type, approval_status, created_at')
    .eq('approval_status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export function ApprovalsTab() {
  const queryClient = useQueryClient();
  const [reviewingMerchant, setReviewingMerchant] = useState<PendingMerchant | null>(null);
  const [reviewingVet, setReviewingVet] = useState<PendingVet | null>(null);
  const [denyDialogOpen, setDenyDialogOpen] = useState(false);
  const [denyReason, setDenyReason] = useState('');
  const [denyingEntity, setDenyingEntity] = useState<{ type: 'merchant' | 'vet'; id: string } | null>(null);
  const [checklistReady, setChecklistReady] = useState(false);
  const [checklistHasFailures, setChecklistHasFailures] = useState(false);

  const { data: pendingMerchants = [], isLoading: merchantsLoading, refetch: refetchMerchants } = useQuery({
    queryKey: ['pending-merchants'],
    queryFn: fetchPendingMerchants,
  });

  const { data: pendingVets = [], isLoading: vetsLoading, refetch: refetchVets } = useQuery({
    queryKey: ['pending-vets'],
    queryFn: fetchPendingVets,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ type, id }: { type: 'merchant' | 'vet'; id: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const { error } = await supabase.functions.invoke('admin-approve-entity', {
        body: { entityType: type, entityId: id, action: 'approve' }
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(`${vars.type === 'merchant' ? 'Merchant' : 'Vet'} approved successfully!`);
      queryClient.invalidateQueries({ queryKey: ['pending-merchants'] });
      queryClient.invalidateQueries({ queryKey: ['pending-vets'] });
      setReviewingMerchant(null);
      setReviewingVet(null);
      resetChecklistState();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to approve');
    },
  });

  const denyEntityMutation = useMutation({
    mutationFn: async ({ type, id, reason }: { type: 'merchant' | 'vet'; id: string; reason: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const { error } = await supabase.functions.invoke('admin-approve-entity', {
        body: { entityType: type, entityId: id, action: 'deny', denialReason: reason }
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Entity denied successfully');
      queryClient.invalidateQueries({ queryKey: ['pending-merchants'] });
      queryClient.invalidateQueries({ queryKey: ['pending-vets'] });
      setDenyDialogOpen(false);
      setDenyReason('');
      setDenyingEntity(null);
      setReviewingMerchant(null);
      setReviewingVet(null);
      resetChecklistState();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to deny entity');
    },
  });

  const resetChecklistState = () => {
    setChecklistReady(false);
    setChecklistHasFailures(false);
  };

  const handleReviewMerchant = (merchant: PendingMerchant) => {
    resetChecklistState();
    setReviewingMerchant(merchant);
  };

  const handleReviewVet = (vet: PendingVet) => {
    resetChecklistState();
    setReviewingVet(vet);
  };

  const handleDeny = useCallback((type: 'merchant' | 'vet', id: string) => {
    setDenyingEntity({ type, id });
    setDenyDialogOpen(true);
  }, []);

  const confirmDeny = useCallback(() => {
    if (!denyingEntity || !denyReason.trim()) {
      toast.error('Please provide a reason for denial');
      return;
    }
    denyEntityMutation.mutate({ type: denyingEntity.type, id: denyingEntity.id, reason: denyReason.trim() });
  }, [denyingEntity, denyReason, denyEntityMutation]);

  const handleRefresh = useCallback(() => {
    refetchMerchants();
    refetchVets();
    toast.success('Refreshed pending approvals');
  }, [refetchMerchants, refetchVets]);

  const handleChecklistUpdate = useCallback((allAnswered: boolean, hasFailures: boolean) => {
    setChecklistReady(allAnswered);
    setChecklistHasFailures(hasFailures);
  }, []);

  const totalPending = pendingMerchants.length + pendingVets.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Pending Approvals</h2>
          <p className="text-muted-foreground">Review and approve new Merchants and Vets</p>
        </div>
        <div className="flex items-center gap-3">
          {totalPending > 0 && (
            <Badge variant="destructive" className="text-sm px-3 py-1">
              <AlertCircle className="w-4 h-4 mr-1" />
              {totalPending} Pending
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Merchants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-amber-500" />
              <span className="text-3xl font-bold">{pendingMerchants.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Vets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-blue-500" />
              <span className="text-3xl font-bold">{pendingVets.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Awaiting Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              <span className="text-3xl font-bold">{totalPending}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="merchants" className="space-y-4">
        <TabsList>
          <TabsTrigger value="merchants" className="flex items-center gap-2">
            <Store className="w-4 h-4" />
            Merchants
            {pendingMerchants.length > 0 && (
              <Badge variant="secondary" className="ml-1">{pendingMerchants.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="vets" className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4" />
            Veterinarians
            {pendingVets.length > 0 && (
              <Badge variant="secondary" className="ml-1">{pendingVets.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Merchants Tab */}
        <TabsContent value="merchants">
          <Card>
            <CardHeader>
              <CardTitle>Pending Merchant Applications</CardTitle>
              <CardDescription>Click "Review" to complete the verification checklist before approving</CardDescription>
            </CardHeader>
            <CardContent>
              {merchantsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : pendingMerchants.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <p className="text-lg font-medium">All caught up!</p>
                  <p className="text-sm">No pending merchant applications</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Business Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Applied</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingMerchants.map((merchant) => (
                      <TableRow key={merchant.id}>
                        <TableCell>
                          <div className="font-medium">{merchant.business_name}</div>
                          {merchant.address && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <MapPin className="w-3 h-3" />
                              {merchant.address}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{merchant.business_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {merchant.contact_person && (
                              <div className="text-sm">{merchant.contact_person}</div>
                            )}
                            {merchant.email && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {merchant.email}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(merchant.created_at), 'MMM d, yyyy')}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReviewMerchant(merchant)}
                          >
                            <ClipboardCheck className="w-4 h-4 mr-1" />
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vets Tab */}
        <TabsContent value="vets">
          <Card>
            <CardHeader>
              <CardTitle>Pending Vet Applications</CardTitle>
              <CardDescription>Click "Review" to complete the verification checklist before approving</CardDescription>
            </CardHeader>
            <CardContent>
              {vetsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : pendingVets.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <p className="text-lg font-medium">All caught up!</p>
                  <p className="text-sm">No pending vet applications</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Clinic / Practice</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Applied</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingVets.map((vet) => (
                      <TableRow key={vet.id}>
                        <TableCell>
                          <div className="font-medium">{vet.clinic_name || vet.name}</div>
                          {vet.clinic_name && (
                            <div className="text-xs text-muted-foreground">{vet.name}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{vet.practice_type || 'General'}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {vet.contact_email}
                            </div>
                            {vet.clinic_phone && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {vet.clinic_phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="w-3 h-3" />
                            {vet.location}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(vet.created_at), 'MMM d, yyyy')}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReviewVet(vet)}
                          >
                            <ClipboardCheck className="w-4 h-4 mr-1" />
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Merchant Review Dialog */}
      <Dialog open={!!reviewingMerchant} onOpenChange={(open) => { if (!open) { setReviewingMerchant(null); resetChecklistState(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="w-5 h-5" />
              Review: {reviewingMerchant?.business_name}
            </DialogTitle>
            <DialogDescription>
              Complete the verification checklist below. All questions must be answered before you can approve.
            </DialogDescription>
          </DialogHeader>

          {reviewingMerchant && (
            <>
              {/* Applicant summary */}
              <div className="grid grid-cols-2 gap-3 text-sm border rounded-lg p-3 bg-muted/30">
                <div><span className="text-muted-foreground">Type:</span> {reviewingMerchant.business_type}</div>
                <div><span className="text-muted-foreground">Contact:</span> {reviewingMerchant.contact_person || '—'}</div>
                <div><span className="text-muted-foreground">Email:</span> {reviewingMerchant.email || '—'}</div>
                <div><span className="text-muted-foreground">Phone:</span> {reviewingMerchant.phone || '—'}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Address:</span> {reviewingMerchant.address || '—'}</div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                <VerificationChecklist
                  entityType="merchant"
                  entityId={reviewingMerchant.id}
                  onChecklistComplete={handleChecklistUpdate}
                />
              </div>

              <DialogFooter className="gap-2 pt-3 border-t">
                <Button variant="outline" onClick={() => { setReviewingMerchant(null); resetChecklistState(); }}>
                  Close
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDeny('merchant', reviewingMerchant.id)}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Deny
                </Button>
                <Button
                  onClick={() => approveMutation.mutate({ type: 'merchant', id: reviewingMerchant.id })}
                  disabled={!checklistReady || approveMutation.isPending}
                  title={!checklistReady ? 'Complete all checklist items first' : checklistHasFailures ? 'Warning: some checks failed' : 'Approve merchant'}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  {approveMutation.isPending ? 'Approving...' : 'Approve'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Vet Review Dialog */}
      <Dialog open={!!reviewingVet} onOpenChange={(open) => { if (!open) { setReviewingVet(null); resetChecklistState(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5" />
              Review: {reviewingVet?.clinic_name || reviewingVet?.name}
            </DialogTitle>
            <DialogDescription>
              Complete the verification checklist below. All questions must be answered before you can approve.
            </DialogDescription>
          </DialogHeader>

          {reviewingVet && (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm border rounded-lg p-3 bg-muted/30">
                <div><span className="text-muted-foreground">Vet:</span> {reviewingVet.name}</div>
                <div><span className="text-muted-foreground">Type:</span> {reviewingVet.practice_type || 'General'}</div>
                <div><span className="text-muted-foreground">Email:</span> {reviewingVet.contact_email}</div>
                <div><span className="text-muted-foreground">Phone:</span> {reviewingVet.clinic_phone || '—'}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Location:</span> {reviewingVet.location}</div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                <VerificationChecklist
                  entityType="vet"
                  entityId={reviewingVet.id}
                  onChecklistComplete={handleChecklistUpdate}
                />
              </div>

              <DialogFooter className="gap-2 pt-3 border-t">
                <Button variant="outline" onClick={() => { setReviewingVet(null); resetChecklistState(); }}>
                  Close
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDeny('vet', reviewingVet.id)}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Deny
                </Button>
                <Button
                  onClick={() => approveMutation.mutate({ type: 'vet', id: reviewingVet.id })}
                  disabled={!checklistReady || approveMutation.isPending}
                  title={!checklistReady ? 'Complete all checklist items first' : checklistHasFailures ? 'Warning: some checks failed' : 'Approve vet'}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  {approveMutation.isPending ? 'Approving...' : 'Approve'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Deny Confirmation Dialog */}
      <Dialog open={denyDialogOpen} onOpenChange={setDenyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deny Application</DialogTitle>
            <DialogDescription>
              Please provide a reason for denying this {denyingEntity?.type} application. This will be recorded for audit purposes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="deny-reason">Reason for Denial</Label>
              <Textarea
                id="deny-reason"
                placeholder="Enter the reason for denying this application..."
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDenyDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDeny}
              disabled={!denyReason.trim() || denyEntityMutation.isPending}
            >
              {denyEntityMutation.isPending ? 'Denying...' : 'Confirm Denial'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
