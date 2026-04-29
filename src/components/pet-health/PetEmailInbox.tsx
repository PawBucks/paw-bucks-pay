import { useState, useEffect, useCallback } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { ScrollArea } from"@/components/ui/scroll-area";
import {
 Mail,
 Copy,
 Check,
 FileText,
 Syringe,
 FlaskConical,
 Pill,
 ImageIcon,
 Scissors,
 Heart,
 Shield,
 Receipt,
 HelpCircle,
 ExternalLink,
 Inbox,
 Loader2,
 Pencil,
 AlertCircle,
 CheckCircle2,
} from"lucide-react";
import { toast } from"sonner";
import { format } from"date-fns";

interface PetEmailInboxProps {
 petId: string;
 petName: string;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
 vaccine: { label:"Vaccine", icon: Syringe, color:"bg-success/10 text-success" },
 lab_result: { label:"Lab Result", icon: FlaskConical, color:"bg-info/10 text-info" },
 prescription: { label:"Prescription", icon: Pill, color:"bg-accent/10 text-accent" },
 imaging: { label:"Imaging", icon: ImageIcon, color:"bg-warning/10 text-warning" },
 surgical: { label:"Surgical", icon: Scissors, color:"bg-destructive/10 text-destructive" },
 dental: { label:"Dental", icon: Heart, color:"bg-accent/10 text-accent" },
 wellness: { label:"Wellness", icon: Heart, color:"bg-success/10 text-success" },
 insurance: { label:"Insurance", icon: Shield, color:"bg-info/10 text-info" },
 invoice: { label:"Invoice", icon: Receipt, color:"bg-warning/10 text-warning" },
 other: { label:"Other", icon: FileText, color:"bg-muted text-muted-foreground" },
 uncategorized: { label:"Processing...", icon: HelpCircle, color:"bg-muted text-muted-foreground" },
};

