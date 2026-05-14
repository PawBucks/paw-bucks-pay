import { useState } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Alert, AlertDescription } from"@/components/ui/alert";
import { toast } from"sonner";
import { Check, Copy, Loader2, Shield, ShieldOff } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from"@/components/ui/dialog";

interface TwoFactorSetupProps {
 onSetupComplete?: () => void;
}

export const TwoFactorSetup = ({ onSetupComplete }: TwoFactorSetupProps) => {
 const [loading, setLoading] = useState(false);
 const [enrolling, setEnrolling] = useState(false);
 const [factorId, setFactorId] = useState<string | null>(null);
 const [qrCode, setQrCode] = useState<string | null>(null);
 const [secret, setSecret] = useState<string | null>(null);
 const [verifyCode, setVerifyCode] = useState("");
 const [verifying, setVerifying] = useState(false);
 const [is2FAEnabled, setIs2FAEnabled] = useState<boolean | null>(null);
 const [copiedSecret, setCopiedSecret] = useState(false);
 const [showDisableDialog, setShowDisableDialog] = useState(false);
 const [disableCode, setDisableCode] = useState("");
 const [disabling, setDisabling] = useState(false);

 const check2FAStatus = async () => {
 setLoading(true);
 try {
 const { data, error } = await supabase.auth.mfa.listFactors();
 
 if (error) throw error;
 
 const hasVerifiedFactor = data.totp.some(factor => factor.status ==='verified');
 setIs2FAEnabled(hasVerifiedFactor);
 } catch (error: any) {
 console.error("Error checking 2FA status:", error);
 toast.error("Failed to check 2FA status");
 } finally {
 setLoading(false);
 }
 };

 const startEnrollment = async () => {
 setEnrolling(true);
 try {
 const { data, error } = await supabase.auth.mfa.enroll({
 factorType:'totp',
 friendlyName:'PawBucks Admin Authenticator'
 });

 if (error) throw error;

 setFactorId(data.id);
 setQrCode(data.totp.qr_code);
 setSecret(data.totp.secret);
 } catch (error: any) {
 console.error("Error starting 2FA enrollment:", error);
 toast.error(error.message ||"Failed to start 2FA setup");
 } finally {
 setEnrolling(false);
 }
 };

 const verifyEnrollment = async () => {
 if (!factorId || verifyCode.length !== 6) {
 toast.error("Please enter a valid 6-digit code");
 return;
 }

 setVerifying(true);
 try {
 const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
 factorId
 });

 if (challengeError) throw challengeError;

 const { error: verifyError } = await supabase.auth.mfa.verify({
 factorId,
 challengeId: challengeData.id,
 code: verifyCode
 });

 if (verifyError) throw verifyError;

 toast.success("Two-factor authentication enabled successfully!");
 setIs2FAEnabled(true);
 setQrCode(null);
 setSecret(null);
 setFactorId(null);
 setVerifyCode("");
 onSetupComplete?.();
 } catch (error: any) {
 console.error("Error verifying 2FA:", error);
 toast.error(error.message ||"Invalid verification code");
 } finally {
 setVerifying(false);
 }
 };

 const disable2FA = async () => {
 if (disableCode.length !== 6) {
 toast.error("Please enter a valid 6-digit code");
 return;
 }

 setDisabling(true);
 try {
 const { data: factors } = await supabase.auth.mfa.listFactors();
 const verifiedFactor = factors?.totp.find(f => f.status ==='verified');
 
 if (!verifiedFactor) {
 toast.error("No active 2FA factor found");
 return;
 }

 // First challenge then verify to confirm user identity
 const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
 factorId: verifiedFactor.id
 });

 if (challengeError) throw challengeError;

 const { error: verifyError } = await supabase.auth.mfa.verify({
 factorId: verifiedFactor.id,
 challengeId: challengeData.id,
 code: disableCode
 });

 if (verifyError) throw verifyError;

 // Now unenroll
 const { error: unenrollError } = await supabase.auth.mfa.unenroll({
 factorId: verifiedFactor.id
 });

 if (unenrollError) throw unenrollError;

 toast.success("Two-factor authentication disabled");
 setIs2FAEnabled(false);
 setShowDisableDialog(false);
 setDisableCode("");
 } catch (error: any) {
 console.error("Error disabling 2FA:", error);
 toast.error(error.message ||"Failed to disable 2FA");
 } finally {
 setDisabling(false);
 }
 };

 const copySecret = () => {
 if (secret) {
 navigator.clipboard.writeText(secret);
 setCopiedSecret(true);
 setTimeout(() => setCopiedSecret(false), 2000);
 toast.success("Secret copied to clipboard");
 }
 };

 // Check 2FA status on mount
 useState(() => {
 check2FAStatus();
 });

 if (loading || is2FAEnabled === null) {
 return (
 <Card>
 <CardContent className="flex items-center justify-center py-8">
 <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
 </CardContent>
 </Card>
 );
 }

 // Show QR code enrollment UI
 if (qrCode && secret && factorId) {
 return (
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Shield className="h-5 w-5" aria-hidden="true" />
 Set Up Two-Factor Authentication
 </CardTitle>
 <CardDescription>
 Scan the QR code with your authenticator app
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="flex justify-center">
 <img 
 src={qrCode} 
 alt="2FA QR Code" 
 className="border rounded-lg p-2 bg-white"
 width={200}
 height={200}
 />
 </div>
 
 <Alert>
 <AlertDescription className="text-sm">
 <strong>Can't scan?</strong> Enter this secret manually in your authenticator app:
 <div className="flex items-center gap-2 mt-2">
 <code className="bg-muted px-2 py-1 rounded text-xs break-all flex-1">
 {secret}
 </code>
 <Button 
 variant="outline" 
 size="icon" 
 className="shrink-0"
 onClick={copySecret}
 >
 {copiedSecret ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
 </Button>
 </div>
 </AlertDescription>
 </Alert>

 <div className="space-y-2">
 <Label htmlFor="verify-code">Verification Code</Label>
 <Input
 id="verify-code"
 type="text"
 inputMode="numeric"
 pattern="[0-9]*"
 maxLength={6}
 placeholder="Enter 6-digit code"
 value={verifyCode}
 onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g,'').slice(0, 6))}
 disabled={verifying}
 />
 </div>

 <div className="flex gap-2">
 <Button 
 variant="outline" 
 className="flex-1"
 onClick={() => {
 setQrCode(null);
 setSecret(null);
 setFactorId(null);
 setVerifyCode("");
 }}
 disabled={verifying}
 >
 Cancel
 </Button>
 <Button 
 className="flex-1"
 onClick={verifyEnrollment}
 disabled={verifying || verifyCode.length !== 6}
 >
 {verifying ? (
 <>
 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
 Verifying...
 </>
 ) : (
"Verify & Enable"
 )}
 </Button>
 </div>
 </CardContent>
 </Card>
 );
 }

 return (
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 {is2FAEnabled ? (
 <Shield className="h-5 w-5 text-success" aria-hidden="true" />
 ) : (
 <ShieldOff className="h-5 w-5 text-warning" />
 )}
 Two-Factor Authentication
 </CardTitle>
 <CardDescription>
 {is2FAEnabled 
 ?"Your account is protected with two-factor authentication"
 :"Add an extra layer of security to your admin account"
 }
 </CardDescription>
 </CardHeader>
 <CardContent>
 {is2FAEnabled ? (
 <div className="space-y-4">
 <Alert className="border-success/30 bg-success/10">
 <Shield className="h-4 w-4 text-success" aria-hidden="true" />
 <AlertDescription className="text-success">
 Two-factor authentication is enabled. Your account is more secure.
 </AlertDescription>
 </Alert>
 
 <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
 <DialogTrigger asChild>
 <Button variant="destructive" className="w-full">
 Disable Two-Factor Authentication
 </Button>
 </DialogTrigger>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
 <DialogDescription>
 Enter your current authenticator code to disable 2FA. This will make your account less secure.
 </DialogDescription>
 </DialogHeader>
 <div className="space-y-4">
 <div className="space-y-2">
 <Label htmlFor="disable-code">Verification Code</Label>
 <Input
 id="disable-code"
 type="text"
 inputMode="numeric"
 pattern="[0-9]*"
 maxLength={6}
 placeholder="Enter 6-digit code"
 value={disableCode}
 onChange={(e) => setDisableCode(e.target.value.replace(/\D/g,'').slice(0, 6))}
 disabled={disabling}
 />
 </div>
 <div className="flex gap-2">
 <Button 
 variant="outline" 
 className="flex-1"
 onClick={() => {
 setShowDisableDialog(false);
 setDisableCode("");
 }}
 disabled={disabling}
 >
 Cancel
 </Button>
 <Button 
 variant="destructive"
 className="flex-1"
 onClick={disable2FA}
 disabled={disabling || disableCode.length !== 6}
 >
 {disabling ? (
 <>
 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
 Disabling...
 </>
 ) : (
"Disable 2FA"
 )}
 </Button>
 </div>
 </div>
 </DialogContent>
 </Dialog>
 </div>
 ) : (
 <div className="space-y-4">
 <Alert>
 <Shield className="h-4 w-4" aria-hidden="true" />
 <AlertDescription>
 Use an authenticator app like Google Authenticator, Authy, or 1Password to generate verification codes.
 </AlertDescription>
 </Alert>
 <Button 
 className="w-full" 
 onClick={startEnrollment}
 disabled={enrolling}
 >
 {enrolling ? (
 <>
 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
 Setting up...
 </>
 ) : (
 <>
 <Shield className="h-4 w-4 mr-2" aria-hidden="true" />
 Enable Two-Factor Authentication
 </>
 )}
 </Button>
 </div>
 )}
 </CardContent>
 </Card>
 );
};
