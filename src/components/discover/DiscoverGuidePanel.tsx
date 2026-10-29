import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, CalendarDays, Navigation, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGuideContent, type GuidePlace } from "@/hooks/useGuideContent";
import { GuidePlaces } from "@/components/community/GuidePlaceCommunity";
import { trackCareAction } from "@/lib/careActions";
import { toast } from "sonner";

const GUIDE_SLUG = "pet-friendly-los-angeles";
const INTERESTED_KEY = "pb:interested-events";
const getInterested = (): string[] => { try { return JSON.parse(localStorage.getItem(INTERESTED_KEY) || "[]"); } catch { return []; } };

export type DiscoverTab = "providers" | "places" | "events";

export function DiscoverTabs({ tab, onChange }: { tab: DiscoverTab; onChange: (t: DiscoverTab) => void }) {
  const tabs: { v: DiscoverTab; l: string }[] = [{ v: "providers", l: "Care providers" }, { v: "places", l: "Places" }, { v: "events", l: "Events" }];
  return (
    <div role="tablist" aria-label="What to discover" className="mb-3 grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
      {tabs.map((t) => (
        <button key={t.v} role="tab" aria-selected={tab === t.v} onClick={() => onChange(t.v)}
          className={`rounded-md px-2 py-1.5 text-xs font-semibold transition ${tab === t.v ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>
          {t.l}
        </button>
      ))}
    </div>
  );
}

function EventCard({ e, interested, onToggle }: { e: GuidePlace; interested: boolean; onToggle: () => void }) {
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${e.name} ${e.area || ""}`)}`;
  return (
    <article className="space-y-2 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap justify-between gap-2">
        <h3 className="font-semibold">{e.name}</h3>
        {e.tag_label && <span className="rounded border bg-secondary px-2 py-0.5 text-xs">{e.tag_label}</span>}
      </div>
      {e.area && <p className="flex items-center gap-1 text-xs text-primary"><CalendarDays className="h-3 w-3" />{e.area}</p>}
      <p className="text-sm text-muted-foreground">{e.description}</p>
      {e.tip && <p className="border-l-2 border-primary pl-3 text-sm">{e.tip}</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={interested ? "default" : "outline"} onClick={onToggle} aria-pressed={interested}>
          <CalendarCheck className="mr-1 h-4 w-4" />{interested ? "I'm going" : "I'm interested"}
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href={maps} target="_blank" rel="noopener noreferrer" onClick={() => trackCareAction("directions", "event", e.id, { source: "discover" })}><Navigation className="mr-1 h-4 w-4" />Directions</a>
        </Button>
      </div>
    </article>
  );
}

export function DiscoverGuidePanel({ tab }: { tab: "places" | "events" }) {
  const { parks, beaches, cafes, events, loading } = useGuideContent(GUIDE_SLUG) as any;
  const [interested, setInterested] = useState<string[]>(getInterested);
  const toggle = (id: string) => {
    const on = !interested.includes(id);
    const next = on ? [...interested, id] : interested.filter((x) => x !== id);
    setInterested(next);
    localStorage.setItem(INTERESTED_KEY, JSON.stringify(next));
    if (on) { trackCareAction("rsvp", "event", id, { source: "discover" }); toast.success("Added to your plans"); }
  };
  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (tab === "places") {
    const sections: [string, GuidePlace[]][] = [["Dog parks", parks || []], ["Beaches & trails", beaches || []], ["Cafes & patios", cafes || []]];
    return (
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-4">
        <p className="text-sm text-muted-foreground">Verified leash rules, amenities and access details, plus photos and tips from local pet parents.</p>
        {sections.map(([title, list]) => list.length > 0 && (
          <section key={title} className="space-y-3"><h2 className="text-lg font-semibold">{title}</h2><GuidePlaces places={list} /></section>
        ))}
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-4">
      <Link to="/petfest" className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
        <PartyPopper className="h-6 w-6 text-primary" />
        <div className="flex-1"><p className="font-semibold">PawBucks PetFest</p><p className="text-xs text-muted-foreground">RSVP for the community pet festival</p></div>
        <span className="text-sm font-semibold text-primary">RSVP</span>
      </Link>
      {(events || []).length === 0 && <p className="text-sm text-muted-foreground">No events listed right now.</p>}
      {(events || []).map((e: GuidePlace) => <EventCard key={e.id} e={e} interested={interested.includes(e.id)} onToggle={() => toggle(e.id)} />)}
    </div>
  );
}
