import { NativeBiometric, BiometryType } from"capacitor-native-biometric";
import { Capacitor } from"@capacitor/core";

const BIOMETRIC_SERVER ="pawbucks-app";

export interface BiometricCredentials {
 email: string;
 password: string;
}

/**
 * Check if we're running in a native Capacitor environment
 */
export const isNativePlatform = (): boolean => {
 return Capacitor.isNativePlatform();
};

/**
 * Check if biometric authentication is available on the device
 */
export const isBiometricAvailable = async (): Promise<{
 available: boolean;
 biometryType: BiometryType;
}> => {
 if (!isNativePlatform()) {
 return { available: false, biometryType: BiometryType.NONE };
 }

 try {
 const result = await NativeBiometric.isAvailable();
 return {
 available: result.isAvailable,
 biometryType: result.biometryType,
 };
 } catch {
 return { available: false, biometryType: BiometryType.NONE };
 }
};

/**
 * Get a user-friendly name for the biometric type
 */
export const getBiometricTypeName = (type: BiometryType): string => {
 switch (type) {
 case BiometryType.FACE_ID:
 return"Face ID";
 case BiometryType.TOUCH_ID:
 return"Touch ID";
 case BiometryType.FINGERPRINT:
 return"Fingerprint";
 case BiometryType.FACE_AUTHENTICATION:
 return"Face Authentication";
 case BiometryType.IRIS_AUTHENTICATION:
 return"Iris Authentication";
 default:
 return"Biometric Login";
 }
};

/**
 * Store credentials securely in the device keychain after successful login
 */
export const saveCredentials = async (
 email: string,
 password: string
): Promise<boolean> => {
 if (!isNativePlatform()) return false;

 try {
 await NativeBiometric.setCredentials({
 username: email,
 password,
 server: BIOMETRIC_SERVER,
 });
 localStorage.setItem("biometric_enabled","true");
 return true;
 } catch (error) {
 console.error("Failed to save biometric credentials:", error);
 return false;
 }
};

/**
 * Verify biometric identity and retrieve stored credentials
 */
export const authenticateWithBiometric = async (): Promise<BiometricCredentials | null> => {
 if (!isNativePlatform()) return null;

 try {
 // Prompt for biometric verification
 await NativeBiometric.verifyIdentity({
 reason:"Log in to PawBucks",
 title:"Biometric Login",
 subtitle:"Use your biometrics to sign in",
 description:"Place your finger on the sensor or look at the camera",
 });

 // If verification succeeds, retrieve stored credentials
 const credentials = await NativeBiometric.getCredentials({
 server: BIOMETRIC_SERVER,
 });

 return {
 email: credentials.username,
 password: credentials.password,
 };
 } catch (error) {
 console.error("Biometric authentication failed:", error);
 return null;
 }
};

/**
 * Remove stored biometric credentials
 */
export const removeBiometricCredentials = async (): Promise<void> => {
 if (!isNativePlatform()) return;

 try {
 await NativeBiometric.deleteCredentials({ server: BIOMETRIC_SERVER });
 localStorage.removeItem("biometric_enabled");
 } catch (error) {
 console.error("Failed to remove biometric credentials:", error);
 }
};

/**
 * Check if biometric login has been enabled by the user
 */
export const isBiometricEnabled = (): boolean => {
 return localStorage.getItem("biometric_enabled") ==="true";
};
