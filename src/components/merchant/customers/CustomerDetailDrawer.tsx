import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Mail, Phone, Plus, PawPrint, Pencil, Trash2, ShieldAlert, FileText, BookmarkPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { type MerchantPet, type PetCustomer, vaccinationsOf, vaccineStatus } from '@/lib/merchantPets';
import { formatDateOnly } from '@/lib/timezone';
import { Formatters } from '@/utils/formatters';
import { PetDetailDialog } from './PetDetailDialog';

export function CustomerDetailDrawer({customer,merchantId,pets,onClose,onRefresh,onSaveContact}: {customer:PetCustomer; merchantId:string; pets:MerchantPet[]; onClose:()=>void; onRefresh:()=>Promise<void>; onSaveContact:()=>void}) {
  const navigate=useNavigate();
  const [editor,setEditor]=useState<{pet:MerchantPet|null}|null>(null);
  const [removing,setRemoving]=useState<MerchantPet|null>(null);
  const [busy,setBusy]=useState(false);
  async function remove() {
    if(!removing) return;
    setBusy(true);
    const {error}=await supabase.from('merchant_client_pets').delete().eq('id',removing.id).eq('merchant_id',merchantId).select('id').single();
    if(error) toast.error('Could not delete pet record');
    else {toast.success('Pet record deleted'); setRemoving(null); await onRefresh();}
    setBusy(false);
  }
  return <><Sheet open onOpenChange={open=>{if(!open) onClose();}}><SheetContent className="w-full sm:max-w-xl overflow-y-auto"><SheetHeader className="pr-8"><SheetTitle>{customer.name}</SheetTitle><SheetDescription>{customer.company || (customer.saved ? 'Saved customer' : 'Platform customer')}</SheetDescription></SheetHeader>
    <div className="space-y-6 mt-6"><div className="space-y-2 text-sm">{customer.email&&<p className="flex gap-2 break-all"><Mail className="h-4 w-4 shrink-0 text-muted-foreground"/>{customer.email}</p>}{customer.phone&&<p className="flex gap-2"><Phone className="h-4 w-4 text-muted-foreground"/>{customer.phone}</p>}<div className="grid grid-cols-3 gap-3 border-y border-border py-4 mt-4"><div><p className="text-muted-foreground text-xs">Spent</p><p className="font-semibold">{Formatters.currency(customer.totalSpent)}</p></div><div><p className="text-muted-foreground text-xs">Bookings</p><p className="font-semibold">{customer.bookings}</p></div><div><p className="text-muted-foreground text-xs">Purchases</p><p className="font-semibold">{customer.transactions}</p></div></div></div>
    <div className="flex flex-wrap gap-2">{!customer.saved&&<Button variant="outline" size="sm" onClick={onSaveContact}><BookmarkPlus className="h-4 w-4 mr-2"/>Add to list</Button>}<Button variant="outline" size="sm" onClick={()=>navigate('/merchant/invoicing')}><FileText className="h-4 w-4 mr-2"/>New invoice</Button><Button variant="outline" size="sm" onClick={()=>navigate('/merchant/messages')}><Mail className="h-4 w-4 mr-2"/>Message</Button></div>
    <section className="space-y-4"><div className="flex items-center justify-between gap-2"><h2 className="font-semibold flex items-center gap-2"><PawPrint className="h-5 w-5 text-primary"/>Pets <Badge variant="secondary">{pets.length}</Badge></h2><Button size="sm" onClick={()=>setEditor({pet:null})} disabled={!customer.userId&&!customer.clientId}><Plus className="h-4 w-4 mr-2"/>Add pet</Button></div>{!customer.userId&&!customer.clientId&&<p className="text-sm text-muted-foreground">Save this customer to your list before adding a pet.</p>}
    {!pets.length&&<div className="py-10 text-center border-y border-border"><PawPrint className="h-9 w-9 mx-auto mb-3 text-muted-foreground"/><p className="text-sm text-muted-foreground">No business pet records yet</p></div>}
    {pets.map(p=><article key={p.id} className="rounded-md border border-border p-4 space-y-3"><div className="flex gap-3 items-start">{p.photo_url?<img src={p.photo_url} alt={p.name} className="h-14 w-14 rounded-md object-cover"/>:<div className="h-14 w-14 rounded-md bg-muted flex items-center justify-center shrink-0"><PawPrint className="h-6 w-6 text-muted-foreground"/></div>}<div className="flex-1 min-w-0"><h3 className="font-semibold break-words">{p.name}</h3><p className="text-sm text-muted-foreground capitalize">{[p.species,p.breed].filter(Boolean).join(' · ')}</p><p className="text-xs text-muted-foreground capitalize">{[p.sex,p.spayed_neutered===null ? null : p.spayed_neutered?'Spayed / neutered':'Not spayed / neutered',p.size].filter(Boolean).join(' · ')}</p></div><Button variant="ghost" size="icon" aria-label={`Edit ${p.name}`} onClick={()=>setEditor({pet:p})}><Pencil className="h-4 w-4"/></Button><Button variant="ghost" size="icon" className="text-destructive" aria-label={`Delete ${p.name}`} onClick={()=>setRemoving(p)}><Trash2 className="h-4 w-4"/></Button></div>
    <div className="flex flex-wrap gap-2">{p.handling_cautions&&<Badge variant="destructive"><ShieldAlert className="h-3 w-3 mr-1"/>Handling caution</Badge>}{vaccinationsOf(p).filter(v=>vaccineStatus(v)==='Overdue'||vaccineStatus(v)==='Expiring soon').map((v,i)=><Badge key={i} variant={vaccineStatus(v)==='Overdue'?'destructive':'secondary'}>{v.name}: {vaccineStatus(v)}</Badge>)}</div>
    <dl className="space-y-2 text-sm">{[
      ['Birthdate',p.birthdate?formatDateOnly(p.birthdate):p.age_estimate],['Color / markings',p.color_markings],['Weight',p.weight_lbs?`${p.weight_lbs} lbs`:null],['Microchip',p.microchip_number],['Veterinarian',[p.vet_clinic_name,p.vet_doctor_name,p.vet_phone].filter(Boolean).join(' · ')],['Medical problems',p.medical_conditions],['Allergies',p.allergies],['Medications',p.medications],['Coat type',p.grooming_coat_type],['Grooming preferences',p.grooming_preferences],['Temperament',p.temperament_notes],['Handling cautions',p.handling_cautions],['Special instructions',p.special_instructions],['Emergency contact',[p.emergency_contact_name,p.emergency_contact_phone].filter(Boolean).join(' · ')]
    ].filter(([,value])=>value).map(([label,value])=><div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="whitespace-pre-wrap break-words">{value}</dd></div>)}</dl>
    {vaccinationsOf(p).length>0&&<div className="space-y-2 border-t border-border pt-3"><h4 className="text-xs font-semibold text-muted-foreground">Vaccinations</h4>{vaccinationsOf(p).map((v,i)=><div key={i} className="text-xs flex justify-between gap-2"><span>{v.name}{v.expiration_date&&` · expires ${formatDateOnly(v.expiration_date)}`}</span><span className={vaccineStatus(v)==='Overdue'?'text-destructive':'text-muted-foreground'}>{vaccineStatus(v)}</span></div>)}</div>}
    </article>)}</section></div></SheetContent></Sheet>
    {editor&&<PetDetailDialog pet={editor.pet} customer={customer} merchantId={merchantId} onClose={()=>setEditor(null)} onSaved={onRefresh}/>}
    <AlertDialog open={!!removing} onOpenChange={open=>{if(!open&&!busy) setRemoving(null);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {removing?.name}?</AlertDialogTitle><AlertDialogDescription>This deletes only your business’s pet record. The pet owner’s profile and veterinary records will not change.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} className="bg-destructive text-destructive-foreground" onClick={e=>{e.preventDefault(); void remove();}}>Delete pet</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}