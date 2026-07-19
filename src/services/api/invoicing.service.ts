import { supabase } from"./base.service";

const INVOICE_SELECT_COLUMNS = "id, merchant_id, client_id, invoice_number, status, issue_date, due_date, sent_at, viewed_at, paid_at, client_name, client_email, client_phone, client_company, client_address, subtotal, discount_type, discount_value, discount_amount, tax_rate, tax_amount, shipping_amount, total, amount_paid, amount_due, currency, title, notes, footer, terms_conditions, payment_terms, allow_partial_payments, allow_tips, accept_credit_card, accept_bank_transfer, accept_pawbucks, view_count, stripe_payment_intent_id, stripe_invoice_id, is_recurring, recurring_interval, recurring_end_date, parent_invoice_id, next_invoice_date, attachment_urls, created_at, updated_at" as const;

// Types - using'any' for flexibility with Supabase responses
export interface InvoiceClient {
 id: string;
 merchant_id: string;
 name: string;
 email: string;
 phone?: string | null;
 company_name?: string | null;
 address_line1?: string | null;
 address_line2?: string | null;
 city?: string | null;
 state?: string | null;
 postal_code?: string | null;
 country?: string | null;
 tax_id?: string | null;
 notes?: string | null;
 is_active: boolean;
 created_at: string;
 updated_at: string;
}

export interface InvoiceSettings {
 id: string;
 merchant_id: string;
 invoice_prefix: string;
 next_invoice_number: number;
 default_payment_terms: number;
 default_tax_rate: number;
 default_notes?: string | null;
 default_footer?: string | null;
 late_fee_enabled: boolean;
 late_fee_type: string;
 late_fee_amount: number;
 late_fee_grace_days: number;
 reminder_enabled: boolean;
 reminder_days_before: number[];
 overdue_reminder_days: number[];
 logo_url?: string | null;
 accent_color: string;
 bank_name?: string | null;
 bank_account_name?: string | null;
 bank_routing_number?: string | null;
 bank_account_number_last4?: string | null;
 paypal_email?: string | null;
 venmo_handle?: string | null;
 default_currency: string;
 created_at: string;
 updated_at: string;
}

export interface Invoice {
 id: string;
 merchant_id: string;
 client_id?: string | null;
 invoice_number: string;
 status: string;
 issue_date: string;
 due_date: string;
 sent_at?: string | null;
 viewed_at?: string | null;
 paid_at?: string | null;
 client_name: string;
 client_email: string;
 client_phone?: string | null;
 client_company?: string | null;
 client_address?: string | null;
 subtotal: number;
 discount_type?: string | null;
 discount_value?: number | null;
 discount_amount: number;
 tax_rate: number;
 tax_amount: number;
 shipping_amount: number;
 total: number;
 amount_paid: number;
 amount_due: number;
 currency: string;
 title?: string | null;
 notes?: string | null;
 footer?: string | null;
 terms_conditions?: string | null;
 payment_terms: number;
 allow_partial_payments: boolean;
 allow_tips: boolean;
 accept_credit_card: boolean;
 accept_bank_transfer: boolean;
 accept_pawbucks: boolean;
 access_token?: string | null;
 view_count: number;
 stripe_payment_intent_id?: string | null;
 stripe_invoice_id?: string | null;
 is_recurring: boolean;
 recurring_interval?: string | null;
 recurring_end_date?: string | null;
 parent_invoice_id?: string | null;
 next_invoice_date?: string | null;
 attachment_urls?: string[] | null;
 created_at: string;
 updated_at: string;
}

export interface InvoiceItem {
 id: string;
 invoice_id: string;
 description: string;
 quantity: number;
 unit_price: number;
 unit_type: string;
 discount_type?: string | null;
 discount_value?: number | null;
 discount_amount: number;
 tax_rate: number;
 tax_amount: number;
 subtotal: number;
 total: number;
 sort_order: number;
 service_id?: string | null;
 created_at: string;
 updated_at: string;
}

export interface InvoiceRecipient {
 id?: string;
 invoice_id?: string;
 email: string;
 name?: string | null;
 recipient_type:'cc' |'bcc';
 created_at?: string;
 updated_at?: string;
}

