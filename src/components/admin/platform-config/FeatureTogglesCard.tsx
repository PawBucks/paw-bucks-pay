import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ToggleLeft, Loader2 } from 'lucide-react';

interface FeatureToggle {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

interface FeatureTogglesCardProps {
  features: FeatureToggle[];
  onToggle: (key: string, enabled: boolean) => void;
  saving: boolean;
  loading: boolean;
}

export function FeatureTogglesCard({ features, onToggle, saving, loading }: FeatureTogglesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ToggleLeft className="w-5 h-5 text-primary" />
          Feature Toggles
        </CardTitle>
        <CardDescription>
          Enable or disable platform-wide features
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          features.map((feature) => (
            <div key={feature.key} className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <p className="font-medium text-sm">{feature.label}</p>
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              </div>
              <Switch
                checked={feature.enabled}
                onCheckedChange={(checked) => onToggle(feature.key, checked)}
                disabled={saving}
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
