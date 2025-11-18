import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Eye, EyeOff, Home, KeyRound } from "lucide-react";
import logo from "@/assets/logo.png";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { signUpSchema, signInSchema } from "@/lib/validation";

const Auth = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [userType, setUserType] = useState<"pet_owner" | "merchant">("pet_owner");
  const [referralCode, setReferralCode] = useState("");
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    const checkUserAndRedirect = async () => {
      if (user) {
        // Check if user is admin
        const { data: isAdmin } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin'
        });

        if (isAdmin) {
          navigate("/admin");
        } else {
          navigate("/");
        }
      }
    };

    checkUserAndRedirect();
  }, [user, navigate]);

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;
    const fullName = formData.get("fullName") as string;

    try {
      // Check if passwords match
      if (password !== confirmPassword) {
        toast.error("Passwords do not match");
        setIsLoading(false);
        return;
      }

      // Validate input
      const validatedData = signUpSchema.parse({
        email,
        password,
        fullName,
        referralCode: referralCode || "",
      });

      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email: validatedData.email,
        password: validatedData.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: validatedData.fullName,
            user_type: userType,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        // Create profile
        const { error: profileError } = await supabase.from("profiles").insert({
          id: data.user.id,
          user_type: userType,
          full_name: validatedData.fullName,
          email: validatedData.email,
        });

        if (profileError) throw profileError;

        // Handle referral code if provided
        if (validatedData.referralCode && userType === "pet_owner") {
          // Find the referrer by code
          const { data: referrer, error: referrerError } = await supabase
            .from("profiles")
            .select("id")
            .eq("referral_code", validatedData.referralCode)
            .single();

          if (!referrerError && referrer) {
            // Create referral record
            await supabase.from("referrals").insert({
              referrer_id: referrer.id,
              referee_id: data.user.id,
              referral_code: validatedData.referralCode,
            });
          }
        }

        toast.success("Account created successfully!");
        navigate("/");
      }
    } catch (error: any) {
      if (error.errors) {
        // Zod validation error
        toast.error(error.errors[0]?.message || "Invalid input");
      } else {
        toast.error("Failed to create account. Please try again.");
      }
      console.error("Sign up error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      // Validate input
      const validatedData = signInSchema.parse({
        email,
        password,
      });

      const { error } = await supabase.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password,
      });

      if (error) throw error;

      toast.success("Signed in successfully!");
      navigate("/");
    } catch (error: any) {
      if (error.errors) {
        // Zod validation error
        toast.error(error.errors[0]?.message || "Invalid input");
      } else {
        toast.error("Failed to sign in. Please check your credentials.");
      }
      console.error("Sign in error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsResetting(true);

    try {
      const redirectUrl = `${window.location.origin}/auth`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: redirectUrl,
      });

      if (error) throw error;

      toast.success("Password reset email sent! Check your inbox.");
      setForgotPasswordOpen(false);
      setResetEmail("");
    } catch (error: any) {
      toast.error("Failed to send reset email. Please try again.");
      console.error("Password reset error:", error);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--gradient-hero)]">
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
      
      <Card className="w-full max-w-md shadow-lg animate-scale-in">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center mb-4">
            <img 
              src={logo} 
              alt="PawBucks Logo" 
              className="h-24 sm:h-32 w-auto object-contain"
            />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold">Welcome to PawBucks</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Connect with pet services or grow your pet business
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin" className="text-sm sm:text-base">Sign In</TabsTrigger>
              <TabsTrigger value="signup" className="text-sm sm:text-base">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email Address</Label>
                  <Input 
                    id="signin-email" 
                    name="email" 
                    type="email" 
                    placeholder="your@email.com"
                    autoComplete="email"
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <div className="relative">
                    <Input 
                      id="signin-password" 
                      name="password" 
                      type={showSignInPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required 
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowSignInPassword(!showSignInPassword)}
                      aria-label={showSignInPassword ? "Hide password" : "Show password"}
                    >
                      {showSignInPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                  aria-label="Sign in to your account"
                >
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
                
                <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      variant="link"
                      className="w-full text-sm text-muted-foreground hover:text-primary"
                    >
                      <KeyRound className="h-4 w-4 mr-2" />
                      Forgot Password?
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Reset Your Password</DialogTitle>
                      <DialogDescription>
                        Enter your email address and we'll send you a link to reset your password.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="reset-email">Email Address</Label>
                        <Input
                          id="reset-email"
                          type="email"
                          placeholder="your@email.com"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setForgotPasswordOpen(false)}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          className="flex-1"
                          disabled={isResetting}
                        >
                          {isResetting ? "Sending..." : "Send Reset Link"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input 
                    id="fullName" 
                    name="fullName" 
                    placeholder="John Doe"
                    autoComplete="name"
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email Address</Label>
                  <Input 
                    id="signup-email" 
                    name="email" 
                    type="email" 
                    placeholder="your@email.com"
                    autoComplete="email"
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Input 
                      id="signup-password" 
                      name="password" 
                      type={showSignUpPassword ? "text" : "password"}
                      placeholder="Create a strong password"
                      autoComplete="new-password"
                      minLength={6}
                      required 
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                      aria-label={showSignUpPassword ? "Hide password" : "Show password"}
                    >
                      {showSignUpPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Input 
                      id="confirm-password" 
                      name="confirmPassword" 
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Re-enter your password"
                      autoComplete="new-password"
                      minLength={6}
                      required 
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Account Type</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant={userType === "pet_owner" ? "default" : "outline"}
                      onClick={() => setUserType("pet_owner")}
                      className="flex-1"
                      aria-pressed={userType === "pet_owner"}
                    >
                      Pet Owner
                    </Button>
                    <Button
                      type="button"
                      variant={userType === "merchant" ? "default" : "outline"}
                      onClick={() => setUserType("merchant")}
                      className="flex-1"
                      aria-pressed={userType === "merchant"}
                    >
                      Merchant
                    </Button>
                  </div>
                </div>
                {userType === "pet_owner" && (
                  <div className="space-y-2 animate-fade-in">
                    <Label htmlFor="referralCode">Referral Code (Optional)</Label>
                    <Input 
                      id="referralCode" 
                      name="referralCode" 
                      placeholder="Enter code to get $10 bonus"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      maxLength={8}
                      aria-describedby="referral-help"
                    />
                    <p id="referral-help" className="text-xs text-muted-foreground">
                      Both you and your referrer get $10 after your first transaction!
                    </p>
                  </div>
                )}
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                  aria-label="Create your PawBucks account"
                >
                  {isLoading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;