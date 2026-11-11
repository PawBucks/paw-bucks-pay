import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Search, Map, List, MapPin, Phone, Globe, ArrowUpRight, Store, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { DirectoryPro, filterPros } from "@/lib/petPros";
import { PetProMap } from "./PetProMap";
const categories = ["all", "grooming", "veterinary", "training", "boarding", "daycare", "walker", "pet_store", "mobile_groomer"];
export async function loadDirectoryPros(): Promise<DirectoryPro[]> {
  const [merchants, vets, external] = await Promise.all([
    supabase.from("merchants_public").select("id,business_name,business_type,business_categories,logo_url,address,phone,website_url,latitude,longitude"),
    supabase.from("partner_vets_public").select("id,name,clinic_name,location,website_url"),
    supabase.from("public_pet_pros").select("id,business_name,category,address,phone,website_url,latitude,longitude,source_url").eq("is_hidden", false).eq("reuse_confirmed", true).is("linked_merchant_id", null).is("linked_vet_id", null),
  ]);
  for (const r of [merchants, vets, external]) if (r.error) throw r.error;
  return [
    ...(merchants.data ?? []).map((p) => ({ id: p.id ?? "", name: p.business_name ?? "", category: p.business_type ?? "other", categories: p.business_categories ?? [], logo: p.logo_url, address: p.address, phone: p.phone, website: p.website_url, latitude: p.latitude, longitude: p.longitude, network: "pawbucks" as const, href: `/merchant/${p.id}` })),
    ...(vets.data ?? []).map((p) => ({ id: p.id ?? "", name: p.clinic_name || p.name || "Veterinary clinic", category: "veterinary", address: p.location, website: p.website_url, network: "pawbucks" as const })),
    ...(external.data ?? []).map((p) => ({ id: p.id, name: p.business_name, category: p.category, address: p.address, phone: p.phone, website: p.website_url, latitude: p.latitude, longitude: p.longitude, network: "public" as const, sourceUrl: p.source_url })),
  ].sort((a, b) => a.name.localeCompare(b.name));
}
export function PetProDirectory() {
  const { user } = useAuth();
  const { data: pros = [], isLoading, error, refetch } = useQuery({ queryKey: ["public-pet-pro-directory"], queryFn: loadDirectoryPros });
  const [q, setQ] = useState(""); const [category, setCategory] = useState("all"); const [network, setNetwork] = useState<"all" | "pawbucks" | "public">("all");
  const [map, setMap] = useState(false); const [claim, setClaim] = useState<DirectoryPro | null>(null); const [selected, setSelected] = useState<DirectoryPro | null>(null);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [evidence, setEvidence] = useState(""); const [busy, setBusy] = useState(false);
  const filtered = useMemo(() => filterPros(pros, q, category, network), [pros, q, category, network]);
  const submitClaim = async (e: React.FormEvent) => { e.preventDefault(); if (!user || !claim) return; setBusy(true); const { error } = await supabase.from("pet_pro_claims").insert({ listing_id: claim.id, user_id: user.id, contact_name: name.trim(), contact_email: email.trim(), evidence: evidence.trim() }); setBusy(false); if (error) toast.error(error.code === "23505" ? "You already requested this listing." : error.message); else { toast.success("Claim submitted for ownership review."); setClaim(null); setEvidence(""); } };
  const card = (p: DirectoryPro) => <article key={p.id} className="border border-border rounded-md p-4 bg-card space-y-3">
    <div className="flex gap-3"><div className="bg-muted text-primary rounded-md h-11 w-11 flex shrink-0 items-center justify-center">{p.logo ? <img src={p.logo} alt="" className="h-11 w-11 object-contain rounded-md" /> : <Store className="h-5 w-5" />}</div><div className="min-w-0"><h3 className="font-semibold break-words">{p.name}</h3><p className="text-sm capitalize text-muted-foreground">{p.category.replace(/_/g, " ")}</p></div></div>
    <Badge variant="outline">{p.network === "pawbucks" ? "PawBucks network" : "Public listing · Unclaimed"}</Badge>
    {p.address && <p className="text-sm text-muted-foreground flex gap-2"><MapPin className="h-4 w-4 shrink-0 mt-0.5" />{p.address}</p>}
    <div className="flex flex-wrap gap-2">{p.phone && <Button size="sm" variant="outline" asChild><a href={`tel:${p.phone.replace(/[^+\d]/g, "")}`}><Phone className="h-3 w-3 mr-1" />Call</a></Button>}{p.address && <Button size="sm" variant="outline" asChild><a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.address)}`} target="_blank" rel="noopener noreferrer"><MapPin className="h-3 w-3 mr-1" />Directions</a></Button>}{p.website && <Button size="sm" variant="outline" asChild><a href={p.website} target="_blank" rel="noopener noreferrer"><Globe className="h-3 w-3 mr-1" />Website</a></Button>}{p.href && <Button size="sm" asChild><Link to={p.href}>View profile<ArrowUpRight className="h-3 w-3 ml-1" /></Link></Button>}</div>
    {p.sourceUrl && <a className="text-xs text-muted-foreground underline" href={p.sourceUrl} target="_blank" rel="noopener noreferrer">Public source</a>}
    {p.network === "public" && <Button className="w-full" variant="ghost" onClick={() => { setClaim(p); setEmail(user?.email ?? ""); }}><ShieldCheck className="h-4 w-4 mr-2" />Claim this listing</Button>}
  </article>;
  return <section className="max-w-7xl mx-auto px-4 py-6 space-y-5">
    <div className="flex flex-wrap justify-between items-center gap-3"><div><p className="text-sm text-primary font-semibold">LOCAL CARE NETWORK</p><h1 className="text-2xl font-bold">Pet Pro directory</h1></div><div className="flex gap-1"><Button size="icon" variant={!map ? "default" : "outline"} aria-label="List view" onClick={() => setMap(false)}><List className="h-4 w-4" /></Button><Button size="icon" variant={map ? "default" : "outline"} aria-label="Map view" onClick={() => setMap(true)}><Map className="h-4 w-4" /></Button></div></div>
    <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search pet professionals" placeholder="Business name, service, city or ZIP" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" /></div>
    <div className="flex flex-wrap gap-2">{(["all", "pawbucks", "public"] as const).map((n) => <Button key={n} size="sm" variant={network === n ? "default" : "outline"} onClick={() => setNetwork(n)}>{n === "all" ? "All pet pros" : n === "pawbucks" ? "PawBucks network" : "Public listings"}</Button>)}</div>
    <div className="flex gap-2 overflow-x-auto pb-2">{categories.map((c) => <Button key={c} size="sm" variant={c === category ? "secondary" : "ghost"} className="capitalize shrink-0" onClick={() => setCategory(c)}>{c.replace(/_/g, " ")}</Button>)}</div>
    <p className="text-sm text-muted-foreground">{filtered.length} professionals{map ? ` · ${filtered.filter((p) => p.latitude != null && p.longitude != null).length} mapped` : ""}</p>
    {isLoading ? <p>Loading professionals…</p> : error ? <div role="alert">Unable to load the directory.<Button variant="link" onClick={() => refetch()}>Try again</Button></div> : !filtered.length ? <p className="py-10 text-muted-foreground">No professionals match these filters.</p> : map ? <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-4"><PetProMap pros={filtered} onSelect={setSelected} /><div className="space-y-3 max-h-[640px] overflow-auto">{selected && card(selected)}{filtered.filter((p) => p.id !== selected?.id).map(card)}</div></div> : <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{filtered.map(card)}</div>}
    <Dialog open={!!claim} onOpenChange={(open) => { if (!open) setClaim(null); }}><DialogContent><DialogHeader><DialogTitle>Claim {claim?.name}</DialogTitle></DialogHeader>{!user ? <Button asChild><Link to="/auth">Sign in to request ownership</Link></Button> : <form onSubmit={submitClaim} className="space-y-4"><label className="block text-sm">Contact name<Input required minLength={2} maxLength={200} value={name} onChange={(e) => setName(e.target.value)} /></label><label className="block text-sm">Business contact email<Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label className="block text-sm">Ownership evidence<Textarea required minLength={10} maxLength={2000} placeholder="Your role, business website, and evidence of ownership" value={evidence} onChange={(e) => setEvidence(e.target.value)} /></label><p className="text-sm text-muted-foreground">An administrator will verify ownership before connecting this listing to your business account.</p><Button disabled={busy} type="submit">{busy ? "Submitting…" : "Submit claim"}</Button></form>}</DialogContent></Dialog>
  </section>;
}
