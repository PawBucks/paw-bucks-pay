import { useEffect, useState } from"react";
import { useParams } from"react-router-dom";
import { supabase } from"@/integrations/supabase/client";
import { Card, CardContent } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Skeleton } from"@/components/ui/skeleton";
import { ShieldCheck, Syringe, AlertTriangle, ShieldX } from"lucide-react";
import pawbucksLogo from "@/assets/pawbucks-logo.png";
import { SEO } from"@/components/SEO";

type DigitalId = {
 pet: {
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
 };
 owner: { full_name: string };
 vaccinations: Array<{
 vaccine_name: string;
 administration_date: string;
 next_due_date: string | null;
 administered_by: string | null;
 }>;
 allergies: Array<{ allergy_name: string; severity: string }>;
 verified_at: string;
};

export default function PetDigitalIdPublic() {
 const { token } = useParams();
 const [data, setData] = useState<DigitalId | null>(null);
 const [loading, setLoading] = useState(true);
 const [notFound, setNotFound] = useState(false);

 useEffect(() => {
 if (!token) return;
 void load();
 }, [token]);

 const load = async () => {
 setLoading(true);
 const { data: result, error } = await (supabase.rpc as any)("get_pet_digital_id", { p_token: token });
 if (error || !result) {
 setNotFound(true);
 } else {
 setData(result as DigitalId);
 }
 setLoading(false);
 };

 if (loading) {
 return (
 <div className="container max-w-2xl mx-auto p-4 space-y-4">
 <Skeleton className="h-96 w-full" />
 </div>
 );
 }

 if (notFound || !data) {
 return (
 <div className="min-h-screen flex items-center justify-center p-4">
 <Card className="max-w-md w-full">
 <CardContent className="pt-8 pb-6 text-center space-y-3">
 <ShieldX className="w-12 h-12 mx-auto text-destructive" />
 <h1 className="text-xl font-bold">Invalid Pet ID</h1>
 <p className="text-sm text-muted-foreground">
 This Digital Pet ID link is invalid or has been revoked by the owner.
 </p>
 </CardContent>
 </Card>
 </div>
 );
 }

 const { pet, owner, vaccinations, allergies } = data;
 const upToDateCount = vaccinations.filter(
 (v) => !v.next_due_date || new Date(v.next_due_date) > new Date()
 ).length;
 const overdueCount = vaccinations.filter(
 (v) => v.next_due_date && new Date(v.next_due_date) <= new Date()
 ).length;

 return (
 <>
 <SEO title={`${pet.name} – Verified Digital Pet ID`} description="PawBucks verified pet identity & vaccination proof" />
 <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background py-6">
 <div className="container max-w-2xl mx-auto p-4">
 <Card className="overflow-hidden border-2 border-primary/30 shadow-2xl">
 <div className="bg-gradient-to-br from-primary via-primary/90 to-primary/70 text-primary-foreground p-6">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-2">
 <img src={pawbucksLogo} alt="PawBucks" className="w-6 h-6 object-contain" />
 <span className="font-bold tracking-wide text-sm uppercase">PawBucks Digital Pet ID</span>
 </div>
 <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
 <ShieldCheck className="w-3 h-3 mr-1" /> Verified
 </Badge>
 </div>
 <div className="flex items-center gap-4">
 {pet.photo_url ? (
 <img src={pet.photo_url} alt={pet.name} className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg" />
 ) : (
 <div className="w-24 h-24 rounded-full bg-white/20 border-4 border-white flex items-center justify-center">
 <img src={pawbucksLogo} alt="PawBucks" className="w-12 h-12 object-contain" />
 </div>
 )}
 <div>
 <h1 className="text-3xl font-bold leading-tight">{pet.name}</h1>
 <p className="opacity-90 capitalize">
 {pet.type}
 {pet.breed ? ` · ${pet.breed}` :""}
 </p>
 {pet.birthday && (
 <p className="text-sm opacity-80">Born {new Date(pet.birthday).toLocaleDateString()}</p>
 )}
 </div>
 </div>
 </div>

 <CardContent className="p-6 space-y-6">
 <div className="grid grid-cols-2 gap-4 text-sm">
 <Field label="Owner" value={owner.full_name} />
 <Field label="Microchip #" value={pet.microchip_number ||"—"} />
 <Field label="Gender" value={pet.gender ||"—"} />
 <Field label="Size" value={pet.size ||"—"} />
 {pet.color_markings && <Field label="Color / Markings" value={pet.color_markings} className="col-span-2" />}
 {pet.identifying_features && <Field label="Identifying Features" value={pet.identifying_features} className="col-span-2" />}
 </div>

 <div className="border-t pt-4">
 <div className="flex items-center justify-between mb-3">
 <h2 className="font-bold flex items-center gap-2">
 <Syringe className="w-4 h-4" /> Vaccination Status
 </h2>
 <div className="flex gap-2">
 <Badge className="bg-success/15 text-success hover:bg-success/20 border-success/30">
 {upToDateCount} Current
 </Badge>
 {overdueCount > 0 && <Badge variant="destructive">{overdueCount} Overdue</Badge>}
 </div>
 </div>
 {vaccinations.length === 0 ? (
 <p className="text-sm text-muted-foreground">No vaccinations on file.</p>
 ) : (
 <div className="space-y-2">
 {vaccinations.map((v, i) => {
 const overdue = v.next_due_date && new Date(v.next_due_date) <= new Date();
 return (
 <div key={i} className="flex items-start justify-between p-3 rounded-lg bg-muted/40 border">
 <div>
 <p className="font-medium text-sm">{v.vaccine_name}</p>
 <p className="text-xs text-muted-foreground">
 Given {new Date(v.administration_date).toLocaleDateString()}
 {v.administered_by ? ` · by ${v.administered_by}` :""}
 </p>
 {v.next_due_date && (
 <p className={`text-xs mt-0.5 ${overdue ?"text-destructive font-medium" :"text-muted-foreground"}`}>
 Next due {new Date(v.next_due_date).toLocaleDateString()}
 </p>
 )}
 </div>
 <Badge variant={overdue ?"destructive" :"secondary"} className="text-xs">
 {overdue ?"Overdue" :"Current"}
 </Badge>
 </div>
 );
 })}
 </div>
 )}
 </div>

 {allergies.length > 0 && (
 <div className="border-t pt-4">
 <h2 className="font-bold flex items-center gap-2 mb-3">
 <AlertTriangle className="w-4 h-4 text-warning" /> Allergies & Alerts
 </h2>
 <div className="flex flex-wrap gap-2">
 {allergies.map((a, i) => (
 <Badge key={i} variant="outline" className="border-warning/40 text-warning">
 {a.allergy_name} ({a.severity})
 </Badge>
 ))}
 </div>
 </div>
 )}

 <p className="text-[10px] text-center text-muted-foreground border-t pt-3">
 Issued by PawBucks · ID #{pet.id.slice(0, 8).toUpperCase()} · Verified {new Date(data.verified_at).toLocaleDateString()}
 </p>
 </CardContent>
 </Card>
 </div>
 </div>
 </>
 );
}

function Field({ label, value, className ="" }: { label: string; value: string; className?: string }) {
 return (
 <div className={className}>
 <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
 <p className="font-medium">{value}</p>
 </div>
 );
}