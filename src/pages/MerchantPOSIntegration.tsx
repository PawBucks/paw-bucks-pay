import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Key, Plus, Copy, Trash2, AlertTriangle, CheckCircle, Clock, ExternalLink } from "lucide-react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";

interface POSIntegration {
  id: string;
  name: string;
  api_key_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

interface POSTransaction {
  id: string;
  external_transaction_id: string | null;
  customer_email: string | null;
  amount: number;
  status: string;
  pawbucks_awarded: number | null;
  created_at: string;
}

export default function MerchantPOSIntegration() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [merchant, setMerchant] = useState<{ id: string; business_name: string } | null>(null);
  const [integrations, setIntegrations] = useState<POSIntegration[]>([]);
  const [transactions, setTransactions] = useState<POSTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [newApiKey, setNewApiKey] = useState("");
  const [newIntegrationName, setNewIntegrationName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      // Get merchant
      const { data: merchantData, error: merchantError } = await supabase
        .from("merchants")
        .select("id, business_name")
        .eq("user_id", user!.id)
        .single();

      if (merchantError || !merchantData) {
        navigate("/merchant-onboarding");
        return;
      }

      setMerchant(merchantData);

      // Load integrations
      const { data: integrationsData } = await supabase
        .from("merchant_pos_integrations")
        .select("*")
        .eq("merchant_id", merchantData.id)
        .order("created_at", { ascending: false });

      setIntegrations(integrationsData || []);

      // Load recent transactions
      const { data: transactionsData } = await supabase
        .from("pos_transactions")
        .select("*")
        .eq("merchant_id", merchantData.id)
        .order("created_at", { ascending: false })
        .limit(20);

      setTransactions(transactionsData || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApiKey = async () => {
    if (!merchant || !newIntegrationName.trim()) {
      toast.error("Please enter a name for this integration");
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("pos-generate-api-key", {
        body: {
          merchantId: merchant.id,
          name: newIntegrationName.trim(),
        },
      });

      if (error) throw error;

      if (data.success) {
        setNewApiKey(data.api_key);
        setShowCreateDialog(false);
        setShowApiKeyDialog(true);
        setNewIntegrationName("");
        loadData();
      } else {
        throw new Error(data.error || "Failed to create API key");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create API key";
      toast.error(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText(newApiKey);
    toast.success("API key copied to clipboard");
  };

  const handleToggleActive = async (integrationId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("merchant_pos_integrations")
        .update({ is_active: isActive })
        .eq("id", integrationId);

      if (error) throw error;

      setIntegrations(integrations.map(i => 
        i.id === integrationId ? { ...i, is_active: isActive } : i
      ));
      toast.success(isActive ? "API key activated" : "API key deactivated");
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async (integrationId: string) => {
    if (!confirm("Are you sure you want to delete this API key? This cannot be undone.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("merchant_pos_integrations")
        .delete()
        .eq("id", integrationId);

      if (error) throw error;

      setIntegrations(integrations.filter(i => i.id !== integrationId));
      toast.success("API key deleted");
    } catch (error) {
      toast.error("Failed to delete API key");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "rewarded":
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Rewarded</Badge>;
      case "matched":
        return <Badge className="bg-blue-500"><CheckCircle className="w-3 h-3 mr-1" />Matched</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "failed":
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="container max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/merchant-dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">POS Integration</h1>
            <p className="text-muted-foreground">Connect your point-of-sale system to award PawBucks automatically</p>
          </div>
        </div>

        {/* API Documentation Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              API Documentation
            </CardTitle>
            <CardDescription>
              Send transactions from your POS to our API endpoint
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Endpoint</Label>
                <code className="block mt-1 p-3 bg-muted rounded-md text-sm break-all">
                  POST https://yxpnkipcoxksmnsvpvwi.supabase.co/functions/v1/pos-submit-transaction
                </code>
              </div>
              <div>
                <Label className="text-sm font-medium">Headers</Label>
                <code className="block mt-1 p-3 bg-muted rounded-md text-sm">
                  x-api-key: pk_live_XXXXXXXX...
                </code>
              </div>
              <div>
                <Label className="text-sm font-medium">Request Body (JSON)</Label>
                <pre className="mt-1 p-3 bg-muted rounded-md text-sm overflow-x-auto">
{`{
  "transaction_id": "POS-12345",
  "customer_email": "customer@example.com",
  "customer_phone": "555-123-4567",
  "amount": 45.99,
  "currency": "USD",
  "items": [
    { "name": "Dog Food", "quantity": 1, "price": 35.99 },
    { "name": "Dog Treats", "quantity": 2, "price": 5.00 }
  ],
  "timestamp": "2024-01-15T14:30:00Z"
}`}
                </pre>
              </div>
              <p className="text-sm text-muted-foreground">
                Include either <code>customer_email</code> or <code>customer_phone</code> to match customers with their PawBucks account.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* API Keys Section */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  API Keys
                </CardTitle>
                <CardDescription>Manage your POS integration API keys</CardDescription>
              </div>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create API Key
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {integrations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No API keys created yet</p>
                <p className="text-sm">Create an API key to start integrating your POS system</p>
              </div>
            ) : (
              <div className="space-y-4">
                {integrations.map((integration) => (
                  <div
                    key={integration.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{integration.name}</span>
                        {!integration.is_active && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                      <code className="text-sm text-muted-foreground">
                        {integration.api_key_prefix}...
                      </code>
                      {integration.last_used_at && (
                        <p className="text-xs text-muted-foreground">
                          Last used: {new Date(integration.last_used_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`active-${integration.id}`} className="text-sm">
                          Active
                        </Label>
                        <Switch
                          id={`active-${integration.id}`}
                          checked={integration.is_active}
                          onCheckedChange={(checked) => handleToggleActive(integration.id, checked)}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(integration.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent POS Transactions</CardTitle>
            <CardDescription>Transactions submitted from your POS system</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No transactions yet</p>
                <p className="text-sm">Transactions will appear here once you start sending them from your POS</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">${tx.amount.toFixed(2)}</span>
                        {getStatusBadge(tx.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {tx.customer_email || "No email"} • {tx.external_transaction_id || tx.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.created_at).toLocaleString()}
                      </p>
                    </div>
                    {tx.pawbucks_awarded && tx.pawbucks_awarded > 0 && (
                      <div className="text-right">
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          +{tx.pawbucks_awarded} PawBucks
                        </Badge>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Create API Key Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Create a new API key for your POS integration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="integration-name">Integration Name</Label>
              <Input
                id="integration-name"
                placeholder="e.g., Main Store POS, Square Integration"
                value={newIntegrationName}
                onChange={(e) => setNewIntegrationName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateApiKey} disabled={creating}>
              {creating ? "Creating..." : "Create API Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show API Key Dialog */}
      <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Save Your API Key
            </DialogTitle>
            <DialogDescription>
              This is the only time you'll see this API key. Copy and save it securely.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <code className="text-sm break-all select-all">{newApiKey}</code>
            </div>
            <Button className="w-full" onClick={handleCopyApiKey}>
              <Copy className="h-4 w-4 mr-2" />
              Copy API Key
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApiKeyDialog(false)}>
              I've Saved It
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
