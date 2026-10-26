// Customer/pet CSV import: column mapping presets, row grouping, and dedupe.
export type ImportField =
  | 'name' | 'first_name' | 'last_name' | 'email' | 'phone' | 'address_line1' | 'city' | 'state' | 'postal_code' | 'notes'
  | 'pet_name' | 'species' | 'breed' | 'birthdate' | 'sex' | 'spayed_neutered' | 'color_markings' | 'weight_lbs'
  | 'vet_clinic_name' | 'medical_conditions' | 'allergies' | 'medications' | 'grooming_preferences' | 'special_instructions';

export const IMPORT_FIELDS: { key: ImportField; label: string; group: 'Customer' | 'Pet' }[] = [
  { key: 'name', label: 'Full name', group: 'Customer' },
  { key: 'first_name', label: 'First name', group: 'Customer' },
  { key: 'last_name', label: 'Last name', group: 'Customer' },
  { key: 'email', label: 'Email', group: 'Customer' },
  { key: 'phone', label: 'Phone', group: 'Customer' },
  { key: 'address_line1', label: 'Address', group: 'Customer' },
  { key: 'city', label: 'City', group: 'Customer' },
  { key: 'state', label: 'State', group: 'Customer' },
  { key: 'postal_code', label: 'ZIP', group: 'Customer' },
  { key: 'notes', label: 'Customer notes', group: 'Customer' },
  { key: 'pet_name', label: 'Pet name', group: 'Pet' },
  { key: 'species', label: 'Species', group: 'Pet' },
  { key: 'breed', label: 'Breed', group: 'Pet' },
  { key: 'birthdate', label: 'Birthdate', group: 'Pet' },
  { key: 'sex', label: 'Sex', group: 'Pet' },
  { key: 'spayed_neutered', label: 'Spayed/neutered', group: 'Pet' },
  { key: 'color_markings', label: 'Color', group: 'Pet' },
  { key: 'weight_lbs', label: 'Weight (lbs)', group: 'Pet' },
  { key: 'vet_clinic_name', label: 'Vet clinic', group: 'Pet' },
  { key: 'medical_conditions', label: 'Medical conditions', group: 'Pet' },
  { key: 'allergies', label: 'Allergies', group: 'Pet' },
  { key: 'medications', label: 'Medications', group: 'Pet' },
  { key: 'grooming_preferences', label: 'Grooming notes', group: 'Pet' },
  { key: 'special_instructions', label: 'Special instructions', group: 'Pet' },
];

