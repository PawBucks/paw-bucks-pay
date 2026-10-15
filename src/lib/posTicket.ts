export type TicketLine = { item_id: string; name: string; price: number; quantity: number };

/** Mirrors the server-side complete_pos_sale math (server is the source of truth). */
export function computeTicketTotals(lines: TicketLine[], discount: number, taxRate: number) {
  const subtotal = lines.reduce((s, l) => s + Math.round(l.price * l.quantity * 100) / 100, 0);
  const disc = Math.min(Math.max(discount || 0, 0), subtotal);
  const tax = Math.round((subtotal - disc) * (taxRate || 0)) / 100;
  return { subtotal, discount: disc, tax, total: Math.round((subtotal - disc + tax) * 100) / 100 };
}

/** Adds one unit of an item, or increments an existing line. */
export function addToTicket(lines: TicketLine[], item: Omit<TicketLine, "quantity">): TicketLine[] {
  const existing = lines.find((l) => l.item_id === item.item_id);
  if (existing) return lines.map((l) => (l.item_id === item.item_id ? { ...l, quantity: l.quantity + 1 } : l));
  return [...lines, { ...item, quantity: 1 }];
}
