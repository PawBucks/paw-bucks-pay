import { useState } from'react';
import { useQuery, useMutation, useQueryClient } from'@tanstack/react-query';
import { format } from'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from'@/components/ui/card';
import { Button } from'@/components/ui/button';
import { Input } from'@/components/ui/input';
import { Label } from'@/components/ui/label';
import { Badge } from'@/components/ui/badge';
import { Switch } from'@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from'@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from'@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from'@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from'@/components/ui/tabs';
import { 
 UserPlus, 
 Mail, 
 Shield, 
 Clock, 
 Eye, 
 Trash2, 
 Copy, 
 CheckCircle2,
 AlertTriangle,
 History,
 Users,
 Link as LinkIcon,
 RefreshCw
} from'lucide-react';
import { supabase } from'@/integrations/supabase/client';
import { toast } from'sonner';
import { LoadingSpinner } from'@/components/LoadingSpinner';
import { buildAppUrl } from'@/lib/url';

interface AccountantCollaborationProps {
 merchantId: string;
 businessName: string;
}

interface Invitation {
 id: string;
 accountant_email: string;
 accountant_name: string | null;
 access_token: string;
 permissions: {
 view_expenses: boolean;
 view_income: boolean;
 view_mileage: boolean;
 add_notes: boolean;
 recategorize: boolean;
 };
 status:'pending' |'accepted' |'revoked' |'expired';
 invited_at: string;
 accepted_at: string | null;
 expires_at: string;
 last_accessed_at: string | null;
}

interface ActivityLog {
 id: string;
 action: string;
 entity_type: string;
 old_value: any;
 new_value: any;
 notes: string | null;
 created_at: string;
}

function generateAccessToken(): string {
 const chars ='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
 let token ='';
 for (let i = 0; i < 32; i++) {
 token += chars.charAt(Math.floor(Math.random() * chars.length));
 }
 return token;
}

