import { useState } from"react";
import { Button } from"@/components/ui/button";
import { Label } from"@/components/ui/label";
import { ExternalLink, FileText, Upload, X } from "lucide-react";
import { supabase } from"@/integrations/supabase/client";
import { toast } from"sonner";

type PolicyType ="tos" |"privacy" |"shipping_returns";

interface PolicyDocumentUploadProps {
 userId: string;
 entityId: string;
 entityType:"merchant" |"vet";
 tosUrl?: string | null;
 privacyPolicyUrl?: string | null;
 shippingReturnsPolicyUrl?: string | null;
 onUpdate: () => void;
}

const POLICY_CONFIG: Record<PolicyType, { label: string; dbField: string }> = {
 tos: { label:"Terms of Service", dbField:"tos_url" },
 privacy: { label:"Privacy Policy", dbField:"privacy_policy_url" },
 shipping_returns: { label:"Shipping & Returns Policy", dbField:"shipping_returns_policy_url" },
};

export const PolicyDocumentUpload = ({
 userId,
 entityId,
 entityType,
 tosUrl,
 privacyPolicyUrl,
 shippingReturnsPolicyUrl,
 onUpdate,
}: PolicyDocumentUploadProps) => {
 const [uploading, setUploading] = useState<PolicyType | null>(null);

 const currentUrls: Record<PolicyType, string | null> = {
 tos: tosUrl || null,
 privacy: privacyPolicyUrl || null,
 shipping_returns: shippingReturnsPolicyUrl || null,
 };

 const handleUpload = async (policyType: PolicyType, file: File) => {
 if (!file) return;

 const allowedTypes = ["application/pdf","text/html","text/plain"];
 if (!allowedTypes.includes(file.type)) {
 toast.error("Please upload a PDF, HTML, or text file.");
 return;
 }

 if (file.size > 10 * 1024 * 1024) {
 toast.error("File must be under 10MB.");
 return;
 }

 setUploading(policyType);
 try {
 const fileExt = file.name.split(".").pop();
 const filePath = `${userId}/${entityType}-${entityId}/${policyType}.${fileExt}`;

 const { error: uploadError } = await supabase.storage
 .from("policy-documents")
 .upload(filePath, file, { upsert: true });

 if (uploadError) throw uploadError;

 const { data: urlData } = supabase.storage
 .from("policy-documents")
 .getPublicUrl(filePath);

 const table = entityType ==="merchant" ?"merchants" :"partner_vets";
 const { dbField } = POLICY_CONFIG[policyType];

 const { error: updateError } = await supabase
 .from(table)
        .update({ [dbField]: urlData.publicUrl } as any)
 .eq("id", entityId);

 if (updateError) throw updateError;

 toast.success(`${POLICY_CONFIG[policyType].label} uploaded successfully!`);
 onUpdate();
 } catch (error: any) {
 console.error("Policy upload error:", error);
 toast.error("Failed to upload document.");
 } finally {
 setUploading(null);
 }
 };

 const handleRemove = async (policyType: PolicyType) => {
 try {
 const table = entityType ==="merchant" ?"merchants" :"partner_vets";
 const { dbField } = POLICY_CONFIG[policyType];

 const { error } = await supabase
 .from(table)
        .update({ [dbField]: null } as any)
 .eq("id", entityId);

 if (error) throw error;

 toast.success(`${POLICY_CONFIG[policyType].label} removed.`);
 onUpdate();
 } catch (error: any) {
 console.error("Policy remove error:", error);
 toast.error("Failed to remove document.");
 }
 };

 return (
 <div className="space-y-4 pt-4 border-t">
 <Label className="text-base font-semibold">Policy Documents</Label>
 <p className="text-sm text-muted-foreground">
 Upload your legal documents (PDF, HTML, or TXT). These will be linked at the bottom of your storefront.
 </p>

 <div className="space-y-3">
 {(Object.entries(POLICY_CONFIG) as [PolicyType, typeof POLICY_CONFIG[PolicyType]][]).map(
 ([key, config]) => {
 const url = currentUrls[key];
 const isUploading = uploading === key;

 return (
 <div key={key} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
 <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" aria-hidden="true" />
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium">{config.label}</p>
 {url ? (
 <a
 href={url}
 target="_blank"
 rel="noopener noreferrer"
 className="text-xs text-primary hover:underline flex items-center gap-1"
 >
 View document <ExternalLink className="w-3 h-3" />
 </a>
 ) : (
 <p className="text-xs text-muted-foreground">Not uploaded</p>
 )}
 </div>
 <div className="flex items-center gap-2">
 {url && (
 <Button
 type="button"
 variant="ghost"
 size="sm"
 onClick={() => handleRemove(key)}
 className="h-8 w-8 p-0 text-destructive hover:text-destructive"
 >
 <X className="w-4 h-4" />
 </Button>
 )}
 <Button
 type="button"
 variant="outline"
 size="sm"
 disabled={isUploading}
 className="relative"
 asChild
 >
 <label className="cursor-pointer">
 <Upload className="w-4 h-4 mr-1" />
 {isUploading ?"Uploading..." : url ?"Replace" :"Upload"}
 <input
 type="file"
 accept=".pdf,.html,.txt"
 className="absolute inset-0 opacity-0 cursor-pointer"
 onChange={(e) => {
 const file = e.target.files?.[0];
 if (file) handleUpload(key, file);
 e.target.value ="";
 }}
 />
 </label>
 </Button>
 </div>
 </div>
 );
 }
 )}
 </div>
 </div>
 );
};
