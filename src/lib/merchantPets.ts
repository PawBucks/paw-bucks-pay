import type { Tables } from '@/integrations/supabase/types';
import { todayDateOnly } from '@/lib/timezone';

export type MerchantPet = Tables<'merchant_client_pets'>;
export type PetCustomer = { key: string; userId?: string; clientId?: string; name: string; email?: string; phone?: string; company?: string; saved: boolean; totalSpent: number; bookings: number; transactions: number };
export type Vaccination = { name: string; date_administered: string; expiration_date: string; verified: boolean };
export function customerPets(pets: MerchantPet[], customer: PetCustomer) {
  return pets.filter(p => customer.userId ? p.user_id === customer.userId || (!!customer.clientId && p.client_id === customer.clientId) : !!customer.clientId && p.client_id === customer.clientId);
}
export function vaccineStatus(v: Vaccination, today = todayDateOnly()) {
  if (!v.verified || !v.expiration_date) return 'Unverified';
  if (v.expiration_date < today) return 'Overdue';
  const days = (Date.parse(`${v.expiration_date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000;
  return days <= 30 ? 'Expiring soon' : 'Valid';
}
export function vaccinationsOf(pet: MerchantPet): Vaccination[] {
  if (!Array.isArray(pet.vaccinations)) return [];
  return pet.vaccinations.flatMap(v => {
    if (!v || typeof v !== 'object' || Array.isArray(v) || typeof v.name !== 'string') return [];
    return [{ name: v.name, date_administered: typeof v.date_administered === 'string' ? v.date_administered : '', expiration_date: typeof v.expiration_date === 'string' ? v.expiration_date : '', verified: v.verified === true }];
  });
}