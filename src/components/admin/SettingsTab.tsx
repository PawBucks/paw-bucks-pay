import { Card, CardContent, CardDescription, CardHeader, CardTitle } from'@/components/ui/card';
import { Gift, Loader2, Shield, Coins } from "lucide-react";
import { TwoFactorSetup } from'./TwoFactorSetup';
import { Separator } from'@/components/ui/separator';
import { Switch } from'@/components/ui/switch';
import { Badge } from'@/components/ui/badge';
import { supabase } from'@/integrations/supabase/client';
import { toast } from'sonner';
import { useState, useEffect } from'react';
import { useAuth } from'@/hooks/useAuth';
import { PlatformConfigSection } from'./platform-config/PlatformConfigSection';

export function SettingsTab() {
 const { user } = useAuth();
 const [welcomeCreditEnabled, setWelcomeCreditEnabled] = useState(true);
 const [loading, setLoading] = useState(true);
 const [toggling, setToggling] = useState(false);
 const [isSuperAdmin, setIsSuperAdmin] = useState(false);
 const [petOwnerEarnEnabled, setPetOwnerEarnEnabled] = useState(true);
 const [earnToggling, setEarnToggling] = useState(false);

 useEffect(() => {
 loadWelcomeCreditSetting();
 loadPetOwnerEarnSetting();
 checkSuperAdmin();
 }, []);

 const checkSuperAdmin = async () => {
 if (!user) return;
 const { data } = await supabase
 .from('user_roles')
 .select('role')
 .eq('user_id', user.id)
 .eq('role','superadmin')
 .maybeSingle();
 setIsSuperAdmin(!!data);
 };

 const loadWelcomeCreditSetting = async () => {
 try {
 const { data } = await supabase
 .from('platform_settings')
 .select('value')
 .eq('key','welcome_credit_enabled')
 .maybeSingle();

 if (data) {
 setWelcomeCreditEnabled(data.value === true || data.value ==='true');
 } else {
 setWelcomeCreditEnabled(true);
 }
 } catch (err) {
 console.error('Error loading welcome credit setting:', err);
 } finally {
 setLoading(false);
 }
 };

 const loadPetOwnerEarnSetting = async () => {
  try {
   const { data } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key','pet_owner_pawbucks_earning_enabled')
    .maybeSingle();
   if (data) {
    const v: any = data.value;
    const enabled = v === true || v === 'true' || v?.enabled === true || v == null;
    setPetOwnerEarnEnabled(enabled);
   } else {
    setPetOwnerEarnEnabled(true);
   }
  } catch (err) {
   console.error('Error loading pet owner earn setting:', err);
  }
 };

 const handleTogglePetOwnerEarn = async (enabled: boolean) => {
  setEarnToggling(true);
  try {
   const { error } = await supabase
    .from('platform_settings')
    .upsert({
     key:'pet_owner_pawbucks_earning_enabled',
     value: { enabled, description:'Platform-wide kill switch for pet owner PawBucks earning' } as unknown as any,
     updated_at: new Date().toISOString(),
    }, { onConflict:'key' });
   if (error) throw error;
   setPetOwnerEarnEnabled(enabled);
   toast.success(
    enabled
     ?'PawBucks earning re-enabled — pet owners will earn PawBucks on purchases again'
     :'PawBucks earning paused — pet owners will NOT earn PawBucks on new purchases'
   );
  } catch (err) {
   console.error('Error toggling pet owner earn:', err);
   toast.error('Failed to update PawBucks earning setting');
  } finally {
   setEarnToggling(false);
  }
 };

 const handleToggleWelcomeCredit = async (enabled: boolean) => {
 setToggling(true);
 try {
 const { error } = await supabase
 .from('platform_settings')
 .upsert({
 key:'welcome_credit_enabled',
 value: enabled as unknown as any,
 updated_at: new Date().toISOString(),
 }, { onConflict:'key' });

 if (error) throw error;

 setWelcomeCreditEnabled(enabled);
 toast.success(
 enabled
 ?'Welcome Credit program restarted — new signups will receive tiered credits (Series A/B/C/Standard)'
 :'Welcome Credit program paused — new signups will NOT receive credits'
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
 <Gift className="h-5 w-5 text-primary" aria-hidden="true" />
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
 ?'bg-success/10 text-success border-success/30'
 :'bg-destructive/10 text-destructive border-destructive/30'
 }
 >
 {welcomeCreditEnabled ?'Active' :'Paused'}
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
 {welcomeCreditEnabled ?'Program is running' :'Program is paused'}
 </p>
 <p className="text-sm text-muted-foreground">
 {welcomeCreditEnabled
 ?'New pet owners receive tiered welcome credits based on available spots. Credits expire monthly if unused.'
 :'New pet owners will NOT receive welcome credits on signup.'}
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
 <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
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
 <span className="px-2 py-1 bg-success/10 text-success text-xs rounded-full">
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
 <span className="px-2 py-1 bg-success/10 text-success text-xs rounded-full">
 Enabled
 </span>
 </div>
 </CardContent>
 </Card>
 </div>
 </div>

 {/* Platform Configuration Section - SuperAdmin Only */}
 {isSuperAdmin && (
 <>
 <Separator />
 <div className="space-y-4">
  <div className="flex items-center gap-2">
   <Coins className="h-5 w-5 text-primary" aria-hidden="true" />
   <h3 className="text-xl font-semibold">Pet Owner Rewards</h3>
  </div>
  <Card>
   <CardHeader>
    <CardTitle className="flex items-center justify-between">
     <span>PawBucks Earning (Pet Owners)</span>
     <Badge
      variant="outline"
      className={
       petOwnerEarnEnabled
        ?'bg-success/10 text-success border-success/30'
        :'bg-destructive/10 text-destructive border-destructive/30'
      }
     >
      {petOwnerEarnEnabled ?'Active' :'Paused'}
     </Badge>
    </CardTitle>
    <CardDescription>
     Global kill switch for PawBucks earning on pet owner purchases. When paused, pet owners
     will earn 0 PawBucks on all new transactions across the platform. Existing balances are not affected.
    </CardDescription>
   </CardHeader>
   <CardContent>
    <div className="flex items-center justify-between">
     <div className="space-y-1">
      <p className="font-medium">
       {petOwnerEarnEnabled ?'Earning is active' :'Earning is paused'}
      </p>
      <p className="text-sm text-muted-foreground">
       {petOwnerEarnEnabled
        ?'Pet owners earn PawBucks at their tier multiplier on all qualifying purchases.'
        :'Pet owners will NOT earn any PawBucks on new purchases until this is re-enabled.'}
      </p>
     </div>
     <div className="flex items-center gap-2">
      {earnToggling && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      <Switch
       checked={petOwnerEarnEnabled}
       onCheckedChange={handleTogglePetOwnerEarn}
       disabled={earnToggling}
      />
     </div>
    </div>
   </CardContent>
  </Card>
 </div>
 <Separator />
 <PlatformConfigSection />
 </>
 )}
 </div>
 );
}
