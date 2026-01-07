import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

/**
 * AuthCallback handles all Supabase authentication redirects:
 * - Email confirmation after signup
 * - Password recovery links
 * - Magic link logins
 * 
 * Supabase sends users here with tokens in the URL, which we exchange for a session.
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"processing" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get parameters from both URL search params and hash
        const code = searchParams.get("code");
        const error = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");
        
        // Also check hash params (some flows use hash-based routing)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const type = hashParams.get("type") || searchParams.get("type");
        const tokenHash = searchParams.get("token_hash");

        console.log("AuthCallback - Processing auth redirect:", {
          hasCode: !!code,
          hasError: !!error,
          hasAccessToken: !!accessToken,
          type,
          hasTokenHash: !!tokenHash,
        });

        // Handle errors from Supabase
        if (error) {
          console.error("Auth callback error:", error, errorDescription);
          setStatus("error");
          setErrorMessage(errorDescription || "Authentication failed. Please try again.");
          toast.error(errorDescription || "Authentication failed");
          setTimeout(() => navigate("/auth"), 3000);
          return;
        }

        // Handle PKCE flow (code exchange)
        if (code) {
          console.log("Exchanging code for session...");
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          
          if (exchangeError) {
            console.error("Code exchange error:", exchangeError);
            setStatus("error");
            setErrorMessage(exchangeError.message || "Failed to verify. Link may be expired.");
            toast.error("Link expired or invalid. Please request a new one.");
            setTimeout(() => navigate("/auth"), 3000);
            return;
          }

          if (data.session) {
            console.log("Session established via code exchange");
            
            // Check if this is a password recovery
            if (type === "recovery") {
              toast.success("Verified! Please set your new password.");
              navigate("/reset-password", { replace: true });
              return;
            }

            // Regular email confirmation - redirect to dashboard
            toast.success("Email confirmed! Welcome to PawBucks.");
            navigate("/dashboard", { replace: true });
            return;
          }
        }

        // Handle token_hash flow (magic links, some recovery flows)
        if (tokenHash) {
          console.log("Verifying token hash...");
          const otpType = type === "recovery" ? "recovery" : "email";
          
          const { data, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType as "recovery" | "email",
          });

          if (verifyError) {
            console.error("Token verification error:", verifyError);
            setStatus("error");
            setErrorMessage("Link expired or invalid. Please request a new one.");
            toast.error("Link expired or invalid. Please request a new one.");
            setTimeout(() => navigate("/auth"), 3000);
            return;
          }

          if (data.session) {
            if (type === "recovery") {
              toast.success("Verified! Please set your new password.");
              navigate("/reset-password", { replace: true });
              return;
            }

            toast.success("Email confirmed! Welcome to PawBucks.");
            navigate("/dashboard", { replace: true });
            return;
          }
        }

        // Handle implicit flow (access token in hash)
        if (accessToken && refreshToken) {
          console.log("Setting session from hash tokens...");
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error("Session set error:", sessionError);
            setStatus("error");
            setErrorMessage("Failed to establish session. Please try again.");
            setTimeout(() => navigate("/auth"), 3000);
            return;
          }

          if (type === "recovery") {
            toast.success("Verified! Please set your new password.");
            navigate("/reset-password", { replace: true });
            return;
          }

          toast.success("Welcome to PawBucks!");
          navigate("/dashboard", { replace: true });
          return;
        }

        // No valid auth parameters found - check for existing session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          navigate("/dashboard", { replace: true });
          return;
        }

        // No auth data at all
        console.log("No auth parameters found in callback");
        setStatus("error");
        setErrorMessage("Invalid or expired link. Please try again.");
        setTimeout(() => navigate("/auth"), 3000);

      } catch (err) {
        console.error("AuthCallback unexpected error:", err);
        setStatus("error");
        setErrorMessage("An unexpected error occurred. Please try again.");
        setTimeout(() => navigate("/auth"), 3000);
      }
    };

    handleAuthCallback();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-purple-50 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          {status === "processing" ? (
            <>
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
              <p className="text-muted-foreground">Verifying your request...</p>
              <p className="text-sm text-muted-foreground mt-2">Please wait while we process your authentication.</p>
            </>
          ) : (
            <>
              <div className="text-destructive text-4xl mb-4">⚠️</div>
              <p className="text-destructive font-medium">{errorMessage}</p>
              <p className="text-sm text-muted-foreground mt-2">Redirecting to sign in...</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthCallback;
