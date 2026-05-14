import { Card, CardContent, CardDescription, CardHeader, CardTitle } from'@/components/ui/card';
import { Switch } from'@/components/ui/switch';
import { Input } from'@/components/ui/input';
import { Label } from'@/components/ui/label';
import { Bell, Loader2 } from "lucide-react";

interface NotificationSetting {
 key: string;
 value: any;
 description: string;
}

interface NotificationSettingsCardProps {
 settings: NotificationSetting[];
 onToggle: (key: string, value: any) => void;
 saving: boolean;
 loading: boolean;
}

export function NotificationSettingsCard({ settings, onToggle, saving, loading }: NotificationSettingsCardProps) {
 const toggleSettings = settings.filter(s => 
 typeof s.value ==='boolean' || s.value ==='true' || s.value ==='false'
 );
 const numericSettings = settings.filter(s => 
 typeof s.value ==='number' || (!isNaN(Number(s.value)) && s.value !=='true' && s.value !=='false' && typeof s.value !=='boolean')
 );

 const getBoolValue = (val: any): boolean => {
 if (typeof val ==='boolean') return val;
 return val ==='true' || val === true;
 };

 const formatLabel = (key: string) => {
 return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
 };

 return (
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Bell className="w-5 h-5 text-primary" aria-hidden="true" />
 Notification & Email Settings
 </CardTitle>
 <CardDescription>
 Configure platform notification channels and alert thresholds
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-5">
 {loading ? (
 <div className="flex items-center justify-center py-8">
 <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
 </div>
 ) : (
 <>
 {/* Toggle Settings */}
 <div className="space-y-3">
 <p className="text-sm font-medium text-muted-foreground">Channels</p>
 {toggleSettings.map(s => (
 <div key={s.key} className="flex items-center justify-between py-2">
 <div className="space-y-0.5">
 <p className="font-medium text-sm">{formatLabel(s.key)}</p>
 <p className="text-xs text-muted-foreground">{s.description}</p>
 </div>
 <Switch
 checked={getBoolValue(s.value)}
 onCheckedChange={(checked) => onToggle(s.key, checked)}
 disabled={saving}
 />
 </div>
 ))}
 </div>

 {/* Numeric Settings */}
 {numericSettings.length > 0 && (
 <div className="space-y-3">
 <p className="text-sm font-medium text-muted-foreground">Thresholds</p>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {numericSettings.map(s => (
 <div key={s.key} className="space-y-2">
 <Label>{formatLabel(s.key)}</Label>
 <Input
 type="number"
 value={Number(s.value)}
 onChange={(e) => onToggle(s.key, Number(e.target.value))}
 disabled={saving}
 />
 <p className="text-xs text-muted-foreground">{s.description}</p>
 </div>
 ))}
 </div>
 </div>
 )}
 </>
 )}
 </CardContent>
 </Card>
 );
}
