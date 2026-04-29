import { useEffect, useState, useCallback } from'react';
import { useNavigate } from'react-router-dom';
import { supabase } from'@/integrations/supabase/client';
import { useQuery, useQueryClient } from'@tanstack/react-query';
import { useDebounce } from'@/hooks/useDebounce';
import { Button } from'@/components/ui/button';
import { Input } from'@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from'@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from'@/components/ui/dialog';
import { Label } from'@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from'@/components/ui/select';
import { Badge } from'@/components/ui/badge';
import { Search, Edit, Shield, Coins, RefreshCw, Crown, Gift } from'lucide-react';
import { toast } from'sonner';
import { UpgradeSubscriptionDialog } from'./UpgradeSubscriptionDialog';

type User = {
 id: string;
 email: string;
 full_name: string;
 user_type: string;
 created_at: string;
 phone?: string;
 pawbucks_balance?: number;
 shared_with_owner?: string; // Owner's email if this user is a shared member
 welcome_credit_status?: string | null;
 welcome_credit_amount?: number | null;
 welcome_credit_expires?: string | null;
};

type UserRole = {
 role: string;
};

// Function to load users with their PawBucks balances
// Uses pawbucks_wallet.balance for pet owners and merchant_pawbucks_wallet for merchants
// For shared account members, shows the owner's balance
const fetchUsersWithBalances = async (): Promise<User[]> => {
 const { data: profiles, error } = await supabase
 .from('profiles')
 .select('*')
 .order('created_at', { ascending: false });

 if (error) throw error;

 // Fetch pet owner wallet balances
 const { data: walletData } = await supabase
 .from('pawbucks_wallet')
 .select('user_id, balance');

 // Fetch merchant wallet balances - need to join with merchants to get user_id
 const { data: merchantsData } = await supabase
 .from('merchants')
 .select('id, user_id');

 const { data: merchantWalletData } = await supabase
 .from('merchant_pawbucks_wallet')
 .select('merchant_id, balance');

 // Fetch shared account memberships to find who shares with whom
 const { data: sharedMembers } = await supabase
 .from('shared_account_members')
 .select('member_id, owner_id')
 .eq('status','accepted');

 // Fetch welcome credit data
 const { data: welcomeCredits } = await supabase
 .from('user_welcome_credits')
 .select('user_id, status, credit_amount, expires_at');

 // Create a map of member_id to owner_id
 const memberToOwnerMap = new Map<string, string>();
 sharedMembers?.forEach(m => {
 memberToOwnerMap.set(m.member_id, m.owner_id);
 });

 // Create a map of user_id to pet owner wallet balance
 const petOwnerBalanceMap = new Map<string, number>();
 walletData?.forEach(wallet => {
 petOwnerBalanceMap.set(wallet.user_id, wallet.balance ?? 0);
 });

 // Create a map of merchant_id to merchant wallet balance
 const merchantBalanceByMerchantId = new Map<string, number>();
 merchantWalletData?.forEach(wallet => {
 merchantBalanceByMerchantId.set(wallet.merchant_id, wallet.balance ?? 0);
 });

 // Create a map of user_id to merchant_id
 const userToMerchantId = new Map<string, string>();
 merchantsData?.forEach(m => {
 if (m.user_id) {
 userToMerchantId.set(m.user_id, m.id);
 }
 });

 // Create a map of user_id to email for owner lookup
 const emailMap = new Map<string, string>();
 profiles?.forEach(p => {
 emailMap.set(p.id, p.email);
 });

 // Create a map of user_id to welcome credit info
 const welcomeCreditMap = new Map<string, { status: string; amount: number; expires_at: string }>();
 welcomeCredits?.forEach(wc => {
 welcomeCreditMap.set(wc.user_id, { status: wc.status, amount: wc.credit_amount, expires_at: wc.expires_at });
 });

 return (profiles || []).map(p => {
 const ownerId = memberToOwnerMap.get(p.id);
 
 // Determine balance based on user type
 let effectiveBalance = 0;
 
 if (ownerId) {
 // Shared member - use owner's balance
 effectiveBalance = petOwnerBalanceMap.get(ownerId) ?? 0;
 } else if (p.user_type ==='merchant') {
 // Merchant - use merchant_pawbucks_wallet
 const merchantId = userToMerchantId.get(p.id);
 if (merchantId) {
 effectiveBalance = merchantBalanceByMerchantId.get(merchantId) ?? 0;
 }
 } else {
 // Pet owner - use pawbucks_wallet
 effectiveBalance = petOwnerBalanceMap.get(p.id) ?? 0;
 }
 
 const wc = welcomeCreditMap.get(p.id);
 return {
 ...p,
 pawbucks_balance: effectiveBalance,
 shared_with_owner: ownerId ? emailMap.get(ownerId) : undefined,
 welcome_credit_status: wc?.status ?? null,
 welcome_credit_amount: wc?.amount ?? null,
 welcome_credit_expires: wc?.expires_at ?? null,
 };
 });
};

