import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Coins, Search, Loader2, CheckCircle, User } from 'lucide-react';

type UserResult = {
  id: string;
  email: string;
  full_name: string;
  balance: number | null;
};

const MAX_CREDIT_AMOUNT = 100000;

export function PawBucksCreditTool() {
  const [searchEmail, setSearchEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<UserResult | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [reason, setReason] = useState('');
  const [crediting, setCrediting] = useState(false);
  const [lastCredited, setLastCredited] = useState<{ email: string; amount: number } | null>(null);

  const handleSearch = async () => {
    if (!searchEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    setSearching(true);
    setFoundUser(null);
    setLastCredited(null);

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

      // Get their PawBucks wallet balance
      const { data: wallet } = await supabase
        .from('pawbucks_wallet')
        .select('balance')
        .eq('user_id', data.id)
        .single();

      setFoundUser({
        ...data,
        balance: wallet?.balance ?? 0,
      });
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search for user');
    } finally {
      setSearching(false);
    }
  };

  const handleCredit = async () => {
    if (!foundUser) return;

    const amount = parseInt(creditAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid positive amount');
      return;
    }

    if (amount > MAX_CREDIT_AMOUNT) {
      toast.error(`Maximum credit amount is ${MAX_CREDIT_AMOUNT.toLocaleString()} PawBucks`);
      return;
    }

    if (!reason.trim() || reason.trim().length < 5) {
      toast.error('Please provide a reason (at least 5 characters)');
      return;
    }

    if (reason.length > 500) {
      toast.error('Reason must be less than 500 characters');
      return;
    }

    setCrediting(true);

    try {
      // Call the secure edge function instead of direct database updates
      const { data, error } = await supabase.functions.invoke('admin-credit-pawbucks', {
        body: {
          userId: foundUser.id,
          amount,
          reason: reason.trim()
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to credit PawBucks');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success(`Successfully credited ${amount} PawBucks to ${foundUser.email}`);
      setLastCredited({ email: foundUser.email, amount });
      
      // Update displayed balance from server response
      setFoundUser({
        ...foundUser,
        balance: data.newBalance ?? (foundUser.balance ?? 0) + amount,
      });
      
      // Reset form
      setCreditAmount('');
      setReason('');
    } catch (error: any) {
      console.error('Credit error:', error);
      toast.error(error.message || 'Failed to credit PawBucks');
    } finally {
      setCrediting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-primary" />
          Manual PawBucks Credit
        </CardTitle>
        <CardDescription>
          Credit PawBucks to a user's wallet for refunds, compensation, or promotions (max {MAX_CREDIT_AMOUNT.toLocaleString()} per operation)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search Section */}
        <div className="space-y-3">
          <Label>Search User by Email</Label>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="user@example.com"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={searching}>
              {searching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* User Found Section */}
        {foundUser && (
          <div className="p-4 rounded-lg bg-muted/50 border space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{foundUser.full_name || 'No name'}</p>
                <p className="text-sm text-muted-foreground">{foundUser.email}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-sm text-muted-foreground">Current Balance</p>
                <p className="font-bold text-lg text-primary">{foundUser.balance?.toLocaleString() ?? 0} PawBucks</p>
              </div>
            </div>

            <div className="grid gap-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="creditAmount">Amount to Credit (max {MAX_CREDIT_AMOUNT.toLocaleString()})</Label>
                <Input
                  id="creditAmount"
                  type="number"
                  min="1"
                  max={MAX_CREDIT_AMOUNT}
                  placeholder="e.g., 200"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Credit (required, 5-500 characters)</Label>
                <Textarea
                  id="reason"
                  placeholder="e.g., Compensation for missed webhook transaction"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  maxLength={500}
                />
              </div>
              <Button 
                onClick={handleCredit} 
                disabled={crediting || !creditAmount || !reason}
                className="w-full"
              >
                {crediting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Coins className="w-4 h-4 mr-2" />
                    Credit {creditAmount || '0'} PawBucks
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Success Confirmation */}
        {lastCredited && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600">
            <CheckCircle className="w-5 h-5" />
            <span>
              Credited <strong>{lastCredited.amount.toLocaleString()} PawBucks</strong> to {lastCredited.email}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
