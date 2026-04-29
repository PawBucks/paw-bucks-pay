import { useState, useEffect } from"react";
import { supabase } from"@/integrations/supabase/client";
import { GradientCard } from"@/components/ui/gradient-card";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Switch } from"@/components/ui/switch";
import { Textarea } from"@/components/ui/textarea";
import { Checkbox } from"@/components/ui/checkbox";
import { Badge } from"@/components/ui/badge";
import { Loader2, RefreshCw, Send, CheckCircle, Clock, TrendingUp } from"lucide-react";
import { toast } from"sonner";

interface GroomingRebookSettingsProps {
 merchantId: string;
}

interface RebookSettings {
 id?: string;
 is_enabled: boolean;
 rebook_interval_days: number;
 message_template: string;
 max_reminders_per_cycle: number;
 reminder_channels: string[];
}

interface RebookStats {
 totalSent: number;
 totalRebooked: number;
 pending: number;
}

const DEFAULT_TEMPLATE ="Hi {{owner_name}}, it's been a while since {{pet_name}}'s last grooming! We have openings available. Book now to keep {{pet_name}} looking great!";

export function GroomingRebookSettings({ merchantId }: GroomingRebookSettingsProps) {
 const [settings, setSettings] = useState<RebookSettings>({
 is_enabled: true,
 rebook_interval_days: 42,
 message_template: DEFAULT_TEMPLATE,
 max_reminders_per_cycle: 2,
 reminder_channels: ["push","email"],
 });
 const [stats, setStats] = useState<RebookStats>({ totalSent: 0, totalRebooked: 0, pending: 0 });
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);

 useEffect(() => {
 loadSettings();
 loadStats();
 }, [merchantId]);

 const loadSettings = async () => {
 const { data, error } = await supabase
 .from("grooming_rebook_settings")
 .select("*")
 .eq("merchant_id", merchantId)
 .maybeSingle();

 if (data) {
 setSettings({
 id: data.id,
 is_enabled: data.is_enabled,
 rebook_interval_days: data.rebook_interval_days,
 message_template: data.message_template,
 max_reminders_per_cycle: data.max_reminders_per_cycle,
 reminder_channels: data.reminder_channels as string[],
 });
 }
 setLoading(false);
 };

 const loadStats = async () => {
 const { data: logs } = await supabase
 .from("grooming_rebook_log")
 .select("status")
 .eq("merchant_id", merchantId);

 if (logs) {
 setStats({
 totalSent: logs.length,
 totalRebooked: logs.filter(l => l.status ==="rebooked").length,
 pending: logs.filter(l => l.status ==="sent").length,
 });
 }
 };

 const handleSave = async () => {
 setSaving(true);
 try {
 const payload = {
 merchant_id: merchantId,
 is_enabled: settings.is_enabled,
 rebook_interval_days: settings.rebook_interval_days,
 message_template: settings.message_template,
 max_reminders_per_cycle: settings.max_reminders_per_cycle,
 reminder_channels: settings.reminder_channels,
 };

 if (settings.id) {
 const { error } = await supabase
 .from("grooming_rebook_settings")
 .update(payload)
 .eq("id", settings.id);
 if (error) throw error;
 } else {
 const { data, error } = await supabase
 .from("grooming_rebook_settings")
 .insert(payload)
 .select()
 .single();
 if (error) throw error;
 setSettings(prev => ({ ...prev, id: data.id }));
 }

 toast.success("Rebooking settings saved!");
 } catch (error) {
 console.error("Error saving rebook settings:", error);
 toast.error("Failed to save settings");
 } finally {
 setSaving(false);
 }
 };

 const toggleChannel = (channel: string) => {
 setSettings(prev => ({
 ...prev,
 reminder_channels: prev.reminder_channels.includes(channel)
 ? prev.reminder_channels.filter(c => c !== channel)
 : [...prev.reminder_channels, channel],
 }));
 };

 const conversionRate = stats.totalSent > 0
 ? Math.round((stats.totalRebooked / stats.totalSent) * 100)
 : 0;

 if (loading) {
 return (
 <div className="flex items-center justify-center py-8">
 <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
 </div>
 );
 }

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h3 className="text-lg font-semibold flex items-center gap-2">
 <RefreshCw className="w-5 h-5 text-primary" />
 Automated Rebooking
 </h3>
 <p className="text-sm text-muted-foreground">
 Automatically remind clients when it's time for their next grooming visit
 </p>
 </div>
 <Switch
 checked={settings.is_enabled}
 onCheckedChange={(checked) => setSettings(prev => ({ ...prev, is_enabled: checked }))}
 />
 </div>

 {/* Stats */}
 <div className="grid grid-cols-3 gap-3">
 <GradientCard className="p-3 text-center">
 <Send className="w-4 h-4 mx-auto text-primary mb-1" />
 <p className="text-xl font-bold">{stats.totalSent}</p>
 <p className="text-xs text-muted-foreground">Reminders Sent</p>
 </GradientCard>
 <GradientCard className="p-3 text-center">
 <CheckCircle className="w-4 h-4 mx-auto text-success0 mb-1" />
 <p className="text-xl font-bold">{stats.totalRebooked}</p>
 <p className="text-xs text-muted-foreground">Rebooked</p>
 </GradientCard>
 <GradientCard className="p-3 text-center">
 <TrendingUp className="w-4 h-4 mx-auto text-accent mb-1" />
 <p className="text-xl font-bold">{conversionRate}%</p>
 <p className="text-xs text-muted-foreground">Conversion</p>
 </GradientCard>
 </div>

 {settings.is_enabled && (
 <div className="space-y-4">
 {/* Interval */}
 <div className="space-y-2">
 <Label htmlFor="interval">Remind after (days since last visit)</Label>
 <div className="flex items-center gap-2">
 <Input
 id="interval"
 type="number"
 min={7}
 max={180}
 value={settings.rebook_interval_days}
 onChange={(e) => setSettings(prev => ({ ...prev, rebook_interval_days: parseInt(e.target.value) || 42 }))}
 className="w-24"
 />
 <span className="text-sm text-muted-foreground">
 ({Math.round(settings.rebook_interval_days / 7)} weeks)
 </span>
 </div>
 </div>

 {/* Max reminders */}
 <div className="space-y-2">
 <Label htmlFor="maxReminders">Max reminders per cycle</Label>
 <Input
 id="maxReminders"
 type="number"
 min={1}
 max={5}
 value={settings.max_reminders_per_cycle}
 onChange={(e) => setSettings(prev => ({ ...prev, max_reminders_per_cycle: parseInt(e.target.value) || 2 }))}
 className="w-24"
 />
 <p className="text-xs text-muted-foreground">Reminders are spaced at least 1 week apart</p>
 </div>

 {/* Channels */}
 <div className="space-y-2">
 <Label>Notification Channels</Label>
 <div className="flex flex-wrap gap-4">
 {[
 { id:"push", label:"In-App Push" },
 { id:"email", label:"Email" },
 { id:"sms", label:"SMS" },
 ].map(ch => (
 <label key={ch.id} className="flex items-center gap-2 cursor-pointer">
 <Checkbox
 checked={settings.reminder_channels.includes(ch.id)}
 onCheckedChange={() => toggleChannel(ch.id)}
 />
 <span className="text-sm">{ch.label}</span>
 {ch.id ==="sms" && (
 <Badge variant="outline" className="text-xs">Requires Twilio</Badge>
 )}
 </label>
 ))}
 </div>
 </div>

 {/* Message template */}
 <div className="space-y-2">
 <Label htmlFor="template">Message Template</Label>
 <Textarea
 id="template"
 value={settings.message_template}
 onChange={(e) => setSettings(prev => ({ ...prev, message_template: e.target.value }))}
 rows={4}
 placeholder="Use {{owner_name}} and {{pet_name}} as placeholders"
 />
 <p className="text-xs text-muted-foreground">
 Available placeholders: <code className="bg-muted px-1 rounded">{"{{owner_name}}"}</code>, <code className="bg-muted px-1 rounded">{"{{pet_name}}"}</code>
 </p>
 </div>

 {/* Preview */}
 <GradientCard className="p-4">
 <p className="text-xs font-medium text-muted-foreground mb-2">Preview:</p>
 <p className="text-sm">
 {settings.message_template
 .replace(/\{\{owner_name\}\}/g,"Sarah")
 .replace(/\{\{pet_name\}\}/g,"Max")}
 </p>
 </GradientCard>
 </div>
 )}

 <Button onClick={handleSave} disabled={saving} className="w-full">
 {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
 Save Rebooking Settings
 </Button>
 </div>
 );
}
