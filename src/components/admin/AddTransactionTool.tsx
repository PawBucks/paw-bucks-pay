import { useState } from"react";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from"@/components/ui/select";
import { supabase } from"@/integrations/supabase/client";
import { toast } from"sonner";
import { Loader2, Plus, Search, DollarSign } from "lucide-react";

type Merchant = {
 id: string;
 business_name: string;
 cashback_rate: number;
};

type Profile = {
 id: string;
 email: string;
 full_name: string;
};

export const AddTransactionTool = () => {
 const [userEmail, setUserEmail] = useState("");
 const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
 const [merchants, setMerchants] = useState<Merchant[]>([]);
 const [selectedMerchant, setSelectedMerchant] = useState<string>("");
 const [amount, setAmount] = useState("");
 const [description, setDescription] = useState("");
 const [searching, setSearching] = useState(false);
 const [submitting, setSubmitting] = useState(false);
 const [loadingMerchants, setLoadingMerchants] = useState(false);

 const searchUser = async () => {
 if (!userEmail.trim()) {
 toast.error("Please enter an email address");
 return;
 }

 setSearching(true);
 try {
 const { data, error } = await supabase
 .from('profiles')
 .select('id, email, full_name')
 .ilike('email', `%${userEmail}%`)
 .limit(1)
 .single();

 if (error || !data) {
 toast.error("User not found");
 setSelectedUser(null);
 return;
 }

 setSelectedUser(data);
 toast.success(`Found user: ${data.full_name || data.email}`);
 } catch (err) {
 toast.error("Failed to search user");
 } finally {
 setSearching(false);
 }
 };

 const loadMerchants = async () => {
 if (merchants.length > 0) return;
 
 setLoadingMerchants(true);
 try {
 const { data, error } = await supabase
 .from('merchants')
 .select('id, business_name, cashback_rate')
 .order('business_name');

 if (error) throw error;
 setMerchants(data || []);
 } catch (err) {
 toast.error("Failed to load merchants");
 } finally {
 setLoadingMerchants(false);
 }
 };

 const handleSubmit = async () => {
 if (!selectedUser) {
 toast.error("Please search and select a user first");
 return;
 }
 if (!selectedMerchant) {
 toast.error("Please select a merchant");
 return;
 }
 if (!amount || parseFloat(amount) <= 0) {
 toast.error("Please enter a valid amount");
 return;
 }

 setSubmitting(true);
 try {
 const { data, error } = await supabase.functions.invoke('admin-add-transaction', {
 body: {
 user_id: selectedUser.id,
 merchant_id: selectedMerchant,
 amount: parseFloat(amount),
 description: description || undefined,
 },
 });

 if (error) throw error;

 if (data.success) {
 toast.success(
 `Transaction created! ${data.transaction.user_email} earned ${data.transaction.pawbucks_earned} PawBucks from $${data.transaction.amount} at ${data.transaction.merchant_name}`
 );
 
 // Reset form
 setUserEmail("");
 setSelectedUser(null);
 setSelectedMerchant("");
 setAmount("");
 setDescription("");
 } else {
 throw new Error(data.error ||'Unknown error');
 }
 } catch (err: any) {
 console.error('Failed to add transaction:', err);
 toast.error(err.message ||"Failed to add transaction");
 } finally {
 setSubmitting(false);
 }
 };

 const selectedMerchantData = merchants.find(m => m.id === selectedMerchant);

 return (
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Plus className="w-5 h-5" />
 Add Manual Transaction
 </CardTitle>
 <CardDescription>
 Create a transaction record for missing payments (e.g., webhook failures)
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 {/* User Search */}
 <div className="space-y-2">
 <Label>User Email</Label>
 <div className="flex gap-2">
 <Input
 placeholder="Search by email..."
 value={userEmail}
 onChange={(e) => setUserEmail(e.target.value)}
 onKeyDown={(e) => e.key ==='Enter' && searchUser()}
 />
 <Button onClick={searchUser} disabled={searching} variant="secondary">
 {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
 </Button>
 </div>
 {selectedUser && (
 <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
 <p className="font-medium">{selectedUser.full_name ||'No name'}</p>
 <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
 </div>
 )}
 </div>

 {/* Merchant Selection */}
 <div className="space-y-2">
 <Label>Merchant</Label>
 <Select 
 value={selectedMerchant} 
 onValueChange={setSelectedMerchant}
 onOpenChange={(open) => open && loadMerchants()}
 >
 <SelectTrigger>
 <SelectValue placeholder={loadingMerchants ?"Loading..." :"Select merchant"} />
 </SelectTrigger>
 <SelectContent>
 {merchants.map((merchant) => (
 <SelectItem key={merchant.id} value={merchant.id}>
 {merchant.business_name} ({merchant.cashback_rate}x PawBucks)
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 {/* Amount */}
 <div className="space-y-2">
 <Label>Transaction Amount (USD)</Label>
 <div className="relative">
 <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
 <Input
 type="number"
 step="0.01"
 min="0.01"
 max="100000"
 placeholder="0.00"
 value={amount}
 onChange={(e) => setAmount(e.target.value)}
 className="pl-9"
 />
 </div>
 {amount && parseFloat(amount) > 0 && (
 <p className="text-sm text-muted-foreground">
 User will earn {Math.floor(parseFloat(amount) * 10)} - {Math.floor(parseFloat(amount) * 30)} PawBucks (10x-30x based on subscription tier)
 </p>
 )}
 </div>

 {/* Description */}
 <div className="space-y-2">
 <Label>Description (optional)</Label>
 <Input
 placeholder="e.g., Missing webhook transaction from Dec 5"
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 />
 </div>

 {/* Submit */}
 <Button 
 onClick={handleSubmit} 
 disabled={submitting || !selectedUser || !selectedMerchant || !amount}
 className="w-full"
 >
 {submitting ? (
 <>
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 Creating Transaction...
 </>
 ) : (
 <>
 <Plus className="w-4 h-4 mr-2" />
 Add Transaction
 </>
 )}
 </Button>
 </CardContent>
 </Card>
 );
};
