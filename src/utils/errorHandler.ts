import { toast } from'sonner';
import { ERROR_MESSAGES } from'@/lib/constants';

// Centralized error handling utility
export class ErrorHandler {
 static handle(error: unknown, customMessage?: string): void {
 console.error('Error:', error);

 let message = customMessage || ERROR_MESSAGES.GENERIC;

 if (error instanceof Error) {
 // Specific error types
 if (error.message.includes('network') || error.message.includes('fetch')) {
 message = ERROR_MESSAGES.NETWORK;
 } else if (error.message.includes('auth') || error.message.includes('unauthorized')) {
 message = ERROR_MESSAGES.AUTH_REQUIRED;
 } else if (error.message) {
 message = error.message;
 }
 }

 toast.error(message);
 }

 static async withToast<T>(
 promise: Promise<T>,
 loadingMessage: string,
 successMessage: string,
 errorMessage?: string
 ): Promise<T> {
 const toastId = toast.loading(loadingMessage);

 try {
 const result = await promise;
 toast.success(successMessage, { id: toastId });
 return result;
 } catch (error) {
 this.handle(error, errorMessage);
 toast.dismiss(toastId);
 throw error;
 }
 }

 static logError(context: string, error: unknown): void {
 console.error(`[${context}]:`, error);
 
 // In production, send to error tracking service
 if (process.env.NODE_ENV ==='production') {
 // TODO: Integrate with error tracking service (Sentry, LogRocket, etc.)
 }
 }
}
