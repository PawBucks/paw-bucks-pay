import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

type Props = {
  merchantId?: string;
  vetId?: string;
};

export function OpenStatusBadge({ merchantId, vetId }: Props) {
  const { data: isOpen } = useQuery({
    queryKey: ["open-status", merchantId, vetId],
    queryFn: async () => {
      const table = merchantId ? "merchant_business_hours" : "vet_business_hours";
      const col = merchantId ? "merchant_id" : "vet_id";
      const id = merchantId || vetId;

      const now = new Date();
      const dayOfWeek = now.getDay();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      const { data } = await (supabase.from(table) as any)
        .select("open_time, close_time, is_closed")
        .eq(col, id)
        .eq("day_of_week", dayOfWeek)
        .maybeSingle();

      if (!data || data.is_closed) return false;
      return currentTime >= data.open_time && currentTime <= data.close_time;
    },
    enabled: !!(merchantId || vetId),
    staleTime: 1000 * 60 * 5,
  });

  if (isOpen === undefined || isOpen === null) return null;

  return (
    <Badge
      variant="outline"
      className={
        isOpen
          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400"
          : "bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-400"
      }
    >
      <span className={`w-2 h-2 rounded-full mr-1.5 ${isOpen ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
      {isOpen ? "Open Now" : "Closed"}
    </Badge>
  );
}