export interface InvoicePayment {
 id: string;
 invoice_id: string;
 amount: number;
 payment_method: string;
 payment_date: string;
 stripe_payment_intent_id?: string | null;
 stripe_charge_id?: string | null;
 status: string;
 notes?: string | null;
 reference_number?: string | null;
 processing_fee?: number | null;
 recorded_by?: string | null;
 created_at: string;
 updated_at: string;
}

export interface InvoiceActivity {
 id: string;
 invoice_id: string;
 action: string;
 description?: string | null;
 metadata?: any;
 performed_by: string;
 ip_address?: string | null;
 created_at: string;
}

export interface InvoiceTemplate {
 id: string;
 merchant_id: string;
 name: string;
 description?: string | null;
 title?: string | null;
 notes?: string | null;
 footer?: string | null;
 terms_conditions?: string | null;
 default_items?: any;
 payment_terms: number;
 tax_rate: number;
 discount_type?: string | null;
 discount_value?: number | null;
 allow_partial_payments: boolean;
 is_default: boolean;
 created_at: string;
 updated_at: string;
}

export interface CatalogItem {
 id: string;
 merchant_id: string;
 name: string;
 description?: string | null;
 unit_price: number;
 unit_type: string;
 tax_rate: number;
 category?: string | null;
 sku?: string | null;
 is_active: boolean;
 created_at: string;
 updated_at: string;
}

