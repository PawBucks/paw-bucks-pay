import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Building2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const BrandSetup = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [brand, setBrand] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSignUp, setShowSignUp] = useState(false);

  // Sign up form
  const [signUpForm, setSignUpForm] = useState({
    email: "",
    password: "",
    full_name: "",
  });

  useEffect(() => {
    if (token) fetchBrand();
  }, [token]);

  useEffect(() => {
    // If user is logged in and brand is loaded, auto-claim
    if (user && brand && !brand.invitation_claimed_at) {
      claimBrand();
    }
  }, [user, brand]);

  const fetchBrand = async () => {
    try {
      const { data, error } = await supabase
        .rpc("get_brand_by_invitation_token", { p_token: token || "" });

      if (error || !data || data.length === 0) {
        setError("Invalid or expired invitation link.");
        return;
      }

      const brandData = data[0];

      if (brandData.invitation_claimed_at) {
        setError("This invitation has already been claimed.");
        return;
      }

      setBrand(brandData);
      if (brandData.invitation_email) {
        setSignUpForm(f => ({ ...f, email: brandData.invitation_email }));
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const claimBrand = async () => {
    if (!user || !brand) return;
    setClaiming(true);
    try {
      const { data, error } = await supabase
        .rpc("claim_brand_account", { p_token: token || "" });

      if (error) {
        toast.error("Failed to claim brand account. Please try again.");
        console.error("Claim error:", error);
        return;
      }

      if (data && !data.success) {
        toast.error(data.error || "Failed to claim brand account.");
        return;
      }

      toast.success("Brand account claimed successfully! Welcome aboard.");
      navigate("/dashboard");
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setClaiming(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setClaiming(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: signUpForm.email,
        password: signUpForm.password,
        options: {
          data: {
            full_name: signUpForm.full_name,
            user_type: "brand",
          },
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      if (data.user && !data.user.confirmed_at) {
        toast.success("Account created! Please check your email to verify, then return to this link.");
      }
      // If auto-confirmed, the useEffect will handle claiming
    } catch {
      toast.error("Failed to create account. Please try again.");
    } finally {
      setClaiming(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setClaiming(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: signUpForm.email,
        password: signUpForm.password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }
      // The useEffect will handle claiming once user state updates
    } catch {
      toast.error("Failed to sign in. Please try again.");
    } finally {
      setClaiming(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-bold">{error}</h2>
            <p className="text-muted-foreground">Please contact the PawBucks team for assistance.</p>
            <Button onClick={() => navigate("/")} variant="outline">Go to Homepage</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (claiming && user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Setting up your brand account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome, {brand?.brand_name}!</CardTitle>
          <CardDescription>
            You've been invited to manage the <strong>{brand?.brand_name}</strong> brand account on PawBucks. 
            {user ? " We're setting up your account..." : " Create an account or sign in to get started."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!user && (
            <div className="space-y-6">
              <form onSubmit={showSignUp ? handleSignIn : handleSignUp} className="space-y-4">
                {!showSignUp && (
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input
                      value={signUpForm.full_name}
                      onChange={(e) => setSignUpForm(f => ({ ...f, full_name: e.target.value }))}
                      placeholder="Your full name"
                      required
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={signUpForm.email}
                    onChange={(e) => setSignUpForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={signUpForm.password}
                    onChange={(e) => setSignUpForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min 8 characters"
                    minLength={8}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={claiming}>
                  {claiming && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {showSignUp ? "Sign In & Claim Account" : "Create Account & Claim Brand"}
                </Button>
              </form>
              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-primary hover:underline"
                  onClick={() => setShowSignUp(!showSignUp)}
                >
                  {showSignUp ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BrandSetup;
