import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { addWeeks, addMonths, addYears } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarClock, FileText, LayoutTemplate, Package, Plus, Settings, Users } from "lucide-react";
import { MerchantWorkspaceLayout, WorkspacePageHeader } from "@/components/merchant/workspace/MerchantWorkspaceLayout";
import { toast } from"sonner";
import { InvoiceList, InvoiceEditor, InvoicePreview, ClientManager, InvoiceSettingsComponent, CatalogManager, TemplateManager, ScheduledInvoices } from"@/components/invoicing";
import { RecordPaymentDialog } from"@/components/invoicing/RecordPaymentDialog";
import { DeleteRecurringInvoiceDialog, type RecurringDeleteChoice } from"@/components/invoicing/DeleteRecurringInvoiceDialog";
import { invoicingService, type Invoice, type InvoiceItem, type InvoiceClient, type InvoiceSettings, type InvoiceTemplate, type CatalogItem, type InvoicePayment, type InvoiceRecipient } from"@/services/api/invoicing.service";

// Helper function to calculate next invoice date based on interval
function calculateNextInvoiceDate(fromDate: Date, interval: string): Date {
 switch (interval) {
 case"weekly":
 return addWeeks(fromDate, 1);
 case"biweekly":
 return addWeeks(fromDate, 2);
 case"monthly":
 return addMonths(fromDate, 1);
 case"quarterly":
 return addMonths(fromDate, 3);
 case"yearly":
 return addYears(fromDate, 1);
 default:
 return addMonths(fromDate, 1);
 }
}

// Turn Postgres/PostgREST errors from an invoice delete into a friendly toast
// message. The `protect_paid_invoice_delete` trigger raises detailed messages
// explaining why a row can't be removed (payments applied, transactions
// reference it, etc.) — surface those instead of a generic failure string.
function getInvoiceDeleteErrorMessage(error: unknown): string {
 const msg = (error as { message?: string } | null)?.message ?? "";
 if (msg.includes("Cannot delete invoice")) return msg;
 if (msg.includes("has payments applied")) return msg;
 if (msg.includes("payment record")) return msg;
 if (msg.includes("transaction")) return msg;
 if (msg.includes("foreign key") || msg.includes("violates foreign key")) {
 return "This invoice is referenced by other records and can't be deleted. Void or refund it instead.";
 }
 return "Failed to delete invoice";
}

