import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, Bookmark, Phone, Navigation, Globe, CalendarCheck, Users, Repeat, MousePointerClick } from "lucide-react";
import { computeCareLoopMetrics, countByAction } from "@/lib/careLoopMetrics";

const since = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

function Stat({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card p-3 min-w-0">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

/** Business view: how pet parents interacted with this business in the last 30 days. */
export function CareIntentSummary() {
  const { data } = useQuery({
    queryKey: ["care-intent-summary"],
    queryFn: async () => {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id;
      if (!uid) return null;
      const { data: m } = await supabase.from("merchants").select("id").eq("user_id", uid).maybeSingle();
      if (!m) return null;
      const { data: ev } = await supabase.from("care_action_events").select("action").eq("merchant_id", m.id).gte("created_at", since(30)).limit(10000);
      return countByAction(ev ?? []);
    },
  });
  const c = data ?? {};
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg">Pet parent interest</CardTitle>
        <CardDescription>How pet parents engaged with your business in the last 30 days</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat icon={Eye} label="Profile views" value={c.view ?? 0} />
        <Stat icon={Bookmark} label="Saves" value={c.save ?? 0} />
        <Stat icon={Phone} label="Calls" value={(c.call ?? 0) + (c.contact ?? 0)} />
        <Stat icon={Navigation} label="Directions" value={c.directions ?? 0} />
        <Stat icon={Globe} label="Website" value={c.website ?? 0} />
        <Stat icon={CalendarCheck} label="Bookings" value={c.book ?? 0} />
        <Stat icon={CalendarCheck} label="Inquiries" value={c.inquire ?? 0} />
        <Stat icon={CalendarCheck} label="Completed visits" value={c.attend ?? 0} />
      </CardContent>
    </Card>
  );
}

/** Admin view: activity, retention and discovery-to-action conversion. */
export function CareLoopAdminMetrics() {
  const { data, isLoading } = useQuery({
    queryKey: ["care-loop-admin"],
    queryFn: async () => {
      const { data: ev } = await supabase.from("care_action_events").select("user_id, action, created_at").gte("created_at", since(90)).order("created_at", { ascending: false }).limit(50000);
      const { count: providers } = await supabase.from("care_action_events").select("merchant_id", { count: "exact", head: true }).not("merchant_id", "is", null).gte("created_at", since(30));
      return { m: computeCareLoopMetrics(ev ?? []), providers: providers ?? 0 };
    },
  });
  const pct = (v: number | null | undefined) => (v == null ? "—" : `${v}%`);
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg">Care loop health</CardTitle>
        <CardDescription>Based on pet parent discovery and action activity (last 90 days)</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {isLoading ? <p className="text-sm text-muted-foreground col-span-full">Loading…</p> : <>
          <Stat icon={Users} label="Weekly active" value={data?.m.wau ?? 0} />
          <Stat icon={Users} label="Monthly active" value={data?.m.mau ?? 0} />
          <Stat icon={Repeat} label="Day 1 return" value={pct(data?.m.d1)} />
          <Stat icon={Repeat} label="Day 7 return" value={pct(data?.m.d7)} />
          <Stat icon={Repeat} label="Day 30 return" value={pct(data?.m.d30)} />
          <Stat icon={MousePointerClick} label="Discover → action" value={pct(data?.m.conversion)} />
          <Stat icon={CalendarCheck} label="Business interactions (30d)" value={data?.providers ?? 0} />
        </>}
      </CardContent>
    </Card>
  );
}
