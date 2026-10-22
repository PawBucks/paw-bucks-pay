import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSpecialHours } from '@/hooks/useSpecialHours';
import { type SpecialHours, type OpenWindow, validateOpenWindows } from '@/lib/specialHours';
import { formatDateOnly, formatMerchantTime, todayDateOnly } from '@/lib/timezone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export function SpecialHoursEditor({ merchantId, vetId }: { merchantId?: string; vetId?: string }) {
  const query = useSpecialHours(merchantId, vetId);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [date, setDate] = useState(todayDateOnly());
  const [label, setLabel] = useState('');
  const [closed, setClosed] = useState(true);
  const [annual, setAnnual] = useState(false);
  const [windows, setWindows] = useState<OpenWindow[]>([{ start_time: '09:00', end_time: '12:00' }]);
  const [saving, setSaving] = useState(false);
  const startEdit = (entry?: SpecialHours) => {
    setEditing(entry?.id || null); setDate(entry?.special_date || todayDateOnly());
    setLabel(entry?.label || ''); setClosed(entry?.is_closed ?? true); setAnnual(entry?.repeat_annually ?? false);
    setWindows(entry?.windows.length ? entry.windows : [{ start_time: '09:00', end_time: '12:00' }]); setOpen(true);
  };
  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['special-hours'] }),
      qc.invalidateQueries({ queryKey: ['open-status'] }),
    ]);
  };
  const save = async () => {
    const id = merchantId || vetId;
    if (!id || !date) return;
    const problem = closed ? null : validateOpenWindows(windows);
    if (problem) { toast.error(problem); return; }
    setSaving(true);
    try {
      const values = { merchant_id: merchantId || null, vet_id: merchantId ? null : vetId || null,
        special_date: date, label: label.trim(), is_closed: closed, repeat_annually: annual,
        windows: closed ? [] : [...windows].sort((a, b) => a.start_time.localeCompare(b.start_time)) };
      const result = editing
        ? await supabase.from('business_special_hours').update(values).eq('id', editing)
        : await supabase.from('business_special_hours').insert(values);
      if (result.error) throw result.error;
      await refresh(); setOpen(false); toast.success('Holiday hours saved');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to save holiday hours. Check for an existing entry on this date.'); }
    finally { setSaving(false); }
  };
  const remove = async (id: string) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('business_special_hours').delete().eq('id', id);
      if (error) throw error;
      await refresh(); toast.success('Holiday hours removed');
    } catch { toast.error('Unable to remove holiday hours'); }
    finally { setSaving(false); }
  };
  if (!merchantId && !vetId) return null;
  return <section className="space-y-4 border-t pt-4">
    <div className="flex items-center justify-between gap-3">
      <h3 className="font-semibold flex items-center gap-2"><CalendarDays className="h-4 w-4 shrink-0" />Holiday & Special Hours</h3>
      <Button type="button" size="sm" variant="outline" onClick={() => startEdit()}><Plus className="h-4 w-4 mr-1" />Add Date</Button>
    </div>
    {query.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : query.isError ?
      <div className="text-destructive text-sm">Unable to load holiday hours. <Button type="button" variant="link" onClick={() => query.refetch()}>Retry</Button></div> :
      !query.data?.length ? <p className="text-muted-foreground text-sm">No holiday or special hours set.</p> :
      query.data.map(entry => <div key={entry.id} className="flex items-start justify-between gap-2 border-b pb-3">
        <div className="min-w-0 space-y-1">
          <p className="font-medium break-words">{entry.label || 'Special date'} · {formatDateOnly(entry.special_date)}</p>
          <div className="flex flex-wrap gap-2"><Badge variant={entry.is_closed ? 'destructive' : 'secondary'}>{entry.is_closed ? 'Closed all day' : 'Special hours'}</Badge>{entry.repeat_annually && <Badge variant="outline">Repeats annually</Badge>}</div>
          {!entry.is_closed && <p className="text-sm text-muted-foreground">{entry.windows.map(w => `${formatMerchantTime(w.start_time)}–${formatMerchantTime(w.end_time)}`).join(' · ')}</p>}
        </div>
        <div className="flex shrink-0"><Button type="button" variant="ghost" size="icon" aria-label="Edit holiday hours" disabled={saving} onClick={() => startEdit(entry)}><Pencil className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" aria-label="Remove holiday hours" disabled={saving} onClick={() => remove(entry.id)}><Trash2 className="h-4 w-4" /></Button></div>
      </div>)}
    <Dialog open={open} onOpenChange={value => { if (!saving) setOpen(value); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Add'} Holiday & Special Hours</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label htmlFor="holiday-date">Date</Label><Input id="holiday-date" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="holiday-label">Holiday name (optional)</Label><Input id="holiday-label" maxLength={100} value={label} onChange={e => setLabel(e.target.value)} placeholder="Christmas Eve" /></div>
          <div className="flex justify-between items-center"><Label htmlFor="holiday-closed">Closed all day</Label><Switch id="holiday-closed" checked={closed} onCheckedChange={setClosed} /></div>
          <div className="flex justify-between items-center"><Label htmlFor="holiday-annual">Repeat annually on this date</Label><Switch id="holiday-annual" checked={annual} onCheckedChange={setAnnual} /></div>
          {!closed && <div className="space-y-3">
            {windows.map((w, i) => <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
              {(['start_time', 'end_time'] as const).map(field => <div key={field} className="min-w-0 space-y-1"><Label htmlFor={`window-${i}-${field}`}>{field === 'start_time' ? 'Start' : 'End'}</Label><Input id={`window-${i}-${field}`} aria-label={`Window ${i + 1} ${field === 'start_time' ? 'start' : 'end'}`} type="time" className="min-w-0" value={w[field]} onChange={e => setWindows(prev => prev.map((v, n) => n === i ? { ...v, [field]: e.target.value } : v))} /></div>)}
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove window ${i + 1}`} onClick={() => setWindows(prev => prev.filter((_, n) => n !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>)}
            <Button type="button" variant="outline" size="sm" onClick={() => setWindows(prev => [...prev, { start_time: '14:00', end_time: '17:00' }])}><Plus className="h-4 w-4 mr-1" />Add open window</Button>
          </div>}
        </div>
        <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancel</Button><Button type="button" disabled={saving || !date || (!closed && !!validateOpenWindows(windows))} onClick={save}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Holiday Hours</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}