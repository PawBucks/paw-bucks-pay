import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Shield } from 'lucide-react';
import { TwoFactorSetup } from './TwoFactorSetup';
import { Separator } from '@/components/ui/separator';

export function SettingsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">System Settings</h2>
        <p className="text-muted-foreground">Configure platform settings and security</p>
      </div>

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
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full dark:bg-green-900/30 dark:text-green-400">
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
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full dark:bg-green-900/30 dark:text-green-400">
                  Enabled
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* Platform Configuration Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Platform Configuration
          </CardTitle>
          <CardDescription>
            Manage Stripe keys, payout schedules, and feature toggles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Settings management interface coming soon. For now, configure settings through the backend.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
