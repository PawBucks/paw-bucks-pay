export type PosReceiptLine = { name: string; line_total: number | string; quantity: number; unit_price: number | string };
export function posReceiptItems(lines: PosReceiptLine[], sale: { discount: number | string; tax: number | string; tip: number | string }) {
  const items = lines.map((line) => ({ name: line.name, price: Number(line.line_total), qty: Number(line.quantity), unit_price: Number(line.unit_price) }));
  if (Number(sale.discount) > 0) items.push({ name: "Discount", price: -Number(sale.discount), qty: 1, unit_price: -Number(sale.discount) });
  if (Number(sale.tax) > 0) items.push({ name: "Sales tax", price: Number(sale.tax), qty: 1, unit_price: Number(sale.tax) });
  if (Number(sale.tip) > 0) items.push({ name: "Tip", price: Number(sale.tip), qty: 1, unit_price: Number(sale.tip) });
  return items;
}