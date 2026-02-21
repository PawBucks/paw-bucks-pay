import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface PetEmailInboxProps {
  petId: string;
  petName: string;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  vaccine: { label: "Vaccine", icon: Syringe, color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  lab_result: { label: "Lab Result", icon: FlaskConical, color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  prescription: { label: "Prescription", icon: Pill, color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  imaging: { label: "Imaging", icon: ImageIcon, color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  surgical: { label: "Surgical", icon: Scissors, color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  dental: { label: "Dental", icon: Heart, color: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200" },
  wellness: { label: "Wellness", icon: Heart, color: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200" },
  insurance: { label: "Insurance", icon: Shield, color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200" },
  invoice: { label: "Invoice", icon: Receipt, color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  other: { label: "Other", icon: FileText, color: "bg-muted text-muted-foreground" },
  uncategorized: { label: "Processing...", icon: HelpCircle, color: "bg-muted text-muted-foreground" },
};

export const PetEmailInbox = ({ petId, petName }: PetEmailInboxProps) => {
  const [emailAddress, setEmailAddress] = useState<string | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    loadData();
  }, [petId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load email address
      const { data: emailData } = await supabase
        .from("pet_email_addresses")
        .select("email_address")
        .eq("pet_id", petId)
        .eq("is_active", true)
        .maybeSingle();

      setEmailAddress(emailData?.email_address || null);

      // Load documents
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

  const copyEmail = async () => {
    if (!emailAddress) return;
    await navigator.clipboard.writeText(emailAddress);
    setCopied(true);
    toast.success("Email address copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredDocs = filter === "all"
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
            {emailAddress ? (
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
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
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
            variant={filter === "all" ? "default" : "outline"}
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
                variant={filter === cat ? "default" : "outline"}
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
                  : "Documents sent to your pet's email will appear here."}
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
                        <span>{format(new Date(doc.created_at), "MMM d, yyyy")}</span>
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
