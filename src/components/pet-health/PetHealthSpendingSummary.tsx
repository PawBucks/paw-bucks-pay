import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { TrendingUp, Loader2 } from "lucide-react";
import { Formatters } from "@/utils/formatters";
import { parseDateOnly } from "@/lib/timezone";

interface PetHealthSpendingSummaryProps {
  petId: string;
  refreshTrigger?: number;
}

type MonthlyBucket = { key: string; label: string; amount: number };

export const PetHealthSpendingSummary = ({ petId, refreshTrigger = 0 }: PetHealthSpendingSummaryProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [annual, setAnnual] = useState(0);
  const [monthly, setMonthly] = useState<MonthlyBucket[]>([]);
  const [visitCount, setVisitCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const { data: visits } = await supabase
          .from("pet_medical_visits")
          .select("id, visit_date")
          .eq("pet_id", petId)
          .order("visit_date", { ascending: false });

        const { data: records } = await supabase
          .from("pet_medical_records")
          .select("visit_id, price, record_date")
          .eq("pet_id", petId);

        if (cancelled) return;

        const visitList = visits || [];
        const totalsByVisit = new Map<string, number>();
        const looseByDate: { date: string; amount: number }[] = [];

        (records || []).forEach((r: any) => {
          const amount = Number(r.price) || 0;
          if (!amount) return;
          if (r.visit_id) {
            totalsByVisit.set(r.visit_id, (totalsByVisit.get(r.visit_id) || 0) + amount);
          } else if (r.record_date) {
            looseByDate.push({ date: r.record_date, amount });
          }
        });

        const entries: { date: string; amount: number }[] = [
          ...visitList
            .map((v: any) => ({ date: v.visit_date as string, amount: totalsByVisit.get(v.id) || 0 }))
            .filter((e) => e.amount > 0),
          ...looseByDate,
        ];

        const cutoff = new Date();
        cutoff.setFullYear(cutoff.getFullYear() - 1);

        const annualTotal = entries.reduce((sum, e) => {
          const d = parseDateOnly(e.date);
          return d && d >= cutoff ? sum + e.amount : sum;
        }, 0);

        const buckets = new Map<string, MonthlyBucket>();
        entries.forEach((e) => {
          const d = parseDateOnly(e.date);
          if (!d) return;
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          const existing = buckets.get(key);
          if (existing) {
            existing.amount += e.amount;
          } else {
            buckets.set(key, {
              key,
              label: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
              amount: e.amount,
            });
          }
        });

        setAnnual(annualTotal);
        setVisitCount(visitList.length);
        setMonthly(
          Array.from(buckets.values())
            .sort((a, b) => b.key.localeCompare(a.key))
            .slice(0, 6)
        );
      } catch (err) {
        console.error("Error loading pet spending:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [petId, refreshTrigger]);

  if (isLoading) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Calculating care spend...
        </div>
      </Card>
    );
  }

  if (annual === 0 && monthly.length === 0) {
    return null;
  }

  return (
    <Card className="p-5 bg-primary/5 border-primary/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
            <TrendingUp className="w-3.5 h-3.5" />
            Last 12 Months
          </div>
          <p className="text-3xl font-bold tracking-tight mt-1.5">
            {Formatters.currency(annual)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Across {visitCount} recorded {visitCount === 1 ? "visit" : "visits"}
          </p>
        </div>
      </div>

      {monthly.length > 0 && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {monthly.map((m) => (
            <div key={m.key} className="rounded-lg bg-background border border-border px-3 py-2 min-w-0">
              <p className="text-sm font-semibold truncate">{Formatters.currency(m.amount)}</p>
              <p className="text-[11px] text-muted-foreground truncate">{m.label}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
