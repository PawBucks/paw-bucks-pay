import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Share2, Download, ShieldCheck, PawPrint, Syringe, AlertTriangle, Copy, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";

type PetRow = {
  id: string;
  name: string;
  type: string;
  breed: string | null;
  birthday: string | null;
  photo_url: string | null;
  gender: string | null;
  color_markings: string | null;
  size: string | null;
  microchip_number: string | null;
  identifying_features: string | null;
  digital_id_token: string | null;
  user_id: string;
};

type Vaccination = {
  id: string;
  vaccine_name: string;
  vaccine_type: string;
  manufacturer: string | null;
  administration_date: string;
  expiration_date: string | null;
  next_due_date: string | null;
  administered_by: string | null;
};

const SHARE_BASE = "https://pawbucks.app";

export default function PetDigitalId() {
  const { petId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pet, setPet] = useState<PetRow | null>(null);
  const [ownerName, setOwnerName] = useState<string>("");
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [allergies, setAllergies] = useState<{ allergy_name: string; severity: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!petId || !user) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petId, user?.id]);

  const load = async () => {
    setLoading(true);
    const { data: petData, error } = await supabase
      .from("pet_profiles")
      .select("*")
      .eq("id", petId!)
      .maybeSingle();
    if (error || !petData) {
      toast({ title: "Unable to load pet", variant: "destructive" });
      setLoading(false);
      return;
    }
    setPet(petData as PetRow);

    const [{ data: profile }, { data: vaxData }, { data: allergyData }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", petData.user_id).maybeSingle(),
      supabase.from("pet_vaccinations").select("*").eq("pet_id", petData.id).order("administration_date", { ascending: false }),
      (supabase.from("pet_allergies") as any).select("allergy_name, severity").eq("pet_id", petData.id).eq("is_active", true),
    ]);
    setOwnerName(profile?.full_name || "PawBucks Member");
    setVaccinations((vaxData || []) as Vaccination[]);
    setAllergies((allergyData || []) as any);
    setLoading(false);
  };

  const shareUrl = pet?.digital_id_token
    ? `${SHARE_BASE}/pet-id/public/${pet.digital_id_token}`
    : "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast({ title: "Link copied", description: "Share this with vets, groomers, or boarders." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${pet?.name}'s Digital Pet ID`,
          text: `Verify ${pet?.name}'s vaccination records & ID`,
          url: shareUrl,
        });
      } catch {
        // user cancelled
      }
    } else {
      void handleCopy();
    }
  };

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="container max-w-2xl mx-auto p-4 space-y-4">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="container max-w-2xl mx-auto p-4">
        <p>Pet not found.</p>
        <Button onClick={() => navigate("/dashboard")} className="mt-4">Back to Dashboard</Button>
      </div>
    );
  }

  const upToDateCount = vaccinations.filter(
    (v) => !v.next_due_date || new Date(v.next_due_date) > new Date()
  ).length;
  const overdueCount = vaccinations.filter(
    (v) => v.next_due_date && new Date(v.next_due_date) <= new Date()
  ).length;

  return (
    <>
      <SEO title={`${pet.name}'s Digital Pet ID`} description="Official PawBucks Digital Pet ID with vaccination proof" />
      <div className="container max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between print:hidden">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="w-4 h-4 mr-2" /> Share
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Download className="w-4 h-4 mr-2" /> Print
            </Button>
          </div>
        </div>

        <Card ref={cardRef} className="overflow-hidden border-2 border-primary/30 shadow-2xl print:shadow-none">
          {/* Header banner */}
          <div className="bg-gradient-to-br from-primary via-primary/90 to-primary/70 text-primary-foreground p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <PawPrint className="w-6 h-6" />
                <span className="font-bold tracking-wide text-sm uppercase">PawBucks Digital Pet ID</span>
              </div>
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                <ShieldCheck className="w-3 h-3 mr-1" /> Verified
              </Badge>
            </div>
            <div className="flex items-center gap-4">
              {pet.photo_url ? (
                <img
                  src={pet.photo_url}
                  alt={pet.name}
                  className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-white/20 border-4 border-white flex items-center justify-center">
                  <PawPrint className="w-12 h-12" />
                </div>
              )}
              <div>
                <h1 className="text-3xl font-bold leading-tight">{pet.name}</h1>
                <p className="opacity-90 capitalize">
                  {pet.type}
                  {pet.breed ? ` · ${pet.breed}` : ""}
                </p>
                {pet.birthday && (
                  <p className="text-sm opacity-80">
                    Born {new Date(pet.birthday).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>

          <CardContent className="p-6 space-y-6">
            {/* Owner & ID details */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Owner" value={ownerName} />
              <Field label="Microchip #" value={pet.microchip_number || "—"} />
              <Field label="Gender" value={pet.gender || "—"} />
              <Field label="Size" value={pet.size || "—"} />
              {pet.color_markings && <Field label="Color / Markings" value={pet.color_markings} className="col-span-2" />}
              {pet.identifying_features && <Field label="Identifying Features" value={pet.identifying_features} className="col-span-2" />}
            </div>

            {/* Vaccination summary */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold flex items-center gap-2">
                  <Syringe className="w-4 h-4" /> Vaccination Status
                </h2>
                <div className="flex gap-2">
                  <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/20 border-green-500/30">
                    {upToDateCount} Current
                  </Badge>
                  {overdueCount > 0 && (
                    <Badge variant="destructive">{overdueCount} Overdue</Badge>
                  )}
                </div>
              </div>
              {vaccinations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No vaccinations on file yet. Visit a partner vet to add records.</p>
              ) : (
                <div className="space-y-2">
                  {vaccinations.map((v) => {
                    const overdue = v.next_due_date && new Date(v.next_due_date) <= new Date();
                    return (
                      <div key={`${v.vaccine_name}-${v.administration_date}`} className="flex items-start justify-between p-3 rounded-lg bg-muted/40 border">
                        <div>
                          <p className="font-medium text-sm">{v.vaccine_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Given {new Date(v.administration_date).toLocaleDateString()}
                            {v.administered_by ? ` · by ${v.administered_by}` : ""}
                          </p>
                          {v.next_due_date && (
                            <p className={`text-xs mt-0.5 ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                              Next due {new Date(v.next_due_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <Badge variant={overdue ? "destructive" : "secondary"} className="text-xs">
                          {overdue ? "Overdue" : "Current"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Allergies */}
            {allergies.length > 0 && (
              <div className="border-t pt-4">
                <h2 className="font-bold flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Allergies & Alerts
                </h2>
                <div className="flex flex-wrap gap-2">
                  {allergies.map((a, i) => (
                    <Badge key={i} variant="outline" className="border-amber-500/40 text-amber-700">
                      {a.allergy_name} ({a.severity})
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* QR code */}
            {shareUrl && (
              <div className="border-t pt-4 flex flex-col items-center gap-3">
                <p className="text-sm font-medium text-center">Scan to verify in seconds</p>
                <div className="bg-white p-3 rounded-lg border-2 border-primary/20">
                  <QRCodeSVG value={shareUrl} size={160} level="M" />
                </div>
                <button
                  onClick={handleCopy}
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 print:hidden"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied!" : "Copy share link"}
                </button>
              </div>
            )}

            <p className="text-[10px] text-center text-muted-foreground border-t pt-3">
              Issued by PawBucks · ID #{pet.id.slice(0, 8).toUpperCase()} · Verified {new Date().toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Field({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}