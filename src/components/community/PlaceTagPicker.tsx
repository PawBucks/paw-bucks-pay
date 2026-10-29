import { useEffect, useState } from 'react';
import { Store, Trees, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';

export type PlaceTag = { type: 'merchant' | 'guide_place'; id: string; label: string };

export function PlaceTagPicker({ value, onChange }: { value: PlaceTag | null; onChange: (t: PlaceTag | null) => void }) {
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 250);
  const [results, setResults] = useState<PlaceTag[]>([]);
  useEffect(() => {
    const term = dq.trim().replace(/[%,()]/g, '');
    if (term.length < 2) { setResults([]); return; }
    let live = true;
    Promise.all([
      supabase.from('merchants').select('id,business_name').ilike('business_name', `%${term}%`).limit(5),
      supabase.from('guide_places').select('id,name').eq('is_active', true).ilike('name', `%${term}%`).limit(5),
    ]).then(([m, g]) => {
      if (!live) return;
      setResults([
        ...(g.data || []).map((p) => ({ type: 'guide_place' as const, id: p.id, label: p.name })),
        ...(m.data || []).map((p) => ({ type: 'merchant' as const, id: p.id, label: p.business_name })),
      ]);
    });
    return () => { live = false; };
  }, [dq]);

  if (value) return (
    <div><Label>Tagged place</Label>
      <div className="flex items-center gap-2 rounded-md border p-2 text-sm">
        {value.type === 'merchant' ? <Store className="h-4 w-4 text-primary" /> : <Trees className="h-4 w-4 text-primary" />}
        <span className="flex-1 truncate">{value.label}</span>
        <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Remove tag" onClick={() => onChange(null)}><X className="h-3 w-3" /></Button>
      </div>
    </div>
  );
  return (
    <div className="relative"><Label htmlFor="post-tag">Tag a place or business (optional)</Label>
      <Input id="post-tag" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Dog park, groomer, café…" maxLength={80} />
      {results.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md max-h-60 overflow-auto">
          {results.map((r) => (
            <li key={r.type + r.id}>
              <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => { onChange(r); setQ(''); setResults([]); }}>
                {r.type === 'merchant' ? <Store className="h-4 w-4" /> : <Trees className="h-4 w-4" />}
                <span className="truncate">{r.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">{r.type === 'merchant' ? 'Business' : 'Place'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
