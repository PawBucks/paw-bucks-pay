import { describe, it, expect } from 'vitest';
import { customerPets, vaccineStatus, type MerchantPet } from '@/lib/merchantPets';

describe('merchant pet customer links',()=>{
  const pets = [{id:'a',user_id:'owner-a',client_id:null},{id:'b',user_id:'owner-b',client_id:null},{id:'c',user_id:null,client_id:'client-a'}] as MerchantPet[];
  const base = {key:'a',name:'Customer',saved:false,totalSpent:0,bookings:0,transactions:0};
  it('shows only the selected platform customer pets',()=>expect(customerPets(pets,{...base,userId:'owner-a'}).map(p=>p.id)).toEqual(['a']));
  it('shows only the selected saved contact pets',()=>expect(customerPets(pets,{...base,clientId:'client-a'}).map(p=>p.id)).toEqual(['c']));
  it('does not attach pets to an unlinked guest',()=>expect(customerPets(pets,base)).toEqual([]));
  it('preserves records when saved and platform customer identities are merged',()=>expect(customerPets(pets,{...base,userId:'owner-a',clientId:'client-a'}).map(p=>p.id)).toEqual(['a','c']));
});
describe('vaccination dates',()=>{
  const v = {name:'Rabies',date_administered:'2025-01-01',expiration_date:'2026-10-23',verified:true};
  it('marks expired vaccinations overdue',()=>expect(vaccineStatus(v,'2026-10-24')).toBe('Overdue'));
  it('does not treat unverified records as valid',()=>expect(vaccineStatus({...v,verified:false},'2026-10-24')).toBe('Unverified'));
  it('warns before expiry',()=>expect(vaccineStatus({...v,expiration_date:'2026-11-01'},'2026-10-24')).toBe('Expiring soon'));
  it('recognizes current verified vaccinations',()=>expect(vaccineStatus({...v,expiration_date:'2027-10-24'},'2026-10-24')).toBe('Valid'));
});