import { useState } from'react';
import { supabase } from'@/integrations/supabase/client';
import { Button } from'@/components/ui/button';
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogHeader,
 DialogTitle,
} from'@/components/ui/dialog';
import { Label } from'@/components/ui/label';
import { RadioGroup, RadioGroupItem } from'@/components/ui/radio-group';
import { Badge } from'@/components/ui/badge';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from'@/components/ui/select';
import { Crown } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { toast } from'sonner';

type User = {
 id: string;
 email: string;
 full_name: string;
 user_type: string;
};

interface UpgradeSubscriptionDialogProps {
 user: User | null;
 open: boolean;
 onOpenChange: (open: boolean) => void;
 onSuccess?: () => void;
}

const SUBSCRIPTION_TIERS = {
 pawpass: {
 name:'PawPass',
 price:'$10/mo',
 multiplier:'20x',
 icon: Crown,
 description:'Double rewards at partner merchants',
 },
 pawpass_plus: {
 name:'PawPass+',
 price:'$20/mo',
 multiplier:'30x',
 icon: Sparkles,
 description:'Triple rewards + ad-free experience',
 },
};

const DURATION_OPTIONS = [
 { value: 7, label:'7 days' },
 { value: 14, label:'14 days' },
 { value: 30, label:'30 days' },
 { value: 60, label:'60 days' },
 { value: 90, label:'90 days' },
 { value: 180, label:'6 months' },
 { value: 365, label:'1 year' },
];

export function UpgradeSubscriptionDialog({
 user,
 open,
 onOpenChange,
 onSuccess,
}: UpgradeSubscriptionDialogProps) {
 const [selectedTier, setSelectedTier] = useState<'pawpass' |'pawpass_plus'>('pawpass');
 const [durationDays, setDurationDays] = useState<number>(30);
 const [loading, setLoading] = useState(false);

 const handleUpgrade = async () => {
 if (!user) return;

 setLoading(true);
 try {
 const { data, error } = await supabase.functions.invoke('admin-upgrade-subscription', {
 body: {
 user_id: user.id,
 tier: selectedTier,
 duration_days: durationDays,
 },
 });

 if (error) throw error;

 if (data?.error) {
 throw new Error(data.error);
 }

 const expiresAt = data.expires_at ? new Date(data.expires_at).toLocaleDateString() :'';
 toast.success(`${user.full_name || user.email} upgraded to ${SUBSCRIPTION_TIERS[selectedTier].name} until ${expiresAt}`);
 onOpenChange(false);
 onSuccess?.();
 } catch (error: unknown) {
 const errorMessage = error instanceof Error ? error.message :'Failed to upgrade subscription';
 console.error('Error upgrading subscription:', error);
 toast.error(errorMessage);
 } finally {
 setLoading(false);
 }
 };

 if (!user) return null;

 const isPetOwner = user.user_type ==='pet_owner';
 const expirationDate = new Date();
 expirationDate.setDate(expirationDate.getDate() + durationDays);

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="sm:max-w-md">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <span className="h-5 w-5 text-primary" aria-hidden="true">👑</span>
 Grant Complimentary Subscription
 </DialogTitle>
 <DialogDescription>
 Manually upgrade {user.full_name || user.email} to a PawPass subscription plan without requiring payment.
 </DialogDescription>
 </DialogHeader>

 {!isPetOwner ? (
 <div className="py-4">
 <p className="text-sm text-muted-foreground">
 Only pet owners can be upgraded to subscription plans. This user is a{''}
 <Badge variant="secondary">{user.user_type}</Badge>.
 </p>
 </div>
 ) : (
 <div className="space-y-4 py-4">
 <div className="space-y-2">
 <Label>Select Subscription Tier</Label>
 <RadioGroup
 value={selectedTier}
 onValueChange={(v) => setSelectedTier(v as'pawpass' |'pawpass_plus')}
 className="space-y-3"
 >
 {(Object.entries(SUBSCRIPTION_TIERS) as [keyof typeof SUBSCRIPTION_TIERS, typeof SUBSCRIPTION_TIERS['pawpass']][]).map(
 ([key, tier]) => {
 const TierIcon = tier.icon;
 return (
 <label
 key={key}
 className={`flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${
 selectedTier === key
 ?'border-primary bg-primary/5'
 :'border-border hover:border-primary'
 }`}
 >
 <RadioGroupItem value={key} id={key} />
 <div className="flex-1">
 <div className="flex items-center gap-2">
 <TierIcon className="h-4 w-4 text-primary" />
 <span className="font-medium">{tier.name}</span>
 <Badge variant="outline" className="ml-auto text-xs">
 {tier.price} value
 </Badge>
 </div>
 <p className="text-sm text-muted-foreground mt-1">
 {tier.description} ({tier.multiplier} rewards)
 </p>
 </div>
 </label>
 );
 }
 )}
 </RadioGroup>
 </div>

 <div className="space-y-2">
 <Label className="flex items-center gap-2">
 <span className="h-4 w-4" aria-hidden="true">📅</span>
 Subscription Duration
 </Label>
 <Select
 value={durationDays.toString()}
 onValueChange={(v) => setDurationDays(parseInt(v))}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select duration" />
 </SelectTrigger>
 <SelectContent>
 {DURATION_OPTIONS.map((option) => (
 <SelectItem key={option.value} value={option.value.toString()}>
 {option.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 <p className="text-xs text-muted-foreground">
 Expires: {expirationDate.toLocaleDateString('en-US', { 
 weekday:'long', 
 year:'numeric', 
 month:'long', 
 day:'numeric' 
 })}
 </p>
 </div>

 <div className="bg-muted rounded-lg p-3 text-sm space-y-2">
 <p className="text-muted-foreground">
 <strong>Note:</strong> This is a complimentary subscription that does not require payment from the user.
 </p>
 <ul className="text-muted-foreground text-xs space-y-1 list-disc list-inside">
 <li>User will be notified of their upgrade immediately</li>
 <li>Reminder notifications sent 7 days and 24 hours before expiration</li>
 <li>Automatically reverts to free plan when duration ends</li>
 </ul>
 </div>

 <Button
 onClick={handleUpgrade}
 disabled={loading}
 className="w-full"
 >
 {loading ?'Upgrading...' : `Grant ${SUBSCRIPTION_TIERS[selectedTier].name} for ${DURATION_OPTIONS.find(d => d.value === durationDays)?.label}`}
 </Button>
 </div>
 )}
 </DialogContent>
 </Dialog>
 );
}
