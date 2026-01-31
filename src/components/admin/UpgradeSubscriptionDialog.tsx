import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Crown, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

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
    name: 'PawPass',
    price: '$10/mo',
    multiplier: '20x',
    icon: Crown,
    description: 'Double rewards at partner merchants',
  },
  pawpass_plus: {
    name: 'PawPass+',
    price: '$20/mo',
    multiplier: '30x',
    icon: Sparkles,
    description: 'Triple rewards + ad-free experience',
  },
};

export function UpgradeSubscriptionDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: UpgradeSubscriptionDialogProps) {
  const [selectedTier, setSelectedTier] = useState<'pawpass' | 'pawpass_plus'>('pawpass');
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-upgrade-subscription', {
        body: {
          user_id: user.id,
          tier: selectedTier,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success(data.message || `User upgraded to ${SUBSCRIPTION_TIERS[selectedTier].name}`);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to upgrade subscription';
      console.error('Error upgrading subscription:', error);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const isPetOwner = user.user_type === 'pet_owner';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Upgrade Subscription
          </DialogTitle>
          <DialogDescription>
            Manually upgrade {user.full_name || user.email} to a PawPass subscription plan.
          </DialogDescription>
        </DialogHeader>

        {!isPetOwner ? (
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Only pet owners can be upgraded to subscription plans. This user is a{' '}
              <Badge variant="secondary">{user.user_type}</Badge>.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Subscription Tier</Label>
              <RadioGroup
                value={selectedTier}
                onValueChange={(v) => setSelectedTier(v as 'pawpass' | 'pawpass_plus')}
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
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <RadioGroupItem value={key} id={key} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <TierIcon className="h-4 w-4 text-primary" />
                            <span className="font-medium">{tier.name}</span>
                            <Badge variant="secondary" className="ml-auto">
                              {tier.price}
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

            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="text-muted-foreground">
                <strong>Note:</strong> This will create a subscription in Stripe. The user will need
                to add a payment method to continue the subscription after the initial period.
              </p>
            </div>

            <Button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Upgrading...' : `Upgrade to ${SUBSCRIPTION_TIERS[selectedTier].name}`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
