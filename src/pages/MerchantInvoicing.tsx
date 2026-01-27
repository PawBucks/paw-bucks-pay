import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { addWeeks, addMonths, addYears } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Users, Settings, FileText, LayoutTemplate, Package } from "lucide-react";
import { toast } from "sonner";
import { InvoiceList, InvoiceEditor, InvoicePreview, ClientManager, InvoiceSettingsComponent, CatalogManager, TemplateManager } from "@/components/invoicing";
import { invoicingService, type Invoice, type InvoiceItem, type InvoiceClient, type InvoiceSettings, type InvoiceTemplate, type CatalogItem } from "@/services/api/invoicing.service";

// Helper function to calculate next invoice date based on interval
function calculateNextInvoiceDate(fromDate: Date, interval: string): Date {
  switch (interval) {
    case "weekly":
      return addWeeks(fromDate, 1);
    case "biweekly":
      return addWeeks(fromDate, 2);
    case "monthly":
      return addMonths(fromDate, 1);
    case "quarterly":
      return addMonths(fromDate, 3);
    case "yearly":
      return addYears(fromDate, 1);
    default:
      return addMonths(fromDate, 1);
  }
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
  const [viewMode, setViewMode] = useState<"list" | "create" | "edit" | "preview">("list");
  const [selectedInvoice, setSelectedInvoice] = useState<(Invoice & { items?: InvoiceItem[] }) | null>(null);
  const [previewData, setPreviewData] = useState<{ invoice: Invoice; items: InvoiceItem[] } | null>(null);
  
  // Data
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<InvoiceClient[]>([]);
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState<string>("INV-00001");

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
        if (error.code === "PGRST116") {
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
          `${settingsRes.data.invoice_prefix || "INV-"}${String(settingsRes.data.next_invoice_number || 1).padStart(5, "0")}`
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
      const [invoiceRes, itemsRes] = await Promise.all([
        invoicingService.getInvoiceById(invoiceId),
        invoicingService.getInvoiceItems(invoiceId),
      ]);
      
      if (invoiceRes.data) {
        setSelectedInvoice({
          ...invoiceRes.data,
          items: itemsRes.data || [],
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
      const itemsRes = await invoicingService.getInvoiceItems(invoice.id);
      setPreviewData({
        invoice,
        items: itemsRes.data || [],
      });
      setViewMode("preview");
    } catch (error) {
      console.error("Error loading invoice for preview:", error);
      toast.error("Failed to load invoice");
    }
  };

  const handleSaveInvoice = async (data: any, items: any[], skipToast = false): Promise<string | null> => {
    if (!merchantId) return null;
    
    setSaving(true);
    try {
      let invoiceId: string;
      
      // Format dates - handle both Date objects and string dates
      const formatDate = (date: any): string => {
        if (date instanceof Date) {
          return date.toISOString().split("T")[0];
        }
        if (typeof date === 'string') {
          return date.split("T")[0];
        }
        return new Date().toISOString().split("T")[0];
      };
      
      // Remove 'items' from data - items are stored in separate invoice_items table
      const { items: _items, ...invoiceData } = data;
      
      // Convert empty strings to null for UUID fields to prevent database errors
      const sanitizeUUID = (value: string | null | undefined) => 
        value && value.trim() !== '' ? value : null;
      
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
          invoice_number: nextInvoiceNumber,
          status: "draft",
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
        
        // Increment the next invoice number in settings
        if (settings) {
          const newNextNumber = (settings.next_invoice_number || 1) + 1;
          await invoicingService.upsertSettings(merchantId, {
            next_invoice_number: newNextNumber,
          });
          // Update local state for immediate feedback
          setSettings({ ...settings, next_invoice_number: newNextNumber });
          setNextInvoiceNumber(
            `${settings.invoice_prefix || "INV-"}${String(newNextNumber).padStart(5, "0")}`
          );
        }
      }
      
      if (!skipToast) {
        toast.success("Invoice saved successfully");
        setViewMode("list");
      }
      loadData();
      return invoiceId;
    } catch (error: any) {
      console.error("Error saving invoice:", error);
      toast.error(error.message || "Failed to save invoice");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSendInvoice = async (data: any, items: any[]) => {
    // First save the invoice (skip toast since we'll show one for send)
    const invoiceId = await handleSaveInvoice(data, items, true);
    
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
      toast.error(error.message || "Invoice saved but failed to send email");
    }
  };

  const handlePreviewInvoice = (data: any, items: any[]) => {
    // Convert form data to preview format
    const previewInvoice: Invoice = {
      id: selectedInvoice?.id || "preview",
      merchant_id: merchantId!,
      invoice_number: selectedInvoice?.invoice_number || nextInvoiceNumber,
      status: selectedInvoice?.status || "draft",
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
      currency: "USD",
      access_token: "",
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
        invoice_number: nextInvoiceNumber,
        status: "draft",
        client_id: invoice.client_id,
        client_name: invoice.client_name,
        client_email: invoice.client_email,
        client_phone: invoice.client_phone,
        client_company: invoice.client_company,
        client_address: invoice.client_address,
        title: invoice.title,
        issue_date: new Date().toISOString().split("T")[0],
        due_date: new Date(Date.now() + (invoice.payment_terms || 30) * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
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
    try {
      const { error } = await invoicingService.deleteInvoice(invoice.id);
      if (error) throw error;
      
      toast.success("Invoice deleted");
      loadData();
    } catch (error) {
      console.error("Error deleting invoice:", error);
      toast.error("Failed to delete invoice");
    }
  };

  const handleDownloadPdf = async (invoice: Invoice) => {
    toast.info("Opening print dialog...");
    // For now, open the invoice in a new window for printing
    const payUrl = `${window.location.origin}/invoice/${invoice.id}/pay?token=${invoice.access_token}`;
    window.open(payUrl, "_blank");
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
    if (!merchantId) return;
    
    try {
      await invoicingService.upsertSettings(merchantId, data);
      toast.success("Settings saved");
      loadData();
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    }
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
          invoice_id: '',
          description: item.description || '',
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          unit_type: item.unit_type || 'item',
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
      id: '',
      merchant_id: merchantId!,
      invoice_number: nextInvoiceNumber,
      status: 'draft',
      issue_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + (template.payment_terms || 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      client_id: null,
      client_name: '',
      client_email: '',
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
      currency: 'USD',
      allow_partial_payments: template.allow_partial_payments,
      allow_tips: false,
      accept_credit_card: true,
      accept_bank_transfer: true,
      accept_pawbucks: true,
      access_token: '',
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Preview mode
  if (viewMode === "preview" && previewData) {
    return (
      <div className="min-h-screen bg-background">
        <SEO title="Invoice Preview | PawBucks" />
        <div className="container mx-auto py-6 px-4">
          <InvoicePreview
            invoice={previewData.invoice}
            items={previewData.items}
            merchant={{
              business_name: merchant?.business_name || "",
              address: merchant?.address,
              phone: merchant?.phone,
              logo_url: merchant?.logo_url,
            }}
            onBack={() => setViewMode(selectedInvoice ? "edit" : "list")}
            onSend={() => handleSendFromList(previewData.invoice)}
            onDownload={() => handleDownloadPdf(previewData.invoice)}
          />
        </div>
      </div>
    );
  }

  // Create/Edit mode
  if (viewMode === "create" || viewMode === "edit") {
    return (
      <div className="min-h-screen bg-background">
        <SEO title={`${viewMode === "create" ? "Create" : "Edit"} Invoice | PawBucks`} />
        <div className="container mx-auto py-6 px-4">
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
      </div>
    );
  }

  // Main view with tabs
  return (
    <div className="min-h-screen bg-background">
      <SEO title="Invoicing | PawBucks" description="Manage your business invoices" />
      
      <div className="container mx-auto py-6 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/merchant-dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Invoicing</h1>
              <p className="text-muted-foreground">Create, send, and manage your invoices</p>
            </div>
          </div>
          <Button onClick={handleCreateInvoice}>
            <Plus className="h-4 w-4 mr-2" />
            New Invoice
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="invoices" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Invoices</span>
            </TabsTrigger>
            <TabsTrigger value="clients" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Clients</span>
            </TabsTrigger>
            <TabsTrigger value="catalog" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
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
              merchantId={merchant?.id || ""}
              onSave={handleSaveSettings}
              loading={loading}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default MerchantInvoicing;
