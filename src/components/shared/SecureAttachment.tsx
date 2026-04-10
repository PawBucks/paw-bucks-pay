import { useState, useEffect } from "react";
import { getMerchantMessageFileUrl } from "@/utils/storageUrls";
import { Paperclip } from "lucide-react";

type Props = {
  fileUrl: string;
  fileType: string;
  fileName: string | null;
  maxHeight?: string;
};

export function SecureAttachment({ fileUrl, fileType, fileName, maxHeight = "max-h-48" }: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMerchantMessageFileUrl(fileUrl).then((url) => {
      if (!cancelled) setSignedUrl(url);
    });
    return () => { cancelled = true; };
  }, [fileUrl]);

  if (!signedUrl) return null;

  return (
    <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="block">
      {fileType === "image" ? (
        <img src={signedUrl} alt={fileName || "Attachment"} className={`max-w-full rounded-md ${maxHeight} object-cover`} />
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-background/20">
          <Paperclip className="w-4 h-4" />
          <span className="text-sm underline">{fileName || "Download file"}</span>
        </div>
      )}
    </a>
  );
}
