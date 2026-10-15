import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMerchantContext } from "@/hooks/useMerchantContext";
import { MerchantWorkspaceLayout } from "@/components/merchant/workspace/MerchantWorkspaceLayout";
import { BarcodeScannerModal } from "@/components/merchant/pos/BarcodeScannerModal";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Minus, Plus, Trash2, ScanLine, Search, Pencil, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { addToTicket, computeTicketTotals, type TicketLine } from "@/lib/posTicket";
import { Formatters } from "@/utils/formatters";

type PosItem = {
  id: string; name: string; sku: string | null; barcode: string | null; category: string | null;
  price: number; stock_quantity: number | null; is_active: boolean;
};
type Sale = { id: string; total: number; payment_method: string; customer_name: string | null; created_at: string };

const money = (n: number) => Formatters.currency(n);
const emptyItem = { id: "", name: "", sku: "", barcode: "", category: "", price: 0, stock_quantity: null, is_active: true } as unknown as PosItem;

export default function MerchantPOSTerminal() {
  const { merchantId, loading: ctxLoading } = useMerchantContext();
  const [items, setItems] = useState<PosItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [ticket, setTicket] = useState<TicketLine[]>([]);
  const [search, setSearch] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [customer, setCustomer] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [checkingOut, setCheckingOut] = useState(false);
  const [editing, setEditing] = useState<PosItem | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!merchantId) return;
    const [{ data: it }, { data: sl }] = await Promise.all([
      supabase.from("merchant_pos_items").select("*").eq("merchant_id", merchantId).order("name"),
      supabase.from("merchant_pos_sales").select("id,total,payment_method,customer_name,created_at").eq("merchant_id", merchantId).order("created_at", { ascending: false }).limit(50),
    ]);
    setItems((it || []).map((i: any) => ({ ...i, price: Number(i.price) })));
    setSales((sl || []).map((s: any) => ({ ...s, total: Number(s.total) })));
  }, [merchantId]);
  useEffect(() => { load(); }, [load]);

  const active = items.filter((i) => i.is_active);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return active;
    return active.filter((i) => [i.name, i.sku, i.barcode, i.category].some((v) => v?.toLowerCase().includes(q)));
  }, [active, search]);

  const add = (i: PosItem) => setTicket((t) => addToTicket(t, { item_id: i.id, name: i.name, price: i.price }));
  const setQty = (id: string, q: number) =>
    setTicket((t) => (q <= 0 ? t.filter((l) => l.item_id !== id) : t.map((l) => (l.item_id === id ? { ...l, quantity: q } : l))));

  const handleScan = useCallback((code: string) => {
    const hit = items.find((i) => i.is_active && (i.barcode === code || i.sku === code));
    if (!hit) return null;
    setTicket((t) => addToTicket(t, { item_id: hit.id, name: hit.name, price: hit.price }));
    return hit.name;
  }, [items]);

  const totals = computeTicketTotals(ticket, discount, taxRate);

  const checkout = async () => {
    if (!merchantId || ticket.length === 0) return;
    setCheckingOut(true);
    const { error } = await supabase.rpc("complete_pos_sale", {
      _merchant_id: merchantId,
      _items: ticket.map((l) => ({ item_id: l.item_id, quantity: l.quantity })),
      _payment_method: payMethod, _discount: discount, _tax_rate: taxRate,
      _customer_name: customer || null,
    });
    setCheckingOut(false);
    if (error) return toast.error(`Sale not saved: ${error.message}`);
    toast.success(`Sale completed — ${money(totals.total)}`);
    setTicket([]); setDiscount(0); setCustomer("");
    load();
  };

  const saveItem = async () => {
    if (!editing || !merchantId || !editing.name.trim()) return;
    setSaving(true);
    const row = {
      merchant_id: merchantId, name: editing.name.trim(), sku: editing.sku || null, barcode: editing.barcode || null,
      category: editing.category || null, price: Number(editing.price) || 0,
      stock_quantity: editing.stock_quantity === null || (editing.stock_quantity as any) === "" ? null : Number(editing.stock_quantity),
      is_active: editing.is_active, updated_at: new Date().toISOString(),
    };
    const { error } = editing.id
      ? await supabase.from("merchant_pos_items").update(row).eq("id", editing.id)
      : await supabase.from("merchant_pos_items").insert(row);
    setSaving(false);
    if (error) return toast.error(error.message.includes("barcode_uniq") ? "Another item already uses this barcode" : error.message);
    toast.success("Item saved"); setEditing(null); load();
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    const { error } = await supabase.from("merchant_pos_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <>
      <SEO title="POS Terminal · PawBucks" description="Ring up sales and scan items." />
      <MerchantWorkspaceLayout>
        <div className="max-w-7xl mx-auto space-y-4">
          <h1 className="text-2xl font-bold">POS Terminal</h1>
          {ctxLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : !merchantId ? <p>No business account found.</p> : (
          <Tabs defaultValue="register">
            <TabsList>
              <TabsTrigger value="register">Register</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="sales">Sales</TabsTrigger>
            </TabsList>

            <TabsContent value="register" className="grid lg:grid-cols-[1fr_380px] gap-4">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Search name, SKU or barcode" value={search} onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && search) { if (handleScan(search.trim())) setSearch(""); else if (filtered.length === 1) { add(filtered[0]); setSearch(""); } } }} />
                  </div>
                  <Button onClick={() => setScanOpen(true)}><ScanLine className="h-4 w-4 mr-2" />Scan</Button>
                </div>
                {active.length === 0 ? (
                  <Card className="p-8 text-center text-muted-foreground"><Package className="h-8 w-8 mx-auto mb-2" />Add items in the Inventory tab to start selling.</Card>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                    {filtered.map((i) => (
                      <button key={i.id} onClick={() => add(i)} className="text-left rounded-lg border bg-card p-3 hover:border-primary transition-colors">
                        <p className="font-medium line-clamp-2">{i.name}</p>
                        <p className="text-primary font-semibold mt-1">{money(i.price)}</p>
                        {i.stock_quantity !== null && <p className="text-xs text-muted-foreground">{i.stock_quantity} in stock</p>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Card className="p-4 space-y-3 h-fit lg:sticky lg:top-4">
                <div className="flex justify-between items-center">
                  <h2 className="font-semibold">Sale ticket</h2>
                  {ticket.length > 0 && <Button variant="ghost" size="sm" onClick={() => setTicket([])}>Clear</Button>}
                </div>
                {ticket.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Tap or scan items to add them.</p> : (
                  <div className="space-y-2 max-h-80 overflow-auto">
                    {ticket.map((l) => (
                      <div key={l.item_id} className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{l.name}</p>
                          <p className="text-xs text-muted-foreground">{money(l.price)} each</p>
                        </div>
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(l.item_id, l.quantity - 1)} aria-label="Decrease"><Minus className="h-3 w-3" /></Button>
                        <span className="w-6 text-center text-sm">{l.quantity}</span>
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(l.item_id, l.quantity + 1)} aria-label="Increase"><Plus className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setQty(l.item_id, 0)} aria-label="Remove"><Trash2 className="h-3 w-3 text-destructive" /></Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Discount ($)</Label><Input type="number" min={0} step="0.01" value={discount || ""} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} /></div>
                  <div><Label className="text-xs">Tax rate (%)</Label><Input type="number" min={0} max={25} step="0.001" value={taxRate || ""} onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)} /></div>
                </div>
                <Input placeholder="Customer name (optional)" value={customer} onChange={(e) => setCustomer(e.target.value)} />
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card_external">Card (external reader)</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-sm space-y-1 border-t pt-2">
                  <div className="flex justify-between"><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>
                  {totals.discount > 0 && <div className="flex justify-between"><span>Discount</span><span>-{money(totals.discount)}</span></div>}
                  {totals.tax > 0 && <div className="flex justify-between"><span>Tax</span><span>{money(totals.tax)}</span></div>}
                  <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{money(totals.total)}</span></div>
                </div>
                <Button className="w-full" size="lg" disabled={ticket.length === 0 || checkingOut} onClick={checkout}>
                  {checkingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : `Complete sale · ${money(totals.total)}`}
                </Button>
              </Card>
            </TabsContent>

            <TabsContent value="inventory" className="space-y-3">
              <Button onClick={() => setEditing({ ...emptyItem })}><Plus className="h-4 w-4 mr-2" />Add item</Button>
              <div className="space-y-2">
                {items.map((i) => (
                  <Card key={i.id} className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{i.name} {!i.is_active && <Badge variant="secondary">Hidden</Badge>}</p>
                      <p className="text-xs text-muted-foreground">{[i.category, i.sku && `SKU ${i.sku}`, i.barcode && `Barcode ${i.barcode}`].filter(Boolean).join(" · ") || "No codes"}</p>
                    </div>
                    <span className="text-sm">{i.stock_quantity ?? "∞"} in stock</span>
                    <span className="font-semibold w-20 text-right">{money(i.price)}</span>
                    <Button size="icon" variant="ghost" onClick={() => setEditing(i)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteItem(i.id)} aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </Card>
                ))}
                {items.length === 0 && <p className="text-muted-foreground text-sm">No items yet.</p>}
              </div>
            </TabsContent>

            <TabsContent value="sales" className="space-y-2">
              {sales.length === 0 && <p className="text-muted-foreground text-sm">No sales yet.</p>}
              {sales.map((s) => (
                <Card key={s.id} className="p-3 flex justify-between">
                  <div>
                    <p className="font-medium">{s.customer_name || "Walk-in customer"}</p>
                    <p className="text-xs text-muted-foreground">{Formatters.dateTime ? Formatters.dateTime(s.created_at) : new Date(s.created_at).toLocaleString("en-US", { timeZone: "America/New_York" })} · {s.payment_method === "card_external" ? "Card" : s.payment_method === "cash" ? "Cash" : "Other"}</p>
                  </div>
                  <span className="font-semibold">{money(s.total)}</span>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
          )}
        </div>
      </MerchantWorkspaceLayout>

      <BarcodeScannerModal open={scanOpen} onClose={() => setScanOpen(false)} onScan={handleScan} />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit item" : "New item"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Price ($)</Label><Input type="number" min={0} step="0.01" value={editing.price} onChange={(e) => setEditing({ ...editing, price: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label>Stock (blank = unlimited)</Label><Input type="number" min={0} value={editing.stock_quantity ?? ""} onChange={(e) => setEditing({ ...editing, stock_quantity: e.target.value === "" ? null : parseInt(e.target.value) })} /></div>
              <div><Label>Category</Label><Input value={editing.category || ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></div>
              <div><Label>SKU</Label><Input value={editing.sku || ""} onChange={(e) => setEditing({ ...editing, sku: e.target.value })} /></div>
              <div className="col-span-2"><Label>Barcode / UPC</Label><Input value={editing.barcode || ""} onChange={(e) => setEditing({ ...editing, barcode: e.target.value })} /></div>
              <label className="col-span-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> Show on register
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveItem} disabled={saving || !editing?.name.trim()}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
