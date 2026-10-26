import { useMemo, useState } from 'react';
import Papa from 'papaparse';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, PawPrint, Users, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { csvSafeCell } from '@/lib/csv';
import { toast } from 'sonner';
import { IMPORT_FIELDS, PRESETS, TEMPLATE_HEADERS, TEMPLATE_SAMPLE, autoMap, buildImport, findExisting, type ImportField, type PresetId } from '@/lib/customerImport';

type Existing = { id: string; email: string | null; phone: string | null };
type Props = { open: boolean; onOpenChange: (o: boolean) => void; merchantId: string; existing: Existing[]; onDone: () => void };
const MAX_ROWS = 5000;

export function CustomerImportDialog({ open, onOpenChange, merchantId, existing, onDone }: Props) {
  const [step, setStep] = useState<'upload' | 'map' | 'review' | 'done'>('upload');
  const [preset, setPreset] = useState<PresetId>('auto');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, ImportField | ''>>({});
  const [dupMode, setDupMode] = useState<'skip' | 'merge'>('merge');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState({ created: 0, updated: 0, skipped: 0, pets: 0, failed: 0 });

  const reset = () => { setStep('upload'); setHeaders([]); setRows([]); setMapping({}); };
  const close = (o: boolean) => { if (!busy) { onOpenChange(o); if (!o) reset(); } };

  const downloadTemplate = () => {
    const csv = [TEMPLATE_HEADERS, TEMPLATE_SAMPLE].map(r => r.map(csvSafeCell).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'pawbucks-customer-import-template.csv'; a.click();
  };

  const onFile = (file?: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error('File is larger than 10 MB');
    Papa.parse<Record<string, string>>(file, {
      header: true, skipEmptyLines: true,
      complete: res => {
        const h = (res.meta.fields ?? []).filter(Boolean);
        if (!h.length || !res.data.length) return toast.error('No rows found in this file');
        if (res.data.length > MAX_ROWS) return toast.error(`Please import at most ${MAX_ROWS} rows at a time`);
        setHeaders(h); setRows(res.data); setMapping(autoMap(h, preset)); setStep('map');
      },
      error: () => toast.error('Could not read this file. Save it as CSV and try again.'),
    });
  };

  const built = useMemo(() => buildImport(rows, mapping), [rows, mapping]);
  const stats = useMemo(() => {
    const dup = built.customers.filter(c => findExisting(c, existing)).length;
    return { total: built.customers.length, dup, pets: built.customers.reduce((n, c) => n + c.pets.length, 0) };
  }, [built, existing]);
  const hasIdentity = Object.values(mapping).some(f => f === 'name' || f === 'first_name' || f === 'email' || f === 'phone');

  const runImport = async () => {
    setBusy(true);
    const r = { created: 0, updated: 0, skipped: 0, pets: 0, failed: 0 };
    const { data: existingPets } = await supabase.from('merchant_client_pets').select('client_id,name').eq('merchant_id', merchantId);
    const petSeen = new Set((existingPets ?? []).map(p => `${p.client_id}|${p.name.toLowerCase()}`));
    for (const c of built.customers) {
      const match = findExisting(c, existing);
      let clientId = match?.id;
      const fields = { name: c.name, phone: c.phone || null, address_line1: c.address_line1 || null, city: c.city || null, state: c.state || null, postal_code: c.postal_code || null, notes: c.notes || null };
      if (match) {
        if (dupMode === 'skip') { r.skipped++; continue; }
        const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v)) as typeof fields;
        const { error } = await supabase.from('invoice_clients').update(patch).eq('id', match.id);
        if (error) { r.failed++; continue; }
        r.updated++;
      } else {
        const { data, error } = await supabase.from('invoice_clients').insert({ ...fields, merchant_id: merchantId, email: c.email }).select('id').single();
        if (error || !data) { r.failed++; continue; }
        clientId = data.id; r.created++;
      }
      const newPets = c.pets.filter(p => !petSeen.has(`${clientId}|${p.name.toLowerCase()}`));
      if (newPets.length) {
        const { error } = await supabase.from('merchant_client_pets').insert(newPets.map(p => ({ ...p, merchant_id: merchantId, client_id: clientId!, breed: p.breed || null, birthdate: p.birthdate || null, sex: p.sex || null })));
        if (!error) r.pets += newPets.length;
      }
    }
    setResult(r); setBusy(false); setStep('done'); onDone();
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary" />Import customers & pets</DialogTitle>
          <DialogDescription>Upload a CSV exported from MoeGo, Gingr, Square, or any spreadsheet. One row per pet is fine — rows with the same email or phone become one customer.</DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Where is this file from?</Label>
              <Select value={preset} onValueChange={v => setPreset(v as PresetId)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRESETS.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg p-8 cursor-pointer hover:bg-muted/50">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="font-medium">Choose a CSV file</span>
              <span className="text-xs text-muted-foreground">Up to {MAX_ROWS.toLocaleString()} rows, 10 MB</span>
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
            </label>
            <Button variant="outline" size="sm" onClick={downloadTemplate}><Download className="h-4 w-4 mr-2" />Download PawBucks template</Button>
          </div>
        )}

        {step === 'map' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">We matched your columns automatically. Adjust anything that looks wrong.</p>
            <div className="space-y-2">
              {headers.map(h => (
                <div key={h} className="grid grid-cols-2 gap-2 items-center">
                  <div className="text-sm truncate"><span className="font-medium">{h}</span><span className="block text-xs text-muted-foreground truncate">{rows[0]?.[h] || '—'}</span></div>
                  <Select value={mapping[h] || 'ignore'} onValueChange={v => setMapping(m => ({ ...m, [h]: v === 'ignore' ? '' : v as ImportField }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ignore">Don't import</SelectItem>
                      {IMPORT_FIELDS.map(f => <SelectItem key={f.key} value={f.key}>{f.group}: {f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            {!hasIdentity && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-4 w-4" />Map at least a name, email, or phone column.</p>}
            <DialogFooter><Button variant="outline" onClick={reset}>Back</Button><Button disabled={!hasIdentity} onClick={() => setStep('review')}>Review</Button></DialogFooter>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border p-3"><Users className="h-4 w-4 mx-auto text-primary" /><div className="text-xl font-semibold">{stats.total}</div><div className="text-xs text-muted-foreground">Customers</div></div>
              <div className="rounded-lg border p-3"><PawPrint className="h-4 w-4 mx-auto text-primary" /><div className="text-xl font-semibold">{stats.pets}</div><div className="text-xs text-muted-foreground">Pets</div></div>
              <div className="rounded-lg border p-3"><AlertCircle className="h-4 w-4 mx-auto text-muted-foreground" /><div className="text-xl font-semibold">{stats.dup}</div><div className="text-xs text-muted-foreground">Already saved</div></div>
            </div>
            {stats.dup > 0 && (
              <RadioGroup value={dupMode} onValueChange={v => setDupMode(v as 'skip' | 'merge')} className="space-y-1">
                <Label className="flex items-center gap-2 font-normal"><RadioGroupItem value="merge" />Update existing customers and add new pets</Label>
                <Label className="flex items-center gap-2 font-normal"><RadioGroupItem value="skip" />Skip customers I already have</Label>
              </RadioGroup>
            )}
            <div className="max-h-48 overflow-y-auto rounded border divide-y text-sm">
              {built.customers.slice(0, 50).map(c => (
                <div key={c.key} className="p-2 flex justify-between gap-2">
                  <div className="min-w-0"><div className="font-medium truncate">{c.name}</div><div className="text-xs text-muted-foreground truncate">{c.email || c.phone || 'No contact info'}</div></div>
                  <div className="flex flex-wrap gap-1 justify-end">{c.pets.map(p => <Badge key={p.name} variant="secondary">{p.name}</Badge>)}{findExisting(c, existing) && <Badge variant="outline">Existing</Badge>}</div>
                </div>
              ))}
            </div>
            {built.issues.length > 0 && (
              <div className="rounded border border-destructive/40 p-2 text-xs max-h-28 overflow-y-auto space-y-0.5">
                {built.issues.slice(0, 30).map((i, k) => <div key={k}>Row {i.row}: {i.message}</div>)}
              </div>
            )}
            <DialogFooter><Button variant="outline" onClick={() => setStep('map')} disabled={busy}>Back</Button><Button onClick={runImport} disabled={busy || !stats.total}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Import {stats.total} customers</Button></DialogFooter>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-3 text-center py-4">
            <CheckCircle2 className="h-10 w-10 mx-auto text-primary" />
            <p className="font-medium">Import finished</p>
            <p className="text-sm text-muted-foreground">{result.created} added, {result.updated} updated, {result.skipped} skipped, {result.pets} pets added{result.failed ? `, ${result.failed} failed` : ''}.</p>
            <Button onClick={() => close(false)}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
