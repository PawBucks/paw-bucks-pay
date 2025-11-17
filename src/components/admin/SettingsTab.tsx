import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings } from 'lucide-react';

export function SettingsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">System Settings</h2>
        <p className="text-muted-foreground">Configure platform settings and integrations</p>
      </div>

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
