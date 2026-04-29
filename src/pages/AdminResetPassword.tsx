import { useState, useEffect } from"react";
import { useNavigate } from"react-router-dom";
import { supabase } from"@/integrations/supabase/client";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { toast } from"sonner";
import { KeyRound, Eye, EyeOff } from"lucide-react";

const AdminResetPassword = () => {
 const [password, setPassword] = useState("");
 const [confirmPassword, setConfirmPassword] = useState("");
 const [showPassword, setShowPassword] = useState(false);
 const [loading, setLoading] = useState(false);
 const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
 const navigate = useNavigate();

 useEffect(() => {
 // Check if we have a valid recovery session from the URL hash
 const checkRecoverySession = async () => {
 // Get the hash parameters from the URL
 const hashParams = new URLSearchParams(window.location.hash.substring(1));
 const accessToken = hashParams.get("access_token");
 const type = hashParams.get("type");

 if (type ==="recovery" && accessToken) {
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

 // Check existing session
 const { data: { session } } = await supabase.auth.getSession();
 if (session) {
 setIsValidSession(true);
 return;
 }

 setIsValidSession(false);
 toast.error("Invalid or expired reset link");
 };

 checkRecoverySession();
 }, []);

 const handleResetPassword = async (e: React.FormEvent) => {
 e.preventDefault();
 
 if (password !== confirmPassword) {
 toast.error("Passwords do not match");
 return;
 }

 if (password.length < 8) {
 toast.error("Password must be at least 8 characters");
 return;
 }

 setLoading(true);

 try {
 const { error } = await supabase.auth.updateUser({
 password: password,
 });

 if (error) throw error;

 toast.success("Password updated successfully!");
 
 // Sign out and redirect to admin login
 await supabase.auth.signOut();
 navigate("/admin");
 } catch (error: any) {
 console.error("Error resetting password:", error);
 toast.error(error.message ||"Failed to reset password");
 } finally {
 setLoading(false);
 }
 };

 // Loading state
 if (isValidSession === null) {
 return (
 <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
 <Card className="w-full max-w-md">
 <CardContent className="flex items-center justify-center py-12">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
 <span className="ml-3 text-muted-foreground">Verifying reset link...</span>
 </CardContent>
 </Card>
 </div>
 );
 }

 // Invalid session
 if (!isValidSession) {
 return (
 <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
 <Card className="w-full max-w-md">
 <CardHeader className="space-y-1 text-center">
 <CardTitle className="text-2xl font-bold text-destructive">Link Expired</CardTitle>
 <CardDescription>
 This password reset link is invalid or has expired.
 </CardDescription>
 </CardHeader>
 <CardContent>
 <Button onClick={() => navigate("/admin")} className="w-full">
 Back to Admin Login
 </Button>
 </CardContent>
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
 <KeyRound className="h-8 w-8 text-primary" />
 </div>
 </div>
 <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
 <CardDescription>
 Enter your new admin password
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
 minLength={8}
 placeholder="Enter new password"
 />
 <Button
 type="button"
 variant="ghost"
 size="icon"
 className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
 onClick={() => setShowPassword(!showPassword)}
 >
 {showPassword ? (
 <EyeOff className="h-4 w-4" />
 ) : (
 <Eye className="h-4 w-4" />
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
 minLength={8}
 placeholder="Confirm new password"
 />
 </div>
 <Button
 type="submit"
 className="w-full"
 disabled={loading}
 >
 {loading ?"Updating..." :"Update Password"}
 </Button>
 </form>
 </CardContent>
 </Card>
 </div>
 );
};

export default AdminResetPassword;
