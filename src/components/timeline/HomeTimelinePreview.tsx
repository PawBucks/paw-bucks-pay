import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PawBucksLogo } from "@/components/PawBucksLogo";
import { Formatters } from "@/utils/formatters";

interface TimelineMoment {
  id: string;
  pet_id: string;
  title: string;
  narrative: string;
  emoji: string;
  photo_url: string | null;
  merchant_name: string | null;
  amount: number | null;
  pawbucks_earned: number;
  moment_date: string;
  mood?: string;
  source: "transaction" | "medical_visit";
}

interface PetInfo {
  id: string;
  name: string;
  type?: string;
  photo_url?: string;
}

interface Props {
  userId: string;
  pets: PetInfo[];
}

const PREVIEW_LIMIT = 3;

export const HomeTimelinePreview = ({ userId, pets }: Props) => {
  const navigate = useNavigate();
  const [moments, setMoments] = useState<TimelineMoment[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TimelineMoment | null>(null);

  useEffect(() => {
    if (!userId || pets.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const petIds = pets.map((p) => p.id);

    const fetchAll = async () => {
      try {
        const [txRes, txCount, visitRes] = await Promise.all([
          supabase
            .from("pet_timeline_moments")
            .select(
              "id, pet_id, title, narrative, emoji, photo_url, merchant_name, amount, pawbucks_earned, moment_date, mood",
            )
            .in("pet_id", petIds)
            .order("moment_date", { ascending: false })
            .limit(PREVIEW_LIMIT + 5),
          supabase
            .from("pet_timeline_moments")
            .select("id", { count: "exact", head: true })
            .in("pet_id", petIds),
          supabase
            .from("pet_medical_visits")
            .select("id, pet_id, vet_name, doctor_name, visit_date, notes")
            .in("pet_id", petIds)
            .order("visit_date", { ascending: false })
            .limit(PREVIEW_LIMIT + 5),
        ]);

        if (cancelled) return;

        const txMoments: TimelineMoment[] = (txRes.data ?? []).map((m: any) => ({
          ...m,
          source: "transaction" as const,
        }));

        const visitMoments: TimelineMoment[] = (visitRes.data ?? []).map(
          (v: any) => {
            const pet = pets.find((p) => p.id === v.pet_id);
            const petName = pet?.name || "Your pet";
            return {
              id: `visit-${v.id}`,
              pet_id: v.pet_id,
              title: `Vet Visit${v.vet_name ? ` at ${v.vet_name}` : ""}`,
              narrative:
                v.notes?.trim() ||
                `${petName} had a checkup${
                  v.doctor_name ? ` with ${v.doctor_name}` : ""
                }${v.vet_name ? ` at ${v.vet_name}` : ""}. Way to stay healthy!`,
              emoji: "🏥",
              photo_url: null,
              merchant_name: v.vet_name,
              amount: null,
              pawbucks_earned: 0,
              moment_date: v.visit_date,
              mood: "brave",
              source: "medical_visit" as const,
            };
          },
        );

        const combined = [...txMoments, ...visitMoments]
          .sort(
            (a, b) =>
              new Date(b.moment_date).getTime() -
              new Date(a.moment_date).getTime(),
          )
          .slice(0, PREVIEW_LIMIT);

        setMoments(combined);
        setTotalCount(
          (txCount.count ?? 0) + (visitRes.data?.length ?? 0),
        );
      } catch (err) {
        console.error("[HomeTimelinePreview] Error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAll();

    const channel = supabase
      .channel("home-timeline-preview")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pet_timeline_moments",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const next = { ...(payload.new as any), source: "transaction" as const };
          setMoments((prev) => [next, ...prev].slice(0, PREVIEW_LIMIT));
          setTotalCount((c) => c + 1);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId, pets]);

  const getPetName = (petId: string) =>
    pets.find((p) => p.id === petId)?.name || "Your pet";

  if (loading) {
    return (
      <div className="rounded-2xl border border-primary/15 bg-primary/[0.03] p-4 sm:p-5 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        aria-label="Pet timeline"
        className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.04] via-background to-accent/[0.04] p-4 sm:p-5"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-sm sm:text-base leading-tight">
                Your Pet's Timeline
              </h3>
              <p className="text-xs text-muted-foreground">
                {totalCount > 0
                  ? `${totalCount} ${totalCount === 1 ? "moment" : "moments"} captured`
                  : "Every visit becomes a memory"}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 h-8 text-primary hover:bg-primary/10"
            onClick={() => navigate("/pet-timeline")}
          >
            View all
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {moments.length === 0 ? (
          <button
            type="button"
            onClick={() => navigate("/pet-timeline")}
            className="w-full text-left rounded-xl border border-dashed border-primary/30 bg-background/50 p-4 hover:border-primary/60 transition-colors"
          >
            <p className="text-sm font-medium">
              ✨ Your pet's story starts with your first visit
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Every paw print, vet visit, and snack run adds to their timeline.
            </p>
          </button>
        ) : (
          <ul className="space-y-2">
            {moments.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setSelected(m)}
                  aria-label={`Read full story: ${m.title}`}
                  className="w-full text-left rounded-xl border border-border/60 bg-card hover:bg-accent/5 hover:border-primary/30 transition-all p-3 flex items-start gap-3 group"
                >
                  {m.photo_url ? (
                    <img
                      src={m.photo_url}
                      alt={m.title}
                      className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center text-xl flex-shrink-0">
                      {m.emoji || "🐾"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium truncate">{m.title}</p>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {format(new Date(m.moment_date), "MMM d")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {m.narrative}
                    </p>
                    {m.pawbucks_earned > 0 && (
                      <Badge className="mt-1.5 bg-gradient-to-r from-primary to-accent text-white text-[10px] gap-1 px-1.5 py-0">
                        <PawBucksLogo className="w-2.5 h-2.5" />
                        +{m.pawbucks_earned.toLocaleString()}
                      </Badge>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 group-hover:translate-x-0.5 group-hover:text-primary transition-all flex-shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </motion.section>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 text-xs text-primary uppercase tracking-wide font-medium mb-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  {getPetName(selected.pet_id)}'s Timeline
                </div>
                <DialogTitle className="text-xl flex items-start gap-2">
                  <span className="text-2xl leading-none">
                    {selected.emoji || "🐾"}
                  </span>
                  <span>{selected.title}</span>
                </DialogTitle>
                <DialogDescription>
                  {format(new Date(selected.moment_date), "EEEE, MMMM d, yyyy")}
                  {selected.merchant_name ? ` · ${selected.merchant_name}` : ""}
                </DialogDescription>
              </DialogHeader>

              {selected.photo_url && (
                <img
                  src={selected.photo_url}
                  alt={selected.title}
                  className="w-full rounded-xl object-cover max-h-72"
                />
              )}

              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                {selected.narrative}
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {selected.amount != null && (
                  <Badge variant="secondary" className="text-xs">
                    {Formatters.currency(selected.amount)}
                  </Badge>
                )}
                {selected.pawbucks_earned > 0 && (
                  <Badge className="bg-gradient-to-r from-primary to-accent text-white text-xs gap-1">
                    <PawBucksLogo className="w-3 h-3" />
                    +{selected.pawbucks_earned.toLocaleString()} PawBucks
                  </Badge>
                )}
              </div>

              <DialogFooter className="sm:justify-between gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setSelected(null)}
                  className="sm:mr-auto"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setSelected(null);
                    navigate("/pet-timeline");
                  }}
                >
                  View full timeline
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default HomeTimelinePreview;