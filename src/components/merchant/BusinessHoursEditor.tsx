import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Clock } from "lucide-react";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type DayHours = {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
};

const DEFAULT_HOURS: DayHours[] = Array.from({ length: 7 }, (_, i) => ({
  day_of_week: i,
  open_time: "09:00",
  close_time: "17:00",
  is_closed: i === 0, // Sunday closed by default
}));

type Props = {
  merchantId?: string;
  vetId?: string;
};

export function BusinessHoursEditor({ merchantId, vetId }: Props) {
  const [hours, setHours] = useState<DayHours[]>(DEFAULT_HOURS);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      let data: any[] | null = null;
      if (merchantId) {
        const res = await (supabase.from("merchant_business_hours") as any)
          .select("day_of_week, open_time, close_time, is_closed")
          .eq("merchant_id", merchantId)
          .order("day_of_week");
        data = res.data;
      } else if (vetId) {
        const res = await (supabase.from("vet_business_hours") as any)
          .select("day_of_week, open_time, close_time, is_closed")
          .eq("vet_id", vetId)
          .order("day_of_week");
        data = res.data;
      }
      if (data && data.length > 0) {
        const merged = DEFAULT_HOURS.map((def) => {
          const existing = data!.find((d: any) => d.day_of_week === def.day_of_week);
          return existing
            ? { ...def, open_time: existing.open_time?.substring(0, 5), close_time: existing.close_time?.substring(0, 5), is_closed: existing.is_closed }
            : def;
        });
        setHours(merged);
      }
      setLoaded(true);
    };
    load();
  }, [merchantId, vetId]);

  const updateDay = (dayIndex: number, field: keyof DayHours, value: any) => {
    setHours((prev) =>
      prev.map((h) => (h.day_of_week === dayIndex ? { ...h, [field]: value } : h))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const table = merchantId ? "merchant_business_hours" : "vet_business_hours";
      const fkField = merchantId ? "merchant_id" : "vet_id";
      const fkValue = merchantId || vetId;

      // Delete existing and re-insert
      await (supabase.from(table) as any).delete().eq(fkField, fkValue);

      const rows = hours.map((h) => ({
        [fkField]: fkValue,
        day_of_week: h.day_of_week,
        open_time: h.open_time,
        close_time: h.close_time,
        is_closed: h.is_closed,
      }));

      const { error } = await (supabase.from(table) as any).insert(rows);
      if (error) throw error;
      toast.success("Business hours saved!");
    } catch (err: any) {
      toast.error("Failed to save hours: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  return (
    <div className="space-y-4 pt-4 border-t">
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-muted-foreground" />
        <Label className="text-base font-semibold">Hours of Operation</Label>
      </div>
      <div className="space-y-3">
        {hours.map((h) => (
          <div key={h.day_of_week} className="flex items-center gap-3">
            <span className="w-20 text-sm font-medium">{DAY_NAMES[h.day_of_week]}</span>
            <Switch
              checked={!h.is_closed}
              onCheckedChange={(open) => updateDay(h.day_of_week, "is_closed", !open)}
            />
            {!h.is_closed ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  type="time"
                  value={h.open_time}
                  onChange={(e) => updateDay(h.day_of_week, "open_time", e.target.value)}
                  className="w-[120px] h-8 text-sm"
                />
                <span className="text-muted-foreground text-xs">to</span>
                <Input
                  type="time"
                  value={h.close_time}
                  onChange={(e) => updateDay(h.day_of_week, "close_time", e.target.value)}
                  className="w-[120px] h-8 text-sm"
                />
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Closed</span>
            )}
          </div>
        ))}
      </div>
      <Button onClick={handleSave} disabled={saving} size="sm" variant="outline" type="button">
        {saving ? "Saving..." : "Save Hours"}
      </Button>
    </div>
  );
}
