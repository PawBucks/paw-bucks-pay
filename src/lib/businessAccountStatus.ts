import { supabase } from '@/integrations/supabase/client';

export type BusinessAccount = { id: string; kind: 'merchant' | 'vet'; name: string; is_paused: boolean };

export async function setBusinessDisabled(account: BusinessAccount, disabled: boolean, reason: string) {
  const result = account.kind === 'merchant'
    ? await supabase.rpc('admin_set_merchant_pause', { _merchant_id: account.id, _paused: disabled, _reason: reason })
    : await supabase.rpc('admin_set_vet_pause', { _vet_id: account.id, _paused: disabled, _reason: reason });
  if (result.error) throw result.error;
}