import { useState } from'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from'@/components/ui/card';
import { Button } from'@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from'@/components/ui/select';
import { Badge } from'@/components/ui/badge';
import { CreditCard, Eye, EyeOff, Loader2, CheckCircle2 } from'lucide-react';
import { supabase } from'@/integrations/supabase/client';
import { toast } from'sonner';

interface StripeSettingsCardProps {
 payoutSchedule: string;
 onPayoutScheduleChange: (schedule: string) => void;
 saving: boolean;
}

export function StripeSettingsCard({ payoutSchedule, onPayoutScheduleChange, saving }: StripeSettingsCardProps) {
 const [showKey, setShowKey] = useState(false);
 const [verifying, setVerifying] = useState(false);
 const [stripeStatus, setStripeStatus] = useState<'unknown' |'connected' |'error'>('unknown');

 const verifyStripeConnection = async () => {
 setVerifying(true);
 try {
 const { data: { session } } = await supabase.auth.getSession();
 if (!session) throw new Error('Not authenticated');

 const { data, error } = await supabase.functions.invoke('admin-verify-stripe', {
 headers: { Authorization: `Bearer ${session.access_token}` },
 });

 if (error) throw error;
 setStripeStatus(data?.connected ?'connected' :'error');
 toast.success(data?.connected ?'✅ Stripe connection verified' :'❌ Stripe connection issue detected');
 } catch (err) {
 console.error('Stripe verification error:', err);
 setStripeStatus('error');
 toast.error('Could not verify Stripe connection');
 } finally {
 setVerifying(false);
 }
 };

 return (
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <CreditCard className="w-5 h-5 text-primary" />
 Stripe Configuration
 </CardTitle>
 <CardDescription>
 Manage payment processing keys and payout settings
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-6">
 {/* API Key Status */}
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <div>
 <p className="font-medium text-sm">Secret Key</p>
 <p className="text-xs text-muted-foreground">Used for server-side payment processing</p>
 </div>
 <div className="flex items-center gap-2">
 <Badge variant="outline" className="bg-success/10 text-success border-success/30/30">
 Configured
 </Badge>
 <Button variant="ghost" size="icon" onClick={() => setShowKey(!showKey)} className="h-8 w-8">
 {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
 </Button>
 </div>
 </div>
 <div className="bg-muted rounded-md p-3 font-mono text-xs">
 {showKey ?'sk_live_••••••••••••••••' :'••••••••••••••••••••••••••••••••'}
 </div>
 </div>

 {/* Publishable Key */}
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <div>
 <p className="font-medium text-sm">Publishable Key</p>
 <p className="text-xs text-muted-foreground">Used for client-side Stripe Elements</p>
 </div>
 <Badge variant="outline" className="bg-success/10 text-success border-success/30/30">
 Configured
 </Badge>
 </div>
 <div className="bg-muted rounded-md p-3 font-mono text-xs">
 pk_live_••••••••••••••••
 </div>
 </div>

 {/* Webhook Secrets */}
 <div className="space-y-2">
 <p className="font-medium text-sm">Webhook Secrets</p>
 <div className="grid gap-2">
 <div className="flex items-center justify-between bg-muted rounded-md p-3">
 <span className="text-xs">Platform Webhook</span>
 <Badge variant="outline" className="bg-success/10 text-success border-success/30/30 text-xs">
 Active
 </Badge>
 </div>
 <div className="flex items-center justify-between bg-muted rounded-md p-3">
 <span className="text-xs">Connect Webhook</span>
 <Badge variant="outline" className="bg-success/10 text-success border-success/30/30 text-xs">
 Active
 </Badge>
 </div>
 </div>
 </div>

 {/* Payout Schedule */}
 <div className="space-y-2">
 <p className="font-medium text-sm">Default Payout Schedule</p>
 <p className="text-xs text-muted-foreground">How often merchants receive their payouts</p>
 <Select value={payoutSchedule} onValueChange={onPayoutScheduleChange} disabled={saving}>
 <SelectTrigger className="w-full">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="daily">Daily</SelectItem>
 <SelectItem value="weekly">Weekly</SelectItem>
 <SelectItem value="monthly">Monthly</SelectItem>
 </SelectContent>
 </Select>
 </div>

 {/* Verify Connection */}
 <Button onClick={verifyStripeConnection} disabled={verifying} variant="outline" className="w-full">
 {verifying ? (
 <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying...</>
 ) : stripeStatus ==='connected' ? (
 <><CheckCircle2 className="h-4 w-4 mr-2 text-success" /> Connection Verified</>
 ) : (
'Verify Stripe Connection'
 )}
 </Button>
 </CardContent>
 </Card>
 );
}
