import { useState, useEffect } from'react';
import { Settings, Loader2, Save } from'lucide-react';
import { Button } from'@/components/ui/button';
import { supabase } from'@/integrations/supabase/client';
import { toast } from'sonner';
import { StripeSettingsCard } from'./StripeSettingsCard';
import { FeatureTogglesCard } from'./FeatureTogglesCard';
import { PlatformFeesCard } from'./PlatformFeesCard';
import { NotificationSettingsCard } from'./NotificationSettingsCard';

const FEATURE_TOGGLE_KEYS = [
 { key:'pawbucks_enabled', label:'PawBucks Rewards', description:'Enable PawBucks reward currency across the platform' },
 { key:'pet_fund_enabled', label:'Pet Fund Program', description:'Enable welcome Pet Fund credits for new pet owners' },
 { key:'referrals_enabled', label:'Referral Program', description:'Enable referral bonuses for inviting new users' },
 { key:'merchant_marketplace_enabled', label:'Merchant Marketplace', description:'Enable the merchant marketplace and discovery features' },
];

export function PlatformConfigSection() {
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [hasChanges, setHasChanges] = useState(false);

 // Fee settings
 const [platformFee, setPlatformFee] = useState('3');
 const [cashbackRate, setCashbackRate] = useState('10');
 const [pawbucksEarnRate, setPawbucksEarnRate] = useState('10');
 const [pawbucksConversion, setPawbucksConversion] = useState('1000');
 const [payoutSchedule, setPayoutSchedule] = useState('daily');

 // Feature toggles
 const [features, setFeatures] = useState<{ key: string; label: string; description: string; enabled: boolean }[]>([]);

 // Notification settings
 const [notificationSettings, setNotificationSettings] = useState<{ key: string; value: any; description: string }[]>([]);

 useEffect(() => {
 loadAllSettings();
 }, []);

 const loadAllSettings = async () => {
 try {
 const [platformRes, notifRes] = await Promise.all([
 supabase.from('platform_settings').select('*'),
 supabase.from('platform_notification_settings').select('*'),
 ]);

 if (platformRes.data) {
 const settings = platformRes.data.reduce((acc: Record<string, any>, s: any) => {
 acc[s.key] = s.value;
 return acc;
 }, {});

 setPlatformFee(settings.platform_fee?.rate?.toString() ||'3');
 setCashbackRate(settings.default_cashback_rate?.rate?.toString() ||'10');
 setPawbucksEarnRate(settings.pawbucks_earn_rate?.rate?.toString() ||'10');
 setPawbucksConversion(settings.pawbucks_conversion?.rate?.toString() ||'1000');
 setPayoutSchedule(settings.payout_schedule?.schedule ||'daily');

 setFeatures(FEATURE_TOGGLE_KEYS.map(f => ({
 ...f,
 enabled: settings[f.key]?.enabled !== false,
 })));
 }

 if (notifRes.data) {
 setNotificationSettings(notifRes.data.map((s: any) => ({
 key: s.setting_key,
 value: s.setting_value,
 description: s.description ||'',
 })));
 }
 } catch (err) {
 console.error('Error loading settings:', err);
 toast.error('Failed to load platform settings');
 } finally {
 setLoading(false);
 }
 };

 const handleFeatureToggle = (key: string, enabled: boolean) => {
 setFeatures(prev => prev.map(f => f.key === key ? { ...f, enabled } : f));
 setHasChanges(true);
 };

 const handleNotificationChange = (key: string, value: any) => {
 setNotificationSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s));
 setHasChanges(true);
 };

 const handlePayoutChange = (schedule: string) => {
 setPayoutSchedule(schedule);
 setHasChanges(true);
 };

 const markChanged = (setter: (v: string) => void) => (val: string) => {
 setter(val);
 setHasChanges(true);
 };

 const saveAllSettings = async () => {
 setSaving(true);
 try {
 const now = new Date().toISOString();

 // Save platform fee settings
 const feeUpdates = [
 { key:'platform_fee', value: { description:'Platform fee percentage on transactions', rate: Number(platformFee) } as unknown as any, updated_at: now },
 { key:'default_cashback_rate', value: { description:'Default cashback percentage', rate: Number(cashbackRate) } as unknown as any, updated_at: now },
 { key:'pawbucks_earn_rate', value: { description:'PawBucks earned per $1 spent', rate: Number(pawbucksEarnRate) } as unknown as any, updated_at: now },
 { key:'pawbucks_conversion', value: { description:'PawBucks needed for $1 credit', rate: Number(pawbucksConversion) } as unknown as any, updated_at: now },
 { key:'payout_schedule', value: { description:'Merchant payout schedule', schedule: payoutSchedule } as unknown as any, updated_at: now },
 ];

 // Save feature toggles
 const featureUpdates = features.map(f => ({
 key: f.key,
 value: { description: f.description, enabled: f.enabled } as unknown as any,
 updated_at: now,
 }));

 const allPlatformUpdates = [...feeUpdates, ...featureUpdates];

 // Batch upsert platform settings
 for (const update of allPlatformUpdates) {
 const { error } = await supabase
 .from('platform_settings')
 .upsert(update, { onConflict:'key' });
 if (error) throw error;
 }

 // Save notification settings
 for (const ns of notificationSettings) {
 const { error } = await supabase
 .from('platform_notification_settings')
 .update({ setting_value: ns.value as unknown as any, updated_at: now })
 .eq('setting_key', ns.key);
 if (error) throw error;
 }

 setHasChanges(false);
 toast.success('All platform settings saved successfully');
 } catch (err) {
 console.error('Error saving settings:', err);
 toast.error('Failed to save settings');
 } finally {
 setSaving(false);
 }
 };

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Settings className="w-5 h-5 text-primary" />
 <h3 className="text-xl font-semibold">Platform Configuration</h3>
 </div>
 <Button
 onClick={saveAllSettings}
 disabled={saving || !hasChanges}
 className="gap-2"
 >
 {saving ? (
 <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
 ) : (
 <><Save className="h-4 w-4" /> Save All Changes</>
 )}
 </Button>
 </div>

 <div className="grid gap-6 lg:grid-cols-2">
 <StripeSettingsCard
 payoutSchedule={payoutSchedule}
 onPayoutScheduleChange={handlePayoutChange}
 saving={saving}
 />
 <FeatureTogglesCard
 features={features}
 onToggle={handleFeatureToggle}
 saving={saving}
 loading={loading}
 />
 <PlatformFeesCard
 platformFee={platformFee}
 cashbackRate={cashbackRate}
 pawbucksEarnRate={pawbucksEarnRate}
 pawbucksConversion={pawbucksConversion}
 onPlatformFeeChange={markChanged(setPlatformFee)}
 onCashbackRateChange={markChanged(setCashbackRate)}
 onPawbucksEarnRateChange={markChanged(setPawbucksEarnRate)}
 onPawbucksConversionChange={markChanged(setPawbucksConversion)}
 saving={saving}
 loading={loading}
 />
 <NotificationSettingsCard
 settings={notificationSettings}
 onToggle={handleNotificationChange}
 saving={saving}
 loading={loading}
 />
 </div>
 </div>
 );
}
