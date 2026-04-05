import { useState, useEffect } from "react";
import { ArrowLeft, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface LineItem {
  id?: string;
  description: string;
  quantity: string;
  unit_price: string;
  display_order: number;
}

interface Props {
  invoice?: any;
  onSave: () => void;
  onCancel: () => void;
}

export function AdminInvoiceForm({ invoice, onSave, onCancel }: Props) {
  const { user } = useAuth();
  const isEdit = !!invoice;

  const [saving, setSaving] = useState(false);
  const [recipientType, setRecipientType] = useState(invoice?.recipient_type || "merchant");
  const [recipientId, setRecipientId] = useState(invoice?.recipient_id || "");
  const [recipientName, setRecipientName] = useState(invoice?.recipient_name || "");
  const [recipientEmail, setRecipientEmail] = useState(invoice?.recipient_email || "");
  const [title, setTitle] = useState(invoice?.title || "");
  const [invoiceType, setInvoiceType] = useState(invoice?.invoice_type || "ad_hoc");
  const [dueDate, setDueDate] = useState(invoice?.due_date || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [taxRate, setTaxRate] = useState(String(invoice?.tax_rate || 0));
  const [discountAmount, setDiscountAmount] = useState(String(invoice?.discount_amount || 0));
  const [notes, setNotes] = useState(invoice?.notes || "");
  const [termsConditions, setTermsConditions] = useState(invoice?.terms_conditions || "Payment is due within 30 days of invoice date. Late payments may incur a 1.5% monthly fee.");
  const [items, setItems] = useState<LineItem[]>([
    { description: "", quantity: "1", unit_price: "", display_order: 0 },
  ]);

  const [merchants, setMerchants] = useState<any[]>([]);
  const [vets, setVets] = useState<any[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(true);

  useEffect(() => {
    loadRecipients();
    if (isEdit) loadItems();
  }, []);

  const loadRecipients = async () => {
    setLoadingRecipients(true);
    const [{ data: m }, { data: v }] = await Promise.all([
      supabase.from("merchants").select("id, business_name, email, user_id"),
      supabase.from("partner_vets").select("id, clinic_name, contact_email, user_id"),
    ]);
    setMerchants(m || []);
    setVets(v || []);
    setLoadingRecipients(false);
  };

  const loadItems = async () => {
    const { data } = await supabase
      .from("admin_invoice_items")
      .select("*")
      .eq("invoice_id", invoice.id)
      .order("display_order");
    if (data && data.length > 0) {
      setItems(data.map((it: any) => ({
        id: it.id,
        description: it.description,
        quantity: String(it.quantity),
        unit_price: String(it.unit_price),
        display_order: it.display_order,
      })));
    }
  };

  const handleRecipientSelect = (id: string) => {
    setRecipientId(id);
    if (recipientType === "merchant") {
      const m = merchants.find((x) => x.id === id);
      if (m) { setRecipientName(m.business_name); setRecipientEmail(m.email || ""); }
    } else {
      const v = vets.find((x) => x.id === id);
      if (v) { setRecipientName(v.clinic_name); setRecipientEmail(v.contact_email || ""); }
    }
  };

  const addItem = () => {
    setItems([...items, { description: "", quantity: "1", unit_price: "", display_order: items.length }]);
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof LineItem, value: string) => {
    setItems(items.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const subtotal = items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0);
  const discount = parseFloat(discountAmount) || 0;
  const tax = (subtotal - discount) * ((parseFloat(taxRate) || 0) / 100);
  const total = subtotal - discount + tax;

  const handleSave = async (asDraft = true) => {
    if (!recipientId || !recipientName) {
      toast.error("Please select a recipient");
      return;
    }
    if (!asDraft && !recipientEmail) {
      toast.error("Recipient has no email address on file");
      return;
    }
    if (items.every(it => !it.description && !it.unit_price)) {
      toast.error("Please add at least one line item");
      return;
    }

    setSaving(true);
    try {
      let invoiceId = invoice?.id;
      let invoiceReadyForSend = false;

      if (isEdit) {
        const { error } = await supabase
          .from("admin_invoices")
          .update({
            recipient_type: recipientType,
            recipient_id: recipientId,
            recipient_name: recipientName,
            recipient_email: recipientEmail || null,
            title: title || null,
            invoice_type: invoiceType,
            due_date: dueDate,
            tax_rate: parseFloat(taxRate) || 0,
            discount_amount: discount,
            notes: notes || null,
            terms_conditions: termsConditions || null,
            status: "draft",
          })
          .eq("id", invoiceId);
        if (error) throw error;

        // Delete existing items and re-insert
        await supabase.from("admin_invoice_items").delete().eq("invoice_id", invoiceId);
      } else {
        // Generate invoice number
        const { data: numData } = await supabase.rpc("generate_admin_invoice_number");
        const invoiceNumber = numData || `ADM-${Date.now()}`;

        const { data: newInv, error } = await supabase
          .from("admin_invoices")
          .insert({
            invoice_number: invoiceNumber,
            recipient_type: recipientType,
            recipient_id: recipientId,
            recipient_name: recipientName,
            recipient_email: recipientEmail || null,
            title: title || null,
            invoice_type: invoiceType,
            issue_date: new Date().toISOString().slice(0, 10),
            due_date: dueDate,
            tax_rate: parseFloat(taxRate) || 0,
            discount_amount: discount,
            notes: notes || null,
            terms_conditions: termsConditions || null,
            status: "draft",
            created_by: user?.id || "",
          })
          .select("id")
          .single();
        if (error) throw error;
        invoiceId = newInv.id;
      }

      // Insert items
      const validItems = items.filter(it => it.description.trim() || parseFloat(it.unit_price) > 0);
      if (validItems.length > 0) {
        const { error: itemsError } = await supabase.from("admin_invoice_items").insert(
          validItems.map((it, idx) => ({
            invoice_id: invoiceId,
            description: it.description || "Item",
            quantity: parseFloat(it.quantity) || 1,
            unit_price: parseFloat(it.unit_price) || 0,
            display_order: idx,
          }))
        );
        if (itemsError) throw itemsError;
      }

      invoiceReadyForSend = true;

      if (!asDraft) {
        const { data, error } = await supabase.functions.invoke("send-admin-invoice-email", {
          body: { invoiceId },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }

      toast.success(
        asDraft
          ? isEdit ? "Invoice updated!" : "Invoice saved as draft!"
          : isEdit ? "Invoice updated and sent!" : "Invoice created and sent!"
      );
      onSave();
    } catch (err: any) {
      if (!asDraft && invoiceReadyForSend) {
        toast.error(err.message || "Invoice was saved as draft, but the email could not be sent");
        onSave();
        return;
      }
      toast.error(err.message || "Failed to save invoice");
    } finally {
      setSaving(false);
    }
  };

  const recipientList = recipientType === "merchant" ? merchants : vets;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <h2 className="text-lg font-semibold">{isEdit ? "Edit Invoice" : "Create New Invoice"}</h2>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: Recipient & Details */}
        <Card>
          <CardHeader><CardTitle className="text-base">Invoice Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Recipient Type</Label>
                <Select value={recipientType} onValueChange={(v) => { setRecipientType(v); setRecipientId(""); setRecipientName(""); setRecipientEmail(""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="merchant">Merchant</SelectItem>
                    <SelectItem value="vet">Veterinarian</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Invoice Type</Label>
                <Select value={invoiceType} onValueChange={setInvoiceType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="platform_fee">Platform Fee</SelectItem>
                    <SelectItem value="subscription">Subscription</SelectItem>
                    <SelectItem value="ad_hoc">Ad-hoc</SelectItem>
                    <SelectItem value="commission">Commission</SelectItem>
                    <SelectItem value="onboarding">Onboarding</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Select {recipientType === "merchant" ? "Merchant" : "Vet"}</Label>
              <Select value={recipientId} onValueChange={handleRecipientSelect} disabled={loadingRecipients}>
                <SelectTrigger><SelectValue placeholder={loadingRecipients ? "Loading..." : `Choose a ${recipientType}...`} /></SelectTrigger>
                <SelectContent>
                  {recipientList.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>
                      {recipientType === "merchant" ? r.business_name : r.clinic_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {recipientName && (
              <div className="text-sm p-3 rounded-md bg-muted/50">
                <p className="font-medium">{recipientName}</p>
                {recipientEmail && <p className="text-muted-foreground">{recipientEmail}</p>}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Title / Subject</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Monthly Platform Fees - March 2026" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Tax Rate (%)</Label>
                <Input type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} min="0" max="100" step="0.01" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Discount ($)</Label>
              <Input type="number" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} min="0" step="0.01" />
            </div>
          </CardContent>
        </Card>

        {/* Right: Notes & Terms */}
        <Card>
          <CardHeader><CardTitle className="text-base">Notes & Terms</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Notes (visible to recipient)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Add any notes for this invoice..." />
            </div>
            <div className="space-y-1.5">
              <Label>Terms & Conditions</Label>
              <Textarea value={termsConditions} onChange={(e) => setTermsConditions(e.target.value)} rows={4} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Line Items</CardTitle>
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus className="w-4 h-4 mr-1" /> Add Item
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_100px_120px_120px_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
              <span>Description</span>
              <span>Qty</span>
              <span>Rate ($)</span>
              <span>Amount</span>
              <span></span>
            </div>
            {items.map((item, idx) => {
              const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
              return (
                <div key={idx} className="grid grid-cols-[1fr_100px_120px_120px_40px] gap-2 items-center">
                  <Input value={item.description} onChange={(e) => updateItem(idx, "description", e.target.value)} placeholder="Description" />
                  <Input type="number" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} min="0" step="1" />
                  <Input type="number" value={item.unit_price} onChange={(e) => updateItem(idx, "unit_price", e.target.value)} min="0" step="0.01" />
                  <div className="text-sm font-medium text-right pr-2">${lineTotal.toFixed(2)}</div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(idx)} disabled={items.length <= 1}>
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div className="mt-6 flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
              {discount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-${discount.toFixed(2)}</span></div>}
              {tax > 0 && <div className="flex justify-between"><span>Tax ({taxRate}%)</span><span>${tax.toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold text-base border-t pt-2"><span>Total</span><span>${total.toFixed(2)}</span></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button variant="secondary" onClick={() => handleSave(true)} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save as Draft
        </Button>
        <Button onClick={() => handleSave(false)} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isEdit ? "Update & Send" : "Create & Send"}
        </Button>
      </div>
    </div>
  );
}
