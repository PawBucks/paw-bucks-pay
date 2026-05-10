import { useState, useEffect } from'react';
import { supabase } from'@/integrations/supabase/client';
import { useAuth } from'@/hooks/useAuth';
import { useQueryClient } from'@tanstack/react-query';
import { Button } from'@/components/ui/button';
import { Input } from'@/components/ui/input';
import { Label } from'@/components/ui/label';
import { Textarea } from'@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from'@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from'@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from'@/components/ui/select';
import { toast } from'sonner';
import { Search, Loader2, CheckCircle, User, Plus, Minus } from "lucide-react";

type UserResult = {
 id: string;
 email: string;
 full_name: string;
 balance: number;
 effectiveUserId?: string; // Owner's ID if this user is a shared member
 sharedWithOwner?: string; // Owner's email if shared
};

type MerchantResult = {
 id: string;
 business_name: string;
 email?: string;
 balance: number;
};

const MAX_AMOUNT_ADMIN = 250000;
const MAX_AMOUNT_SUPERADMIN = 750000;

export function PawBucksManagementTool() {
 const { user } = useAuth();
 const queryClient = useQueryClient();
 const [isSuperAdmin, setIsSuperAdmin] = useState(false);
 const [targetType, setTargetType] = useState<'user' |'merchant'>('user');
 const [operation, setOperation] = useState<'credit' |'debit'>('credit');
 
 // User search
 const [searchEmail, setSearchEmail] = useState('');
 const [searching, setSearching] = useState(false);
 const [foundUser, setFoundUser] = useState<UserResult | null>(null);
 
 // Merchant search
 const [searchMerchant, setSearchMerchant] = useState('');
 const [foundMerchant, setFoundMerchant] = useState<MerchantResult | null>(null);
 
 // Operation
 const [amount, setAmount] = useState('');
 const [reason, setReason] = useState('');
 const [processing, setProcessing] = useState(false);
 const [lastOperation, setLastOperation] = useState<{ target: string; amount: number; type: string } | null>(null);

 const maxAmount = isSuperAdmin ? MAX_AMOUNT_SUPERADMIN : MAX_AMOUNT_ADMIN;

 useEffect(() => {
 const checkSuperAdminRole = async () => {
 if (!user) return;
 const { data } = await supabase
 .from('user_roles')
 .select('role')
 .eq('user_id', user.id)
 .eq('role','superadmin')
 .maybeSingle();
 setIsSuperAdmin(!!data);
 };
 checkSuperAdminRole();
 }, [user]);

 const handleSearchUser = async () => {
 if (!searchEmail.trim()) {
 toast.error('Please enter an email address');
 return;
 }

 setSearching(true);
 setFoundUser(null);
 setFoundMerchant(null);
 setLastOperation(null);

 try {
 const { data, error } = await supabase
 .from('profiles')
 .select('id, email, full_name')
 .ilike('email', searchEmail.trim())
 .single();

 if (error || !data) {
 toast.error('User not found');
 return;
 }

 // Check if this user is a shared account member
 const { data: sharedMembership } = await supabase
 .from('shared_account_members')
 .select('owner_id')
 .eq('member_id', data.id)
 .eq('status','accepted')
 .maybeSingle();

 let effectiveUserId = data.id;
 let sharedWithOwner: string | undefined;

 if (sharedMembership?.owner_id) {
 effectiveUserId = sharedMembership.owner_id;
 // Get owner's email for display
 const { data: ownerProfile } = await supabase
 .from('profiles')
 .select('email')
 .eq('id', sharedMembership.owner_id)
 .single();
 sharedWithOwner = ownerProfile?.email;
 }

 // Get the effective wallet balance (owner's if shared)
 const { data: wallet } = await supabase
 .from('pawbucks_wallet')
 .select('balance')
 .eq('user_id', effectiveUserId)
 .maybeSingle();

 setFoundUser({
 ...data,
 balance: wallet?.balance ?? 0,
 effectiveUserId: sharedMembership?.owner_id ? effectiveUserId : undefined,
 sharedWithOwner,
 });
 } catch (error) {
 toast.error('Failed to search for user');
 } finally {
 setSearching(false);
 }
 };

 const handleSearchMerchant = async () => {
 if (!searchMerchant.trim()) {
 toast.error('Please enter a business name or email');
 return;
 }

 setSearching(true);
 setFoundUser(null);
 setFoundMerchant(null);
 setLastOperation(null);

 try {
 const { data, error } = await supabase
 .from('merchants')
 .select('id, business_name, email')
 .or(`business_name.ilike.%${searchMerchant.trim()}%,email.ilike.%${searchMerchant.trim()}%`)
 .limit(1)
 .single();

 if (error || !data) {
 toast.error('Merchant not found');
 return;
 }

 const { data: wallet } = await supabase
 .from('merchant_pawbucks_wallet')
 .select('balance')
 .eq('merchant_id', data.id)
 .maybeSingle();

 setFoundMerchant({
 ...data,
 balance: wallet?.balance ?? 0,
 });
 } catch (error) {
 toast.error('Failed to search for merchant');
 } finally {
 setSearching(false);
 }
 };

 const handleOperation = async () => {
 const amountNum = parseInt(amount, 10);
 if (isNaN(amountNum) || amountNum <= 0) {
 toast.error('Please enter a valid positive amount');
 return;
 }

 if (amountNum > maxAmount) {
 toast.error(`Maximum amount is ${maxAmount.toLocaleString()} PawBucks`);
 return;
 }

 if (!reason.trim() || reason.trim().length < 5) {
 toast.error('Please provide a reason (at least 5 characters)');
 return;
 }

 const target = targetType ==='user' ? foundUser : foundMerchant;
 if (!target) return;

 // For debit, check balance
 if (operation ==='debit' && target.balance < amountNum) {
 toast.error(`Insufficient balance. Current balance: ${target.balance.toLocaleString()} PawBucks`);
 return;
 }

 setProcessing(true);

 try {
 if (operation ==='credit') {
 // Credit operation
 if (targetType ==='user') {
 const { data, error } = await supabase.functions.invoke('admin-credit-pawbucks', {
 body: { userId: target.id, amount: amountNum, reason: reason.trim() }
 });
 if (error || data?.error) throw new Error(data?.error || error?.message);
 setFoundUser({ ...foundUser!, balance: data.newBalance });
 } else {
 // For merchants, update directly (we can add a dedicated edge function later)
 const { error: updateError } = await supabase
 .from('merchant_pawbucks_wallet')
 .update({ balance: target.balance + amountNum, last_updated: new Date().toISOString() })
 .eq('merchant_id', target.id);
 
 if (updateError) throw updateError;

 await supabase.from('merchant_pawbucks_activity').insert({
 merchant_id: target.id,
 amount: amountNum,
 type:'earn',
 source:'admin_credit',
 description: reason.trim()
 });

 setFoundMerchant({ ...foundMerchant!, balance: target.balance + amountNum });
 }
 } else {
 // Debit operation
 const { data, error } = await supabase.functions.invoke('admin-debit-pawbucks', {
 body: {
 targetId: target.id,
 targetType,
 amount: amountNum,
 reason: reason.trim()
 }
 });
 if (error || data?.error) throw new Error(data?.error || error?.message);
 
 if (targetType ==='user') {
 setFoundUser({ ...foundUser!, balance: data.newBalance });
 } else {
 setFoundMerchant({ ...foundMerchant!, balance: data.newBalance });
 }
 }

 const targetName = targetType ==='user' ? foundUser?.email : foundMerchant?.business_name;
 toast.success(`Successfully ${operation ==='credit' ?'credited' :'debited'} ${amountNum.toLocaleString()} PawBucks`);
 setLastOperation({ target: targetName ||'', amount: amountNum, type: operation });
 setAmount('');
 setReason('');

 // Invalidate all PawBucks-related queries to update balances across the platform
 if (targetType ==='user') {
 // Invalidate user wallet queries (various key formats used across the app)
 queryClient.invalidateQueries({ queryKey: ['pawbucks_wallet'] });
 queryClient.invalidateQueries({ queryKey: ['pawbucks-wallet'] });
 queryClient.invalidateQueries({ queryKey: ['pawbucks_wallet', target.id] });
 queryClient.invalidateQueries({ queryKey: ['pawbucks-wallet', target.id] });
 queryClient.invalidateQueries({ queryKey: ['pawbucks_activity'] });
 queryClient.invalidateQueries({ queryKey: ['pawbucks-activity'] });
 queryClient.invalidateQueries({ queryKey: ['pawbucks_activity', target.id] });
 queryClient.invalidateQueries({ queryKey: ['pawbucks-activity', target.id] });
 queryClient.invalidateQueries({ queryKey: ['wallet'] });
 queryClient.invalidateQueries({ queryKey: ['wallet', target.id] });
 } else {
 // Invalidate merchant wallet queries
 queryClient.invalidateQueries({ queryKey: ['merchant-pawbucks-wallet'] });
 queryClient.invalidateQueries({ queryKey: ['merchant-pawbucks-wallet', target.id] });
 queryClient.invalidateQueries({ queryKey: ['merchant-pawbucks-activity'] });
 queryClient.invalidateQueries({ queryKey: ['merchant-pawbucks-activity', target.id] });
 queryClient.invalidateQueries({ queryKey: ['merchant-analytics'] });
 }
 
 // Also invalidate admin-related queries
 queryClient.invalidateQueries({ queryKey: ['admin-analytics'] });
 queryClient.invalidateQueries({ queryKey: ['admin-users'] });
 queryClient.invalidateQueries({ queryKey: ['admin-users-with-pawbucks'] });
 } catch (error: any) {
 toast.error(error.message || `Failed to ${operation} PawBucks`);
 } finally {
 setProcessing(false);
 }
 };

 const target = targetType ==='user' ? foundUser : foundMerchant;

 return (
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <span className="w-5 h-5 text-primary" aria-hidden="true">🪙</span>
 PawBucks Management
 </CardTitle>
 <CardDescription>
 Credit or debit PawBucks for Pet Owners and Merchants (max {maxAmount.toLocaleString()} per operation)
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-6">
 {/* Target Type Selection */}
 <Tabs value={targetType} onValueChange={(v) => {
 setTargetType(v as'user' |'merchant');
 setFoundUser(null);
 setFoundMerchant(null);
 setLastOperation(null);
 }}>
 <TabsList className="grid w-full grid-cols-2">
 <TabsTrigger value="user" className="flex items-center gap-2">
 <span className="w-4 h-4" aria-hidden="true">👤</span>
 Pet Owner
 </TabsTrigger>
 <TabsTrigger value="merchant" className="flex items-center gap-2">
 <span className="w-4 h-4" aria-hidden="true">🏪</span>
 Merchant
 </TabsTrigger>
 </TabsList>

 <TabsContent value="user" className="space-y-4 mt-4">
 <div className="space-y-2">
 <Label>Search Pet Owner by Email</Label>
 <div className="flex gap-2">
 <Input
 type="email"
 placeholder="user@example.com"
 value={searchEmail}
 onChange={(e) => setSearchEmail(e.target.value)}
 onKeyDown={(e) => e.key ==='Enter' && handleSearchUser()}
 className="flex-1"
 />
 <Button onClick={handleSearchUser} disabled={searching}>
 {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
 </Button>
 </div>
 </div>
 </TabsContent>

 <TabsContent value="merchant" className="space-y-4 mt-4">
 <div className="space-y-2">
 <Label>Search Merchant by Name or Email</Label>
 <div className="flex gap-2">
 <Input
 placeholder="Business name or email"
 value={searchMerchant}
 onChange={(e) => setSearchMerchant(e.target.value)}
 onKeyDown={(e) => e.key ==='Enter' && handleSearchMerchant()}
 className="flex-1"
 />
 <Button onClick={handleSearchMerchant} disabled={searching}>
 {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
 </Button>
 </div>
 </div>
 </TabsContent>
 </Tabs>

 {/* Found Target */}
 {target && (
 <div className="p-4 rounded-lg bg-muted border space-y-4">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
 {targetType ==='user' ? <span className="w-5 h-5 text-primary" aria-hidden="true">👤</span> : <span className="w-5 h-5 text-primary" aria-hidden="true">🏪</span>}
 </div>
 <div>
 <p className="font-medium">
 {targetType ==='user' ? (foundUser?.full_name ||'No name') : foundMerchant?.business_name}
 </p>
 <p className="text-sm text-muted-foreground">
 {targetType ==='user' ? foundUser?.email : foundMerchant?.email ||'No email'}
 </p>
 {targetType ==='user' && foundUser?.sharedWithOwner && (
 <p className="text-xs text-warning font-medium mt-1">
 🔗 Shared account with {foundUser.sharedWithOwner}
 </p>
 )}
 </div>
 <div className="ml-auto text-right">
 <p className="text-sm text-muted-foreground">
 {targetType ==='user' && foundUser?.sharedWithOwner ?'Shared Wallet Balance' :'Current Balance'}
 </p>
 <p className="font-bold text-lg text-primary">{target.balance.toLocaleString()} PawBucks</p>
 </div>
 </div>

 <div className="grid gap-4 pt-2">
 {/* Operation Type */}
 <div className="space-y-2">
 <Label>Operation Type</Label>
 <Select value={operation} onValueChange={(v) => setOperation(v as'credit' |'debit')}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="credit">
 <span className="flex items-center gap-2">
 <Plus className="w-4 h-4 text-success" />
 Credit (Add)
 </span>
 </SelectItem>
 <SelectItem value="debit">
 <span className="flex items-center gap-2">
 <Minus className="w-4 h-4 text-destructive" />
 Debit (Remove)
 </span>
 </SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label>Amount (max {maxAmount.toLocaleString()})</Label>
 <Input
 type="number"
 min="1"
 max={maxAmount}
 placeholder="e.g., 200"
 value={amount}
 onChange={(e) => setAmount(e.target.value)}
 />
 </div>

 <div className="space-y-2">
 <Label>Reason (required, 5-500 characters)</Label>
 <Textarea
 placeholder={operation ==='credit' 
 ?"e.g., Compensation for missed transaction" 
 :"e.g., Fraudulent activity reversal"}
 value={reason}
 onChange={(e) => setReason(e.target.value)}
 rows={2}
 maxLength={500}
 />
 </div>

 <Button 
 onClick={handleOperation} 
 disabled={processing || !amount || !reason}
 variant={operation ==='debit' ?'destructive' :'default'}
 className="w-full"
 >
 {processing ? (
 <>
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 Processing...
 </>
 ) : (
 <>
 {operation ==='credit' ? <Plus className="w-4 h-4 mr-2" /> : <Minus className="w-4 h-4 mr-2" />}
 {operation ==='credit' ?'Credit' :'Debit'} {amount ||'0'} PawBucks
 </>
 )}
 </Button>
 </div>
 </div>
 )}

 {/* Success Confirmation */}
 {lastOperation && (
 <div className={`flex items-center gap-2 p-3 rounded-lg border ${
 lastOperation.type ==='credit' 
 ?'bg-success/10 border-success/20 text-success' 
 :'bg-destructive/10 border-destructive/20 text-destructive'
 }`}>
 <CheckCircle className="w-5 h-5" />
 <span>
 {lastOperation.type ==='credit' ?'Credited' :'Debited'}{''}
 <strong>{lastOperation.amount.toLocaleString()} PawBucks</strong>{''}
 {lastOperation.type ==='credit' ?'to' :'from'} {lastOperation.target}
 </span>
 </div>
 )}
 </CardContent>
 </Card>
 );
}
