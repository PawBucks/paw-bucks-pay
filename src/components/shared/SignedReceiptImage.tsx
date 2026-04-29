import { useState, useEffect } from"react";
import { getSignedReceiptUrl } from"@/lib/receiptUrl";
import { Loader2 } from"lucide-react";

interface SignedReceiptImageProps {
 receiptPath: string;
 alt?: string;
 className?: string;
}

/**
 * Displays a receipt image using a signed URL.
 * Handles both legacy public URLs and new path-only values.
 */
export const SignedReceiptImage = ({ receiptPath, alt ="Receipt", className ="w-full h-full object-contain" }: SignedReceiptImageProps) => {
 const [signedUrl, setSignedUrl] = useState<string | null>(null);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 let cancelled = false;
 setLoading(true);
 getSignedReceiptUrl(receiptPath).then((url) => {
 if (!cancelled) {
 setSignedUrl(url);
 setLoading(false);
 }
 });
 return () => { cancelled = true; };
 }, [receiptPath]);

 if (loading) {
 return (
 <div className="flex items-center justify-center w-full h-full">
 <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
 </div>
 );
 }

 return <img src={signedUrl ||""} alt={alt} className={className} />;
};
