import { useQuery } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { Clock } from"lucide-react";

const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const SHORT_DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function formatTime(time: string) {
 const [h, m] = time.split(":");
 const hour = parseInt(h);
 const ampm = hour >= 12 ?"PM" :"AM";
 const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
 return `${display}:${m} ${ampm}`;
}

type Props = {
 merchantId?: string;
 vetId?: string;
};

export function BusinessHoursDisplay({ merchantId, vetId }: Props) {
 const { data: hours } = useQuery({
 queryKey: ["business-hours", merchantId, vetId],
 queryFn: async () => {
 if (merchantId) {
 const { data } = await (supabase.from("merchant_business_hours") as any)
 .select("day_of_week, open_time, close_time, is_closed")
 .eq("merchant_id", merchantId)
 .order("day_of_week");
 return data || [];
 }
 if (vetId) {
 const { data } = await (supabase.from("vet_business_hours") as any)
 .select("day_of_week, open_time, close_time, is_closed")
 .eq("vet_id", vetId)
 .order("day_of_week");
 return data || [];
 }
 return [];
 },
 enabled: !!(merchantId || vetId),
 });

 if (!hours || hours.length === 0) return null;

 const today = new Date().getDay();

 // Build a map for all 7 days
 const hoursMap = new Map<number, { open_time: string; close_time: string; is_closed: boolean }>();
 hours.forEach((h: any) => hoursMap.set(h.day_of_week, h));

 return (
 <div className="rounded-md border bg-card p-4">
 <div className="flex items-center gap-2 mb-3">
 <Clock className="w-4 h-4 text-primary" />
 <h3 className="font-semibold text-sm">Hours of Operation</h3>
 </div>
 <div className="space-y-1.5">
 {[0, 1, 2, 3, 4, 5, 6].map((day) => {
 const entry = hoursMap.get(day);
 const isToday = day === today;
 return (
 <div
 key={day}
 className={`flex items-center justify-between text-sm px-2 py-1 rounded ${
 isToday ?"bg-primary/10 font-medium" :""
 }`}
 >
 <span className={isToday ?"text-primary" :"text-muted-foreground"}>
 {SHORT_DAYS[day]}
 </span>
 <span className={isToday ?"text-primary" :""}>
 {!entry || entry.is_closed ? (
 <span className="text-muted-foreground">Closed</span>
 ) : (
 `${formatTime(entry.open_time)} – ${formatTime(entry.close_time)}`
 )}
 </span>
 </div>
 );
 })}
 </div>
 </div>
 );
}
