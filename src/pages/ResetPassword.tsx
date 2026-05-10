import { useState, useEffect } from"react";
import { useNavigate } from"react-router-dom";
import { supabase } from"@/integrations/supabase/client";
import { SEO } from"@/components/SEO";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { toast } from"sonner";
import { KeyRound, Eye, EyeOff, CheckCircle, Home } from "lucide-react";
import logo from"@/assets/logo.png";

const ResetPassword = () => {
 const [password, setPassword] = useState("");
 const [confirmPassword, setConfirmPassword] = useState("");
 const [showPassword, setShowPassword] = useState(false);
 const [loading, setLoading] = useState(false);
 const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
 const [resetComplete, setResetComplete] = useState(false);
 const navigate = useNavigate();

 useEffect(() => {
 // First, check if we already have a valid session (e.g., redirected from AuthCallback)
 const checkExistingSession = async () => {
 const { data: { session } } = await supabase.auth.getSession();
 if (session) {
 console.log("Valid session found, ready for password reset");
 setIsValidSession(true);
 return true;
 }
 return false;
 };

 // Listen for auth state changes - handles PASSWORD_RECOVERY event
 const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
 console.log("ResetPassword - Auth event:", event,"Session:", !!session);
 
 if (event ==="PASSWORD_RECOVERY") {
 setIsValidSession(true);
 } else if (event ==="SIGNED_IN" && session) {
 setIsValidSession(true);
 }
 });

 // Check for existing session first
 checkExistingSession().then((hasSession) => {
 if (!hasSession) {
 // No session - check URL for recovery tokens (fallback for direct link access)
 checkRecoveryTokens();
 }
 });

 return () => subscription.unsubscribe();
 }, []);

 const checkRecoveryTokens = async () => {
 const url = new URL(window.location.href);
 
 // Check hash params
 const hashParams = new URLSearchParams(window.location.hash.substring(1));
 const accessToken = hashParams.get("access_token");
 const type = hashParams.get("type");
 const errorCode = hashParams.get("error_code");
 const errorDescription = hashParams.get("error_description");
 
 // Check query params
 const code = url.searchParams.get("code");
 const typeFromQuery = url.searchParams.get("type");
 const tokenHash = url.searchParams.get("token_hash");

 console.log("ResetPassword - Checking tokens:", {
 hasCode: !!code,
 hasTokenHash: !!tokenHash,
 hasAccessToken: !!accessToken,
 type: type || typeFromQuery,
 });

 // Handle errors
 if (errorCode || errorDescription) {
 console.error("Recovery error:", errorCode, errorDescription);
 setIsValidSession(false);
 toast.error(errorDescription ||"Password reset link is invalid or expired.");
 return;
 }

 // Handle PKCE flow with code
 if (code) {
 try {
 const { data, error } = await supabase.auth.exchangeCodeForSession(code);
 if (error) {
 console.error("Code exchange error:", error);
 setIsValidSession(false);
 toast.error("Password reset link is invalid or expired. Please request a new one.");
 } else if (data.session) {
 setIsValidSession(true);
 window.history.replaceState(null,"", window.location.pathname);
 }
 return;
 } catch (err) {
 console.error("Code exchange exception:", err);
 setIsValidSession(false);
 return;
 }
 }

 // Handle token_hash
 if (tokenHash && (type ==="recovery" || typeFromQuery ==="recovery")) {
 try {
 const { data, error } = await supabase.auth.verifyOtp({
 token_hash: tokenHash,
 type:"recovery",
 });
 if (error) {
 console.error("Token hash verification error:", error);
 setIsValidSession(false);
 toast.error("Password reset link is invalid or expired. Please request a new one.");
 } else if (data.session) {
 setIsValidSession(true);
 window.history.replaceState(null,"", window.location.pathname);
 }
 return;
 } catch (err) {
 console.error("Token hash exception:", err);
 setIsValidSession(false);
 return;
 }
 }

 // Handle implicit flow with access token in hash
 if (accessToken && type ==="recovery") {
 const refreshToken = hashParams.get("refresh_token");
 if (refreshToken) {
 const { error } = await supabase.auth.setSession({
 access_token: accessToken,
 refresh_token: refreshToken,
 });
 
 if (!error) {
 setIsValidSession(true);
 window.history.replaceState(null,"", window.location.pathname);
 return;
 }
 }
 }

 // No valid recovery parameters found
 setIsValidSession(false);
 };

 const handleResetPassword = async (e: React.FormEvent) => {
 e.preventDefault();
 
 if (password !== confirmPassword) {
 toast.error("Passwords do not match");
 return;
 }

 if (password.length < 6) {
 toast.error("Password must be at least 6 characters");
 return;
 }

 setLoading(true);

 try {
 const { error } = await supabase.auth.updateUser({
 password: password,
 });

 if (error) throw error;

 setResetComplete(true);
 toast.success("Password updated successfully!");
 
 // Sign out after password reset for security
 await supabase.auth.signOut();
 } catch (error: any) {
 console.error("Error resetting password:", error);
 toast.error(error.message ||"Failed to reset password. Please try again.");
 } finally {
 setLoading(false);
 }
 };

 // Loading state while checking session
 if (isValidSession === null) {
 return (
 <div className="min-h-screen flex items-center justify-center bg-[var(--gradient-hero)] p-4">
 <Card className="w-full max-w-md">
 <CardContent className="flex items-center justify-center py-12">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
 <span className="ml-3 text-muted-foreground">Verifying reset link...</span>
 </CardContent>
 </Card>
 </div>
 );
 }

 // Invalid session - link expired or invalid
 if (!isValidSession) {
 return (
 <>
 <SEO 
 title="Reset Password - PawBucks"
 description="Reset your PawBucks account password"
 noIndex={true}
 />
 <div className="min-h-screen flex items-center justify-center bg-[var(--gradient-hero)] p-4">
 <Card className="w-full max-w-md">
 <CardHeader className="space-y-1 text-center">
 <div className="flex justify-center mb-4">
 <img 
 src={logo} 
 alt="PawBucks Logo" 
 className="h-20 w-auto object-contain"
 />
 </div>
 <CardTitle className="text-2xl font-bold text-destructive">Link Expired</CardTitle>
 <CardDescription>
 This password reset link is invalid or has expired. Please request a new one.
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <Button
 onClick={() => navigate("/auth")}
 className="w-full"
 >
 Back to Sign In
 </Button>
 </CardContent>
 </Card>
 </div>
 </>
 );
 }

 // Password reset complete
 if (resetComplete) {
 return (
 <>
 <SEO 
 title="Password Reset Complete - PawBucks"
 description="Your PawBucks password has been successfully reset"
 noIndex={true}
 />
 <div className="min-h-screen flex items-center justify-center bg-[var(--gradient-hero)] p-4">
 <Card className="w-full max-w-md">
 <CardHeader className="space-y-1 text-center">
 <div className="flex justify-center mb-4">
 <div className="p-3 bg-success/10 rounded-full">
 <CheckCircle className="h-8 w-8 text-success" />
 </div>
 </div>
 <CardTitle className="text-2xl font-bold">Password Updated!</CardTitle>
 <CardDescription>
 Your password has been successfully reset. You can now sign in with your new password.
 </CardDescription>
 </CardHeader>
 <CardContent>
 <Button
 onClick={() => navigate("/auth")}
 className="w-full"
 >
 Sign In
 </Button>
 </CardContent>
 </Card>
 </div>
 </>
 );
 }

 // Password reset form
 return (
 <>
 <SEO 
 title="Reset Password - PawBucks"
 description="Create a new password for your PawBucks account"
 noIndex={true}
 />
 <div className="min-h-screen flex items-center justify-center bg-[var(--gradient-hero)] p-4">
 <div className="absolute left-4 top-0 pt-safe z-20">
 <Button
 variant="outline"
 onClick={() => navigate("/")}
 className="gap-2"
 >
 <span className="h-4 w-4" aria-hidden="true">🏠</span>
 Back Home
 </Button>
 </div>

 <Card className="w-full max-w-md">
 <CardHeader className="space-y-1 text-center">
 <div className="flex justify-center mb-4">
 <img 
 src={logo} 
 alt="PawBucks Logo" 
 className="h-20 w-auto object-contain"
 />
 </div>
 <div className="flex justify-center mb-2">
 <div className="p-3 bg-primary/10 rounded-full">
 <KeyRound className="h-6 w-6 text-primary" />
 </div>
 </div>
 <CardTitle className="text-2xl font-bold">Create New Password</CardTitle>
 <CardDescription>
 Enter your new password below. Make sure it's at least 6 characters long.
 </CardDescription>
 </CardHeader>
 <CardContent>
 <form onSubmit={handleResetPassword} className="space-y-4">
 <div className="space-y-2">
 <Label htmlFor="password">New Password</Label>
 <div className="relative">
 <Input
 id="password"
 type={showPassword ?"text" :"password"}
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 required
 disabled={loading}
 minLength={6}
 placeholder="Enter new password"
 className="pr-10"
 />
 <Button
 type="button"
 variant="ghost"
 size="sm"
 className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
 onClick={() => setShowPassword(!showPassword)}
 aria-label={showPassword ?"Hide password" :"Show password"}
 >
 {showPassword ? (
 <EyeOff className="h-4 w-4 text-muted-foreground" />
 ) : (
 <Eye className="h-4 w-4 text-muted-foreground" />
 )}
 </Button>
 </div>
 </div>
 <div className="space-y-2">
 <Label htmlFor="confirmPassword">Confirm Password</Label>
 <Input
 id="confirmPassword"
 type={showPassword ?"text" :"password"}
 value={confirmPassword}
 onChange={(e) => setConfirmPassword(e.target.value)}
 required
 disabled={loading}
 minLength={6}
 placeholder="Confirm new password"
 />
 </div>
 <Button
 type="submit"
 className="w-full"
 disabled={loading}
 >
 {loading ?"Updating Password..." :"Update Password"}
 </Button>
 </form>
 </CardContent>
 </Card>
 </div>
 </>
 );
};

export default ResetPassword;
