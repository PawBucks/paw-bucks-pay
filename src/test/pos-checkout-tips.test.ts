import { describe, expect, it } from 'vitest';
import { posCheckoutTotals } from '../../supabase/functions/_shared/pos-checkout-totals';
import { tipFromPercent } from '@/lib/posTicket';

describe('customer POS QR tips', () => {
  const sale = { total: 118, tip: 10, tax: 8 };
  it('replaces the cashier tip instead of adding it again', () => {
    expect(posCheckoutTotals(sale, 20)).toMatchObject({ tip: 20, total: 128, amountCents: 12800 });
  });
  it('allows the customer to choose no tip', () => {
    expect(posCheckoutTotals(sale, 0).total).toBe(108);
  });
  it('never charges the 3% Success Fee on tips or sales tax', () => {
    expect(posCheckoutTotals(sale, 20).successFeeCents).toBe(300);
    expect(posCheckoutTotals(sale, 0).successFeeCents).toBe(300);
  });
  it('uses the discounted pre-tax subtotal for 15%, 18%, and 20%', () => {
    expect([15, 18, 20].map(p => tipFromPercent(100, 20, p))).toEqual([12, 14.4, 16]);
  });
  it('keeps a custom USD tip rounded to cents', () => {
    expect(posCheckoutTotals(sale, 5.555)).toMatchObject({ tip: 5.56, total: 113.56 });
  });
  it('rejects negative and non-finite tips', () => {
    expect(() => posCheckoutTotals(sale, -1)).toThrow();
    expect(() => posCheckoutTotals(sale, NaN)).toThrow();
  });
});