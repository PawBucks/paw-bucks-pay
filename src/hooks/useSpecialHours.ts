import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SpecialHours } from '@/lib/specialHours';

export function useSpecialHours(merchantId?: string, vetId?: string) {
  return useQuery({
    queryKey: ['special-hours', merchantId, vetId],
    enabled: !!(merchantId || vetId),
    refetchInterval: 60000,
    queryFn: async (): Promise<SpecialHours[]> => {
      const id = merchantId || vetId;
      if (!id) return [];
      const { data, error } = await supabase.from('business_special_hours')
        .select('id, special_date, label, is_closed, repeat_annually, windows')
        .eq(merchantId ? 'merchant_id' : 'vet_id', id).order('special_date');
      if (error) throw error;
      return (data || []).map(row => ({ ...row, windows: row.windows as unknown as SpecialHours['windows'] }));
    },
  });
}