export const invoicingService = {
 // CLIENTS
 async getClients(merchantId: string) {
 const { data, error } = await supabase
 .from("invoice_clients")
 .select("*")
 .eq("merchant_id", merchantId)
 .eq("is_active", true)
 .order("name");
 return { data: (data || []) as InvoiceClient[], error };
 },

 async getClientById(clientId: string) {
 const { data, error } = await supabase
 .from("invoice_clients")
 .select("*")
 .eq("id", clientId)
 .single();
 return { data: data as InvoiceClient | null, error };
 },

 async createClient(client: Partial<InvoiceClient>) {
 const { data, error } = await supabase
 .from("invoice_clients")
 .insert(client as any)
 .select()
 .single();
 return { data: data as InvoiceClient | null, error };
 },

 async updateClient(clientId: string, updates: Partial<InvoiceClient>) {
 const { data, error } = await supabase
 .from("invoice_clients")
 .update(updates as any)
 .eq("id", clientId)
 .select()
 .single();
 return { data: data as InvoiceClient | null, error };
 },

 async deleteClient(clientId: string) {
 const { error } = await supabase
 .from("invoice_clients")
 .update({ is_active: false })
 .eq("id", clientId);
 return { data: null, error };
 },

 // SETTINGS
 async getSettings(merchantId: string) {
 const { data, error } = await supabase
 .from("invoice_settings")
  .select("id, merchant_id, invoice_prefix, next_invoice_number, default_payment_terms, default_tax_rate, default_notes, default_footer, late_fee_enabled, late_fee_type, late_fee_amount, late_fee_grace_days, reminder_enabled, reminder_days_before, overdue_reminder_days, logo_url, accent_color, bank_name, bank_account_name, bank_account_number_last4, paypal_email, venmo_handle, default_currency, created_at, updated_at")
 .eq("merchant_id", merchantId)
 .maybeSingle();
  if (data) {
   const { data: routing } = await supabase.rpc("get_my_bank_routing_number", { p_merchant_id: merchantId });
   (data as any).bank_routing_number = routing ?? null;
  }
  return { data: data as InvoiceSettings | null, error };
 },

 async upsertSettings(merchantId: string, settings: Partial<InvoiceSettings>) {
 const { data, error } = await supabase
 .from("invoice_settings")
 .upsert({ merchant_id: merchantId, ...settings } as any, { onConflict:'merchant_id' })
  .select("id, merchant_id, invoice_prefix, next_invoice_number, default_payment_terms, default_tax_rate, default_notes, default_footer, late_fee_enabled, late_fee_type, late_fee_amount, late_fee_grace_days, reminder_enabled, reminder_days_before, overdue_reminder_days, logo_url, accent_color, bank_name, bank_account_name, bank_account_number_last4, paypal_email, venmo_handle, default_currency, created_at, updated_at")
 .single();
 return { data: data as InvoiceSettings | null, error };
 },

 // INVOICES
 async getInvoices(merchantId: string, filters?: { status?: string; limit?: number }) {
 let query = supabase
 .from("invoices")
  .select(INVOICE_SELECT_COLUMNS)
 .eq("merchant_id", merchantId)
 .order("created_at", { ascending: false });

 if (filters?.status) query = query.eq("status", filters.status);
 if (filters?.limit) query = query.limit(filters.limit);

 const { data, error } = await query;
 return { data: (data || []) as Invoice[], error };
 },

 async getInvoiceById(invoiceId: string) {
 const { data, error } = await supabase.from("invoices").select(INVOICE_SELECT_COLUMNS).eq("id", invoiceId).single();
 return { data: data as Invoice | null, error };
 },

 async getInvoiceWithItems(invoiceId: string) {
 const [invoiceResult, itemsResult, recipientsResult] = await Promise.all([
  supabase.from("invoices").select(INVOICE_SELECT_COLUMNS).eq("id", invoiceId).single(),
 supabase.from("invoice_items").select("*").eq("invoice_id", invoiceId).order("sort_order"),
 supabase.from("invoice_recipients").select("*").eq("invoice_id", invoiceId)
 ]);
 if (invoiceResult.error) return { data: null, error: invoiceResult.error };
 return { 
 data: { 
 ...(invoiceResult.data as Invoice), 
 items: (itemsResult.data || []) as InvoiceItem[],
 recipients: (recipientsResult.data || []) as InvoiceRecipient[]
 }, 
 error: null 
 };
 },

 async createInvoice(invoice: Partial<Invoice>) {
 const { data, error } = await supabase.from("invoices").insert(invoice as any).select().single();
 return { data: data as Invoice | null, error };
 },

 async updateInvoice(invoiceId: string, updates: Partial<Invoice>) {
 const { data, error } = await supabase.from("invoices").update(updates as any).eq("id", invoiceId).select().single();
 return { data: data as Invoice | null, error };
 },

 async deleteInvoice(invoiceId: string) {
 // Delete any child recurring invoices first
 await supabase
 .from("invoices")
 .delete()
 .eq("parent_invoice_id", invoiceId);

 // Nullify any insurance claim references first (FK is SET NULL, but handle explicitly for safety)
 await supabase.from("insurance_claims").update({ invoice_id: null }).eq("invoice_id", invoiceId);

 const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);
 return { data: null, error };
 },

 // INVOICE ITEMS
 async getInvoiceItems(invoiceId: string) {
 const { data, error } = await supabase.from("invoice_items").select("*").eq("invoice_id", invoiceId).order("sort_order");
 return { data: (data || []) as InvoiceItem[], error };
 },

 async createInvoiceItem(item: Partial<InvoiceItem>) {
 const { data, error } = await supabase.from("invoice_items").insert(item as any).select().single();
 return { data: data as InvoiceItem | null, error };
 },

 async bulkUpdateItems(invoiceId: string, items: Partial<InvoiceItem>[]) {
 await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
 if (items.length > 0) {
 const { error } = await supabase.from("invoice_items").insert(
 items.map((item, index) => ({ ...item, invoice_id: invoiceId, sort_order: index, description: item.description ||'' } as any))
 );
 if (error) return { data: null, error };
 }
 return { data: null, error: null };
 },

 // RECIPIENTS
 async getInvoiceRecipients(invoiceId: string) {
 const { data, error } = await supabase
 .from("invoice_recipients")
 .select("*")
 .eq("invoice_id", invoiceId);
 return { data: (data || []) as InvoiceRecipient[], error };
 },

 async bulkUpdateRecipients(invoiceId: string, recipients: Partial<InvoiceRecipient>[]) {
 // Delete existing recipients
 await supabase.from("invoice_recipients").delete().eq("invoice_id", invoiceId);
 
 // Insert new recipients
 if (recipients.length > 0) {
 const { error } = await supabase.from("invoice_recipients").insert(
 recipients.map(r => ({
 invoice_id: invoiceId,
 email: r.email,
 name: r.name || null,
 recipient_type: r.recipient_type ||'cc'
 }))
 );
 if (error) return { data: null, error };
 }
 return { data: null, error: null };
 },

 // PAYMENTS
 async getInvoicePayments(invoiceId: string) {
 const { data, error } = await supabase.from("invoice_payments").select("*").eq("invoice_id", invoiceId).order("payment_date", { ascending: false });
 return { data: (data || []) as InvoicePayment[], error };
 },

 async recordPayment(payment: Partial<InvoicePayment>) {
 // Use edge function to record payment and create transaction for pet owner visibility
 const { data, error } = await supabase.functions.invoke("record-manual-invoice-payment", {
 body: payment,
 });
 
 if (error) {
 console.error("Error recording payment via edge function:", error);
 return { data: null, error };
 }
 
 if (data?.error) {
 return { data: null, error: new Error(data.error) };
 }
 
 return { data: data as InvoicePayment | null, error: null };
 },

 // TEMPLATES
 async getTemplates(merchantId: string) {
 const { data, error } = await supabase.from("invoice_templates").select("*").eq("merchant_id", merchantId).order("name");
 return { data: (data || []) as InvoiceTemplate[], error };
 },

 async getTemplateById(templateId: string) {
 const { data, error } = await supabase
 .from("invoice_templates")
 .select("*")
 .eq("id", templateId)
 .single();
 return { data: data as InvoiceTemplate | null, error };
 },

 async createTemplate(template: Partial<InvoiceTemplate>) {
 const { data, error } = await supabase
 .from("invoice_templates")
 .insert(template as any)
 .select()
 .single();
 return { data: data as InvoiceTemplate | null, error };
 },

 async updateTemplate(templateId: string, updates: Partial<InvoiceTemplate>) {
 const { data, error } = await supabase
 .from("invoice_templates")
 .update(updates as any)
 .eq("id", templateId)
 .select()
 .single();
 return { data: data as InvoiceTemplate | null, error };
 },

 async deleteTemplate(templateId: string) {
 const { error } = await supabase
 .from("invoice_templates")
 .delete()
 .eq("id", templateId);
 return { data: null, error };
 },

 async setDefaultTemplate(merchantId: string, templateId: string) {
 // First, unset all defaults for this merchant
 await supabase
 .from("invoice_templates")
 .update({ is_default: false })
 .eq("merchant_id", merchantId);
 
 // Then set the new default
 const { data, error } = await supabase
 .from("invoice_templates")
 .update({ is_default: true })
 .eq("id", templateId)
 .select()
 .single();
 return { data: data as InvoiceTemplate | null, error };
 },

 // CATALOG ITEMS
 async getCatalogItems(merchantId: string) {
 const { data, error } = await supabase
 .from("invoice_catalog_items")
 .select("*")
 .eq("merchant_id", merchantId)
 .eq("is_active", true)
 .order("category", { ascending: true, nullsFirst: false })
 .order("name");
 return { data: (data || []) as CatalogItem[], error };
 },

 async createCatalogItem(item: Partial<CatalogItem>) {
 const { data, error } = await supabase
 .from("invoice_catalog_items")
 .insert(item as any)
 .select()
 .single();
 return { data: data as CatalogItem | null, error };
 },

 async updateCatalogItem(id: string, updates: Partial<CatalogItem>) {
 const { data, error } = await supabase
 .from("invoice_catalog_items")
 .update(updates as any)
 .eq("id", id)
 .select()
 .single();
 return { data: data as CatalogItem | null, error };
 },

 async deleteCatalogItem(id: string) {
 const { error } = await supabase
 .from("invoice_catalog_items")
 .update({ is_active: false })
 .eq("id", id);
 return { data: null, error };
 },

 // EDGE FUNCTIONS
 async generateInvoiceNumber(merchantId: string) {
 return supabase.rpc("generate_invoice_number", { p_merchant_id: merchantId });
 },

 async sendInvoice(invoiceId: string) {
 return supabase.functions.invoke("send-invoice", { body: { invoiceId } });
 },

 async sendInvoiceReceipt(invoiceId: string, isResend: boolean = false) {
 return supabase.functions.invoke("send-invoice-receipt", { 
 body: { invoiceId, isResend } 
 });
 },
};
