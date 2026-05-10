import { useEffect, useState } from"react";
import { useNavigate } from"react-router-dom";
import { useAuth } from"@/hooks/useAuth";
import { supabase } from"@/integrations/supabase/client";
import { Header } from"@/components/Header";
import { BottomNav } from"@/components/BottomNav";
import { Button } from"@/components/ui/button";
import { GradientCard } from"@/components/ui/gradient-card";
import { Switch } from"@/components/ui/switch";
import { Label } from"@/components/ui/label";
import { RadioGroup, RadioGroupItem } from"@/components/ui/radio-group";
import { ArrowLeft, ShieldAlert, Loader2, Settings } from "lucide-react";
import { toast } from"sonner";

type NotificationPreferences = {
 id: string;
 user_id: string;
 security_alerts: boolean;
 marketing: boolean;
 transactional: boolean;
 delivery_method:"in_app" |"browser";
};

const NotificationPreferences = () => {
 const { user, signOut, loading: authLoading } = useAuth();
 const navigate = useNavigate();
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);

 // Local state for form
 const [securityAlerts, setSecurityAlerts] = useState(true);
 const [marketing, setMarketing] = useState(true);
 const [transactional, setTransactional] = useState(true);
 const [deliveryMethod, setDeliveryMethod] = useState<"in_app" |"browser">("in_app");

 useEffect(() => {
 if (!authLoading && !user) {
 navigate("/auth");
 }
 }, [user, authLoading, navigate]);

 useEffect(() => {
 if (user) {
 loadPreferences();
 }
 }, [user]);

 const loadPreferences = async () => {
 if (!user) return;

 try {
 const { data, error } = await supabase
 .from("notification_preferences")
 .select("*")
 .eq("user_id", user.id)
 .maybeSingle();

 if (error) throw error;

 if (data) {
 setPreferences(data as NotificationPreferences);
 setSecurityAlerts(data.security_alerts);
 setMarketing(data.marketing);
 setTransactional(data.transactional);
 setDeliveryMethod(data.delivery_method as"in_app" |"browser");
 } else {
 // No preferences yet, use defaults
 setPreferences(null);
 }
 } catch (error) {
 console.error("Error loading notification preferences:", error);
 toast.error("Failed to load preferences");
 } finally {
 setLoading(false);
 }
 };

 const handleSave = async () => {
 if (!user) return;

 setSaving(true);
 try {
 const prefsData = {
 user_id: user.id,
 security_alerts: securityAlerts,
 marketing,
 transactional,
 delivery_method: deliveryMethod,
 };

 if (preferences) {
 // Update existing
 const { error } = await supabase
 .from("notification_preferences")
 .update(prefsData)
 .eq("user_id", user.id);

 if (error) throw error;
 } else {
 // Insert new
 const { error } = await supabase
 .from("notification_preferences")
 .insert(prefsData);

 if (error) throw error;
 }

 toast.success("Notification preferences saved!");
 
 // Reload to confirm
 await loadPreferences();
 } catch (error) {
 console.error("Error saving notification preferences:", error);
 toast.error("Failed to save preferences");
 } finally {
 setSaving(false);
 }
 };

 const handleSignOut = async () => {
 await signOut();
 navigate("/auth");
 };

 if (loading || authLoading) {
 return (
 <div className="min-h-screen flex items-center justify-center">
 <Loader2 className="w-8 h-8 animate-spin text-primary" />
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-[var(--gradient-hero)]">
 <Header isAuthenticated={true} onLogout={handleSignOut} />
 <div className="container mx-auto px-4 pt-6 pb-24 md:pb-12 max-w-4xl lg:max-w-5xl">
 {/* Header */}
 <div className="flex items-center gap-3 mb-8">
 <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
 <ArrowLeft className="w-5 h-5" />
 </Button>
 <div className="flex items-center gap-2">
 <Settings className="w-6 h-6 text-primary" />
 <h1 className="text-2xl font-bold">Settings</h1>
 </div>
 </div>

 {/* Categories */}
 <GradientCard className="mb-6">
 <h2 className="text-lg font-semibold mb-4">Notification Categories</h2>
 <p className="text-sm text-muted-foreground mb-6">
 Choose which types of notifications you'd like to receive.
 </p>

 <div className="space-y-6">
 {/* Security Alerts */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
 <ShieldAlert className="w-5 h-5 text-destructive" />
 </div>
 <div>
 <Label className="font-medium">Security Alerts</Label>
 <p className="text-xs text-muted-foreground">
 Login attempts, password changes, suspicious activity
 </p>
 </div>
 </div>
 <Switch
 checked={securityAlerts}
 onCheckedChange={setSecurityAlerts}
 />
 </div>

 {/* Marketing */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
 <span className="w-5 h-5 text-primary" aria-hidden="true">📣</span>
 </div>
 <div>
 <Label className="font-medium">Marketing</Label>
 <p className="text-xs text-muted-foreground">
 Promotions, new features, special offers
 </p>
 </div>
 </div>
 <Switch
 checked={marketing}
 onCheckedChange={setMarketing}
 />
 </div>

 {/* Transactional */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
 <span className="w-5 h-5 text-accent" aria-hidden="true">🧾</span>
 </div>
 <div>
 <Label className="font-medium">Transactional</Label>
 <p className="text-xs text-muted-foreground">
 Payment confirmations, rewards earned, order updates
 </p>
 </div>
 </div>
 <Switch
 checked={transactional}
 onCheckedChange={setTransactional}
 />
 </div>
 </div>
 </GradientCard>

 {/* Delivery Method */}
 <GradientCard className="mb-6">
 <h2 className="text-lg font-semibold mb-4">Delivery Method</h2>
 <p className="text-sm text-muted-foreground mb-6">
 How would you like to receive notifications?
 </p>

 <RadioGroup
 value={deliveryMethod}
 onValueChange={(value) => setDeliveryMethod(value as"in_app" |"browser")}
 className="space-y-4"
 >
 <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/5 transition-colors">
 <RadioGroupItem value="in_app" id="in_app" />
 <div className="flex-1">
 <Label htmlFor="in_app" className="font-medium cursor-pointer">
 In-App Only
 </Label>
 <p className="text-xs text-muted-foreground">
 See notifications in the app's notification center and as toasts
 </p>
 </div>
 </div>

 <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/5 transition-colors">
 <RadioGroupItem value="browser" id="browser" />
 <div className="flex-1">
 <Label htmlFor="browser" className="font-medium cursor-pointer">
 Browser Notifications
 </Label>
 <p className="text-xs text-muted-foreground">
 Get browser push notifications even when the app isn't open (requires permission)
 </p>
 </div>
 </div>
 </RadioGroup>
 </GradientCard>

 {/* Manage Subscriptions */}
 <GradientCard className="mb-6">
 <h2 className="text-lg font-semibold mb-2">Subscription</h2>
 <p className="text-sm text-muted-foreground mb-4">
 View and manage your PawBucks subscription plan.
 </p>
 <Button
 variant="outline"
 className="w-full"
 onClick={() => navigate("/my-subscriptions")}
 >
 <span className="w-4 h-4 mr-2" aria-hidden="true">👑</span>
 Manage Subscriptions
 </Button>
 </GradientCard>

 {/* Save Button */}
 <Button
 className="w-full"
 onClick={handleSave}
 disabled={saving}
 >
 {saving ? (
 <>
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 Saving...
 </>
 ) : (
"Save Preferences"
 )}
 </Button>

 {/* Back Link */}
 <Button
 variant="ghost"
 className="w-full mt-3"
 onClick={() => navigate("/profile")}
 >
 Back to Profile
 </Button>
 </div>
 <BottomNav />
 </div>
 );
};

export default NotificationPreferences;