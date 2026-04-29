import { useState, useEffect, useCallback } from"react";
import { supabase } from"@/integrations/supabase/client";
import { AdminInvoiceList, type AdminInvoice } from"./invoicing/AdminInvoiceList";
import { AdminInvoiceForm } from"./invoicing/AdminInvoiceForm";
import { AdminInvoiceDetail } from"./invoicing/AdminInvoiceDetail";
import { toast } from"sonner";
import {
 AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
 AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from"@/components/ui/alert-dialog";

type View ="list" |"create" |"edit" |"detail";

export function AdminInvoicingTab() {
 const [view, setView] = useState<View>("list");
 const [invoices, setInvoices] = useState<AdminInvoice[]>([]);
 const [loading, setLoading] = useState(true);
 const [selectedInvoice, setSelectedInvoice] = useState<AdminInvoice | null>(null);
 const [deleteTarget, setDeleteTarget] = useState<AdminInvoice | null>(null);

 const loadInvoices = useCallback(async () => {
 setLoading(true);
 const { data, error } = await supabase
 .from("admin_invoices")
 .select("*")
 .order("created_at", { ascending: false });
 if (error) {
 toast.error("Failed to load invoices");
 }
 setInvoices((data as AdminInvoice[]) || []);
 setLoading(false);
 }, []);

 useEffect(() => {
 loadInvoices();
 }, [loadInvoices]);

 const handleView = (inv: AdminInvoice) => {
 setSelectedInvoice(inv);
 setView("detail");
 };

 const handleEdit = (inv: AdminInvoice) => {
 setSelectedInvoice(inv);
 setView("edit");
 };

 const handleSend = async (inv: AdminInvoice) => {
 if (!inv.recipient_email) {
 toast.error("Recipient has no email address on file");
 return;
 }
 const toastId = toast.loading("Sending invoice...");
 try {
 const { data, error } = await supabase.functions.invoke("send-admin-invoice-email", {
 body: { invoiceId: inv.id },
 });
 if (error) throw error;
 if (data?.error) throw new Error(data.error);
 toast.success("Invoice sent!", { id: toastId });
 loadInvoices();
 } catch (err: any) {
 toast.error(err.message ||"Failed to send invoice", { id: toastId });
 }
 };

 const handleDelete = async () => {
 if (!deleteTarget) return;
 const { error } = await supabase
 .from("admin_invoices")
 .delete()
 .eq("id", deleteTarget.id);
 if (error) { toast.error("Failed to delete"); return; }
 toast.success("Invoice deleted");
 setDeleteTarget(null);
 loadInvoices();
 };

 const handleRefresh = async () => {
 await loadInvoices();
 if (selectedInvoice) {
 const { data } = await supabase
 .from("admin_invoices")
 .select("*")
 .eq("id", selectedInvoice.id)
 .single();
 if (data) setSelectedInvoice(data as AdminInvoice);
 }
 };

 return (
 <div>
 {view ==="list" && (
 <AdminInvoiceList
 invoices={invoices}
 loading={loading}
 onCreateNew={() => { setSelectedInvoice(null); setView("create"); }}
 onView={handleView}
 onEdit={handleEdit}
 onDelete={(inv) => setDeleteTarget(inv)}
 onSend={handleSend}
 />
 )}

 {(view ==="create" || view ==="edit") && (
 <AdminInvoiceForm
 invoice={view ==="edit" ? selectedInvoice : undefined}
 onSave={() => { setView("list"); loadInvoices(); }}
 onCancel={() => setView("list")}
 />
 )}

 {view ==="detail" && selectedInvoice && (
 <AdminInvoiceDetail
 invoice={selectedInvoice}
 onBack={() => { setView("list"); loadInvoices(); }}
 onEdit={() => setView("edit")}
 onRefresh={handleRefresh}
 />
 )}

 {/* Delete Confirmation */}
 <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
 <AlertDialogContent>
 <AlertDialogHeader>
 <AlertDialogTitle>Delete Invoice?</AlertDialogTitle>
 <AlertDialogDescription>
 This will permanently delete invoice {deleteTarget?.invoice_number}. This action cannot be undone.
 </AlertDialogDescription>
 </AlertDialogHeader>
 <AlertDialogFooter>
 <AlertDialogCancel>Cancel</AlertDialogCancel>
 <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
 Delete
 </AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>
 </div>
 );
}
