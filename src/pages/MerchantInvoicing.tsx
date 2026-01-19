import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Users, Settings, FileText, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import { InvoiceList, InvoiceEditor, InvoicePreview, ClientManager, InvoiceSettingsComponent } from "@/components/invoicing";
import { invoicingService, type Invoice, type InvoiceItem, type InvoiceClient, type InvoiceSettings, type InvoiceTemplate } from "@/services/api/invoicing.service";

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
      const [invoicesRes, clientsRes, settingsRes, templatesRes] = await Promise.all([
        invoicingService.getInvoices(merchantId),
        invoicingService.getClients(merchantId),
        invoicingService.getSettings(merchantId),
        invoicingService.getTemplates(merchantId),
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

  const handleSaveInvoice = async (data: any, items: any[]) => {
    if (!merchantId) return;
    
    setSaving(true);
    try {
      if (selectedInvoice?.id) {
        // Update existing invoice
        await invoicingService.updateInvoice(selectedInvoice.id, {
          ...data,
          issue_date: data.issue_date.toISOString().split("T")[0],
          due_date: data.due_date.toISOString().split("T")[0],
          recurring_end_date: data.recurring_end_date?.toISOString().split("T")[0] || null,
        });
        
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
        const invoiceRes = await invoicingService.createInvoice({
          merchant_id: merchantId,
          invoice_number: nextInvoiceNumber,
          status: "draft",
          ...data,
          issue_date: data.issue_date.toISOString().split("T")[0],
          due_date: data.due_date.toISOString().split("T")[0],
          recurring_end_date: data.recurring_end_date?.toISOString().split("T")[0] || null,
        });

        if (invoiceRes.data) {
          for (const item of items) {
            await invoicingService.createInvoiceItem({
              invoice_id: invoiceRes.data.id,
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
      }
      
      toast.success("Invoice saved successfully");
      setViewMode("list");
      loadData();
    } catch (error) {
      console.error("Error saving invoice:", error);
      toast.error("Failed to save invoice");
    } finally {
      setSaving(false);
    }
  };

  const handleSendInvoice = async (data: any, items: any[]) => {
    // First save, then send
    await handleSaveInvoice(data, items);
    
    if (selectedInvoice?.id) {
      try {
        const { error } = await supabase.functions.invoke("send-invoice-email", {
          body: { invoiceId: selectedInvoice.id },
        });

        if (error) throw error;
        toast.success("Invoice sent successfully");
        loadData();
      } catch (error) {
        console.error("Error sending invoice:", error);
        toast.error("Invoice saved but failed to send email");
      }
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
            clients={clients}
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
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="invoices" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Invoices</span>
            </TabsTrigger>
            <TabsTrigger value="clients" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Clients</span>
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

          <TabsContent value="templates">
            <Card>
              <CardHeader>
                <CardTitle>Invoice Templates</CardTitle>
                <CardDescription>
                  Create reusable templates for common invoice types
                </CardDescription>
              </CardHeader>
              <CardContent>
                {templates.length === 0 ? (
                  <div className="text-center py-12">
                    <LayoutTemplate className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">No templates yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Create templates to speed up invoice creation
                    </p>
                    <Button variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Template
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {templates.map((template) => (
                      <Card key={template.id} className="cursor-pointer hover:border-primary/50 transition-colors">
                        <CardContent className="p-4">
                          <h4 className="font-medium">{template.name}</h4>
                          <p className="text-sm text-muted-foreground">{template.description}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <InvoiceSettingsComponent
              settings={settings}
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