export function UsersTab() {
 const navigate = useNavigate();
 const queryClient = useQueryClient();
 const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
 const [searchTerm, setSearchTerm] = useState('');
 const [selectedUser, setSelectedUser] = useState<User | null>(null);
 const [editDialogOpen, setEditDialogOpen] = useState(false);
 const [roleDialogOpen, setRoleDialogOpen] = useState(false);
 const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
 const [selectedRole, setSelectedRole] = useState<string>('user');
 const [loading, setLoading] = useState(false);

 // Use React Query for user data - this allows cache invalidation
 const { data: users = [], refetch, isLoading } = useQuery({
 queryKey: ['admin-users-with-pawbucks'],
 queryFn: fetchUsersWithBalances,
 staleTime: 30000, // Consider data stale after 30 seconds
 });

 // Subscribe to real-time PawBucks activity changes for both pet owners and merchants
 useEffect(() => {
 const channel = supabase
 .channel('admin-users-pawbucks-updates')
 .on(
'postgres_changes',
 {
 event:'*',
 schema:'public',
 table:'pawbucks_activity'
 },
 () => {
 // Refetch users when pet owner PawBucks activity changes
 queryClient.invalidateQueries({ queryKey: ['admin-users-with-pawbucks'] });
 }
 )
 .on(
'postgres_changes',
 {
 event:'*',
 schema:'public',
 table:'merchant_pawbucks_activity'
 },
 () => {
 // Refetch users when merchant PawBucks activity changes
 queryClient.invalidateQueries({ queryKey: ['admin-users-with-pawbucks'] });
 }
 )
 .on(
'postgres_changes',
 {
 event:'*',
 schema:'public',
 table:'pawbucks_wallet'
 },
 () => {
 // Refetch users when wallet balance changes directly
 queryClient.invalidateQueries({ queryKey: ['admin-users-with-pawbucks'] });
 }
 )
 .on(
'postgres_changes',
 {
 event:'*',
 schema:'public',
 table:'merchant_pawbucks_wallet'
 },
 () => {
 // Refetch users when merchant wallet balance changes directly
 queryClient.invalidateQueries({ queryKey: ['admin-users-with-pawbucks'] });
 }
 )
 .subscribe();

 return () => {
 supabase.removeChannel(channel);
 };
 }, [queryClient]);

 // Debounce search term for better performance
 const debouncedSearchTerm = useDebounce(searchTerm, 300);

 // Filter users based on debounced search term
 useEffect(() => {
 if (debouncedSearchTerm) {
 const filtered = users.filter(user =>
 user.email.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
 user.full_name.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
 );
 setFilteredUsers(filtered);
 } else {
 setFilteredUsers(users);
 }
 }, [debouncedSearchTerm, users]);

 const handleRefresh = useCallback(() => {
 refetch();
 toast.success('User data refreshed');
 }, [refetch]);

 const handleUpdateUser = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!selectedUser) return;

 setLoading(true);
 try {
 const { error } = await supabase
 .from('profiles')
 .update({
 full_name: selectedUser.full_name,
 phone: selectedUser.phone,
 })
 .eq('id', selectedUser.id);

 if (error) throw error;

 // Log admin action
 await supabase.rpc('log_admin_action', {
 _action:'UPDATE_USER',
 _entity_type:'user',
 _entity_id: selectedUser.id,
 _changes: { full_name: selectedUser.full_name, phone: selectedUser.phone },
 });

 toast.success('User updated successfully');
 setEditDialogOpen(false);
 refetch();
 } catch (error: any) {
 toast.error(error.message);
 } finally {
 setLoading(false);
 }
 };

 const handleUpdateRole = async () => {
 if (!selectedUser) return;

 setLoading(true);
 try {
 const { data, error } = await supabase.functions.invoke('admin-update-user-role', {
 body: {
 user_id: selectedUser.id,
 role: selectedRole,
 },
 });

 if (error) throw error;
 if (data?.error) throw new Error(data.error);

 // Log admin action
 await supabase.rpc('log_admin_action', {
 _action:'UPDATE_USER_ROLE',
 _entity_type:'user',
 _entity_id: selectedUser.id,
 _changes: { role: selectedRole },
 });

 toast.success('User role updated successfully');
 setRoleDialogOpen(false);
 refetch();
 } catch (error: any) {
 toast.error(error.message ||'Failed to update role');
 } finally {
 setLoading(false);
 }
 };

 return (
 <div className="space-y-6">
 <div className="flex justify-between items-center">
 <div>
 <h2 className="text-3xl font-bold">User Management</h2>
 <p className="text-muted-foreground">Manage all platform users</p>
 </div>
 <Button
 variant="outline"
 size="sm"
 onClick={handleRefresh}
 disabled={isLoading}
 className="flex items-center gap-2"
 >
 <RefreshCw className={`w-4 h-4 ${isLoading ?'animate-spin' :''}`} />
 Refresh
 </Button>
 </div>

 <div className="flex gap-4">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
 <Input
 placeholder="Search by email or name..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="pl-10"
 />
 </div>
 </div>

 <div className="border rounded-lg overflow-x-auto">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Name</TableHead>
 <TableHead>Email</TableHead>
 <TableHead>Type</TableHead>
 <TableHead>PawBucks</TableHead>
 <TableHead>Welcome Credit</TableHead>
 <TableHead>Phone</TableHead>
 <TableHead>Joined</TableHead>
 <TableHead className="text-right">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {filteredUsers.map((user) => (
 <TableRow key={user.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/admin/users/${user.id}`)}>
 <TableCell className="font-medium">{user.full_name}</TableCell>
 <TableCell>
 <div>
 {user.email}
 {user.shared_with_owner && (
 <span className="block text-xs text-warning font-medium">
 🔗 Shares with {user.shared_with_owner}
 </span>
 )}
 </div>
 </TableCell>
 <TableCell>
 <Badge variant={user.user_type ==='merchant' ?'default' :'secondary'}>
 {user.user_type}
 </Badge>
 </TableCell>
 <TableCell>
 <span className="flex items-center gap-1 text-primary font-medium">
 <Coins className="w-3 h-3" />
 {(user.pawbucks_balance ?? 0).toLocaleString()}
 {user.shared_with_owner && (
 <span className="text-xs text-muted-foreground ml-1">(shared)</span>
 )}
 </span>
 </TableCell>
 <TableCell>
 {user.welcome_credit_status ? (
 <div className="flex flex-col gap-0.5">
 <Badge
 variant="outline"
 className={
 user.welcome_credit_status ==='active'
 ?'bg-success/10 text-success dark:text-success border-success/30/30'
 : user.welcome_credit_status ==='used'
 ?'bg-info/10 text-info dark:text-info border-info/30/30'
 : user.welcome_credit_status ==='expired'
 ?'bg-muted text-muted-foreground border-border'
 :'bg-destructive/10 text-destructive dark:text-destructive border-destructive/30/30'
 }
 >
 <Gift className="w-3 h-3 mr-1" />
 {user.welcome_credit_status ==='active' ? `$${((user.welcome_credit_amount ?? 0) / 1000).toFixed(0)} Active` : user.welcome_credit_status.charAt(0).toUpperCase() + user.welcome_credit_status.slice(1)}
 </Badge>
 {user.welcome_credit_status ==='active' && user.welcome_credit_expires && (
 <span className="text-xs text-muted-foreground">
 Exp {new Date(user.welcome_credit_expires).toLocaleDateString()}
 </span>
 )}
 </div>
 ) : (
 <span className="text-xs text-muted-foreground">—</span>
 )}
 </TableCell>
 <TableCell>{user.phone ||'N/A'}</TableCell>
 <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
 <TableCell className="text-right" onClick={e => e.stopPropagation()}>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => {
 setSelectedUser(user);
 setEditDialogOpen(true);
 }}
 >
 <Edit className="w-4 h-4" />
 </Button>
 <Button
 variant="ghost"
 size="sm"
 onClick={async () => {
 setSelectedUser(user);
 // Load the user's current role before opening dialog
 const { data: roleData } = await supabase
 .from('user_roles')
 .select('role')
 .eq('user_id', user.id);
 const currentRole = roleData?.[0]?.role ||'user';
 setSelectedRole(currentRole);
 setRoleDialogOpen(true);
 }}
 >
 <Shield className="w-4 h-4" />
 </Button>
 {user.user_type ==='pet_owner' && (
 <Button
 variant="ghost"
 size="sm"
 onClick={() => {
 setSelectedUser(user);
 setUpgradeDialogOpen(true);
 }}
 title="Upgrade Subscription"
 >
 <Crown className="w-4 h-4" />
 </Button>
 )}
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>

 <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Edit User</DialogTitle>
 <DialogDescription>Update user information</DialogDescription>
 </DialogHeader>
 {selectedUser && (
 <form onSubmit={handleUpdateUser} className="space-y-4">
 <div className="space-y-2">
 <Label>Full Name</Label>
 <Input
 value={selectedUser.full_name}
 onChange={(e) => setSelectedUser({ ...selectedUser, full_name: e.target.value })}
 />
 </div>
 <div className="space-y-2">
 <Label>Phone</Label>
 <Input
 value={selectedUser.phone ||''}
 onChange={(e) => setSelectedUser({ ...selectedUser, phone: e.target.value })}
 />
 </div>
 <Button type="submit" disabled={loading} className="w-full">
 {loading ?'Updating...' :'Update User'}
 </Button>
 </form>
 )}
 </DialogContent>
 </Dialog>

 <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Manage User Role</DialogTitle>
 <DialogDescription>Assign admin or user role</DialogDescription>
 </DialogHeader>
 <div className="space-y-4">
 <Select value={selectedRole} onValueChange={setSelectedRole}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="user">User</SelectItem>
 <SelectItem value="admin">Admin</SelectItem>
 <SelectItem value="superadmin">SuperAdmin</SelectItem>
 </SelectContent>
 </Select>
 <Button onClick={handleUpdateRole} disabled={loading} className="w-full">
 {loading ?'Updating...' :'Update Role'}
 </Button>
 </div>
 </DialogContent>
 </Dialog>

 <UpgradeSubscriptionDialog
 user={selectedUser}
 open={upgradeDialogOpen}
 onOpenChange={setUpgradeDialogOpen}
 onSuccess={() => refetch()}
 />
 </div>
 );
}
