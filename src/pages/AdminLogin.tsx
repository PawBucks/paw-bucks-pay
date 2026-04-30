import { useState, useEffect } from"react";
import { useNavigate } from"react-router-dom";
import { useAuth } from"@/hooks/useAuth";
import { supabase } from"@/integrations/supabase/client";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from"@/components/ui/card";
import { toast } from"sonner";
import { ArrowLeft } from"lucide-react";
import pawbucksLogo from"@/assets/pawbucks-logo.png";
import { TwoFactorVerify } from"@/components/admin/TwoFactorVerify";

const AdminLogin = () => {
 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [loading, setLoading] = useState(false);
 const [showForgotPassword, setShowForgotPassword] = useState(false);
 const [resetLoading, setResetLoading] = useState(false);
 const [show2FA, setShow2FA] = useState(false);
 const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
 const navigate = useNavigate();
 const { user } = useAuth();

 useEffect(() => {
 const checkAdminAccess = async () => {
 if (user && !show2FA) {
 // Check for admin OR superadmin role
 const { data: adminData, error: adminError } = await supabase.rpc('has_role', {
 _user_id: user.id,
 _role:'admin'
 });
 const { data: superadminData, error: superadminError } = await supabase.rpc('has_role', {
 _user_id: user.id,
 _role:'superadmin'
 });
 
 const data = adminData || superadminData;

 if (adminError || superadminError) {
 console.error('Error checking admin access:', adminError || superadminError);
 navigate('/');
 return;
 }

 if (data) {
 // Check if user needs 2FA verification
 const { data: factorsData } = await supabase.auth.mfa.listFactors();
 const verifiedFactor = factorsData?.totp.find(f => f.status ==='verified');
 
 if (verifiedFactor) {
 // Check assurance level
 const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
 
 if (aalData?.currentLevel ==='aal1' && aalData.nextLevel ==='aal2') {
 // User has 2FA enabled but hasn't verified yet
 setMfaFactorId(verifiedFactor.id);
 setShow2FA(true);
 return;
 }
 }
 
 navigate('/admin/dashboard');
 } else {
 toast.error("Access denied - Admin privileges required");
 await supabase.auth.signOut();
 navigate('/');
 }
 }
 };

 checkAdminAccess();
 }, [user, navigate, show2FA]);

 const handleSignIn = async (e: React.FormEvent) => {
 e.preventDefault();
 setLoading(true);

 try {
 const { data, error } = await supabase.auth.signInWithPassword({
 email,
 password,
 });

 if (error) {
 // Log failed login attempt
 await supabase.functions.invoke("log-auth-event", {
 body: {
 event_type:"login",
 email,
 success: false,
 failure_reason: error.message,
 metadata: { is_admin_login: true },
 },
 });
 throw error;
 }

 if (data.user) {
 // Check if user has admin role
 // Check for admin OR superadmin role
 const { data: isAdminRole, error: roleError } = await supabase.rpc('has_role', {
 _user_id: data.user.id,
 _role:'admin'
 });
 const { data: isSuperAdminRole } = await supabase.rpc('has_role', {
 _user_id: data.user.id,
 _role:'superadmin'
 });
 
 const isAdmin = isAdminRole || isSuperAdminRole;

 if (roleError) {
 console.error('Error checking admin role:', roleError);
 await supabase.auth.signOut();
 toast.error("Error verifying admin access");
 return;
 }

 if (!isAdmin) {
 // Log unauthorized admin access attempt
 await supabase.functions.invoke("log-auth-event", {
 body: {
 event_type:"login",
 email,
 user_id: data.user.id,
 success: false,
 failure_reason:"Access denied - not an admin",
 metadata: { is_admin_login: true, unauthorized_access: true },
 },
 });
 await supabase.auth.signOut();
 toast.error("Access denied - Admin privileges required");
 return;
 }

 // Check if user has 2FA enabled
 const { data: factorsData } = await supabase.auth.mfa.listFactors();
 const verifiedFactor = factorsData?.totp.find(f => f.status ==='verified');
 
 if (verifiedFactor) {
 // Check assurance level
 const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
 
 if (aalData?.currentLevel ==='aal1' && aalData.nextLevel ==='aal2') {
 // User needs to verify 2FA
 setMfaFactorId(verifiedFactor.id);
 setShow2FA(true);
 return;
 }
 }

 // Log successful admin login
 await supabase.functions.invoke("log-auth-event", {
 body: {
 event_type:"login",
 email,
 user_id: data.user.id,
 success: true,
 metadata: { is_admin_login: true },
 },
 });

 toast.success("Admin login successful!");
 navigate("/admin/dashboard");
 }
 } catch (error: any) {
 toast.error(error.message);
 } finally {
 setLoading(false);
 }
 };

 const handleForgotPassword = async (e: React.FormEvent) => {
 e.preventDefault();
 
 if (!email) {
 toast.error("Please enter your email address");
 return;
 }

 setResetLoading(true);

 try {
 const { error } = await supabase.functions.invoke("admin-reset-password", {
 body: { email },
 });

 if (error) throw error;

 toast.success("If an admin account exists with this email, a password reset link has been sent.");
 setShowForgotPassword(false);
 } catch (error: any) {
 console.error("Error requesting password reset:", error);
 toast.error("Failed to send reset email. Please try again.");
 } finally {
 setResetLoading(false);
 }
 };

 const handle2FAVerified = () => {
 toast.success("Admin login successful!");
 navigate("/admin/dashboard");
 };

 const handle2FACancel = async () => {
 await supabase.auth.signOut();
 setShow2FA(false);
 setMfaFactorId(null);
 setPassword("");
 };

 // Show 2FA verification screen
 if (show2FA && mfaFactorId) {
 return (
 <TwoFactorVerify
 factorId={mfaFactorId}
 onVerified={handle2FAVerified}
 onCancel={handle2FACancel}
 />
 );
 }

 if (showForgotPassword) {
 return (
 <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
 <Card className="w-full max-w-md">
 <CardHeader className="space-y-1 text-center">
 <div className="flex justify-center mb-4">
  <div className="p-3 bg-primary/10 rounded-full">
  <img src={pawbucksLogo} alt="PawBucks" className="h-8 w-8 object-contain" />
  </div>
 </div>
 <CardTitle className="text-2xl font-bold">Forgot Password</CardTitle>
 <CardDescription>
 Enter your admin email to receive a password reset link
 </CardDescription>
 </CardHeader>
 <CardContent>
 <form onSubmit={handleForgotPassword} className="space-y-4">
 <div className="space-y-2">
 <Label htmlFor="reset-email">Email</Label>
 <Input
 id="reset-email"
 type="email"
 placeholder="admin@pawbucks.com"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 required
 disabled={resetLoading}
 />
 </div>
 <Button
 type="submit"
 className="w-full"
 disabled={resetLoading}
 >
 {resetLoading ?"Sending..." :"Send Reset Link"}
 </Button>
 </form>
 </CardContent>
 <CardFooter>
 <Button
 variant="ghost"
 className="w-full"
 onClick={() => setShowForgotPassword(false)}
 >
 <ArrowLeft className="h-4 w-4 mr-2" />
 Back to Login
 </Button>
 </CardFooter>
 </Card>
 </div>
 );
 }

 return (
 <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
 <Card className="w-full max-w-md">
 <CardHeader className="space-y-1 text-center">
 <div className="flex justify-center mb-4">
  <div className="p-3 bg-primary/10 rounded-full">
  <img src={pawbucksLogo} alt="PawBucks" className="h-8 w-8 object-contain" />
  </div>
 </div>
 <CardTitle className="text-2xl font-bold">Admin Login</CardTitle>
 <CardDescription>
 Enter your admin credentials to access the dashboard
 </CardDescription>
 </CardHeader>
 <CardContent>
 <form onSubmit={handleSignIn} className="space-y-4">
 <div className="space-y-2">
 <Label htmlFor="email">Email</Label>
 <Input
 id="email"
 type="email"
 placeholder="admin@pawbucks.com"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 required
 disabled={loading}
 />
 </div>
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <Label htmlFor="password">Password</Label>
 <Button
 type="button"
 variant="link"
 className="px-0 h-auto text-sm text-muted-foreground"
 onClick={() => setShowForgotPassword(true)}
 >
 Forgot password?
 </Button>
 </div>
 <Input
 id="password"
 type="password"
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 required
 disabled={loading}
 />
 </div>
 <Button
 type="submit"
 className="w-full"
 disabled={loading}
 >
 {loading ?"Signing in..." :"Sign In"}
 </Button>
 </form>
 </CardContent>
 </Card>
 </div>
 );
};

export default AdminLogin;