const MerchantInvoicing = () => {
 const { user, loading: authLoading } = useAuth();
 const navigate = useNavigate();
 const [merchantId, setMerchantId] = useState<string | null>(null);
 const [merchant, setMerchant] = useState<any>(null);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [activeTab, setActiveTab] = useState("invoices");
 
 // View states
 const [viewMode, setViewMode] = useState<"list" |"create" |"edit" |"preview">("list");
 const [selectedInvoice, setSelectedInvoice] = useState<(Invoice & { items?: InvoiceItem[]; recipients?: InvoiceRecipient[] }) | null>(null);
 const [previewData, setPreviewData] = useState<{ invoice: Invoice; items: InvoiceItem[]; recipients?: InvoiceRecipient[] } | null>(null);
 
 // Data
 const [invoices, setInvoices] = useState<Invoice[]>([]);
 const [clients, setClients] = useState<InvoiceClient[]>([]);
 const [settings, setSettings] = useState<InvoiceSettings | null>(null);
 const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
 const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
 const [nextInvoiceNumber, setNextInvoiceNumber] = useState<string>("INV-00001");
 
 // Record payment dialog state
 const [recordPaymentInvoice, setRecordPaymentInvoice] = useState<Invoice | null>(null);
 const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);

 // Delete recurring invoice dialog state
 const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
 const [deleteTargetInvoice, setDeleteTargetInvoice] = useState<Invoice | null>(null);
 const [isDeleting, setIsDeleting] = useState(false);

  // Build a human-readable list of changes between the old invoice/items and the new form data/items.
  const buildInvoiceChanges = (
    oldInv: Invoice & { items?: InvoiceItem[] },
    newData: any,
    newItems: any[],
    newTotal: number,
  ): string[] => {
    const changes: string[] = [];
    const fmtMoney = (v: any) => `$${Number(v || 0).toFixed(2)}`;
    const cmpStr = (label: string, oldV: any, newV: any) => {
      const a = (oldV ?? "").toString().trim();
      const b = (newV ?? "").toString().trim();
      if (a !== b) changes.push(`${label}: "${a || "—"}" → "${b || "—"}"`);
    };
    const cmpDate = (label: string, oldV: any, newV: any) => {
      const a = (oldV ?? "").toString().slice(0, 10);
      const b = (newV ?? "").toString().slice(0, 10);
      if (a !== b) changes.push(`${label}: ${a || "—"} → ${b || "—"}`);
    };
    const cmpNum = (label: string, oldV: any, newV: any, money = false) => {
      const a = Number(oldV || 0);
      const b = Number(newV || 0);
      if (Math.abs(a - b) > 0.001) {
        changes.push(`${label}: ${money ? fmtMoney(a) : a} → ${money ? fmtMoney(b) : b}`);
      }
    };

    cmpStr("Title", oldInv.title, newData.title);
    cmpStr("Client name", oldInv.client_name, newData.client_name);
    cmpStr("Client email", oldInv.client_email, newData.client_email);
    cmpDate("Issue date", oldInv.issue_date, newData.issue_date);
    cmpDate("Due date", oldInv.due_date, newData.due_date);
    cmpNum("Tax rate", oldInv.tax_rate, newData.tax_rate);
    cmpNum("Shipping", oldInv.shipping_amount, newData.shipping_amount, true);
    cmpNum("Total", oldInv.total, newTotal, true);
    cmpStr("Notes", oldInv.notes, newData.notes);

    // Items diff (by sort_order position)
    const oldItems = [...(oldInv.items || [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
    const max = Math.max(oldItems.length, newItems.length);
    for (let i = 0; i < max; i++) {
      const o = oldItems[i];
      const n = newItems[i];
      if (o && !n) {
        changes.push(`Removed item: "${o.description}" (${o.quantity} × ${fmtMoney(o.unit_price)})`);
      } else if (!o && n) {
        changes.push(`Added item: "${n.description}" (${n.quantity} × ${fmtMoney(n.unit_price)})`);
      } else if (o && n) {
        const diffs: string[] = [];
        if ((o.description || "") !== (n.description || "")) {
          diffs.push(`description "${o.description}" → "${n.description}"`);
        }
        if (Number(o.quantity) !== Number(n.quantity)) {
          diffs.push(`qty ${Number(o.quantity)} → ${Number(n.quantity)}`);
        }
        if (Math.abs(Number(o.unit_price) - Number(n.unit_price)) > 0.001) {
          diffs.push(`rate ${fmtMoney(o.unit_price)} → ${fmtMoney(n.unit_price)}`);
        }
        if (diffs.length > 0) {
          changes.push(`Item "${n.description || o.description}": ${diffs.join(", ")}`);
        }
      }
    }

    return changes;
  };

 useEffect(() => {
 if (!authLoading && !user) {
 navigate("/auth");
 }
 }, [user, authLoading, navigate]);

 const loadMerchant = useCallback(async () => {
 if (!user) return;
 
 try {
 const { data, error } = await supabase
 .from("merchants")
 .select("*")
 .eq("user_id", user.id)
 .single();

 if (error) {
 if (error.code ==="PGRST116") {
 navigate("/merchant-onboarding");
 return;
 }
 throw error;
 }

 setMerchant(data);
 setMerchantId(data.id);
 } catch (error) {
 console.error("Error loading merchant:", error);
 toast.error("Failed to load merchant data");
 }
 }, [user, navigate]);

 const loadData = useCallback(async () => {
 if (!merchantId) return;
 
 setLoading(true);
 try {
 const [invoicesRes, clientsRes, settingsRes, templatesRes, catalogRes] = await Promise.all([
 invoicingService.getInvoices(merchantId),
 invoicingService.getClients(merchantId),
 invoicingService.getSettings(merchantId),
 invoicingService.getTemplates(merchantId),
 invoicingService.getCatalogItems(merchantId),
 ]);

 if (invoicesRes.data) setInvoices(invoicesRes.data);
 if (clientsRes.data) setClients(clientsRes.data);
 if (settingsRes.data) {
 setSettings(settingsRes.data);
 setNextInvoiceNumber(
 `${settingsRes.data.invoice_prefix ||"INV-"}${String(settingsRes.data.next_invoice_number || 1).padStart(5,"0")}`
 );
 }
 if (templatesRes.data) setTemplates(templatesRes.data);
 if (catalogRes.data) setCatalogItems(catalogRes.data);
 } catch (error) {
 console.error("Error loading invoicing data:", error);
 toast.error("Failed to load invoicing data");
 } finally {
 setLoading(false);
 }
 }, [merchantId]);

 useEffect(() => {
 loadMerchant();
 }, [loadMerchant]);

 useEffect(() => {
 if (merchantId) {
 loadData();
 }
 }, [merchantId, loadData]);

 // Invoice actions
 const handleCreateInvoice = () => {
 setSelectedInvoice(null);
 setViewMode("create");
 };

 const handleEditInvoice = (invoice: Invoice) => {
 // Load invoice with items
 loadInvoiceWithItems(invoice.id);
 };

 const loadInvoiceWithItems = async (invoiceId: string) => {
 try {
 const [invoiceRes, itemsRes, recipientsRes] = await Promise.all([
 invoicingService.getInvoiceById(invoiceId),
 invoicingService.getInvoiceItems(invoiceId),
 invoicingService.getInvoiceRecipients(invoiceId),
 ]);
 
 if (invoiceRes.data) {
 setSelectedInvoice({
 ...invoiceRes.data,
 items: itemsRes.data || [],
 recipients: recipientsRes.data || [],
 });
 setViewMode("edit");
 }
 } catch (error) {
 console.error("Error loading invoice:", error);
 toast.error("Failed to load invoice");
 }
 };

 const handleViewInvoice = async (invoice: Invoice) => {
 try {
 const [itemsRes, recipientsRes] = await Promise.all([
 invoicingService.getInvoiceItems(invoice.id),
 invoicingService.getInvoiceRecipients(invoice.id),
 ]);
 setPreviewData({
 invoice,
 items: itemsRes.data || [],
 recipients: recipientsRes.data || [],
 });
 setViewMode("preview");
 } catch (error) {
 console.error("Error loading invoice for preview:", error);
 toast.error("Failed to load invoice");
 }
 };

 const handleSaveInvoice = async (data: any, items: any[], recipients: any[] = []): Promise<string | null> => {
 if (!merchantId) return null;
 
 setSaving(true);
 try {
 let invoiceId: string;
 
 // Format dates - handle both Date objects and string dates
 const formatDate = (date: any): string => {
 if (date instanceof Date) {
 return date.toISOString().split("T")[0];
 }
 if (typeof date ==='string') {
 return date.split("T")[0];
 }
 return new Date().toISOString().split("T")[0];
 };
 
 // Remove'items' from data - items are stored in separate invoice_items table
 const { items: _items, ...invoiceData } = data;
 
 // Convert empty strings to null for UUID fields to prevent database errors
 const sanitizeUUID = (value: string | null | undefined) => 
 value && value.trim() !=='' ? value : null;
 
 const formattedData = {
 ...invoiceData,
 client_id: sanitizeUUID(invoiceData.client_id as string | null | undefined),
 issue_date: formatDate(invoiceData.issue_date),
 due_date: formatDate(invoiceData.due_date),
 recurring_end_date: invoiceData.recurring_end_date ? formatDate(invoiceData.recurring_end_date) : null,
 };
 
 if (selectedInvoice?.id) {
 // Update existing invoice
 invoiceId = selectedInvoice.id;
        const previousInvoice = selectedInvoice;
 
 // Calculate next_invoice_date for recurring invoices
 let nextInvoiceDateStr = null;
 if (formattedData.is_recurring && formattedData.recurring_interval) {
 const issueDate = new Date(formattedData.issue_date);
 const nextDate = calculateNextInvoiceDate(issueDate, formattedData.recurring_interval);
 nextInvoiceDateStr = nextDate.toISOString().split("T")[0];
 }
 
 const { error: updateError } = await invoicingService.updateInvoice(selectedInvoice.id, {
 ...formattedData,
 next_invoice_date: nextInvoiceDateStr,
 });
 
 if (updateError) {
 throw updateError;
 }
 
 // Delete existing items and recreate
 await supabase.from("invoice_items").delete().eq("invoice_id", selectedInvoice.id);
 
 for (const item of items) {
 await invoicingService.createInvoiceItem({
 invoice_id: selectedInvoice.id,
 description: item.description,
 quantity: item.quantity,
 unit_price: item.unit_price,
 unit_type: item.unit_type,
 discount_type: item.discount_type,
 discount_value: item.discount_value,
 tax_rate: item.tax_rate,
 });
 }

        // If this invoice was previously sent to the client (or is paid/partially_paid/etc.),
        // notify the pet owner that the invoice was modified and include what changed.
        const shouldNotify =
          !!previousInvoice.sent_at ||
          !["draft"].includes(previousInvoice.status);
        if (shouldNotify) {
          const changes = buildInvoiceChanges(
            previousInvoice,
            formattedData,
            items,
            Number(formattedData.total || 0),
          );
          if (changes.length > 0) {
            try {
              await supabase.functions.invoke("send-invoice-modified-email", {
                body: { invoiceId, changes },
              });
            } catch (notifyErr) {
              console.error("Failed to send modification notification:", notifyErr);
              toast.warning("Invoice updated, but notification email failed to send");
            }
          }
        }
 } else {
 // Create new invoice
 // Calculate next_invoice_date for recurring invoices
 let nextInvoiceDateStr = null;
 if (formattedData.is_recurring && formattedData.recurring_interval) {
 const issueDate = new Date(formattedData.issue_date);
 const nextDate = calculateNextInvoiceDate(issueDate, formattedData.recurring_interval);
 nextInvoiceDateStr = nextDate.toISOString().split("T")[0];
 }

 const invoiceRes = await invoicingService.createInvoice({
 merchant_id: merchantId,
	  // Leave blank so the DB trigger atomically assigns the next number
	  // inside the insert transaction. Prevents skipped numbers from
	  // failed/cancelled drafts.
	  invoice_number: "",
 status:"draft",
 ...formattedData,
 next_invoice_date: nextInvoiceDateStr,
 });

 if (invoiceRes.error) {
 throw invoiceRes.error;
 }
 
 if (!invoiceRes.data) {
 throw new Error("Failed to create invoice - no data returned");
 }
 
 invoiceId = invoiceRes.data.id;
 
 for (const item of items) {
 await invoicingService.createInvoiceItem({
 invoice_id: invoiceId,
 description: item.description,
 quantity: item.quantity,
 unit_price: item.unit_price,
 unit_type: item.unit_type,
 discount_type: item.discount_type,
 discount_value: item.discount_value,
 tax_rate: item.tax_rate,
 });
 }
	  // Counter is incremented by the DB trigger as part of the insert,
	  // so no client-side bump here. loadData() below refreshes settings
	  // to show the next number in the UI.
 }
 
 // Save recipients
 if (invoiceId) {
 await invoicingService.bulkUpdateRecipients(invoiceId, recipients);
 }
 
 toast.success("Invoice saved successfully");
 setViewMode("list");
 loadData();
 return invoiceId;
 } catch (error: any) {
 console.error("Error saving invoice:", error);
 toast.error(error.message ||"Failed to save invoice");
 return null;
 } finally {
 setSaving(false);
 }
 };

 const handleSendInvoice = async (data: any, items: any[], recipients: any[] = []) => {
 // First save the invoice
 const invoiceId = await handleSaveInvoice(data, items, recipients);
 
 if (!invoiceId) {
 // Save failed, error already shown
 return;
 }
 
 try {
 const { error } = await supabase.functions.invoke("send-invoice-email", {
 body: { invoiceId },
 });

 if (error) throw error;
 toast.success("Invoice sent successfully");
 setViewMode("list");
 loadData();
 } catch (error: any) {
 console.error("Error sending invoice:", error);
 toast.error(error.message ||"Invoice saved but failed to send email");
 }
 };

 const handlePreviewInvoice = (data: any, items: any[]) => {
 // Convert form data to preview format
 const previewInvoice: Invoice = {
 id: selectedInvoice?.id ||"preview",
 merchant_id: merchantId!,
 invoice_number: selectedInvoice?.invoice_number || nextInvoiceNumber,
 status: selectedInvoice?.status ||"draft",
 ...data,
 issue_date: data.issue_date.toISOString().split("T")[0],
 due_date: data.due_date.toISOString().split("T")[0],
 subtotal: items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0),
 total: 0, // Will be calculated
 amount_paid: 0,
 amount_due: 0,
 discount_amount: 0,
 tax_amount: 0,
 shipping_amount: data.shipping_amount || 0,
 currency:"USD",
 access_token:"",
 view_count: 0,
 created_at: new Date().toISOString(),
 updated_at: new Date().toISOString(),
 };
 
 setPreviewData({
 invoice: previewInvoice,
 items: items.map((item, idx) => ({
 id: item.id || `temp-${idx}`,
 invoice_id: previewInvoice.id,
 ...item,
 created_at: new Date().toISOString(),
 updated_at: new Date().toISOString(),
 })),
 });
 setViewMode("preview");
 };

 const handleSendFromList = async (invoice: Invoice) => {
 try {
 const { error } = await supabase.functions.invoke("send-invoice-email", {
 body: { invoiceId: invoice.id },
 });

 if (error) throw error;
 toast.success("Invoice sent successfully");
 loadData();
 } catch (error) {
 console.error("Error sending invoice:", error);
 toast.error("Failed to send invoice");
 }
 };

 const handleDuplicateInvoice = async (invoice: Invoice) => {
 if (!merchantId) return;
 
 try {
 const itemsRes = await invoicingService.getInvoiceItems(invoice.id);
 
 const newInvoice = await invoicingService.createInvoice({
 merchant_id: merchantId,
	  invoice_number: "", // DB trigger assigns atomically
 status:"draft",
 client_id: invoice.client_id,
 client_name: invoice.client_name,
 client_email: invoice.client_email,
 client_phone: invoice.client_phone,
 client_company: invoice.client_company,
 client_address: invoice.client_address,
 title: invoice.title,
 issue_date: new Date().toISOString().split("T")[0],
 due_date: new Date(Date.now() + ((invoice.payment_terms ?? 30) * 24 * 60 * 60 * 1000)).toISOString().split("T")[0],
 payment_terms: invoice.payment_terms,
 tax_rate: invoice.tax_rate,
 discount_type: invoice.discount_type,
 discount_value: invoice.discount_value,
 notes: invoice.notes,
 footer: invoice.footer,
 terms_conditions: invoice.terms_conditions,
 allow_partial_payments: invoice.allow_partial_payments,
 allow_tips: invoice.allow_tips,
 accept_credit_card: invoice.accept_credit_card,
 accept_bank_transfer: invoice.accept_bank_transfer,
 accept_pawbucks: invoice.accept_pawbucks,
 });

 if (newInvoice.data && itemsRes.data) {
 for (const item of itemsRes.data) {
 await invoicingService.createInvoiceItem({
 invoice_id: newInvoice.data.id,
 description: item.description,
 quantity: item.quantity,
 unit_price: item.unit_price,
 unit_type: item.unit_type,
 discount_type: item.discount_type,
 discount_value: item.discount_value,
 tax_rate: item.tax_rate,
 });
 }
 }

 toast.success("Invoice duplicated");
 loadData();
 } catch (error) {
 console.error("Error duplicating invoice:", error);
 toast.error("Failed to duplicate invoice");
 }
 };

 const handleDeleteInvoice = async (invoice: Invoice) => {
 // If recurring, show the choice dialog
 if (invoice.is_recurring || invoice.parent_invoice_id) {
 setDeleteTargetInvoice(invoice);
 setDeleteDialogOpen(true);
 return;
 }

 // Non-recurring: delete directly with confirmation
 if (!confirm("Are you sure you want to delete this invoice?")) return;

 try {
 const { error } = await invoicingService.deleteInvoice(invoice.id);
 if (error) throw error;
 toast.success("Invoice deleted");
 loadData();
 } catch (error) {
 console.error("Error deleting invoice:", error);
 toast.error(getInvoiceDeleteErrorMessage(error));
 }
 };

 const handleRecurringDeleteChoice = async (choice: RecurringDeleteChoice) => {
 if (!choice || !deleteTargetInvoice) {
 setDeleteDialogOpen(false);
 setDeleteTargetInvoice(null);
 return;
 }

 setIsDeleting(true);
 try {
 if (choice ==="this_only") {
 // Delete only this invoice, detach children first if it's a parent
 await supabase
 .from("invoices")
 .update({ parent_invoice_id: null })
 .eq("parent_invoice_id", deleteTargetInvoice.id);

 // Nullify insurance claim references
 await supabase.from("insurance_claims").update({ invoice_id: null }).eq("invoice_id", deleteTargetInvoice.id);

 const { error } = await supabase.from("invoices").delete().eq("id", deleteTargetInvoice.id);
 if (error) throw error;
 toast.success("Invoice deleted");
 } else if (choice ==="all_future") {
 // "Stop recurring": cancel the recurring schedule and remove any UNPAID
 // future invoices. Paid historical invoices are always preserved — deleting
 // rows with payments would violate the paid-invoice protection trigger and
 // destroy financial history.
 const parentId = deleteTargetInvoice.parent_invoice_id ?? deleteTargetInvoice.id;

 // 1. Turn off recurrence on the parent so no more invoices are generated.
 const { error: stopErr } = await supabase
 .from("invoices")
 .update({ is_recurring: false, next_invoice_date: null })
 .eq("id", parentId);
 if (stopErr) throw stopErr;

        // 2. Delete only future/draft children (not yet sent to the customer).
        //    Outstanding invoices (already sent, awaiting payment) must remain
        //    until they're paid or explicitly voided.
        const { error: childErr } = await supabase
          .from("invoices")
          .delete()
          .eq("parent_invoice_id", parentId)
          .eq("amount_paid", 0)
          .eq("status", "draft");
        if (childErr) throw childErr;

        // 3. If the target itself is a draft child with no payments, remove it too.
        if (
          deleteTargetInvoice.parent_invoice_id &&
          Number(deleteTargetInvoice.amount_paid ?? 0) === 0 &&
          deleteTargetInvoice.status === "draft"
        ) {
          await supabase.from("invoices").delete().eq("id", deleteTargetInvoice.id);
        }

        toast.success("Recurring schedule stopped. Outstanding and paid invoices were kept.");
 }

 loadData();
 } catch (error) {
 console.error("Error deleting invoice:", error);
 toast.error(getInvoiceDeleteErrorMessage(error));
 } finally {
 setIsDeleting(false);
 setDeleteDialogOpen(false);
 setDeleteTargetInvoice(null);
 }
 };

 const handleDownloadPdf = async (invoice: Invoice) => {
 toast.info("Opening print dialog...");
  const { data, error } = await invoicingService.getInvoicePaymentLink(invoice.id);
  if (error || !data?.paymentUrl) {
  toast.error("Unable to open invoice link");
  return;
  }
  window.open(data.paymentUrl,"_blank");
 };

 // Record payment handlers
 const handleOpenRecordPayment = (invoice: Invoice) => {
 setRecordPaymentInvoice(invoice);
 setRecordPaymentOpen(true);
 };

 const handleRecordPayment = async (payment: Partial<InvoicePayment>) => {
 try {
 const { error } = await invoicingService.recordPayment(payment);
 if (error) throw error;
 
 loadData();
 } catch (error) {
 console.error("Error recording payment:", error);
 throw error;
 }
 };

 // Receipt handlers
 const handleResendReceipt = async (invoice: Invoice) => {
 try {
 toast.info("Sending receipt...");
 const { error } = await invoicingService.sendInvoiceReceipt(invoice.id, true);
 if (error) throw error;
 toast.success("Receipt sent to" + invoice.client_email);
 } catch (error) {
 console.error("Error resending receipt:", error);
 toast.error("Failed to send receipt");
 }
 };

 const handleResendInvoiceEmail = async (invoice: Invoice) => {
 try {
 toast.info("Resending invoice email...");
 const { error } = await supabase.functions.invoke("send-invoice-email", {
 body: { invoiceId: invoice.id },
 });
 if (error) throw error;
 toast.success("Invoice email resent to" + invoice.client_email);
 } catch (error) {
 console.error("Error resending invoice email:", error);
 toast.error("Failed to resend invoice email");
 }
 };

 const handlePrintReceipt = async (invoice: Invoice) => {
  const { data, error } = await invoicingService.getInvoicePaymentLink(invoice.id);
  if (error || !data?.paymentUrl) {
  toast.error("Unable to open receipt link");
  return;
  }
  const printWindow = window.open(data.paymentUrl,"_blank");
 if (printWindow) {
 // Give it a moment to load then trigger print
 printWindow.onload = () => {
 setTimeout(() => {
 printWindow.print();
 }, 500);
 };
 }
 };

 // Client actions
 const handleCreateClient = async (data: Partial<InvoiceClient>) => {
 if (!merchantId) return;
 
 try {
 await invoicingService.createClient({
 merchant_id: merchantId,
 ...data,
 } as any);
 toast.success("Client created");
 loadData();
 } catch (error) {
 console.error("Error creating client:", error);
 toast.error("Failed to create client");
 }
 };

 const handleUpdateClient = async (clientId: string, data: Partial<InvoiceClient>) => {
 try {
 await invoicingService.updateClient(clientId, data);
 toast.success("Client updated");
 loadData();
 } catch (error) {
 console.error("Error updating client:", error);
 toast.error("Failed to update client");
 }
 };

 const handleDeleteClient = async (clientId: string) => {
 try {
 await invoicingService.deleteClient(clientId);
 toast.success("Client deleted");
 loadData();
 } catch (error) {
 console.error("Error deleting client:", error);
 toast.error("Failed to delete client");
 }
 };

 // Settings actions
 const handleSaveSettings = async (data: Partial<InvoiceSettings>) => {
 if (!merchantId) {
 throw new Error("Merchant not loaded yet");
 }
 const { error } = await invoicingService.upsertSettings(merchantId, data);
 if (error) {
 console.error("Error saving settings:", error);
 throw error;
 }
 await loadData();
 };

 // Catalog actions
 const handleCreateCatalogItem = async (data: Partial<CatalogItem>) => {
 if (!merchantId) return;
 
 try {
 const result = await invoicingService.createCatalogItem({
 merchant_id: merchantId,
 ...data,
 } as any);
 if (result.error) throw result.error;
 } catch (error) {
 console.error("Error creating catalog item:", error);
 throw error;
 }
 };

 const handleUpdateCatalogItem = async (id: string, data: Partial<CatalogItem>) => {
 try {
 const result = await invoicingService.updateCatalogItem(id, data);
 if (result.error) throw result.error;
 } catch (error) {
 console.error("Error updating catalog item:", error);
 throw error;
 }
 };

 const handleDeleteCatalogItem = async (id: string) => {
 try {
 const result = await invoicingService.deleteCatalogItem(id);
 if (result.error) throw result.error;
 } catch (error) {
 console.error("Error deleting catalog item:", error);
 throw error;
 }
 };

 // Template actions
 const handleCreateTemplate = async (data: Partial<InvoiceTemplate>) => {
 if (!merchantId) return;
 
 try {
 const result = await invoicingService.createTemplate({
 merchant_id: merchantId,
 ...data,
 } as any);
 if (result.error) throw result.error;
 } catch (error) {
 console.error("Error creating template:", error);
 throw error;
 }
 };

 const handleUpdateTemplate = async (templateId: string, data: Partial<InvoiceTemplate>) => {
 try {
 const result = await invoicingService.updateTemplate(templateId, data);
 if (result.error) throw result.error;
 } catch (error) {
 console.error("Error updating template:", error);
 throw error;
 }
 };

 const handleDeleteTemplate = async (templateId: string) => {
 try {
 const result = await invoicingService.deleteTemplate(templateId);
 if (result.error) throw result.error;
 } catch (error) {
 console.error("Error deleting template:", error);
 throw error;
 }
 };

 const handleSetDefaultTemplate = async (templateId: string) => {
 if (!merchantId) return;
 
 try {
 const result = await invoicingService.setDefaultTemplate(merchantId, templateId);
 if (result.error) throw result.error;
 toast.success("Default template updated");
 loadData();
 } catch (error) {
 console.error("Error setting default template:", error);
 toast.error("Failed to set default template");
 }
 };

 const handleUseTemplate = (template: InvoiceTemplate) => {
 // Pre-populate invoice editor with template data
 const defaultItems = Array.isArray(template.default_items) 
 ? template.default_items.map((item: any, index: number) => ({
 id: `template-${index}`,
 invoice_id:'',
 description: item.description ||'',
 quantity: item.quantity || 1,
 unit_price: item.unit_price || 0,
 unit_type: item.unit_type ||'item',
 discount_type: null,
 discount_value: null,
 discount_amount: 0,
 tax_rate: item.tax_rate || 0,
 tax_amount: 0,
 subtotal: (item.quantity || 1) * (item.unit_price || 0),
 total: (item.quantity || 1) * (item.unit_price || 0),
 sort_order: index,
 service_id: null,
 created_at: new Date().toISOString(),
 updated_at: new Date().toISOString(),
 }))
 : [];

 // Create a pre-populated invoice from template
 const templateInvoice: Invoice & { items?: InvoiceItem[] } = {
 id:'',
 merchant_id: merchantId!,
 invoice_number: nextInvoiceNumber,
 status:'draft',
 issue_date: new Date().toISOString().split('T')[0],
 due_date: new Date(Date.now() + ((template.payment_terms ?? 30) * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
 client_id: null,
 client_name:'',
 client_email:'',
 client_phone: null,
 client_company: null,
 client_address: null,
 title: template.title || null,
 notes: template.notes || null,
 footer: template.footer || null,
 terms_conditions: template.terms_conditions || null,
 payment_terms: template.payment_terms,
 tax_rate: template.tax_rate,
 discount_type: template.discount_type || null,
 discount_value: template.discount_value || null,
 discount_amount: 0,
 tax_amount: 0,
 shipping_amount: 0,
 subtotal: 0,
 total: 0,
 amount_paid: 0,
 amount_due: 0,
 currency:'USD',
 allow_partial_payments: template.allow_partial_payments,
 allow_tips: false,
 accept_credit_card: true,
 accept_bank_transfer: true,
 accept_pawbucks: true,
 access_token:'',
 view_count: 0,
 sent_at: null,
 viewed_at: null,
 paid_at: null,
 stripe_payment_intent_id: null,
 stripe_invoice_id: null,
 is_recurring: false,
 recurring_interval: null,
 recurring_end_date: null,
 parent_invoice_id: null,
 next_invoice_date: null,
 attachment_urls: null,
 created_at: new Date().toISOString(),
 updated_at: new Date().toISOString(),
 items: defaultItems,
 };

 setSelectedInvoice(templateInvoice);
 setViewMode('create');
 toast.success(`Using template: ${template.name}`);
 };

 if (authLoading || loading) {
 return (
 <MerchantWorkspaceLayout>
   <WorkspacePageHeader section="Catalog & Services" title="Invoicing" subtitle="Create, send, and manage your invoices" />
   <div className="flex items-center justify-center py-24">
     <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
   </div>
 </MerchantWorkspaceLayout>
 );
 }

 // Preview mode
 if (viewMode ==="preview" && previewData) {
 return (
 <MerchantWorkspaceLayout>
   <SEO title="Invoice Preview | PawBucks" />
   <WorkspacePageHeader section="Catalog & Services" title="Invoice Preview" />
   <div className="p-4 md:p-6 max-w-7xl mx-auto w-full">
     <InvoicePreview
 invoice={previewData.invoice}
 items={previewData.items}
 recipients={previewData.recipients}
 merchant={{
 business_name: merchant?.business_name ||"",
 address: merchant?.address,
 phone: merchant?.phone,
 logo_url: merchant?.logo_url,
 }}
 onBack={() => setViewMode(selectedInvoice ?"edit" :"list")}
 onSend={() => handleSendFromList(previewData.invoice)}
 onDownload={() => handleDownloadPdf(previewData.invoice)}
   />
   </div>
 </MerchantWorkspaceLayout>
 );
 }

 // Create/Edit mode
 if (viewMode ==="create" || viewMode ==="edit") {
 return (
 <MerchantWorkspaceLayout>
   <SEO title={`${viewMode === "create" ? "Create" : "Edit"} Invoice | PawBucks`} />
   <WorkspacePageHeader section="Catalog & Services" title={`${viewMode === "create" ? "Create" : "Edit"} Invoice`} />
   <div className="p-4 md:p-6 max-w-7xl mx-auto w-full">
     <InvoiceEditor
 invoice={selectedInvoice || undefined}
 invoiceNumber={selectedInvoice?.invoice_number || nextInvoiceNumber}
 merchantId={merchantId!}
 clients={clients}
 catalogItems={catalogItems}
 settings={settings || undefined}
 onSave={handleSaveInvoice}
 onSend={handleSendInvoice}
 onPreview={handlePreviewInvoice}
 onBack={() => {
 setViewMode("list");
 setSelectedInvoice(null);
 }}
 saving={saving}
   />
   </div>
 </MerchantWorkspaceLayout>
 );
 }

 // Main view with tabs
 return (
 <MerchantWorkspaceLayout>
   <SEO title="Invoicing · Merchant Workspace" description="Manage your business invoices" />
   <WorkspacePageHeader
     section="Catalog & Services"
     title="Invoicing"
     subtitle="Create, send, and manage your invoices"
     actions={
       <Button onClick={handleCreateInvoice}>
         <Plus className="h-4 w-4 mr-2" />
         New Invoice
       </Button>
     }
   />
   <div className="p-4 md:p-6 max-w-7xl mx-auto w-full">

 {/* Tabs */}
 <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
 <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
 <TabsTrigger value="invoices" className="flex items-center gap-2">
 <FileText className="h-4 w-4" aria-hidden="true" />
 <span className="hidden sm:inline">Invoices</span>
 </TabsTrigger>
 <TabsTrigger value="scheduled" className="flex items-center gap-2">
 <CalendarClock className="h-4 w-4" />
 <span className="hidden sm:inline">Scheduled</span>
 </TabsTrigger>
 <TabsTrigger value="clients" className="flex items-center gap-2">
 <Users className="h-4 w-4" aria-hidden="true" />
 <span className="hidden sm:inline">Clients</span>
 </TabsTrigger>
 <TabsTrigger value="catalog" className="flex items-center gap-2">
 <Package className="h-4 w-4" aria-hidden="true" />
 <span className="hidden sm:inline">Catalog</span>
 </TabsTrigger>
 <TabsTrigger value="templates" className="flex items-center gap-2">
 <LayoutTemplate className="h-4 w-4" />
 <span className="hidden sm:inline">Templates</span>
 </TabsTrigger>
 <TabsTrigger value="settings" className="flex items-center gap-2">
 <Settings className="h-4 w-4" />
 <span className="hidden sm:inline">Settings</span>
 </TabsTrigger>
 </TabsList>

 <TabsContent value="invoices">
 <InvoiceList
 invoices={invoices}
 loading={loading}
 onCreateNew={handleCreateInvoice}
 onEdit={handleEditInvoice}
 onView={handleViewInvoice}
 onSend={handleSendFromList}
 onDuplicate={handleDuplicateInvoice}
 onDelete={handleDeleteInvoice}
 onDownloadPdf={handleDownloadPdf}
 onRefresh={loadData}
 onRecordPayment={handleOpenRecordPayment}
 onResendReceipt={handleResendReceipt}
 onResendInvoiceEmail={handleResendInvoiceEmail}
 onPrintReceipt={handlePrintReceipt}
 />
 </TabsContent>

 {/* Record Payment Dialog */}
 {recordPaymentInvoice && (
 <RecordPaymentDialog
 open={recordPaymentOpen}
 onOpenChange={setRecordPaymentOpen}
 invoice={recordPaymentInvoice}
 onRecordPayment={handleRecordPayment}
 />
 )}

 {/* Delete Recurring Invoice Dialog */}
 <DeleteRecurringInvoiceDialog
 open={deleteDialogOpen}
 onOpenChange={(open) => {
 setDeleteDialogOpen(open);
 if (!open) setDeleteTargetInvoice(null);
 }}
 onChoice={handleRecurringDeleteChoice}
 invoiceNumber={deleteTargetInvoice?.invoice_number}
 isDeleting={isDeleting}
 />

 <TabsContent value="scheduled">
 <ScheduledInvoices
 invoices={invoices}
 loading={loading}
 onEdit={handleEditInvoice}
 onDelete={handleDeleteInvoice}
 onView={handleViewInvoice}
 />
 </TabsContent>

 <TabsContent value="clients">
 <ClientManager
 clients={clients}
 loading={loading}
 onCreateClient={handleCreateClient}
 onUpdateClient={handleUpdateClient}
 onDeleteClient={handleDeleteClient}
 onRefresh={loadData}
 />
 </TabsContent>

 <TabsContent value="catalog">
 <Card>
 <CardHeader>
 <CardTitle>Product & Service Catalog</CardTitle>
 <CardDescription>
 Add your products and services here to quickly add them to invoices
 </CardDescription>
 </CardHeader>
 <CardContent>
 <CatalogManager
 items={catalogItems}
 loading={loading}
 onCreateItem={handleCreateCatalogItem}
 onUpdateItem={handleUpdateCatalogItem}
 onDeleteItem={handleDeleteCatalogItem}
 onRefresh={loadData}
 merchantId={merchantId}
 />
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="templates">
 <Card>
 <CardHeader>
 <CardTitle>Invoice Templates</CardTitle>
 <CardDescription>
 Create reusable templates for common invoice types
 </CardDescription>
 </CardHeader>
 <CardContent>
 <TemplateManager
 templates={templates}
 catalogItems={catalogItems}
 loading={loading}
 onCreateTemplate={handleCreateTemplate}
 onUpdateTemplate={handleUpdateTemplate}
 onDeleteTemplate={handleDeleteTemplate}
 onSetDefault={handleSetDefaultTemplate}
 onUseTemplate={handleUseTemplate}
 onRefresh={loadData}
 />
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="settings">
 <InvoiceSettingsComponent
 settings={settings}
 merchantId={merchant?.id ||""}
 onSave={handleSaveSettings}
 loading={loading}
 />
 </TabsContent>
 </Tabs>
   </div>
 </MerchantWorkspaceLayout>
 );
};

export default MerchantInvoicing;
