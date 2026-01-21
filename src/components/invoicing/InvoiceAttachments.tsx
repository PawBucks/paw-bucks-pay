import { useState, useRef } from "react";
import { Upload, X, FileText, Image, Loader2, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Attachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

interface InvoiceAttachmentsProps {
  merchantId: string;
  invoiceId?: string;
  attachments: string[];
  onChange: (urls: string[]) => void;
  readonly?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) {
    return <Image className="h-5 w-5 text-blue-500" />;
  }
  return <FileText className="h-5 w-5 text-red-500" />;
}

function getFileName(url: string): string {
  try {
    const parts = url.split("/");
    const fileName = parts[parts.length - 1];
    // Remove UUID prefix if present (format: uuid_filename.ext)
    const underscoreIndex = fileName.indexOf("_");
    if (underscoreIndex > 30) {
      return fileName.substring(underscoreIndex + 1);
    }
    return fileName;
  } catch {
    return "Attachment";
  }
}

function getFileType(url: string): string {
  const ext = url.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (["jpg", "jpeg"].includes(ext || "")) return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "application/octet-stream";
}

export function InvoiceAttachments({
  merchantId,
  invoiceId,
  attachments,
  onChange,
  readonly = false,
}: InvoiceAttachmentsProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: Invalid file type. Only PDF and images are allowed.`);
        continue;
      }
      
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: File too large. Maximum size is 10MB.`);
        continue;
      }
      
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    setUploading(true);
    const newUrls: string[] = [];

    try {
      for (const file of validFiles) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${crypto.randomUUID()}_${file.name}`;
        const filePath = `${merchantId}/${invoiceId || "draft"}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("invoice-attachments")
          .upload(filePath, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("invoice-attachments")
          .getPublicUrl(filePath);

        newUrls.push(filePath);
      }

      if (newUrls.length > 0) {
        onChange([...attachments, ...newUrls]);
        toast.success(`${newUrls.length} file(s) uploaded`);
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload files");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = async (urlToRemove: string) => {
    try {
      const { error } = await supabase.storage
        .from("invoice-attachments")
        .remove([urlToRemove]);

      if (error) {
        console.error("Delete error:", error);
        // Still remove from UI even if storage delete fails
      }

      onChange(attachments.filter((url) => url !== urlToRemove));
      toast.success("Attachment removed");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to remove attachment");
    }
  };

  const handleView = async (path: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("invoice-attachments")
        .createSignedUrl(path, 3600); // 1 hour

      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (error) {
      console.error("Error getting signed URL:", error);
      toast.error("Failed to open attachment");
    }
  };

  const handleDownload = async (path: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("invoice-attachments")
        .download(path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = getFileName(path);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download attachment");
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-4">
      {/* Upload area */}
      {!readonly && (
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
            dragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50",
            uploading && "opacity-50 pointer-events-none"
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ALLOWED_TYPES.join(",")}
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />
          
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  Drag & drop files here or{" "}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-primary hover:underline"
                  >
                    browse
                  </button>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF and images up to 10MB
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Attachments list */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((path) => {
            const fileName = getFileName(path);
            const fileType = getFileType(path);
            const isImage = fileType.startsWith("image/");

            return (
              <div
                key={path}
                className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30"
              >
                {getFileIcon(fileType)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {isImage ? "Image" : "PDF"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleView(path)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDownload(path)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {!readonly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleRemove(path)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {attachments.length === 0 && readonly && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No attachments
        </p>
      )}
    </div>
  );
}