export const PetEmailInbox = ({ petId, petName }: PetEmailInboxProps) => {
 const [emailAddress, setEmailAddress] = useState<string | null>(null);
 const [shortCode, setShortCode] = useState<string>("");
 const [documents, setDocuments] = useState<any[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [copied, setCopied] = useState(false);
 const [filter, setFilter] = useState<string>("all");

 // Custom email name state
 const [isEditing, setIsEditing] = useState(false);
 const [customName, setCustomName] = useState("");
 const [nameStatus, setNameStatus] = useState<"idle" |"checking" |"available" |"taken" |"invalid">("idle");
 const [isSaving, setIsSaving] = useState(false);
 const [checkTimeout, setCheckTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

 useEffect(() => {
 loadData();
 }, [petId]);

 const loadData = async () => {
 setIsLoading(true);
 try {
 const { data: emailData } = await supabase
 .from("pet_email_addresses")
 .select("email_address, short_code")
 .eq("pet_id", petId)
 .eq("is_active", true)
 .maybeSingle();

 setEmailAddress(emailData?.email_address || null);
 setShortCode(emailData?.short_code ||"");

 const { data: docs } = await supabase
 .from("pet_inbound_documents")
 .select("*")
 .eq("pet_id", petId)
 .order("created_at", { ascending: false });

 setDocuments(docs || []);
 } catch (err) {
 console.error("Error loading pet email data:", err);
 } finally {
 setIsLoading(false);
 }
 };

 const validateName = (name: string): boolean => {
 // Only allow lowercase letters, numbers, hyphens, underscores, dots. 3-30 chars.
 return /^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$/.test(name);
 };

 const checkAvailability = useCallback(async (name: string) => {
 if (!validateName(name)) {
 setNameStatus("invalid");
 return;
 }
 setNameStatus("checking");
 const { data } = await supabase
 .from("pet_email_addresses")
 .select("pet_id")
 .eq("short_code", name.toLowerCase())
 .eq("is_active", true)
 .neq("pet_id", petId)
 .maybeSingle();

 setNameStatus(data ?"taken" :"available");
 }, [petId]);

 const handleNameChange = (value: string) => {
 const cleaned = value.toLowerCase().replace(/[^a-z0-9._-]/g,"");
 setCustomName(cleaned);

 if (checkTimeout) clearTimeout(checkTimeout);

 if (!cleaned || cleaned.length < 3) {
 setNameStatus("idle");
 return;
 }

 const timeout = setTimeout(() => checkAvailability(cleaned), 400);
 setCheckTimeout(timeout);
 };

 const handleSaveCustomEmail = async () => {
 if (nameStatus !=="available" || !customName) return;
 setIsSaving(true);
 try {
 const emailAddr = `${customName}@inbox.pawbucks.app`;
 const { error } = await supabase
 .from("pet_email_addresses")
 .update({ email_address: emailAddr, short_code: customName })
 .eq("pet_id", petId)
 .eq("is_active", true);

 if (error) throw error;

 setEmailAddress(emailAddr);
 setShortCode(customName);
 setIsEditing(false);
 setNameStatus("idle");
 toast.success("Email address updated!");
 } catch (err: any) {
 console.error("Error updating email:", err);
 if (err.message?.includes("unique") || err.code ==="23505") {
 setNameStatus("taken");
 toast.error("That name was just taken. Please try another.");
 } else {
 toast.error("Failed to update email address");
 }
 } finally {
 setIsSaving(false);
 }
 };

 const copyEmail = async () => {
 if (!emailAddress) return;
 await navigator.clipboard.writeText(emailAddress);
 setCopied(true);
 toast.success("Email address copied!");
 setTimeout(() => setCopied(false), 2000);
 };

 const filteredDocs = filter ==="all"
 ? documents
 : documents.filter((d) => d.category === filter);

 const categoryCounts = documents.reduce((acc: Record<string, number>, doc) => {
 acc[doc.category] = (acc[doc.category] || 0) + 1;
 return acc;
 }, {});

 if (isLoading) {
 return (
 <Card className="p-6">
 <div className="flex items-center justify-center gap-2 py-8">
 <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
 <span className="text-muted-foreground">Loading inbox...</span>
 </div>
 </Card>
 );
 }

 return (
 <div className="space-y-4">
 {/* Email Address Card */}
 <Card className="p-4 bg-primary/5 border-primary/20">
 <div className="flex items-start gap-3">
 <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
 <Mail className="w-5 h-5 text-primary" />
 </div>
 <div className="flex-1 min-w-0">
 <h3 className="font-semibold text-sm mb-1">{petName}'s Health Email</h3>
 <p className="text-xs text-muted-foreground mb-2">
 Share this email with your vet. Documents sent here are automatically organized.
 </p>

 {isEditing ? (
 <div className="space-y-3">
 <div className="space-y-1.5">
 <Label htmlFor="custom-email" className="text-xs">Choose your email name</Label>
 <div className="flex items-center gap-1">
 <Input
 id="custom-email"
 value={customName}
 onChange={(e) => handleNameChange(e.target.value)}
 placeholder={petName.toLowerCase().replace(/\s+/g,"")}
 className="font-mono text-sm max-w-[180px]"
 maxLength={30}
 />
 <span className="text-sm text-muted-foreground whitespace-nowrap">@inbox.pawbucks.app</span>
 </div>
 {/* Status indicator */}
 <div className="flex items-center gap-1.5 min-h-[20px]">
 {nameStatus ==="checking" && (
 <><Loader2 className="w-3 h-3 animate-spin text-muted-foreground" /><span className="text-xs text-muted-foreground">Checking availability...</span></>
 )}
 {nameStatus ==="available" && (
 <><CheckCircle2 className="w-3 h-3 text-success" /><span className="text-xs text-success">Available!</span></>
 )}
 {nameStatus ==="taken" && (
 <><AlertCircle className="w-3 h-3 text-destructive" /><span className="text-xs text-destructive">Already taken</span></>
 )}
 {nameStatus ==="invalid" && customName.length >= 3 && (
 <><AlertCircle className="w-3 h-3 text-destructive" /><span className="text-xs text-destructive">Letters, numbers, hyphens, underscores only (3-30 chars)</span></>
 )}
 {nameStatus ==="idle" && customName.length > 0 && customName.length < 3 && (
 <span className="text-xs text-muted-foreground">At least 3 characters</span>
 )}
 </div>
 </div>
 <div className="flex items-center gap-2">
 <Button
 size="sm"
 onClick={handleSaveCustomEmail}
 disabled={nameStatus !=="available" || isSaving}
 >
 {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
 Save
 </Button>
 <Button
 size="sm"
 variant="ghost"
 onClick={() => { setIsEditing(false); setCustomName(""); setNameStatus("idle"); }}
 >
 Cancel
 </Button>
 </div>
 </div>
 ) : emailAddress ? (
 <div className="flex items-center gap-2">
 <code className="text-sm font-mono bg-background px-3 py-1.5 rounded border truncate">
 {emailAddress}
 </code>
 <Button
 variant="outline"
 size="sm"
 onClick={copyEmail}
 className="flex-shrink-0"
 >
 {copied ? (
 <Check className="w-4 h-4 text-success" />
 ) : (
 <Copy className="w-4 h-4" />
 )}
 </Button>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => { setIsEditing(true); setCustomName(shortCode); }}
 className="flex-shrink-0"
 >
 <Pencil className="w-4 h-4" />
 </Button>
 </div>
 ) : (
 <p className="text-sm text-muted-foreground italic">
 Email address not yet assigned.
 </p>
 )}
 </div>
 </div>
 </Card>

 {/* Category Filters */}
 {documents.length > 0 && (
 <div className="flex flex-wrap gap-2">
 <Button
 variant={filter ==="all" ?"default" :"outline"}
 size="sm"
 onClick={() => setFilter("all")}
 >
 All ({documents.length})
 </Button>
 {Object.entries(categoryCounts).map(([cat, count]) => {
 const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.other;
 const Icon = config.icon;
 return (
 <Button
 key={cat}
 variant={filter === cat ?"default" :"outline"}
 size="sm"
 onClick={() => setFilter(cat)}
 >
 <Icon className="w-3 h-3 mr-1" />
 {config.label} ({count as number})
 </Button>
 );
 })}
 </div>
 )}

 {/* Documents List */}
 {filteredDocs.length === 0 ? (
 <Card className="p-8">
 <div className="text-center space-y-3">
 <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
 <Inbox className="w-8 h-8 text-muted-foreground" />
 </div>
 <div>
 <h3 className="font-semibold">No documents yet</h3>
 <p className="text-sm text-muted-foreground mt-1">
 {emailAddress
 ? `Share ${emailAddress} with your vet to start receiving documents automatically.`
 :"Documents sent to your pet's email will appear here."}
 </p>
 </div>
 </div>
 </Card>
 ) : (
 <ScrollArea className="max-h-[600px]">
 <div className="space-y-3">
 {filteredDocs.map((doc) => {
 const config = CATEGORY_CONFIG[doc.category] || CATEGORY_CONFIG.other;
 const Icon = config.icon;

 return (
 <Card key={doc.id} className="p-4 hover:shadow-md transition-shadow">
 <div className="flex items-start gap-3">
 <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
 <Icon className="w-4 h-4" />
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-start justify-between gap-2">
 <div className="min-w-0">
 <h4 className="font-medium text-sm truncate">
 {doc.file_name}
 </h4>
 <div className="flex items-center gap-2 mt-1 flex-wrap">
 <Badge
 variant="secondary"
 className={`text-xs ${config.color}`}
 >
 {config.label}
 </Badge>
 {doc.ai_confidence != null && (
 <span className="text-xs text-muted-foreground">
 {Math.round(doc.ai_confidence * 100)}% confidence
 </span>
 )}
 </div>
 </div>
 <Button
 variant="ghost"
 size="sm"
 asChild
 className="flex-shrink-0"
 >
 <a
 href={doc.file_url}
 target="_blank"
 rel="noopener noreferrer"
 >
 <ExternalLink className="w-4 h-4" />
 </a>
 </Button>
 </div>
 {doc.ai_summary && (
 <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
 {doc.ai_summary}
 </p>
 )}
 <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
 {doc.sender_name || doc.sender_email ? (
 <span>From: {doc.sender_name || doc.sender_email}</span>
 ) : null}
 <span>{format(new Date(doc.created_at),"MMM d, yyyy")}</span>
 {doc.file_size_bytes && (
 <span>
 {doc.file_size_bytes > 1048576
 ? `${(doc.file_size_bytes / 1048576).toFixed(1)} MB`
 : `${Math.round(doc.file_size_bytes / 1024)} KB`}
 </span>
 )}
 </div>
 </div>
 </div>
 </Card>
 );
 })}
 </div>
 </ScrollArea>
 )}
 </div>
 );
};
