import { Link } from 'react-router-dom';
import { Navigation, Store, Trees, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trackCareAction } from '@/lib/careActions';

export function TaggedPlaceCard({ type, id, label }: { type: 'merchant' | 'guide_place'; id: string; label: string }) {
  const isMerchant = type === 'merchant';
  const detail = isMerchant ? `/merchant/${id}` : '/guides/pet-friendly-los-angeles';
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}`;
  const opts = { merchantId: isMerchant ? id : null, source: 'community_tag' };
  return (
    <div className="mx-4 mb-3 flex items-center gap-3 rounded-lg border bg-secondary/40 p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {isMerchant ? <Store className="h-5 w-5" /> : <Trees className="h-5 w-5" />}
      </div>
      <Link to={detail} onClick={() => trackCareAction('view', type, id, opts)} className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{isMerchant ? 'View business' : 'View in guide'}</p>
      </Link>
      <Button asChild size="sm" variant="outline">
        <a href={maps} target="_blank" rel="noopener noreferrer" onClick={() => trackCareAction('directions', type, id, opts)} aria-label={`Directions to ${label}`}>
          <Navigation className="h-4 w-4" />
        </a>
      </Button>
      <Link to={detail} aria-label={`Open ${label}`} onClick={() => trackCareAction('view', type, id, opts)}><ChevronRight className="h-4 w-4 text-muted-foreground" /></Link>
    </div>
  );
}
