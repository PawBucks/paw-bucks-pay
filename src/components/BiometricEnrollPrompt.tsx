import { useState, useEffect } from"react";
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogHeader,
 DialogTitle,
} from"@/components/ui/dialog";
import { Button } from"@/components/ui/button";
import { Fingerprint } from"lucide-react";
import {
 isBiometricAvailable,
 isBiometricEnabled,
 saveCredentials,
 getBiometricTypeName,
 isNativePlatform,
} from"@/services/biometricAuth";
import { BiometryType } from"capacitor-native-biometric";
import { toast } from"sonner";

interface BiometricEnrollPromptProps {
 email: string;
 password: string;
 open: boolean;
 onClose: () => void;
}

export const BiometricEnrollPrompt = ({
 email,
 password,
 open,
 onClose,
}: BiometricEnrollPromptProps) => {
 const [biometryType, setBiometryType] = useState<BiometryType>(BiometryType.NONE);
 const [shouldShow, setShouldShow] = useState(false);
 const [saving, setSaving] = useState(false);

 useEffect(() => {
 const check = async () => {
 if (!isNativePlatform() || isBiometricEnabled()) {
 setShouldShow(false);
 return;
 }
 const { available, biometryType: type } = await isBiometricAvailable();
 setShouldShow(available);
 setBiometryType(type);
 };
 check();
 }, []);

 if (!shouldShow) return null;

 const label = getBiometricTypeName(biometryType);

 const handleEnable = async () => {
 setSaving(true);
 const success = await saveCredentials(email, password);
 setSaving(false);

 if (success) {
 toast.success(`${label} enabled for future logins!`);
 } else {
 toast.error(`Failed to enable ${label}`);
 }
 onClose();
 };

 return (
 <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
 <DialogContent className="sm:max-w-md">
 <DialogHeader>
 <div className="flex justify-center mb-4">
 <div className="p-3 bg-primary/10 rounded-full">
 <Fingerprint className="h-8 w-8 text-primary" />
 </div>
 </div>
 <DialogTitle className="text-center">Enable {label}?</DialogTitle>
 <DialogDescription className="text-center">
 Sign in faster next time using {label}. Your credentials will be
 stored securely on your device.
 </DialogDescription>
 </DialogHeader>
 <div className="flex gap-2 mt-4">
 <Button variant="outline" className="flex-1" onClick={onClose}>
 Not Now
 </Button>
 <Button className="flex-1" onClick={handleEnable} disabled={saving}>
 {saving ?"Enabling..." : `Enable ${label}`}
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 );
};
