import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, ChevronRight, Heart, IdCard, Receipt, Stethoscope, Bookmark } from "lucide-react";

const SAVED_KEY = "pb:saved-merchants";
const savedIds = (): string[] => { try { return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"); } catch { return []; } };
const todayLA = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const fmtTime = (t: string) => { const [h, m] = t.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

const Section = ({ title, icon: Icon, to, children }: { title: string; icon: typeof Heart; to?: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <div className="flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><Icon className="h-5 w-5 text-primary" />{title}</h2>
      {to && <Link to={to} className="text-sm text-primary">See all</Link>}
    </div>
    {children}
  </section>
);

export default function CareHub() {
  const { user } = useAuth();
  const ids = useMemo(savedIds, []);

  const { data: pets = [] } = useQuery({
    queryKey: ["care-pets", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("pet_profiles").select("id,name,type,breed,photo_url").eq("user_id", user!.id).order("created_at")).data || [],
  });
  const { data: bookings = [] } = useQuery({
    queryKey: ["care-bookings", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("service_bookings")
      .select("id,booking_date,start_time,status,merchant_services(name,merchants(business_name)),pet_profiles(name)")
      .eq("user_id", user!.id).gte("booking_date", todayLA()).in("status", ["pending", "confirmed"])
      .order("booking_date").order("start_time").limit(5)).data || [],
  });
  const { data: saved = [] } = useQuery({
    queryKey: ["care-saved", ids.join(",")], enabled: ids.length > 0,
    queryFn: async () => (await supabase.from("merchants").select("id,business_name,address,logo_url").in("id", ids.slice(0, 20))).data || [],
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      <SEO title="Care Hub | PawBucks" description="Your pets, upcoming care, saved places and history in one place." />
      <Header />
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-6">
        <div>
          <h1 className="text-2xl font-bold">Care Hub 🐾</h1>
          <p className="text-sm text-muted-foreground">Everything your pets need, in one place.</p>
        </div>

        <Section title="My pets" icon={Heart}>
          {pets.length === 0 ? (
            <Card className="p-4 text-sm text-muted-foreground">No pets yet. <Link to="/home" className="text-primary">Add your first pet</Link></Card>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {pets.map((p) => (
                <Card key={p.id} className="w-44 shrink-0 space-y-2 p-3">
                  <div className="flex items-center gap-2">
                    {p.photo_url ? <img src={p.photo_url} alt={p.name} className="h-10 w-10 rounded-full object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg">{p.type === "cat" ? "🐱" : "🐶"}</div>}
                    <div className="min-w-0"><p className="truncate font-semibold">{p.name}</p><p className="truncate text-xs text-muted-foreground">{p.breed || p.type}</p></div>
                  </div>
                  <div className="flex gap-1">
                    <Button asChild size="sm" variant="outline" className="flex-1 px-2"><Link to={`/pet-health/${p.id}`}><Stethoscope className="mr-1 h-3 w-3" />Health</Link></Button>
                    <Button asChild size="sm" variant="outline" className="flex-1 px-2"><Link to={`/pet-id/${p.id}`}><IdCard className="mr-1 h-3 w-3" />ID</Link></Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Section>

        <Section title="Upcoming care" icon={CalendarDays} to="/my-bookings">
          {bookings.length === 0 ? (
            <Card className="p-4 text-sm text-muted-foreground">Nothing scheduled. <Link to="/discover" className="text-primary">Find a provider</Link></Card>
          ) : bookings.map((b: any) => (
            <Link key={b.id} to={`/my-bookings?booking=${b.id}`}>
              <Card className="mb-2 flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{b.merchant_services?.name || "Appointment"}</p>
                  <p className="truncate text-xs text-muted-foreground">{b.merchant_services?.merchants?.business_name}{b.pet_profiles?.name ? ` · ${b.pet_profiles.name}` : ""}</p>
                  <p className="text-xs">{fmtDate(b.booking_date)} · {fmtTime(b.start_time)} PT</p>
                </div>
                <Badge variant={b.status === "confirmed" ? "default" : "secondary"}>{b.status === "confirmed" ? "Confirmed" : "Requested"}</Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Card>
            </Link>
          ))}
        </Section>

        <Section title="Saved places" icon={Bookmark}>
          {saved.length === 0 ? (
            <Card className="p-4 text-sm text-muted-foreground">Tap the heart on any business to save it here.</Card>
          ) : saved.map((m) => (
            <Link key={m.id} to={`/merchant/${m.id}`}>
              <Card className="mb-2 flex items-center gap-3 p-3">
                {m.logo_url ? <img src={m.logo_url} alt="" className="h-10 w-10 rounded-md object-cover" /> : <div className="h-10 w-10 rounded-md bg-muted" />}
                <div className="min-w-0 flex-1"><p className="truncate font-semibold">{m.business_name}</p><p className="truncate text-xs text-muted-foreground">{m.address}</p></div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Card>
            </Link>
          ))}
        </Section>

        <Section title="Care history" icon={Receipt}>
          <div className="grid grid-cols-2 gap-3">
            <Button asChild variant="outline"><Link to="/activity">Receipts & visits</Link></Button>
            <Button asChild variant="outline"><Link to="/my-deals">My deals</Link></Button>
          </div>
        </Section>
      </main>
      <BottomNav />
    </div>
  );
}
