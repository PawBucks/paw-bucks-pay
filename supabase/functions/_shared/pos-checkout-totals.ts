/** Saved ticket base stays authoritative; a customer's USD tip replaces, never adds to, the saved tip. */
export function posCheckoutTotals(sale: { total: number | string; tip: number | string; tax: number | string }, selectedTip: number) {
  if (!Number.isFinite(selectedTip) || selectedTip < 0 || selectedTip > 10000) throw new Error("Invalid tip amount");
  const baseCents = Math.round(Number(sale.total) * 100) - Math.round(Number(sale.tip || 0) * 100);
  const tipCents = Math.round(selectedTip * 100);
  const taxCents = Math.round(Number(sale.tax || 0) * 100);
  const amountCents = baseCents + tipCents;
  const successFeeCents = Math.round(Math.max(0, baseCents - taxCents) * 0.03);
  return { tip: tipCents / 100, total: amountCents / 100, amountCents, tipCents, taxCents, successFeeCents };
}