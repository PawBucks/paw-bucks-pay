import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Megaphone, Trash2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { profileCompleteness, interestFunnel } from "@/lib/businessPresence";

const since = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const fmt = (s: string) => new Date(s).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" });

/** Free business presence tools: profile checklist, updates to pet parents, and interest funnel. */
export function BusinessPresencePanel() {
  const qc = useQueryClient();
  const [title, setTitle] = useState(""); const [body, setBody] = useState(""); const [link, setLink] = useState(""); const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["business-presence"],
    queryFn: async () => {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id; if (!uid) return null;
      const { data: m } = await supabase.from("merchants").select("id, logo_url, description, phone, address, website_url").eq("user_id", uid).maybeSingle();
      if (!m) return null;
      const [hours, services, updates, ev] = await Promise.all([
        supabase.from("merchant_business_hours").select("id", { count: "exact", head: true }).eq("merchant_id", m.id),
        supabase.from("merchant_services").select("id", { count: "exact", head: true }).eq("merchant_id", m.id),
        supabase.from("merchant_updates").select("id, title, body, link_url, created_at, is_hidden").eq("merchant_id", m.id).order("created_at", { ascending: false }).limit(10),
        supabase.from("care_action_events").select("user_id, action").eq("merchant_id", m.id).gte("created_at", since(30)).limit(10000),
      ]);
      const ups = updates.data ?? [];
      return {
        merchant: m, updates: ups,
        completeness: profileCompleteness({ ...m, hasHours: (hours.count ?? 0) > 0, hasServices: (services.count ?? 0) > 0, hasRecentUpdate: ups.some(u => u.created_at > since(30)) }),
        funnel: interestFunnel(ev.data ?? []),
      };
    },
  });
  if (!data) return null;
  const { completeness: c, funnel: f } = data;
  const pct = (v: number | null) => (v == null ? "—" : `${v}%`);

  const post = async () => {
    const l = link.trim();
    if (title.trim().length < 3 || !body.trim()) return toast.error("Add a title (3+ characters) and a message");
    if (l && !/^https:\/\//.test(l)) return toast.error("Links must start with https://");
    setBusy(true);
    const { error } = await supabase.from("merchant_updates").insert({ merchant_id: data.merchant.id, title: title.trim().slice(0, 80), body: body.trim().slice(0, 600), link_url: l || null });
    setBusy(false);
    if (error) return toast.error("Could not post update");
    setTitle(""); setBody(""); setLink(""); toast.success("Update posted to your profile");
    qc.invalidateQueries({ queryKey: ["business-presence"] });
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("merchant_updates").delete().eq("id", id);
    if (error) toast.error("Could not remove update"); else qc.invalidateQueries({ queryKey: ["business-presence"] });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2 mb-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your listing</CardTitle>
          <CardDescription>Free for every business. A complete profile helps pet parents choose you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3"><Progress value={c.score} className="flex-1" /><span className="text-sm font-semibold">{c.score}%</span></div>
          <ul className="space-y-1.5 text-sm">
            {c.missing.length === 0 ? <li className="flex gap-2 items-center text-primary"><CheckCircle2 className="h-4 w-4" />Your profile is complete</li>
              : c.missing.map(m => <li key={m.key} className="flex gap-2 items-center text-muted-foreground"><Circle className="h-4 w-4" />{m.label}</li>)}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">From interest to visits</CardTitle>
          <CardDescription>Unique pet parents in the last 30 days. Page views alone are not counted as outcomes.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
          {[["Viewed", f.viewed, null], ["Engaged", f.engaged, f.engageRate], ["Inquired or booked", f.reached, f.reachRate], ["Completed visit", f.completed, f.completeRate]].map(([l, v, r], i) => (
            <div key={l as string} className="rounded-lg border p-3 relative">
              <div className="text-xs text-muted-foreground">{l}</div>
              <div className="text-2xl font-semibold">{v as number}</div>
              {i > 0 && <div className="text-xs text-primary">{pct(r as number | null)}{i === 3 ? " of requests" : " of viewers"}</div>}
              {i < 3 && <ArrowRight className="hidden sm:block absolute -right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" />Share an update</CardTitle>
          <CardDescription>Openings, new services, events or news. Shown on your profile and in the community feed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Title, e.g. Saturday openings this week" maxLength={80} value={title} onChange={e => setTitle(e.target.value)} />
          <Textarea placeholder="What should pet parents know?" maxLength={600} value={body} onChange={e => setBody(e.target.value)} />
          <Input placeholder="Optional link (https://…)" value={link} onChange={e => setLink(e.target.value)} />
          <Button onClick={post} disabled={busy}>{busy ? "Posting…" : "Post update"}</Button>
          {data.updates.length > 0 && <div className="divide-y border-t mt-4">
            {data.updates.map(u => <div key={u.id} className="py-3 flex justify-between gap-3">
              <div className="min-w-0"><p className="font-medium text-sm break-words">{u.title}{u.is_hidden && <span className="text-destructive text-xs ml-2">Hidden by moderators</span>}</p><p className="text-xs text-muted-foreground">{fmt(u.created_at)}</p></div>
              <Button variant="ghost" size="icon" aria-label="Remove update" onClick={() => remove(u.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>)}
          </div>}
        </CardContent>
      </Card>
    </div>
  );
}
