import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Ban, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { setBusinessDisabled, type BusinessAccount } from '@/lib/businessAccountStatus';

export function BusinessAccountControls({ accounts, onChange }: { accounts: BusinessAccount[]; onChange: () => void }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<BusinessAccount | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await setBusinessDisabled(selected, !selected.is_paused, reason);
      toast.success(selected.is_paused ? 'Account restored' : 'Account disabled and hidden');
      setSelected(null);
      await queryClient.invalidateQueries();
      onChange();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (error as { message?: string })?.message || 'Could not change account status');
    } finally { setSaving(false); }
  };
  return <>
    <Card>
      <CardHeader><CardTitle className="text-lg">Business account status</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {accounts.map(account => <div key={`${account.kind}-${account.id}`} className="space-y-2">
          <p className="font-medium">{account.name} · {account.is_paused ? 'Disabled' : 'Active'}</p>
          <Button variant={account.is_paused ? 'outline' : 'destructive'} disabled={saving} onClick={() => { setSelected(account); setReason(''); }}>
            {account.is_paused ? <RotateCcw className="mr-2 h-4 w-4" /> : <Ban className="mr-2 h-4 w-4" />}
            {account.is_paused ? 'Restore Account' : 'Disable & Hide Account'}
          </Button>
        </div>)}
      </CardContent>
    </Card>
    <AlertDialog open={!!selected} onOpenChange={open => { if (!open && !saving) setSelected(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{selected?.is_paused ? 'Restore' : 'Disable'} {selected?.name}?</AlertDialogTitle>
          <AlertDialogDescription>{selected?.is_paused
            ? 'The approved business will become publicly visible again.'
            : 'This business will be hidden from public listings and profiles. Financial history, bookings, customer records and the owner’s account are preserved. You can restore it later.'}</AlertDialogDescription>
        </AlertDialogHeader>
        {!selected?.is_paused && <div className="space-y-2"><Label htmlFor="business-disable-reason">Reason (optional)</Label><Textarea id="business-disable-reason" maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></div>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={saving} onClick={event => { event.preventDefault(); void save(); }}>{saving ? 'Saving…' : selected?.is_paused ? 'Restore Account' : 'Disable & Hide Account'}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}