export function AccountantCollaboration({ merchantId, businessName }: AccountantCollaborationProps) {
 const queryClient = useQueryClient();
 const [isInviteOpen, setIsInviteOpen] = useState(false);
 const [accountantEmail, setAccountantEmail] = useState('');
 const [accountantName, setAccountantName] = useState('');
 const [permissions, setPermissions] = useState({
 view_expenses: true,
 view_income: true,
 view_mileage: true,
 add_notes: true,
 recategorize: false,
 });

 // Fetch existing invitations
 const { data: invitations = [], isLoading } = useQuery({
 queryKey: ['accountant-invitations', merchantId],
 queryFn: async () => {
 const { data, error } = await supabase
 .from('accountant_invitations')
 .select('*')
 .eq('merchant_id', merchantId)
 .order('created_at', { ascending: false });
 
 if (error) throw error;
 return (data || []).map((item: any) => ({
 ...item,
 permissions: item.permissions as Invitation['permissions'],
 status: item.status as Invitation['status'],
 })) as Invitation[];
 },
 enabled: !!merchantId,
 });

 // Fetch activity logs
 const { data: activityLogs = [] } = useQuery({
 queryKey: ['accountant-activity-logs', merchantId],
 queryFn: async () => {
 const { data, error } = await supabase
 .from('accountant_activity_log')
 .select('*')
 .eq('merchant_id', merchantId)
 .order('created_at', { ascending: false })
 .limit(50);
 
 if (error) throw error;
 return data as ActivityLog[];
 },
 enabled: !!merchantId,
 });

 // Create invitation mutation
 const createInvitation = useMutation({
 mutationFn: async () => {
 const accessToken = generateAccessToken();
 
 const { data, error } = await supabase
 .from('accountant_invitations')
 .insert({
 merchant_id: merchantId,
 accountant_email: accountantEmail,
 accountant_name: accountantName || null,
 access_token: accessToken,
 permissions,
 })
 .select()
 .single();
 
 if (error) throw error;
 
 // Send invitation email
 await supabase.functions.invoke('send-accountant-invitation', {
 body: {
 invitationId: data.id,
 accountantEmail,
 accountantName,
 businessName,
 accessToken,
 },
 });
 
 return data;
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['accountant-invitations', merchantId] });
 setIsInviteOpen(false);
 setAccountantEmail('');
 setAccountantName('');
 toast.success('Invitation sent to accountant');
 },
 onError: (error: any) => {
 toast.error(error.message ||'Failed to send invitation');
 },
 });

 // Revoke invitation mutation
 const revokeInvitation = useMutation({
 mutationFn: async (invitationId: string) => {
 const { error } = await supabase
 .from('accountant_invitations')
 .update({ status:'revoked' })
 .eq('id', invitationId);
 
 if (error) throw error;
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['accountant-invitations', merchantId] });
 toast.success('Access revoked');
 },
 onError: () => {
 toast.error('Failed to revoke access');
 },
 });

 // Delete invitation mutation
 const deleteInvitation = useMutation({
 mutationFn: async (invitationId: string) => {
 const { error } = await supabase
 .from('accountant_invitations')
 .delete()
 .eq('id', invitationId);
 
 if (error) throw error;
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['accountant-invitations', merchantId] });
 toast.success('Invitation deleted');
 },
 onError: () => {
 toast.error('Failed to delete invitation');
 },
 });

 const copyPortalLink = (token: string) => {
 const link = buildAppUrl(`/accountant-portal/${token}`);
 navigator.clipboard.writeText(link);
 toast.success('Portal link copied to clipboard');
 };

 const getStatusBadge = (status: string) => {
 switch (status) {
 case'pending':
 return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
 case'accepted':
 return <Badge variant="default" className="bg-success"><CheckCircle2 className="h-3 w-3 mr-1" /> Active</Badge>;
 case'revoked':
 return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" /> Revoked</Badge>;
 case'expired':
 return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> Expired</Badge>;
 default:
 return <Badge variant="outline">{status}</Badge>;
 }
 };

 if (isLoading) {
 return (
 <div className="flex justify-center py-8">
 <LoadingSpinner />
 </div>
 );
 }

 const activeInvitations = invitations.filter(i => i.status ==='accepted');
 const pendingInvitations = invitations.filter(i => i.status ==='pending');

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h3 className="text-lg font-semibold flex items-center gap-2">
 <Users className="h-5 w-5 text-primary" />
 Accountant Collaboration
 </h3>
 <p className="text-sm text-muted-foreground">
 Give your accountant secure, read-only access to your tax data
 </p>
 </div>
 
 <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
 <DialogTrigger asChild>
 <Button>
 <UserPlus className="h-4 w-4 mr-2" />
 Invite Accountant
 </Button>
 </DialogTrigger>
 <DialogContent className="max-w-md">
 <DialogHeader>
 <DialogTitle>Invite Your Accountant</DialogTitle>
 <DialogDescription>
 Your accountant will receive a secure link to view your tax data
 </DialogDescription>
 </DialogHeader>
 
 <div className="space-y-4 py-4">
 <div className="space-y-2">
 <Label htmlFor="email">Accountant's Email *</Label>
 <Input
 id="email"
 type="email"
 placeholder="accountant@example.com"
 value={accountantEmail}
 onChange={(e) => setAccountantEmail(e.target.value)}
 />
 </div>
 
 <div className="space-y-2">
 <Label htmlFor="name">Accountant's Name (Optional)</Label>
 <Input
 id="name"
 placeholder="John Smith, CPA"
 value={accountantName}
 onChange={(e) => setAccountantName(e.target.value)}
 />
 </div>
 
 <div className="space-y-3">
 <Label>Permissions</Label>
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <span className="text-sm">View Expenses</span>
 <Switch
 checked={permissions.view_expenses}
 onCheckedChange={(v) => setPermissions({ ...permissions, view_expenses: v })}
 />
 </div>
 <div className="flex items-center justify-between">
 <span className="text-sm">View Income Summary</span>
 <Switch
 checked={permissions.view_income}
 onCheckedChange={(v) => setPermissions({ ...permissions, view_income: v })}
 />
 </div>
 <div className="flex items-center justify-between">
 <span className="text-sm">View Mileage Log</span>
 <Switch
 checked={permissions.view_mileage}
 onCheckedChange={(v) => setPermissions({ ...permissions, view_mileage: v })}
 />
 </div>
 <div className="flex items-center justify-between">
 <span className="text-sm">Add Notes</span>
 <Switch
 checked={permissions.add_notes}
 onCheckedChange={(v) => setPermissions({ ...permissions, add_notes: v })}
 />
 </div>
 <div className="flex items-center justify-between">
 <span className="text-sm">Suggest Recategorization</span>
 <Switch
 checked={permissions.recategorize}
 onCheckedChange={(v) => setPermissions({ ...permissions, recategorize: v })}
 />
 </div>
 </div>
 </div>
 </div>
 
 <DialogFooter>
 <Button variant="outline" onClick={() => setIsInviteOpen(false)}>
 Cancel
 </Button>
 <Button 
 onClick={() => createInvitation.mutate()}
 disabled={!accountantEmail || createInvitation.isPending}
 >
 {createInvitation.isPending ? (
 <>
 <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
 Sending...
 </>
 ) : (
 <>
 <Mail className="h-4 w-4 mr-2" />
 Send Invitation
 </>
 )}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>

 {/* Active Access */}
 {activeInvitations.length > 0 && (
 <Alert className="border-success/30 bg-success/10">
 <Shield className="h-4 w-4 text-success" />
 <AlertTitle className="text-success">Active Accountant Access</AlertTitle>
 <AlertDescription className="text-success">
 {activeInvitations.length} accountant(s) currently have access to your tax data
 </AlertDescription>
 </Alert>
 )}

 <Tabs defaultValue="invitations" className="space-y-4">
 <TabsList>
 <TabsTrigger value="invitations">Invitations ({invitations.length})</TabsTrigger>
 <TabsTrigger value="activity">Activity Log ({activityLogs.length})</TabsTrigger>
 </TabsList>
 
 <TabsContent value="invitations">
 <Card>
 <CardHeader>
 <CardTitle className="text-base">Accountant Invitations</CardTitle>
 <CardDescription>
 Manage who has access to your tax vault data
 </CardDescription>
 </CardHeader>
 <CardContent>
 {invitations.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
 <p>No accountants invited yet</p>
 <p className="text-sm">Invite your accountant for easy year-end collaboration</p>
 </div>
 ) : (
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Accountant</TableHead>
 <TableHead>Status</TableHead>
 <TableHead>Last Access</TableHead>
 <TableHead>Expires</TableHead>
 <TableHead className="text-right">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {invitations.map((invitation) => (
 <TableRow key={invitation.id}>
 <TableCell>
 <div>
 <p className="font-medium">{invitation.accountant_name ||'Accountant'}</p>
 <p className="text-sm text-muted-foreground">{invitation.accountant_email}</p>
 </div>
 </TableCell>
 <TableCell>{getStatusBadge(invitation.status)}</TableCell>
 <TableCell className="text-sm text-muted-foreground">
 {invitation.last_accessed_at 
 ? format(new Date(invitation.last_accessed_at),'MMM d, yyyy')
 :'Never'}
 </TableCell>
 <TableCell className="text-sm text-muted-foreground">
 {format(new Date(invitation.expires_at),'MMM d, yyyy')}
 </TableCell>
 <TableCell className="text-right">
 <div className="flex items-center justify-end gap-2">
 <Button
 variant="ghost"
 size="icon"
 onClick={() => copyPortalLink(invitation.access_token)}
 title="Copy portal link"
 >
 <Copy className="h-4 w-4" />
 </Button>
 {invitation.status ==='accepted' && (
 <Button
 variant="ghost"
 size="icon"
 onClick={() => revokeInvitation.mutate(invitation.id)}
 title="Revoke access"
 >
 <Shield className="h-4 w-4 text-warning" />
 </Button>
 )}
 <Button
 variant="ghost"
 size="icon"
 onClick={() => deleteInvitation.mutate(invitation.id)}
 title="Delete invitation"
 >
 <Trash2 className="h-4 w-4 text-destructive" />
 </Button>
 </div>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 )}
 </CardContent>
 </Card>
 </TabsContent>
 
 <TabsContent value="activity">
 <Card>
 <CardHeader>
 <CardTitle className="text-base flex items-center gap-2">
 <History className="h-5 w-5" />
 Audit Trail
 </CardTitle>
 <CardDescription>
 All accountant actions are logged for your records
 </CardDescription>
 </CardHeader>
 <CardContent>
 {activityLogs.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
 <p>No activity yet</p>
 <p className="text-sm">Actions taken by accountants will appear here</p>
 </div>
 ) : (
 <div className="space-y-3">
 {activityLogs.map((log) => (
 <div 
 key={log.id} 
 className="flex items-start gap-3 p-3 rounded-lg bg-muted"
 >
 <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
 <Eye className="h-4 w-4 text-primary" />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium">{log.action}</p>
 <p className="text-xs text-muted-foreground">
 {log.entity_type} • {format(new Date(log.created_at),'MMM d, yyyy h:mm a')}
 </p>
 {log.notes && (
 <p className="text-sm mt-1 text-muted-foreground italic">"{log.notes}"</p>
 )}
 </div>
 </div>
 ))}
 </div>
 )}
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>

 {/* Security Info */}
 <Alert>
 <Shield className="h-4 w-4" />
 <AlertTitle>Secure Access</AlertTitle>
 <AlertDescription className="text-xs text-muted-foreground">
 Accountant access is read-only by default. They cannot delete data or make payments. 
 All actions are logged for your audit trail. Access expires after 30 days but can be renewed.
 </AlertDescription>
 </Alert>
 </div>
 );
}
