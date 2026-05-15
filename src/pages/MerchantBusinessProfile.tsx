import { useEffect, useState } from "react";
import { SEO } from "@/components/SEO";
import { MerchantWorkspaceLayout, WorkspacePageHeader } from "@/components/merchant/workspace/MerchantWorkspaceLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Pencil, Globe, Facebook, Instagram, Twitter, Linkedin, MapPin, Phone, User, Building2 } from "lucide-react";
import { EditMerchantProfileDialog } from "@/components/merchant/EditMerchantProfileDialog";
import { merchantsService } from "@/services/api/merchants.service";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Merchant = Tables<"merchants">;

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  veterinary: "Veterinary", grooming: "Grooming", mobile_groomer: "Mobile Groomer",
  pet_store: "Pet Store", food: "Food & Treats", boarding: "Boarding",
  training: "Training", walker: "Walker", daycare: "Daycare", sitter: "Pet Sitter",
  photography: "Photography", insurance: "Insurance", delivery: "Transportation",
  hiker: "Hiker", runner: "Runner", masseuse: "Masseuse", behaviorist: "Behaviorist",
  breeder: "Breeder", rescue_nonprofit: "Rescue / Nonprofit", other: "Other",
};

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground break-words">{value || <span className="text-muted-foreground italic">Not set</span>}</p>
    </div>
  );
}

export default function MerchantBusinessProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await merchantsService.getByUserId(user.id);
    setMerchant(data ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const handleSubmit = async (formData: FormData, logoFile: File | null, businessCategories: string[]) => {
    if (!merchant || !user) return;
    try {
      let logoUrl = merchant.logo_url ?? null;
      if (logoFile) {
        const ext = logoFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("merchant-logos").upload(path, logoFile, { upsert: true });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("merchant-logos").getPublicUrl(path);
        logoUrl = urlData.publicUrl;
      }

      const businessType = (formData.get("businessType") as string) || merchant.business_type;
      const updates = {
        business_name: (formData.get("businessName") as string)?.trim() || merchant.business_name,
        contact_person: (formData.get("contactPerson") as string)?.trim() || merchant.contact_person,
        phone: (formData.get("phone") as string)?.trim() || null,
        business_type: businessType,
        business_categories: businessCategories.length > 0 ? businessCategories : [businessType],
        address: (formData.get("address") as string)?.trim() || null,
        description: (formData.get("description") as string)?.trim() || null,
        website_url: (formData.get("websiteUrl") as string)?.trim() || null,
        facebook_url: (formData.get("facebookUrl") as string)?.trim() || null,
        instagram_url: (formData.get("instagramUrl") as string)?.trim() || null,
        twitter_url: (formData.get("twitterUrl") as string)?.trim() || null,
        linkedin_url: (formData.get("linkedinUrl") as string)?.trim() || null,
        logo_url: logoUrl,
      };

      const { error } = await merchantsService.update(merchant.id, updates as any);
      if (error) throw error;

      toast({ title: "Profile updated", description: "Your business information has been saved." });
      setEditOpen(false);
      await load();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Update failed", description: e?.message || "Please try again.", variant: "destructive" });
    }
  };

  const categories = merchant?.business_categories?.length
    ? merchant.business_categories
    : merchant?.business_type ? [merchant.business_type] : [];

  return (
    <>
      <SEO title="Business Profile · Merchant Workspace" description="Manage your business information" />
      <MerchantWorkspaceLayout>
        <WorkspacePageHeader
          section="Account"
          title="Business Profile"
          subtitle="Manage how customers see your business across PawBucks"
          actions={merchant ? (
            <Button onClick={() => setEditOpen(true)}><Pencil className="w-4 h-4 mr-2" />Edit Profile</Button>
          ) : null}
        />
        <div className="p-4 md:p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !merchant ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No merchant profile found.</CardContent></Card>
          ) : (
            <>
              {/* Header card */}
              <Card>
                <CardContent className="p-6 flex items-start gap-5 flex-wrap">
                  {merchant.logo_url ? (
                    <img src={merchant.logo_url} alt={merchant.business_name} className="w-24 h-24 rounded-2xl object-cover border-2 border-border" />
                  ) : (
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground flex items-center justify-center text-2xl font-bold">
                      {merchant.business_name?.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-[240px]">
                    <h2 className="text-2xl font-bold">{merchant.business_name}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{merchant.description || "Add a description so customers know what you offer."}</p>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {categories.map((c, i) => (
                        <Badge key={c} variant={i === 0 ? "default" : "secondary"} className="text-[11px]">
                          {BUSINESS_TYPE_LABELS[c] || c}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* About */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4" />About</CardTitle></CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-5">
                  <Field label="Business Name" value={merchant.business_name} />
                  <Field label="Primary Category" value={BUSINESS_TYPE_LABELS[merchant.business_type] || merchant.business_type} />
                  <div className="sm:col-span-2"><Field label="Description" value={merchant.description} /></div>
                </CardContent>
              </Card>

              {/* Contact */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4" />Contact Information</CardTitle></CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-5">
                  <Field label="Contact Person" value={merchant.contact_person} />
                  <Field label="Phone" value={merchant.phone} />
                  <Field label="Email" value={(merchant as any).email} />
                </CardContent>
              </Card>

              {/* Address */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4" />Address</CardTitle></CardHeader>
                <CardContent><Field label="Business Address" value={merchant.address} /></CardContent>
              </Card>

              {/* Web & Social */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Globe className="w-4 h-4" />Website & Social</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { icon: Globe, label: "Website", value: merchant.website_url, color: "text-muted-foreground" },
                    { icon: Facebook, label: "Facebook", value: merchant.facebook_url, color: "text-[#1877F2]" },
                    { icon: Instagram, label: "Instagram", value: merchant.instagram_url, color: "text-[#E4405F]" },
                    { icon: Twitter, label: "X (Twitter)", value: merchant.twitter_url, color: "text-foreground" },
                    { icon: Linkedin, label: "LinkedIn", value: merchant.linkedin_url, color: "text-[#0A66C2]" },
                  ].map(({ icon: Icon, label, value, color }) => (
                    <div key={label} className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${color}`} />
                      <span className="text-xs font-semibold text-muted-foreground w-24">{label}</span>
                      {value ? (
                        <a href={value} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline truncate">{value}</a>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">Not set</span>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <EditMerchantProfileDialog
                open={editOpen}
                onOpenChange={setEditOpen}
                merchant={merchant as any}
                onSubmit={handleSubmit}
                onRefresh={load}
              />
            </>
          )}
        </div>
      </MerchantWorkspaceLayout>
    </>
  );
}