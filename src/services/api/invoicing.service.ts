import { supabase } from "./base.service";

// Types - using 'any' for flexibility with Supabase responses
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
  access_token: string;
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
      .select("*")
      .eq("merchant_id", merchantId)
      .maybeSingle();
    return { data: data as InvoiceSettings | null, error };
  },

  async upsertSettings(merchantId: string, settings: Partial<InvoiceSettings>) {
    const { data, error } = await supabase
      .from("invoice_settings")
      .upsert({ merchant_id: merchantId, ...settings } as any, { onConflict: 'merchant_id' })
      .select()
      .single();
    return { data: data as InvoiceSettings | null, error };
  },

  // INVOICES
  async getInvoices(merchantId: string, filters?: { status?: string; limit?: number }) {
    let query = supabase
      .from("invoices")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false });

    if (filters?.status) query = query.eq("status", filters.status);
    if (filters?.limit) query = query.limit(filters.limit);

    const { data, error } = await query;
    return { data: (data || []) as Invoice[], error };
  },

  async getInvoiceById(invoiceId: string) {
    const { data, error } = await supabase.from("invoices").select("*").eq("id", invoiceId).single();
    return { data: data as Invoice | null, error };
  },

  async getInvoiceWithItems(invoiceId: string) {
    const [invoiceResult, itemsResult] = await Promise.all([
      supabase.from("invoices").select("*").eq("id", invoiceId).single(),
      supabase.from("invoice_items").select("*").eq("invoice_id", invoiceId).order("sort_order")
    ]);
    if (invoiceResult.error) return { data: null, error: invoiceResult.error };
    return { data: { ...(invoiceResult.data as Invoice), items: (itemsResult.data || []) as InvoiceItem[] }, error: null };
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
        items.map((item, index) => ({ ...item, invoice_id: invoiceId, sort_order: index, description: item.description || '' } as any))
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
    const { data, error } = await supabase.from("invoice_payments").insert(payment as any).select().single();
    return { data: data as InvoicePayment | null, error };
  },

  // TEMPLATES
  async getTemplates(merchantId: string) {
    const { data, error } = await supabase.from("invoice_templates").select("*").eq("merchant_id", merchantId).order("name");
    return { data: (data || []) as InvoiceTemplate[], error };
  },

  // EDGE FUNCTIONS
  async generateInvoiceNumber(merchantId: string) {
    return supabase.rpc("generate_invoice_number", { p_merchant_id: merchantId });
  },

  async sendInvoice(invoiceId: string) {
    return supabase.functions.invoke("send-invoice", { body: { invoiceId } });
  },
};
