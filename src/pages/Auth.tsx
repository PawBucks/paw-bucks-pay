import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Eye, EyeOff, Home, KeyRound, Users } from "lucide-react";
import logo from "@/assets/logo.png";
import { useAuth } from "@/hooks/useAuth";
import { signUpSchema, signInSchema } from "@/lib/validation";
import { ROUTES } from "@/lib/constants";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BiometricLoginButton } from "@/components/BiometricLoginButton";
import { BiometricEnrollPrompt } from "@/components/BiometricEnrollPrompt";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const redirectUrl = searchParams.get("redirect"); // Support redirect after auth
  const roleParam = searchParams.get("role") as "pet_owner" | "merchant" | "vet" | null;
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  // Map vet role to merchant for database storage, but track original role for redirect
  const [userType, setUserType] = useState<"pet_owner" | "merchant">(
    roleParam === "vet" ? "merchant" : (roleParam || "pet_owner")
  );
  const [signupRole, setSignupRole] = useState<"pet_owner" | "merchant" | "vet" | null>(roleParam);
  const refParam = searchParams.get("ref");
  const [referralCode, setReferralCode] = useState(refParam || "");
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<{ ownerName: string } | null>(null);
  const [biometricEnroll, setBiometricEnroll] = useState<{ open: boolean; email: string; password: string }>({
    open: false, email: "", password: "",
  });

  // Load invite info if there's a token
  useEffect(() => {
    const loadInviteInfo = async () => {
      if (!inviteToken) return;
      
      try {
        const { data: invite } = await supabase
          .from("shared_account_members")
          .select("owner_id, status")
          .eq("invite_token", inviteToken)
          .eq("status", "pending")
          .maybeSingle();

        if (invite) {
          const { data: ownerProfile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", invite.owner_id)
            .single();

          setInviteInfo({
            ownerName: ownerProfile?.full_name || ownerProfile?.email || "A PawBucks member",
          });
        }
      } catch (err) {
        console.warn("Failed to load invite info:", err);
      }
    };

    loadInviteInfo();
  }, [inviteToken]);

  // Helper function to accept invite after authentication
  const acceptInviteIfPresent = useCallback(async (userId: string, userEmail: string) => {
    if (!inviteToken) return;

    try {
      // Find the invitation by token
      const { data: invite, error: findError } = await supabase
        .from("shared_account_members")
        .select("id, member_email, status")
        .eq("invite_token", inviteToken)
        .eq("status", "pending")
        .maybeSingle();

      if (findError || !invite) {
        console.warn("Invite not found or already used:", findError);
        return;
      }

      // Accept the invitation - update with user's ID and mark as accepted
      const { error: acceptError } = await supabase
        .from("shared_account_members")
        .update({
          member_id: userId,
          member_email: userEmail.toLowerCase(),
          status: "accepted",
          accepted_at: new Date().toISOString(),
        })
        .eq("id", invite.id);

      if (acceptError) {
        console.error("Failed to accept invitation:", acceptError);
        toast.error("Failed to join the shared account. Please try accepting from your dashboard.");
      } else {
        toast.success("You've joined the shared PawBucks account!", {
          description: "You now have access to the shared wallet.",
          duration: 5000,
        });
      }
    } catch (err) {
      console.error("Error accepting invite:", err);
    }
  }, [inviteToken]);

  // Helper function to redirect user based on their role/type
  const redirectBasedOnRole = useCallback(async (userId: string, userTypeOverride?: "pet_owner" | "merchant", isVetSignup?: boolean) => {
    // If there's a redirect URL specified, use it (e.g., returning to invoice payment)
    if (redirectUrl) {
      navigate(redirectUrl);
      return;
    }

    // Check if user is admin first
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: userId,
      _role: 'admin'
    });

    if (isAdmin) {
      navigate(ROUTES.ADMIN);
      return;
    }

    // If signing up as a vet, redirect to vet onboarding
    if (isVetSignup) {
      navigate("/vet-onboarding");
      return;
    }

    // If we have a user type override (from signup), use it
    if (userTypeOverride) {
      if (userTypeOverride === "merchant") {
        navigate(ROUTES.MERCHANT_DASHBOARD);
      } else {
        // Invited users skip pet profile creation - go straight to dashboard
        if (inviteToken) {
          navigate(ROUTES.DASHBOARD);
        } else {
          // Regular pet owners go to create pet profile as first onboarding step
          navigate("/create-pet-profile");
        }
      }
      return;
    }

    // Otherwise, fetch the user's profile to determine their type
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("id", userId)
      .single();

    if (profile?.user_type === "merchant") {
      navigate(ROUTES.MERCHANT_DASHBOARD);
    } else {
      navigate(ROUTES.DASHBOARD);
    }
  }, [navigate, redirectUrl, inviteToken]);

  // Redirect already-logged-in users
  useEffect(() => {
    if (user) {
      redirectBasedOnRole(user.id);
    }
  }, [user, redirectBasedOnRole]);

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;
    const fullName = formData.get("fullName") as string;
    const phone = formData.get("phone") as string;

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

      if (error) {
        // Handle specific Supabase auth errors with user-friendly messages
        if (error.message.includes("already registered")) {
          toast.error("An account with this email already exists. Please sign in instead.");
        } else if (error.message.includes("rate limit") || error.message.includes("too many")) {
          toast.error("Too many attempts. Please wait a few minutes and try again.");
        } else if (error.message.includes("network") || error.message.includes("fetch")) {
          toast.error("Network error. Please check your internet connection and try again.");
        } else if (error.message.includes("Invalid email")) {
          toast.error("Please enter a valid email address.");
        } else if (error.message.includes("Password")) {
          toast.error(error.message);
        } else {
          // Show the actual error for debugging, but with a friendly prefix
          toast.error(`Sign up failed: ${error.message}`);
        }
        console.error("Sign up auth error:", error);
        return;
      }

      if (data.user) {
        // Account was created successfully - everything else is non-critical
        // Update the profile created by the trigger with additional info
        try {
          const { error: profileError } = await supabase.from("profiles").upsert({
            id: data.user.id,
            user_type: userType,
            full_name: validatedData.fullName,
            email: validatedData.email,
            phone: phone || null,
          }, { onConflict: 'id' });

          if (profileError) {
            console.warn("Profile update warning (non-critical):", profileError);
          }
        } catch (profileErr) {
          console.warn("Profile update failed (non-critical):", profileErr);
        }

        // Handle referral code if provided - non-critical
        if (validatedData.referralCode && userType === "pet_owner") {
          try {
            const { data: referrer, error: referrerError } = await supabase
              .from("profiles")
              .select("id")
              .eq("referral_code", validatedData.referralCode)
              .single();

            if (!referrerError && referrer) {
              await supabase.from("referrals").insert({
                referrer_id: referrer.id,
                referee_id: data.user.id,
                referral_code: validatedData.referralCode,
              });
            }
          } catch (referralErr) {
            console.warn("Referral processing failed (non-critical):", referralErr);
          }
        }

        // Accept invitation if signing up via invite link
        await acceptInviteIfPresent(data.user.id, validatedData.email);

        toast.success("Account created successfully!");
        
        // Redirect - wrapped in try/catch to ensure we don't show false errors
        try {
          // If there's a specific redirect URL, use it (e.g., invoice payment)
          if (redirectUrl) {
            navigate(redirectUrl);
          } else if (inviteToken) {
            // If they joined via invite, go directly to dashboard (not create-pet-profile)
            navigate(ROUTES.DASHBOARD);
          } else {
            // Pass isVetSignup flag for vet role redirect
            await redirectBasedOnRole(data.user.id, userType, signupRole === "vet");
          }
        } catch (redirectErr) {
          console.warn("Redirect warning:", redirectErr);
          // Fallback redirect
          if (signupRole === "vet") {
            navigate("/vet-onboarding");
          } else {
            navigate(redirectUrl || (userType === "merchant" ? ROUTES.MERCHANT_DASHBOARD : ROUTES.DASHBOARD));
          }
        }
      } else {
        // User is null but no error - might need email confirmation
        toast.success("Account created! Please check your email to confirm your account.");
      }
    } catch (error: any) {
      if (error.errors) {
        // Zod validation error
        toast.error(error.errors[0]?.message || "Invalid input");
      } else if (error.message) {
        // Supabase or other error with message
        toast.error(`Error: ${error.message}`);
      } else {
        toast.error("An unexpected error occurred. Please try again.");
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

      if (error) {
        // Log failed login attempt
        await supabase.functions.invoke("log-auth-event", {
          body: {
            event_type: "login",
            email: validatedData.email,
            success: false,
            failure_reason: error.message,
          },
        });
        throw error;
      }

      // Log successful login
      await supabase.functions.invoke("log-auth-event", {
        body: {
          event_type: "login",
          email: validatedData.email,
          success: true,
        },
      });

      // Get the user from the current session for redirect
      const { data: sessionData } = await supabase.auth.getSession();
      const loggedInUser = sessionData?.session?.user;

      // Accept invitation if signing in via invite link
      if (loggedInUser) {
        await acceptInviteIfPresent(loggedInUser.id, validatedData.email);
      }

      toast.success("Signed in successfully!");

      // Prompt biometric enrollment on native platforms
      const { isNativePlatform, isBiometricAvailable: checkBio, isBiometricEnabled: bioEnabled } = await import("@/services/biometricAuth");
      if (isNativePlatform()) {
        const { available } = await checkBio();
        if (available && !bioEnabled()) {
          setBiometricEnroll({ open: true, email: validatedData.email, password: validatedData.password });
        }
      }
      
      if (loggedInUser) {
        // If there's a specific redirect URL, use it (e.g., invoice payment)
        if (redirectUrl) {
          navigate(redirectUrl);
        } else if (inviteToken) {
          // If they joined via invite, go directly to dashboard
          navigate(ROUTES.DASHBOARD);
        } else {
          await redirectBasedOnRole(loggedInUser.id);
        }
      } else {
        navigate(redirectUrl || ROUTES.DASHBOARD);
      }
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
    
    const trimmedEmail = resetEmail.trim().toLowerCase();
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }
    
    setIsResetting(true);

    try {
      // Use our custom edge function to send password reset email with proper link
      const redirectUrl = `${window.location.origin}/auth/callback?type=recovery`;
      
      console.log("Requesting password reset for:", trimmedEmail, "redirectTo:", redirectUrl);
      
      const { data, error } = await supabase.functions.invoke("send-password-reset", {
        body: {
          email: trimmedEmail,
          redirectUrl: redirectUrl,
        },
      });

      if (error) {
        console.error("Password reset API error:", error);
        throw error;
      }

      // Always show success message for security (prevents email enumeration)
      toast.success("If an account exists with this email, you'll receive a password reset link shortly.");
      setForgotPasswordOpen(false);
      setResetEmail("");
    } catch (error: any) {
      console.error("Password reset error:", error);
      // Still show success message to prevent email enumeration attacks
      toast.success("If an account exists with this email, you'll receive a password reset link shortly.");
      setForgotPasswordOpen(false);
      setResetEmail("");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
      <SEO 
        title="Sign In or Sign Up - PawBucks"
        description="Create your PawBucks account or sign in to manage pet expenses, earn rewards, and discover trusted pet services."
        keywords={["PawBucks login", "pet rewards signup", "pet owner account", "merchant registration"]}
      />
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
          {/* Show invite banner if accessing via invite link */}
          {inviteInfo && (
            <Alert className="mb-4 bg-amber-50 border-amber-200">
              <Users className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <strong>{inviteInfo.ownerName}</strong> has invited you to share their PawBucks account! 
                Sign up or sign in to accept the invitation automatically.
              </AlertDescription>
            </Alert>
          )}
          
          <Tabs defaultValue={inviteToken || refParam ? "signup" : "signin"} className="w-full">
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

                <BiometricLoginButton
                  isLoading={isLoading}
                  onCredentialsRetrieved={async (email, password) => {
                    setIsLoading(true);
                    try {
                      const { error } = await supabase.auth.signInWithPassword({ email, password });
                      if (error) throw error;
                      toast.success("Signed in successfully!");
                      const { data: sessionData } = await supabase.auth.getSession();
                      const loggedInUser = sessionData?.session?.user;
                      if (loggedInUser) {
                        await redirectBasedOnRole(loggedInUser.id);
                      } else {
                        navigate(ROUTES.DASHBOARD);
                      }
                    } catch {
                      toast.error("Biometric login failed. Please sign in manually.");
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                />
                
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
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input 
                    id="phone" 
                    name="phone" 
                    type="tel" 
                    placeholder="(555) 123-4567"
                    autoComplete="tel"
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
                {/* Only show account type selection if no role was passed via URL */}
                {!roleParam && (
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
                )}
                {/* Show which account type is being created when role is pre-selected */}
                {roleParam && (
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-sm text-center font-medium">
                      Creating a <span className="text-primary capitalize">{roleParam === "pet_owner" ? "Pet Owner" : roleParam === "vet" ? "Veterinarian" : "Merchant"}</span> account
                    </p>
                  </div>
                )}
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

    <BiometricEnrollPrompt
      email={biometricEnroll.email}
      password={biometricEnroll.password}
      open={biometricEnroll.open}
      onClose={() => setBiometricEnroll(prev => ({ ...prev, open: false }))}
    />
    </>
  );
};

export default Auth;