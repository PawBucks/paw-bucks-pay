import { useState, useEffect } from"react";
import { Button } from"@/components/ui/button";
import { Fingerprint } from"lucide-react";
import {
 isBiometricAvailable,
 isBiometricEnabled,
 authenticateWithBiometric,
 getBiometricTypeName,
} from"@/services/biometricAuth";
import { BiometryType } from"capacitor-native-biometric";

interface BiometricLoginButtonProps {
 onCredentialsRetrieved: (email: string, password: string) => void;
 isLoading?: boolean;
}

export const BiometricLoginButton = ({
 onCredentialsRetrieved,
 isLoading = false,
}: BiometricLoginButtonProps) => {
 const [available, setAvailable] = useState(false);
 const [biometryType, setBiometryType] = useState<BiometryType>(BiometryType.NONE);
 const [authenticating, setAuthenticating] = useState(false);

 useEffect(() => {
 const check = async () => {
 const { available: isAvail, biometryType: type } = await isBiometricAvailable();
 setAvailable(isAvail && isBiometricEnabled());
 setBiometryType(type);
 };
 check();
 }, []);

 if (!available) return null;

 const handleBiometricLogin = async () => {
 setAuthenticating(true);
 try {
 const credentials = await authenticateWithBiometric();
 if (credentials) {
 onCredentialsRetrieved(credentials.email, credentials.password);
 }
 } finally {
 setAuthenticating(false);
 }
 };

 const label = getBiometricTypeName(biometryType);

 return (
 <Button
 type="button"
 variant="outline"
 className="w-full gap-2"
 onClick={handleBiometricLogin}
 disabled={isLoading || authenticating}
 >
 <Fingerprint className="h-5 w-5" />
 {authenticating ?"Verifying..." : `Sign in with ${label}`}
 </Button>
 );
};
