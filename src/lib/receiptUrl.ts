import { supabase } from "@/integrations/supabase/client";

/**
 * Extracts the storage path from a receipt URL or returns the path as-is.
 * Handles both old public URLs and new path-only values.
 */
function extractReceiptPath(urlOrPath: string): string {
  // If it's a full URL, extract the path after /receipts/
  const match = urlOrPath.match(/\/storage\/v1\/object\/(?:public|sign)\/receipts\/(.+)/);
  if (match) return match[1];
  // If it starts with the bucket name, strip it
  if (urlOrPath.startsWith("receipts/")) return urlOrPath.slice("receipts/".length);
  return urlOrPath;
}

/**
 * Gets a signed URL for a receipt image (valid for 1 hour).
 * Works with both old public URLs and new path-only values stored in DB.
 */
export async function getSignedReceiptUrl(urlOrPath: string): Promise<string> {
  const path = extractReceiptPath(urlOrPath);
  const { data, error } = await supabase.storage
    .from("receipts")
    .createSignedUrl(path, 3600); // 1 hour
  if (error || !data?.signedUrl) {
    console.error("Failed to create signed receipt URL:", error);
    return urlOrPath; // fallback to original
  }
  return data.signedUrl;
}
