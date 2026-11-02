import { describe, it, expect, vi, beforeEach } from 'vitest';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
import { setBusinessDisabled } from './businessAccountStatus';

describe('business disable and restore', () => {
  beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ error: null }); });
  it('disables a merchant through the preserving status operation', async () => {
    await setBusinessDisabled({ id: 'merchant-1', kind: 'merchant', name: 'Shop', is_paused: false }, true, 'Review');
    expect(rpc).toHaveBeenCalledExactlyOnceWith('admin_set_merchant_pause', { _merchant_id: 'merchant-1', _paused: true, _reason: 'Review' });
  });
  it('disables a vet through the preserving status operation', async () => {
    await setBusinessDisabled({ id: 'vet-1', kind: 'vet', name: 'Clinic', is_paused: false }, true, 'Review');
    expect(rpc).toHaveBeenCalledExactlyOnceWith('admin_set_vet_pause', { _vet_id: 'vet-1', _paused: true, _reason: 'Review' });
  });
  it('restores a disabled account', async () => {
    await setBusinessDisabled({ id: 'vet-1', kind: 'vet', name: 'Clinic', is_paused: true }, false, '');
    expect(rpc).toHaveBeenCalledExactlyOnceWith('admin_set_vet_pause', { _vet_id: 'vet-1', _paused: false, _reason: '' });
  });
  it('does not report success when authorization fails', async () => {
    rpc.mockResolvedValue({ error: new Error('Not authorized') });
    await expect(setBusinessDisabled({ id: 'merchant-1', kind: 'merchant', name: 'Shop', is_paused: false }, true, '')).rejects.toThrow('Not authorized');
  });
});