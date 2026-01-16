import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { PawBucksManagementTool } from './PawBucksManagementTool';
import { PawBucksCalculator } from './PawBucksCalculator';

export function RewardsTab() {
  const [settings, setSettings] = useState({
    earnRate: 10,
    conversionRate: 1000,
    cashbackRate: 10,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .in('key', ['pawbucks_earn_rate', 'pawbucks_conversion', 'default_cashback_rate']);

      if (error) throw error;

      if (data) {
        const earnRate = data.find(s => s.key === 'pawbucks_earn_rate');
        const conversionRate = data.find(s => s.key === 'pawbucks_conversion');
        const cashbackRate = data.find(s => s.key === 'default_cashback_rate');

        setSettings({
          earnRate: (earnRate?.value as any)?.rate || 10,
          conversionRate: (conversionRate?.value as any)?.rate || 1000,
          cashbackRate: (cashbackRate?.value as any)?.rate || 10,
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load reward settings');
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      // Update earn rate
      await supabase
        .from('platform_settings')
        .upsert({
          key: 'pawbucks_earn_rate',
          value: { rate: settings.earnRate, description: 'PawBucks earned per $1 spent' },
        });

      // Update conversion rate
      await supabase
        .from('platform_settings')
        .upsert({
          key: 'pawbucks_conversion',
          value: { rate: settings.conversionRate, description: 'PawBucks needed for $1 credit' },
        });

      // Update cashback rate
      await supabase
        .from('platform_settings')
        .upsert({
          key: 'default_cashback_rate',
          value: { rate: settings.cashbackRate, description: 'Default cashback percentage' },
        });

      await supabase.rpc('log_admin_action', {
        _action: 'UPDATE_REWARDS_SETTINGS',
        _entity_type: 'settings',
        _entity_id: null,
        _changes: settings,
      });

      toast.success('Reward settings updated successfully');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">PawBucks Rewards Management</h2>
        <p className="text-muted-foreground">Configure rewards and cashback settings</p>
      </div>

      {/* PawBucks Calculator */}
      <PawBucksCalculator />

      {/* PawBucks Management Tool */}
      <PawBucksManagementTool />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Earn Rate</CardTitle>
            <CardDescription>PawBucks earned per $1 spent</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Points per Dollar</Label>
              <Input
                type="number"
                value={settings.earnRate}
                onChange={(e) => setSettings({ ...settings, earnRate: parseFloat(e.target.value) })}
              />
              <p className="text-sm text-muted-foreground">
                Current: {settings.earnRate} PawBucks per $1
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conversion Rate</CardTitle>
            <CardDescription>PawBucks needed for $1 credit</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Points to Dollar</Label>
              <Input
                type="number"
                value={settings.conversionRate}
                onChange={(e) => setSettings({ ...settings, conversionRate: parseFloat(e.target.value) })}
              />
              <p className="text-sm text-muted-foreground">
                Current: {settings.conversionRate} PawBucks = $1
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Default Points Rate</CardTitle>
            <CardDescription>Platform-wide points multiplier</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Points Multiplier (x)</Label>
              <Input
                type="number"
                step="0.1"
                value={settings.cashbackRate}
                onChange={(e) => setSettings({ ...settings, cashbackRate: parseFloat(e.target.value) })}
              />
              <p className="text-sm text-muted-foreground">
                Current: {settings.cashbackRate}x points multiplier
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-center">
          <CardContent className="pt-6">
            <Button onClick={handleSaveSettings} disabled={loading} className="w-full" size="lg">
              {loading ? 'Saving...' : 'Save All Settings'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
