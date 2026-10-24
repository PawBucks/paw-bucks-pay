import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { BREED_LIBRARY } from '@/lib/groomingBreedLibrary';
import { todayDateOnly } from '@/lib/timezone';
import { type MerchantPet, type PetCustomer, type Vaccination, vaccinationsOf, vaccineStatus } from '@/lib/merchantPets';

const textFields = ['name','breed','birthdate','age_estimate','color_markings','microchip_number','vet_clinic_name','vet_doctor_name','vet_phone','medical_conditions','allergies','medications','grooming_coat_type','grooming_preferences','temperament_notes','handling_cautions','special_instructions','emergency_contact_name','emergency_contact_phone'] as const;
type TextField = typeof textFields[number];
export function PetDetailDialog({ pet, customer, merchantId, onClose, onSaved }: { pet: MerchantPet | null; customer: PetCustomer; merchantId: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<Record<TextField,string>>(() => Object.fromEntries(textFields.map(k => [k,pet?.[k] ?? ''])) as Record<TextField,string>);
  const [species,setSpecies] = useState(pet?.species ?? 'dog');
  const [sex,setSex] = useState(pet?.sex ?? 'unknown');
  const [neutered,setNeutered] = useState(pet?.spayed_neutered === null || !pet ? 'unknown' : pet.spayed_neutered ? 'yes' : 'no');
  const [size,setSize] = useState(pet?.size ?? 'unknown');
  const [weight,setWeight] = useState(pet?.weight_lbs?.toString() ?? '');
  const [vaccines,setVaccines] = useState<Vaccination[]>(pet ? vaccinationsOf(pet) : []);
  const [photo,setPhoto] = useState<File | null>(null);
  const [saving,setSaving] = useState(false);
  const field = (key: TextField, label: string, multiline = false, type = 'text') => <div className={multiline ? 'col-span-2 space-y-2' : 'space-y-2'} key={key}><Label htmlFor={`pet-${key}`}>{label}</Label>{multiline ? <Textarea id={`pet-${key}`} value={form[key]} maxLength={5000} onChange={e => setForm({...form,[key]:e.target.value})} /> : <Input id={`pet-${key}`} type={type} required={key==='name'} max={type==='date' ? todayDateOnly() : undefined} maxLength={key==='name' ? 100 : 500} list={key==='breed' ? 'pet-breed-options' : undefined} value={form[key]} onChange={e => setForm({...form,[key]:e.target.value})} />}</div>;
  const choice = (label: string,value: string,change: (v:string)=>void,options: [string,string][]) => <div className="space-y-2"><Label>{label}</Label><Select value={value} onValueChange={change}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{options.map(([v,l])=><SelectItem value={v} key={v}>{l}</SelectItem>)}</SelectContent></Select></div>;
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Pet name is required'); return; }
    if (form.birthdate && form.birthdate > todayDateOnly()) { toast.error('Birthdate cannot be in the future'); return; }
    if (weight && (!Number.isFinite(Number(weight)) || Number(weight)<=0)) { toast.error('Enter a positive weight'); return; }
    if (vaccines.some(v => !v.name.trim())) { toast.error('Enter a name for each vaccination'); return; }
    setSaving(true);
    let uploadedPath: string | null = null;
    try {
      let photoUrl = pet?.photo_url ?? null;
      if (photo) {
        if (!['image/jpeg','image/png','image/webp'].includes(photo.type) || photo.size>5*1024*1024) throw new Error('Choose a JPG, PNG or WebP photo under 5 MB');
        const {data:{user}} = await supabase.auth.getUser();
        if (!user) throw new Error('Please sign in again');
        uploadedPath = `${user.id}/${crypto.randomUUID()}.${photo.type.split('/')[1]}`;
        const {error} = await supabase.storage.from('pet-photos').upload(uploadedPath,photo);
        if (error) throw error;
        photoUrl = supabase.storage.from('pet-photos').getPublicUrl(uploadedPath).data.publicUrl;
      }
      const values = { ...form, name: form.name.trim(), birthdate: form.birthdate || null, species, sex, spayed_neutered: neutered==='unknown' ? null : neutered==='yes', size: size==='unknown' ? null : size, weight_lbs: weight ? Number(weight) : null, photo_url: photoUrl, vaccinations: vaccines.map(v => ({...v,name:v.name.trim()})) };
      const result = pet ? await supabase.from('merchant_client_pets').update(values).eq('id',pet.id).eq('merchant_id',merchantId).select('id').single() : await supabase.from('merchant_client_pets').insert({...values,merchant_id:merchantId,user_id:customer.userId ?? null,client_id:customer.userId ? null : customer.clientId ?? null}).select('id').single();
      if (result.error) throw result.error;
      toast.success('Pet record saved');
      await onSaved(); onClose();
    } catch (err) {
      if (uploadedPath) await supabase.storage.from('pet-photos').remove([uploadedPath]);
      toast.error(err instanceof Error ? err.message : 'Could not save pet record');
    } finally { setSaving(false); }
  }
  return <Dialog open onOpenChange={open=>{if(!open && !saving) onClose();}}><DialogContent className="w-[calc(100%-1rem)] max-w-2xl max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{pet ? `Edit ${pet.name}` : 'Add pet'}</DialogTitle><DialogDescription>{customer.name} · Business-maintained record</DialogDescription></DialogHeader>
    <form onSubmit={save} className="space-y-5"><Tabs defaultValue="basic"><TabsList className="flex w-full h-auto flex-wrap justify-start"><TabsTrigger value="basic">Basic info</TabsTrigger><TabsTrigger value="health">Health</TabsTrigger><TabsTrigger value="vaccines">Vaccinations</TabsTrigger><TabsTrigger value="grooming">Grooming</TabsTrigger><TabsTrigger value="safety">Safety</TabsTrigger></TabsList>
    <TabsContent value="basic" className="grid grid-cols-2 gap-4"><div className="col-span-2 flex items-center gap-3">{pet?.photo_url && <img src={pet.photo_url} alt={pet.name} className="h-16 w-16 rounded-md object-cover" />}<Label htmlFor="pet-photo" className="flex items-center gap-2"><Upload className="h-4 w-4" />Pet photo</Label><Input id="pet-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setPhoto(e.target.files?.[0] ?? null)} className="min-w-0 flex-1" /></div>{field('name','Pet name')}{choice('Species',species,setSpecies,[['dog','Dog'],['cat','Cat'],['other','Other']])}{field('breed','Breed')}<datalist id="pet-breed-options">{BREED_LIBRARY.map(b=><option value={b.name} key={b.name}/>)}</datalist>{field('birthdate','Birthdate',false,'date')}{field('age_estimate','Estimated age')}{choice('Sex',sex,setSex,[['unknown','Unknown'],['male','Male'],['female','Female']])}{choice('Spayed / neutered',neutered,setNeutered,[['unknown','Unknown'],['yes','Yes'],['no','No']])}{field('color_markings','Color / markings')}<div className="space-y-2"><Label htmlFor="pet-weight">Weight (lbs)</Label><Input id="pet-weight" type="number" min="0.01" step="0.01" value={weight} onChange={e=>setWeight(e.target.value)} /></div>{choice('Size',size,setSize,[['unknown','Unknown'],['small','Small'],['medium','Medium'],['large','Large'],['giant','Giant']])}{field('microchip_number','Microchip number')}</TabsContent>
    <TabsContent value="health" className="grid grid-cols-2 gap-4">{field('vet_clinic_name','Vet clinic')}{field('vet_doctor_name','Veterinarian')}{field('vet_phone','Vet phone',false,'tel')}{field('medical_conditions','Medical problems',true)}{field('allergies','Allergies / sensitivities',true)}{field('medications','Medications / dosage notes',true)}</TabsContent>
    <TabsContent value="vaccines" className="space-y-4"><div className="flex flex-wrap gap-2">{['Rabies','DHPP / DA2PP','Bordetella','Canine Influenza','FVRCP'].map(name=><Button key={name} type="button" variant="outline" size="sm" disabled={vaccines.some(v=>v.name===name)} onClick={()=>setVaccines([...vaccines,{name,date_administered:'',expiration_date:'',verified:false}])}><Plus className="h-3 w-3 mr-1"/>{name}</Button>)}</div>{vaccines.map((v,i)=><div key={i} className="border-b border-border pb-4 space-y-3"><div className="flex items-center gap-2"><Input aria-label={`Vaccination ${i+1} name`} value={v.name} onChange={e=>setVaccines(vaccines.map((x,j)=>j===i?{...x,name:e.target.value}:x))}/><Badge variant={vaccineStatus(v)==='Overdue'?'destructive':'secondary'}>{vaccineStatus(v)}</Badge><Button type="button" variant="ghost" size="icon" aria-label={`Remove vaccination ${i+1}`} onClick={()=>setVaccines(vaccines.filter((_,j)=>j!==i))}><Trash2 className="h-4 w-4"/></Button></div><div className="grid grid-cols-2 gap-3"><div><Label htmlFor={`administered-${i}`}>Date administered</Label><Input id={`administered-${i}`} type="date" value={v.date_administered} onChange={e=>setVaccines(vaccines.map((x,j)=>j===i?{...x,date_administered:e.target.value}:x))}/></div><div><Label htmlFor={`expires-${i}`}>Expiration date</Label><Input id={`expires-${i}`} type="date" value={v.expiration_date} onChange={e=>setVaccines(vaccines.map((x,j)=>j===i?{...x,expiration_date:e.target.value}:x))}/></div></div><div className="flex items-center gap-2"><Checkbox id={`verified-${i}`} checked={v.verified} onCheckedChange={checked=>setVaccines(vaccines.map((x,j)=>j===i?{...x,verified:checked===true}:x))}/><Label htmlFor={`verified-${i}`}>Record verified by business</Label></div></div>)}<Button type="button" variant="outline" onClick={()=>setVaccines([...vaccines,{name:'',date_administered:'',expiration_date:'',verified:false}])}><Plus className="h-4 w-4 mr-2"/>Add vaccination</Button></TabsContent>
    <TabsContent value="grooming" className="grid grid-cols-2 gap-4">{field('grooming_coat_type','Coat type')}{field('grooming_preferences','Grooming / styling preferences',true)}{field('temperament_notes','Temperament / table and tub notes',true)}</TabsContent>
    <TabsContent value="safety" className="grid grid-cols-2 gap-4"><div className="col-span-2 flex flex-wrap gap-2">{['Bite risk','Sensitive feet / tail','Crate anxiety','Dog reactive'].map(c=><Button type="button" variant="outline" size="sm" key={c} onClick={()=>setForm({...form,handling_cautions:[form.handling_cautions,c].filter(Boolean).join('; ')})}>{c}</Button>)}</div>{field('handling_cautions','Handling cautions',true)}{field('special_instructions','Special instructions',true)}{field('emergency_contact_name','Emergency contact')}{field('emergency_contact_phone','Emergency phone',false,'tel')}</TabsContent>
    </Tabs><div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin"/>}Save pet</Button></div></form>
  </DialogContent></Dialog>;
}