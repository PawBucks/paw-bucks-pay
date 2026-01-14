import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Edit, Shield, Coins, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

type User = {
  id: string;
  email: string;
  full_name: string;
  user_type: string;
  created_at: string;
  phone?: string;
  pawbucks_balance?: number;
  shared_with_owner?: string; // Owner's email if this user is a shared member
};

type UserRole = {
  role: string;
};

// Function to load users with their PawBucks balances
// Uses pawbucks_wallet.balance as the single source of truth
// For shared account members, shows the owner's balance
const fetchUsersWithBalances = async (): Promise<User[]> => {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Fetch wallet balances directly - this is the authoritative source
  const { data: walletData } = await supabase
    .from('pawbucks_wallet')
    .select('user_id, balance');

  // Fetch shared account memberships to find who shares with whom
  const { data: sharedMembers } = await supabase
    .from('shared_account_members')
    .select('member_id, owner_id')
    .eq('status', 'accepted');

  // Create a map of member_id to owner_id
  const memberToOwnerMap = new Map<string, string>();
  sharedMembers?.forEach(m => {
    memberToOwnerMap.set(m.member_id, m.owner_id);
  });

  // Create a map of user_id to wallet balance
  const balanceMap = new Map<string, number>();
  walletData?.forEach(wallet => {
    balanceMap.set(wallet.user_id, wallet.balance ?? 0);
  });

  // Create a map of user_id to email for owner lookup
  const emailMap = new Map<string, string>();
  profiles?.forEach(p => {
    emailMap.set(p.id, p.email);
  });

  return (profiles || []).map(p => {
    const ownerId = memberToOwnerMap.get(p.id);
    // If user is a shared member, use owner's balance; otherwise use their own
    const effectiveBalance = ownerId 
      ? balanceMap.get(ownerId) ?? 0 
      : balanceMap.get(p.id) ?? 0;
    
    return {
      ...p,
      pawbucks_balance: effectiveBalance,
      shared_with_owner: ownerId ? emailMap.get(ownerId) : undefined
    };
  });
};

export function UsersTab() {
  const queryClient = useQueryClient();
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('user');
  const [loading, setLoading] = useState(false);

  // Use React Query for user data - this allows cache invalidation
  const { data: users = [], refetch, isLoading } = useQuery({
    queryKey: ['admin-users-with-pawbucks'],
    queryFn: fetchUsersWithBalances,
    staleTime: 30000, // Consider data stale after 30 seconds
  });

  // Subscribe to real-time PawBucks activity changes
  useEffect(() => {
    const channel = supabase
      .channel('admin-users-pawbucks-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pawbucks_activity'
        },
        () => {
          // Refetch users when PawBucks activity changes
          queryClient.invalidateQueries({ queryKey: ['admin-users-with-pawbucks'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Filter users based on search term
  useEffect(() => {
    if (searchTerm) {
      const filtered = users.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.full_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [searchTerm, users]);

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
        _action: 'UPDATE_USER',
        _entity_type: 'user',
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
      // First, remove existing role
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', selectedUser.id);

      // Then add new role
      const { error } = await supabase
        .from('user_roles')
        .insert([{ user_id: selectedUser.id, role: selectedRole as 'admin' | 'user' }]);

      if (error) throw error;

      // Log admin action
      await supabase.rpc('log_admin_action', {
        _action: 'UPDATE_USER_ROLE',
        _entity_type: 'user',
        _entity_id: selectedUser.id,
        _changes: { role: selectedRole },
      });

      toast.success('User role updated successfully');
      setRoleDialogOpen(false);
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
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
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

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>PawBucks</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.full_name}</TableCell>
                <TableCell>
                  <div>
                    {user.email}
                    {user.shared_with_owner && (
                      <span className="block text-xs text-amber-600 font-medium">
                        🔗 Shares with {user.shared_with_owner}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={user.user_type === 'merchant' ? 'default' : 'secondary'}>
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
                <TableCell>{user.phone || 'N/A'}</TableCell>
                <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
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
                    onClick={() => {
                      setSelectedUser(user);
                      setRoleDialogOpen(true);
                    }}
                  >
                    <Shield className="w-4 h-4" />
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
                  value={selectedUser.phone || ''}
                  onChange={(e) => setSelectedUser({ ...selectedUser, phone: e.target.value })}
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Updating...' : 'Update User'}
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
              </SelectContent>
            </Select>
            <Button onClick={handleUpdateRole} disabled={loading} className="w-full">
              {loading ? 'Updating...' : 'Update Role'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
