import { supabase } from"@/integrations/supabase/client";

/**
 * Resolves a merchant-messages file reference to an accessible signed URL.
 * Handles both legacy full public URLs and new storage paths.
 */
export async function getMerchantMessageFileUrl(fileRef: string): Promise<string> {
 // If it's already a full URL (legacy data), extract the path
 const isFullUrl = fileRef.startsWith("http");
 
 let storagePath = fileRef;
 if (isFullUrl) {
 // Extract path from public URL: .../object/public/merchant-messages/PATH
 const match = fileRef.match(/merchant-messages\/(.+)$/);
 if (match) {
 storagePath = match[1];
 } else {
 // Can't extract path, return as-is (may fail for private bucket)
 return fileRef;
 }
 }

 const { data, error } = await supabase.storage
 .from("merchant-messages")
 .createSignedUrl(storagePath, 3600); // 1 hour TTL

 if (error || !data?.signedUrl) {
 console.error("Failed to create signed URL:", error);
 return fileRef; // Fallback to original
 }

 return data.signedUrl;
}
