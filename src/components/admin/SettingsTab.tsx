import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Gift, Loader2 } from 'lucide-react';
import { TwoFactorSetup } from './TwoFactorSetup';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { PlatformConfigSection } from './platform-config/PlatformConfigSection';

export function SettingsTab() {
  const [welcomeCreditEnabled, setWelcomeCreditEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    loadWelcomeCreditSetting();
  }, []);

  const loadWelcomeCreditSetting = async () => {
    try {
      const { data } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'welcome_credit_enabled')
        .maybeSingle();

      if (data) {
        setWelcomeCreditEnabled(data.value === true || data.value === 'true');
      } else {
        setWelcomeCreditEnabled(true);
      }
    } catch (err) {
      console.error('Error loading welcome credit setting:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleWelcomeCredit = async (enabled: boolean) => {
    setToggling(true);
    try {
      const { error } = await supabase
        .from('platform_settings')
        .upsert({
          key: 'welcome_credit_enabled',
          value: enabled as unknown as any,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      if (error) throw error;

      setWelcomeCreditEnabled(enabled);
      toast.success(
        enabled
          ? '✅ Welcome Credit program restarted — new signups will receive tiered credits (Series A/B/C/Standard)'
          : '⏸️ Welcome Credit program paused — new signups will NOT receive credits'
      );
    } catch (err) {
      console.error('Error toggling welcome credit:', err);
      toast.error('Failed to update Welcome Credit setting');
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">System Settings</h2>
        <p className="text-muted-foreground">Configure platform settings and security</p>
      </div>

      {/* Welcome Credit Program Control */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          <h3 className="text-xl font-semibold">Promotions</h3>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                Welcome Credit Program
              </span>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : (
                <Badge
                  variant="outline"
                  className={
                    welcomeCreditEnabled
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                      : 'bg-destructive/10 text-destructive border-destructive/30'
                  }
                >
                  {welcomeCreditEnabled ? 'Active' : 'Paused'}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Control whether new pet owner signups receive welcome credits. Tiers: Series A ($250, first 500),
              Series B ($150, next 1,000), Series C ($75, next 2,500), Standard ($50, unlimited).
              Credits expire monthly if unused. Existing funds are not affected.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-medium">
                  {welcomeCreditEnabled ? 'Program is running' : 'Program is paused'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {welcomeCreditEnabled
                    ? 'New pet owners receive tiered welcome credits based on available spots. Credits expire monthly if unused.'
                    : 'New pet owners will NOT receive welcome credits on signup.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {toggling && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                <Switch
                  checked={welcomeCreditEnabled}
                  onCheckedChange={handleToggleWelcomeCredit}
                  disabled={loading || toggling}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Security Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="text-xl font-semibold">Security Settings</h3>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          <TwoFactorSetup />
          
          <Card>
            <CardHeader>
              <CardTitle>Session Security</CardTitle>
              <CardDescription>
                Manage login sessions and security policies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-logout</p>
                  <p className="text-sm text-muted-foreground">
                    Sessions expire after 15 minutes of inactivity
                  </p>
                </div>
                <span className="px-2 py-1 bg-emerald-500/10 text-emerald-700 text-xs rounded-full dark:text-emerald-400">
                  Enabled
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Admin Role Verification</p>
                  <p className="text-sm text-muted-foreground">
                    Server-side role checks on all admin actions
                  </p>
                </div>
                <span className="px-2 py-1 bg-emerald-500/10 text-emerald-700 text-xs rounded-full dark:text-emerald-400">
                  Enabled
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* Platform Configuration Section - Fully Built Out */}
      <PlatformConfigSection />
    </div>
  );
}
