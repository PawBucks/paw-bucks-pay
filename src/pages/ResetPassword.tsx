import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { KeyRound, Eye, EyeOff, CheckCircle, Home } from "lucide-react";
import logo from "@/assets/logo.png";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const [resetComplete, setResetComplete] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we have a valid recovery session from the URL hash
    const checkRecoverySession = async () => {
      // Get the hash parameters from the URL
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get("access_token");
      const type = hashParams.get("type");
      
      // Also check query params (some email clients may encode differently)
      const queryParams = new URLSearchParams(window.location.search);
      const tokenFromQuery = queryParams.get("token");
      const typeFromQuery = queryParams.get("type");

      console.log("Recovery check - type:", type || typeFromQuery, "has token:", !!(accessToken || tokenFromQuery));

      if (type === "recovery" || typeFromQuery === "recovery") {
        // Supabase should automatically handle the session from the URL
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session && !error) {
          setIsValidSession(true);
          return;
        }
      }

      // If we have an access token in the URL, try to set the session
      if (accessToken) {
        const refreshToken = hashParams.get("refresh_token");
        if (refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (!error) {
            setIsValidSession(true);
            // Clear the URL hash for security
            window.history.replaceState(null, "", window.location.pathname);
            return;
          }
        }
      }

      // Check if there's already a valid session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsValidSession(true);
        return;
      }

      // No valid session found
      setIsValidSession(false);
      toast.error("Invalid or expired password reset link. Please request a new one.");
    };

    checkRecoverySession();
  }, []);

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
      toast.error(error.message || "Failed to reset password. Please try again.");
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
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircle className="h-8 w-8 text-green-600" />
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
            <Home className="h-4 w-4" />
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
                    type={showPassword ? "text" : "password"}
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
                    aria-label={showPassword ? "Hide password" : "Show password"}
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
                  type={showPassword ? "text" : "password"}
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
                {loading ? "Updating Password..." : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default ResetPassword;