export type PresetId = 'auto' | 'pawbucks' | 'moego' | 'gingr' | 'square';
export const PRESETS: { id: PresetId; label: string }[] = [
  { id: 'auto', label: 'Auto-detect' },
  { id: 'pawbucks', label: 'PawBucks template' },
  { id: 'moego', label: 'MoeGo' },
  { id: 'gingr', label: 'Gingr' },
  { id: 'square', label: 'Square' },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// Generic aliases (used by every preset) plus platform-specific header names.
const ALIASES: Record<ImportField, string[]> = {
  name: ['name', 'fullname', 'customername', 'clientname', 'ownername'],
  first_name: ['firstname', 'givenname', 'ownerfirstname', 'clientfirstname'],
  last_name: ['lastname', 'surname', 'familyname', 'ownerlastname', 'clientlastname'],
  email: ['email', 'emailaddress', 'customeremail', 'clientemail', 'owneremail'],
  phone: ['phone', 'phonenumber', 'mobile', 'cell', 'cellphone', 'mobilephone', 'primaryphone', 'clientphone', 'homephone'],
  address_line1: ['address', 'address1', 'addressline1', 'streetaddress', 'street'],
  city: ['city', 'locality'],
  state: ['state', 'province', 'region', 'administrativedistrictlevel1'],
  postal_code: ['zip', 'zipcode', 'postalcode', 'postcode'],
  notes: ['notes', 'customernotes', 'clientnotes', 'memo'],
  pet_name: ['petname', 'pet', 'animalname', 'animal', 'dogname'],
  species: ['species', 'pettype', 'animaltype', 'type'],
  breed: ['breed', 'petbreed', 'animalbreed'],
  birthdate: ['birthdate', 'birthday', 'dob', 'dateofbirth', 'petbirthday'],
  sex: ['sex', 'gender', 'petgender'],
  spayed_neutered: ['spayedneutered', 'fixed', 'altered', 'spayed', 'neutered', 'spayneuter'],
  color_markings: ['color', 'colour', 'colormarkings', 'coatcolor'],
  weight_lbs: ['weight', 'weightlbs', 'petweight'],
  vet_clinic_name: ['vet', 'vetclinic', 'veterinarian', 'vetname', 'primaryvet'],
  medical_conditions: ['medicalconditions', 'medicalnotes', 'healthnotes', 'conditions'],
  allergies: ['allergies', 'allergy'],
  medications: ['medications', 'medication', 'meds'],
  grooming_preferences: ['groomingnotes', 'groomingpreferences', 'petnotes', 'styling'],
  special_instructions: ['specialinstructions', 'instructions', 'alerts', 'behaviornotes'],
};
const PRESET_ALIASES: Record<Exclude<PresetId, 'auto' | 'pawbucks'>, Partial<Record<ImportField, string[]>>> = {
  moego: { first_name: ['clientfirstname'], last_name: ['clientlastname'], phone: ['primarycontactnumber'], pet_name: ['petname'], grooming_preferences: ['groomingnote', 'petnote'] },
  gingr: { first_name: ['ownerfirstname'], last_name: ['ownerlastname'], email: ['owneremail'], phone: ['ownercellphone', 'cellphone'], pet_name: ['animalname'], breed: ['breedname'], medical_conditions: ['medicalnotes'], vet_clinic_name: ['vetname'] },
  square: { first_name: ['givenname'], last_name: ['familyname'], email: ['emailaddress'], address_line1: ['streetaddress1'], state: ['state'], notes: ['memo'] },
};

export function autoMap(headers: string[], preset: PresetId = 'auto'): Record<string, ImportField | ''> {
  const out: Record<string, ImportField | ''> = {};
  const used = new Set<ImportField>();
  const extra = preset in PRESET_ALIASES ? PRESET_ALIASES[preset as keyof typeof PRESET_ALIASES] : {};
  for (const h of headers) {
    const n = norm(h);
    let hit: ImportField | '' = '';
    for (const f of IMPORT_FIELDS) {
      if (used.has(f.key)) continue;
      if ([...(extra[f.key] ?? []), ...ALIASES[f.key]].includes(n)) { hit = f.key; break; }
    }
    if (hit) used.add(hit);
    out[h] = hit;
  }
  return out;
}

export const TEMPLATE_HEADERS = ['First Name', 'Last Name', 'Email', 'Phone', 'Address', 'City', 'State', 'ZIP', 'Pet Name', 'Species', 'Breed', 'Birthdate', 'Sex', 'Spayed/Neutered', 'Color', 'Weight', 'Vet Clinic', 'Allergies', 'Medications', 'Special Instructions'];
export const TEMPLATE_SAMPLE = ['Jane', 'Doe', 'jane@example.com', '555-123-4567', '123 Main St', 'Los Angeles', 'CA', '90001', 'Biscuit', 'dog', 'Labrador', '2020-04-15', 'female', 'yes', 'Yellow', '62', 'Sunset Vet', 'Chicken', '', 'Nervous with dryers'];

export const phoneKey = (p?: string) => (p ?? '').replace(/\D/g, '').slice(-10);
export const emailKey = (e?: string) => (e ?? '').trim().toLowerCase();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ImportPet = { name: string; species: string; breed?: string; birthdate?: string; sex?: string; spayed_neutered?: boolean | null; color_markings?: string; weight_lbs?: number | null; vet_clinic_name?: string; medical_conditions?: string; allergies?: string; medications?: string; grooming_preferences?: string; special_instructions?: string };
export type ImportCustomer = { key: string; name: string; email: string; phone: string; address_line1?: string; city?: string; state?: string; postal_code?: string; notes?: string; pets: ImportPet[]; rows: number[] };
export type ImportIssue = { row: number; message: string };

function toDate(v: string): string | undefined {
  const s = v.trim(); if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`; }
  return undefined;
}
const toBool = (v: string) => { const s = v.trim().toLowerCase(); if (!s) return null; if (['y', 'yes', 'true', '1', 'spayed', 'neutered', 'fixed', 'altered'].includes(s)) return true; if (['n', 'no', 'false', '0', 'intact'].includes(s)) return false; return null; };
const toSpecies = (v: string) => { const s = v.trim().toLowerCase(); if (!s) return 'dog'; if (s.startsWith('cat') || s.includes('feline')) return 'cat'; if (s.startsWith('dog') || s.includes('canine')) return 'dog'; return 'other'; };
const toSex = (v: string) => { const s = v.trim().toLowerCase(); if (!s) return undefined; if (s.startsWith('f')) return 'female'; if (s.startsWith('m')) return 'male'; return undefined; };

/** Groups rows into customers (one row per pet is fine) keyed by email, then phone, then name. */
export function buildImport(rows: Record<string, string>[], mapping: Record<string, ImportField | ''>) {
  const issues: ImportIssue[] = [];
  const byKey = new Map<string, ImportCustomer>();
  rows.forEach((raw, i) => {
    const row = i + 2; // header is row 1
    const v: Partial<Record<ImportField, string>> = {};
    for (const [h, f] of Object.entries(mapping)) if (f && raw[h] != null && String(raw[h]).trim()) v[f] = String(raw[h]).trim();
    const name = (v.name ?? [v.first_name, v.last_name].filter(Boolean).join(' ')).trim().slice(0, 200);
    let email = emailKey(v.email);
    if (email && !EMAIL_RE.test(email)) { issues.push({ row, message: `Invalid email "${v.email}" was skipped` }); email = ''; }
    const phone = (v.phone ?? '').slice(0, 40);
    if (!name && !email && !phone) { if (Object.keys(v).length) issues.push({ row, message: 'No customer name, email, or phone' }); return; }
    const key = email ? `e:${email}` : phoneKey(phone) ? `p:${phoneKey(phone)}` : `n:${name.toLowerCase()}`;
    let c = byKey.get(key);
    if (!c) { c = { key, name: name || email || phone, email, phone, address_line1: v.address_line1, city: v.city, state: v.state, postal_code: v.postal_code, notes: v.notes, pets: [], rows: [] }; byKey.set(key, c); }
    c.rows.push(row);
    if (v.pet_name) {
      const pn = v.pet_name.slice(0, 100);
      if (c.pets.some(p => p.name.toLowerCase() === pn.toLowerCase())) return;
      const bd = v.birthdate ? toDate(v.birthdate) : undefined;
      if (v.birthdate && !bd) issues.push({ row, message: `Unrecognized birthdate "${v.birthdate}" was skipped` });
      const w = v.weight_lbs ? parseFloat(v.weight_lbs.replace(/[^\d.]/g, '')) : NaN;
      c.pets.push({ name: pn, species: toSpecies(v.species ?? ''), breed: v.breed, birthdate: bd, sex: toSex(v.sex ?? ''), spayed_neutered: toBool(v.spayed_neutered ?? ''), color_markings: v.color_markings, weight_lbs: Number.isFinite(w) && w > 0 && w < 400 ? w : null, vet_clinic_name: v.vet_clinic_name, medical_conditions: v.medical_conditions, allergies: v.allergies, medications: v.medications, grooming_preferences: v.grooming_preferences, special_instructions: v.special_instructions });
    }
  });
  return { customers: [...byKey.values()], issues };
}

/** Finds an existing saved customer that matches by email or phone. */
export function findExisting<T extends { id: string; email: string | null; phone: string | null }>(c: ImportCustomer, existing: T[]): T | undefined {
  return existing.find(e => (c.email && emailKey(e.email ?? '') === c.email) || (phoneKey(c.phone) && phoneKey(e.phone ?? '') === phoneKey(c.phone)));
}
