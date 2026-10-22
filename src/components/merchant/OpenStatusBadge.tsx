import { useQuery } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { Badge } from"@/components/ui/badge";
import { useSpecialHours } from '@/hooks/useSpecialHours';
import { specialWindowsForDate } from '@/lib/specialHours';
import { DEFAULT_MERCHANT_TZ, formatInTimeZone } from '@/lib/timezone';

type Props = {
 merchantId?: string;
 vetId?: string;
};

export function OpenStatusBadge({ merchantId, vetId }: Props) {
 const special = useSpecialHours(merchantId, vetId);
 const { data: isOpen } = useQuery({
 queryKey: ["open-status", merchantId, vetId],
 queryFn: async () => {
 const table = merchantId ?"merchant_business_hours" :"vet_business_hours";
 const col = merchantId ?"merchant_id" :"vet_id";
 const id = merchantId || vetId;

 const now = new Date();
  let timezone = DEFAULT_MERCHANT_TZ;
  if (merchantId) {
    const { data } = await supabase.rpc('get_merchant_checkout_context', { p_merchant_id: merchantId });
    const row = Array.isArray(data) ? data[0] : data;
    timezone = row?.timezone || DEFAULT_MERCHANT_TZ;
  }
  const dayOfWeek = Number(formatInTimeZone(now, timezone, 'i')) % 7;
  const currentTime = formatInTimeZone(now, timezone, 'HH:mm');
  const date = formatInTimeZone(now, timezone, 'yyyy-MM-dd');
  const { data: dates, error } = await supabase.from('business_special_hours').select('*').eq(merchantId ? 'merchant_id' : 'vet_id', id || '');
  if (error) throw error;
  const windows = specialWindowsForDate((dates || []).map(d => ({ ...d, windows: d.windows as unknown as {start_time: string; end_time: string}[] })), date);
  if (windows !== null) return windows.some(w => currentTime >= w.start_time && currentTime < w.end_time);

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
  refetchInterval: 60000,
 });

  if (isOpen === undefined || isOpen === null || special.isError) return null;

 return (
 <Badge
 variant="outline"
 className={
 isOpen
 ?"bg-success/10 text-success border-success/30"
 :"bg-destructive/10 text-destructive border-destructive/30"
 }
 >
 <span className={`w-2 h-2 rounded-full mr-1.5 ${isOpen ?"bg-success animate-pulse" :"bg-destructive"}`} />
 {isOpen ?"Open Now" :"Closed"}
 </Badge>
 );
}
