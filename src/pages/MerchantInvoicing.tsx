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
import { invoicingService, type Invoice, type InvoiceClient, type InvoiceSettings, type InvoiceTemplate } from "@/services/api/invoicing.service";

const MerchantInvoicing = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("invoices");
  
  // View states
  const [viewMode, setViewMode] = useState<"list" | "create" | "edit" | "preview">("list");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  
  // Data
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<InvoiceClient[]>([]);
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);

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
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          navigate("/merchant-onboarding");
          return;
        }
        throw error;
      }

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
      if (settingsRes.data) setSettings(settingsRes.data);
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

  const handleCreateInvoice = () => {
    setEditingInvoiceId(null);
    setViewMode("create");
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoiceId(invoice.id);
    setViewMode("edit");
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setViewMode("preview");
  };

  const handleInvoiceSaved = () => {
    setViewMode("list");
    setEditingInvoiceId(null);
    loadData();
    toast.success("Invoice saved successfully");
  };

  const handleSendInvoice = async (invoiceId: string) => {
    try {
      const { error } = await supabase.functions.invoke("send-invoice-email", {
        body: { invoiceId },
      });

      if (error) throw error;
      
      toast.success("Invoice sent successfully");
      loadData();
    } catch (error) {
      console.error("Error sending invoice:", error);
      toast.error("Failed to send invoice");
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    try {
      const { error } = await invoicingService.deleteInvoice(invoiceId);
      if (error) throw error;
      
      toast.success("Invoice deleted");
      loadData();
    } catch (error) {
      console.error("Error deleting invoice:", error);
      toast.error("Failed to delete invoice");
    }
  };

  const handleMarkPaid = async (invoiceId: string) => {
    try {
      const { error } = await invoicingService.updateInvoice(invoiceId, {
        status: "paid",
        paid_at: new Date().toISOString(),
      });
      if (error) throw error;
      
      toast.success("Invoice marked as paid");
      loadData();
    } catch (error) {
      console.error("Error updating invoice:", error);
      toast.error("Failed to update invoice");
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
  if (viewMode === "preview" && selectedInvoice) {
    return (
      <div className="min-h-screen bg-background">
        <SEO title="Invoice Preview | PawBucks" />
        <div className="container mx-auto py-6 px-4">
          <Button
            variant="ghost"
            onClick={() => setViewMode("list")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Invoices
          </Button>
          <InvoicePreview
            invoiceId={selectedInvoice.id}
            onEdit={() => handleEditInvoice(selectedInvoice)}
            onSend={() => handleSendInvoice(selectedInvoice.id)}
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
          <Button
            variant="ghost"
            onClick={() => setViewMode("list")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Invoices
          </Button>
          <InvoiceEditor
            merchantId={merchantId!}
            invoiceId={editingInvoiceId}
            clients={clients}
            settings={settings}
            onSave={handleInvoiceSaved}
            onCancel={() => setViewMode("list")}
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
              onView={handleViewInvoice}
              onEdit={handleEditInvoice}
              onSend={handleSendInvoice}
              onDelete={handleDeleteInvoice}
              onMarkPaid={handleMarkPaid}
              onCreate={handleCreateInvoice}
            />
          </TabsContent>

          <TabsContent value="clients">
            <ClientManager merchantId={merchantId!} />
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
            <InvoiceSettingsComponent merchantId={merchantId!} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default MerchantInvoicing;
