import { useState, useEffect } from"react";
import { useNavigate } from"react-router-dom";
import { useAuth } from"@/hooks/useAuth";
import { supabase } from"@/integrations/supabase/client";
import { merchantHasActiveService, SERVICE_NAMES } from"@/services/api/merchantServices.service";
import { Button } from"@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Badge } from"@/components/ui/badge";
import { Switch } from"@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from"@/components/ui/dialog";
import { Checkbox } from"@/components/ui/checkbox";
import { toast } from"sonner";
import { ArrowLeft, Key, Plus, Copy, Trash2, AlertTriangle, CheckCircle, ExternalLink, Webhook, Code, Send, RefreshCw, Unlock, History } from "lucide-react";
import { Header } from"@/components/Header";
import { BottomNav } from"@/components/BottomNav";

import { Formatters } from "@/utils/formatters";
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

interface WebhookConfig {
 id: string;
 name: string;
 url: string;
 secret?: string;
 events: string[];
 is_active: boolean;
 last_triggered_at: string | null;
 failure_count: number;
 created_at: string;
}

interface WebhookLog {
 id: string;
 event_type: string;
 success: boolean;
 response_status: number | null;
 duration_ms: number | null;
 created_at: string;
}

const WEBHOOK_EVENTS = [
 { id:'transaction.created', label:'Transaction Created', description:'When a new POS transaction is received' },
 { id:'reward.awarded', label:'Reward Awarded', description:'When PawBucks are awarded to a customer' },
 { id:'customer.matched', label:'Customer Matched', description:'When a transaction is matched to a PawBucks user' },
 { id:'customer.not_found', label:'Customer Not Found', description:'When no matching PawBucks user is found' },
];

const SERVICE_NAME = SERVICE_NAMES.POS_API_INTEGRATION;

export default function MerchantPOSIntegration() {
 const { user, loading: authLoading } = useAuth();
 const navigate = useNavigate();
 const [merchant, setMerchant] = useState<{ id: string; business_name: string } | null>(null);
 const [hasAccess, setHasAccess] = useState(false);
 const [integrations, setIntegrations] = useState<POSIntegration[]>([]);
 const [transactions, setTransactions] = useState<POSTransaction[]>([]);
 const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
 const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
 const [loading, setLoading] = useState(true);
 
 // Dialog states
 const [showCreateKeyDialog, setShowCreateKeyDialog] = useState(false);
 const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
 const [showCreateWebhookDialog, setShowCreateWebhookDialog] = useState(false);
 
 // Form states
 const [newApiKey, setNewApiKey] = useState("");
 const [newIntegrationName, setNewIntegrationName] = useState("");
 const [creating, setCreating] = useState(false);
 const [newWebhook, setNewWebhook] = useState({ name:'', url:'', events: ['transaction.created','reward.awarded'] });

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

 // Check if merchant has purchased the service using the service helper
 const hasService = await merchantHasActiveService(merchantData.id, SERVICE_NAME);
 setHasAccess(hasService);

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
 .limit(50);

 setTransactions(transactionsData || []);

 // Load webhooks
 const { data: webhooksData } = await supabase
 .from("merchant_webhooks")
 .select("id, merchant_id, name, url, events, is_active, last_triggered_at, failure_count, created_at, updated_at")
 .eq("merchant_id", merchantData.id)
 .order("created_at", { ascending: false });

 setWebhooks(webhooksData || []);

 // Load webhook logs (most recent)
 if (webhooksData && webhooksData.length > 0) {
 const webhookIds = webhooksData.map(w => w.id);
 const { data: logsData } = await supabase
 .from("webhook_delivery_logs")
 .select("*")
 .in("webhook_id", webhookIds)
 .order("created_at", { ascending: false })
 .limit(20);

 setWebhookLogs(logsData || []);
 }
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
 setShowCreateKeyDialog(false);
 setShowApiKeyDialog(true);
 setNewIntegrationName("");
 loadData();
 } else {
 throw new Error(data.error ||"Failed to create API key");
 }
 } catch (error: unknown) {
 const errorMessage = error instanceof Error ? error.message :"Failed to create API key";
 toast.error(errorMessage);
 } finally {
 setCreating(false);
 }
 };

 const handleCopyApiKey = () => {
 navigator.clipboard.writeText(newApiKey);
 toast.success("API key copied to clipboard");
 };

 const handleToggleKeyActive = async (integrationId: string, isActive: boolean) => {
 try {
 const { error } = await supabase
 .from("merchant_pos_integrations")
 .update({ is_active: isActive })
 .eq("id", integrationId);

 if (error) throw error;

 setIntegrations(integrations.map(i => 
 i.id === integrationId ? { ...i, is_active: isActive } : i
 ));
 toast.success(isActive ?"API key activated" :"API key deactivated");
 } catch {
 toast.error("Failed to update status");
 }
 };

 const handleDeleteKey = async (integrationId: string) => {
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
 } catch {
 toast.error("Failed to delete API key");
 }
 };

 const handleCreateWebhook = async () => {
 if (!merchant || !newWebhook.url.trim()) {
 toast.error("Please enter a webhook URL");
 return;
 }

 try {
 // Create webhook via edge function so secret is encrypted server-side
 const { data, error } = await supabase.functions.invoke('manage-encrypted-secrets', {
 body: {
 action:'create_webhook',
 merchant_id: merchant.id,
 name: newWebhook.name ||"Default Webhook",
 url: newWebhook.url,
 events: newWebhook.events,
 },
 });

 if (error) throw error;
 if (data?.raw_secret) {
 // Show the raw secret once so the merchant can copy it
 toast.success(`Webhook created! Secret: ${data.raw_secret}`, { duration: 15000 });
 } else {
 toast.success("Webhook created successfully");
 }
 setShowCreateWebhookDialog(false);
 setNewWebhook({ name:'', url:'', events: ['transaction.created','reward.awarded'] });
 loadData();
 } catch {
 toast.error("Failed to create webhook");
 }
 };

 const handleToggleWebhook = async (webhookId: string, isActive: boolean) => {
 try {
 const { error } = await supabase
 .from("merchant_webhooks")
 .update({ is_active: isActive })
 .eq("id", webhookId);

 if (error) throw error;

 setWebhooks(webhooks.map(w => 
 w.id === webhookId ? { ...w, is_active: isActive } : w
 ));
 toast.success(isActive ?"Webhook enabled" :"Webhook disabled");
 } catch {
 toast.error("Failed to update webhook");
 }
 };

 const handleDeleteWebhook = async (webhookId: string) => {
 if (!confirm("Are you sure you want to delete this webhook?")) return;

 try {
 const { error } = await supabase
 .from("merchant_webhooks")
 .delete()
 .eq("id", webhookId);

 if (error) throw error;

 setWebhooks(webhooks.filter(w => w.id !== webhookId));
 toast.success("Webhook deleted");
 } catch {
 toast.error("Failed to delete webhook");
 }
 };

 const getStatusBadge = (status: string) => {
 switch (status) {
 case"rewarded":
 return <Badge className="bg-success text-success-foreground"><CheckCircle className="w-3 h-3 mr-1" />Rewarded</Badge>;
 case"matched":
 return <Badge className="bg-info text-info-foreground"><CheckCircle className="w-3 h-3 mr-1" />Matched</Badge>;
 case"pending":
 return <Badge variant="secondary"><span className="w-3 h-3 mr-1" aria-hidden="true">⏰</span>Pending</Badge>;
 case"failed":
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

 // Service not purchased - show upsell
 if (!hasAccess) {
 return (
 <div className="min-h-screen bg-background pb-20">
 <Header />
 <main className="container max-w-4xl lg:max-w-6xl mx-auto px-4 py-6">
 <div className="flex items-center gap-3 mb-6">
 <Button variant="ghost" size="icon" onClick={() => navigate("/merchant-dashboard")}>
 <ArrowLeft className="h-5 w-5" />
 </Button>
 <h1 className="text-2xl font-bold">POS & API Integration</h1>
 </div>

 <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
 <CardHeader className="text-center pb-4">
 <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
 <span className="w-8 h-8 text-primary" aria-hidden="true">⚡</span>
 </div>
 <CardTitle className="text-2xl">Unlock POS & API Integration</CardTitle>
 <CardDescription className="text-base max-w-lg mx-auto">
 Connect your existing point-of-sale system or custom applications to automatically award PawBucks to your customers.
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-6">
 <div className="grid gap-4 md:grid-cols-2">
 <div className="flex items-start gap-3 p-4 rounded-lg bg-card border">
 <span className="w-5 h-5 text-primary mt-0.5" aria-hidden="true">🔑</span>
 <div>
 <p className="font-medium">Unlimited API Transactions</p>
 <p className="text-sm text-muted-foreground">No limits on transaction volume</p>
 </div>
 </div>
 <div className="flex items-start gap-3 p-4 rounded-lg bg-card border">
 <Webhook className="w-5 h-5 text-primary mt-0.5" />
 <div>
 <p className="font-medium">Webhook Notifications</p>
 <p className="text-sm text-muted-foreground">Real-time event notifications</p>
 </div>
 </div>
 <div className="flex items-start gap-3 p-4 rounded-lg bg-card border">
 <span className="w-5 h-5 text-primary mt-0.5" aria-hidden="true">🛡️</span>
 <div>
 <p className="font-medium">Secure Authentication</p>
 <p className="text-sm text-muted-foreground">HMAC signed webhooks</p>
 </div>
 </div>
 <div className="flex items-start gap-3 p-4 rounded-lg bg-card border">
 <span className="w-5 h-5 text-primary mt-0.5" aria-hidden="true">📖</span>
 <div>
 <p className="font-medium">Developer Support</p>
 <p className="text-sm text-muted-foreground">Priority integration assistance</p>
 </div>
 </div>
 </div>

 <div className="text-center pt-4">
 <p className="text-3xl font-bold mb-2">$149<span className="text-lg font-normal text-muted-foreground">/month</span></p>
 <p className="text-sm text-muted-foreground mb-4">or 111,750 PawBucks</p>
 <Button size="lg" onClick={() => navigate("/merchant/market")}>
 Get Started in Merchant Market
 <ExternalLink className="w-4 h-4 ml-2" />
 </Button>
 </div>
 </CardContent>
 </Card>
 </main>
 <BottomNav />
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-background pb-20">
 <Header variant="merchant" isAuthenticated={true} />
 
 <main className="container max-w-5xl lg:max-w-6xl mx-auto px-4 py-6">
 <div className="flex items-center gap-3 mb-6">
 <Button variant="ghost" size="icon" onClick={() => navigate("/merchant-dashboard")}>
 <ArrowLeft className="h-5 w-5" />
 </Button>
 <div>
 <div className="flex items-center gap-2">
 <h1 className="text-2xl font-bold">POS & API Integration</h1>
 <Badge className="bg-primary">Premium</Badge>
 </div>
 <p className="text-muted-foreground">Connect your systems to award PawBucks automatically</p>
 </div>
 </div>

 <Tabs defaultValue="api-keys" className="space-y-6">
 <TabsList className="grid w-full grid-cols-4">
 <TabsTrigger value="api-keys" className="flex items-center gap-2">
 <span className="w-4 h-4" aria-hidden="true">🔑</span>
 <span className="hidden sm:inline">API Keys</span>
 </TabsTrigger>
 <TabsTrigger value="webhooks" className="flex items-center gap-2">
 <Webhook className="w-4 h-4" />
 <span className="hidden sm:inline">Webhooks</span>
 </TabsTrigger>
 <TabsTrigger value="transactions" className="flex items-center gap-2">
 <History className="w-4 h-4" />
 <span className="hidden sm:inline">Transactions</span>
 </TabsTrigger>
 <TabsTrigger value="docs" className="flex items-center gap-2">
 <Code className="w-4 h-4" />
 <span className="hidden sm:inline">Documentation</span>
 </TabsTrigger>
 </TabsList>

 {/* API Keys Tab */}
 <TabsContent value="api-keys" className="space-y-6">
 <Card>
 <CardHeader>
 <div className="flex items-center justify-between">
 <div>
 <CardTitle className="flex items-center gap-2">
 <span className="h-5 w-5" aria-hidden="true">🔑</span>
 API Keys
 </CardTitle>
 <CardDescription>Manage your POS integration API keys</CardDescription>
 </div>
 <Button onClick={() => setShowCreateKeyDialog(true)}>
 <Plus className="h-4 w-4 mr-2" />
 Create API Key
 </Button>
 </div>
 </CardHeader>
 <CardContent>
 {integrations.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 <span className="h-12 w-12 mx-auto mb-4 opacity-50" aria-hidden="true">🔑</span>
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
 {integration.is_active ? (
 <Badge variant="outline" className="text-success border-success/40">
 <span className="w-3 h-3 mr-1" aria-hidden="true">🔓</span>Active
 </Badge>
 ) : (
 <Badge variant="secondary">
 <span className="w-3 h-3 mr-1" aria-hidden="true">🔒</span>Inactive
 </Badge>
 )}
 </div>
 <code className="text-sm text-muted-foreground">
 {integration.api_key_prefix}...
 </code>
 {integration.last_used_at && (
 <p className="text-xs text-muted-foreground">
 Last used: {new Date(integration.last_used_at).toLocaleString()}
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
 onCheckedChange={(checked) => handleToggleKeyActive(integration.id, checked)}
 />
 </div>
 <Button
 variant="ghost"
 size="icon"
 onClick={() => handleDeleteKey(integration.id)}
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
 </TabsContent>

 {/* Webhooks Tab */}
 <TabsContent value="webhooks" className="space-y-6">
 <Card>
 <CardHeader>
 <div className="flex items-center justify-between">
 <div>
 <CardTitle className="flex items-center gap-2">
 <Webhook className="h-5 w-5" />
 Webhook Endpoints
 </CardTitle>
 <CardDescription>Receive real-time notifications when events occur</CardDescription>
 </div>
 <Button onClick={() => setShowCreateWebhookDialog(true)}>
 <Plus className="h-4 w-4 mr-2" />
 Add Webhook
 </Button>
 </div>
 </CardHeader>
 <CardContent>
 {webhooks.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
 <p>No webhooks configured</p>
 <p className="text-sm">Add a webhook to receive real-time event notifications</p>
 </div>
 ) : (
 <div className="space-y-4">
 {webhooks.map((webhook) => (
 <div key={webhook.id} className="p-4 border rounded-lg space-y-3">
 <div className="flex items-center justify-between">
 <div>
 <div className="flex items-center gap-2">
 <span className="font-medium">{webhook.name}</span>
 {webhook.is_active ? (
 <Badge variant="outline" className="text-success border-success/40">Active</Badge>
 ) : (
 <Badge variant="secondary">Disabled</Badge>
 )}
 {webhook.failure_count > 0 && (
 <Badge variant="destructive">{webhook.failure_count} failures</Badge>
 )}
 </div>
 <code className="text-sm text-muted-foreground break-all">{webhook.url}</code>
 </div>
 <div className="flex items-center gap-2">
 <Switch
 checked={webhook.is_active}
 onCheckedChange={(checked) => handleToggleWebhook(webhook.id, checked)}
 />
 <Button variant="ghost" size="icon" onClick={() => handleDeleteWebhook(webhook.id)}>
 <Trash2 className="h-4 w-4 text-destructive" />
 </Button>
 </div>
 </div>
 <div className="flex flex-wrap gap-2">
 {webhook.events.map((event) => (
 <Badge key={event} variant="secondary" className="text-xs">{event}</Badge>
 ))}
 </div>
 <div className="flex items-center gap-4 text-xs text-muted-foreground">
 <span>Secret: <code>whsec_••••••••</code></span>
 {webhook.last_triggered_at && (
 <span>Last triggered: {new Date(webhook.last_triggered_at).toLocaleString()}</span>
 )}
 </div>
 </div>
 ))}
 </div>
 )}
 </CardContent>
 </Card>

 {/* Recent Webhook Deliveries */}
 {webhookLogs.length > 0 && (
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Send className="h-5 w-5" />
 Recent Deliveries
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-2">
 {webhookLogs.map((log) => (
 <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg text-sm">
 <div className="flex items-center gap-3">
 {log.success ? (
 <CheckCircle className="w-4 h-4 text-success" />
 ) : (
 <AlertTriangle className="w-4 h-4 text-destructive" />
 )}
 <Badge variant="outline">{log.event_type}</Badge>
 <span className="text-muted-foreground">
 {log.response_status && `HTTP ${log.response_status}`}
 </span>
 </div>
 <div className="flex items-center gap-4 text-muted-foreground">
 {log.duration_ms && <span>{log.duration_ms}ms</span>}
 <span>{new Date(log.created_at).toLocaleString()}</span>
 </div>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 )}
 </TabsContent>

 {/* Transactions Tab */}
 <TabsContent value="transactions" className="space-y-6">
 <Card>
 <CardHeader>
 <div className="flex items-center justify-between">
 <div>
 <CardTitle>POS Transactions</CardTitle>
 <CardDescription>Transactions submitted from your integrated systems</CardDescription>
 </div>
 <Button variant="outline" onClick={loadData}>
 <RefreshCw className="h-4 w-4 mr-2" />
 Refresh
 </Button>
 </div>
 </CardHeader>
 <CardContent>
 {transactions.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 <span className="h-12 w-12 mx-auto mb-4 opacity-50" aria-hidden="true">⏰</span>
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
 <span className="font-medium">{Formatters.currency(tx.amount)}</span>
 {getStatusBadge(tx.status)}
 </div>
 <p className="text-sm text-muted-foreground">
 {tx.customer_email ||"No email"} • {tx.external_transaction_id || tx.id.slice(0, 8)}
 </p>
 <p className="text-xs text-muted-foreground">
 {new Date(tx.created_at).toLocaleString()}
 </p>
 </div>
 {tx.pawbucks_awarded && tx.pawbucks_awarded > 0 && (
 <div className="text-right">
 <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
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
 </TabsContent>

 {/* Documentation Tab */}
 <TabsContent value="docs" className="space-y-6">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Code className="h-5 w-5" />
 API Reference
 </CardTitle>
 <CardDescription>Complete documentation for integrating with the PawBucks API</CardDescription>
 </CardHeader>
 <CardContent className="space-y-6">
 {/* Submit Transaction Endpoint */}
 <div className="space-y-4">
 <h3 className="font-semibold text-lg flex items-center gap-2">
 <Badge>POST</Badge> Submit Transaction
 </h3>
 <div>
 <Label className="text-sm font-medium">Endpoint</Label>
 <div className="flex items-center gap-2 mt-1">
 <code className="flex-1 p-3 bg-muted rounded-md text-sm break-all">
 https://yxpnkipcoxksmnsvpvwi.supabase.co/functions/v1/pos-submit-transaction
 </code>
 <Button variant="outline" size="icon" onClick={() => {
 navigator.clipboard.writeText("https://yxpnkipcoxksmnsvpvwi.supabase.co/functions/v1/pos-submit-transaction");
 toast.success("Copied!");
 }}>
 <Copy className="h-4 w-4" />
 </Button>
 </div>
 </div>
 <div>
 <Label className="text-sm font-medium">Headers</Label>
 <pre className="mt-1 p-3 bg-muted rounded-md text-sm overflow-x-auto">
{`Content-Type: application/json
x-api-key: pk_live_XXXXXXXX...`}
 </pre>
 </div>
 <div>
 <Label className="text-sm font-medium">Request Body</Label>
 <pre className="mt-1 p-3 bg-muted rounded-md text-sm overflow-x-auto">
{`{
"transaction_id":"POS-12345", // Optional: Your system's transaction ID
"customer_email":"user@example.com", // Required: Email OR phone
"customer_phone":"555-123-4567", // Required: Phone OR email
"amount": 45.99, // Required: Transaction amount
"currency":"USD", // Optional: Default USD
"items": [ // Optional: Line items
 {"name":"Dog Food","quantity": 1,"price": 35.99 },
 {"name":"Dog Treats","quantity": 2,"price": 5.00 }
 ],
"timestamp":"2024-01-15T14:30:00Z" // Optional: Transaction time
}`}
 </pre>
 </div>
 <div>
 <Label className="text-sm font-medium">Response</Label>
 <pre className="mt-1 p-3 bg-muted rounded-md text-sm overflow-x-auto">
{`{
"success": true,
"transaction_id":"uuid-here",
"status":"rewarded", // rewarded | matched | pending
"matched_user": true,
"pawbucks_awarded": 450,
"message":"Transaction processed. 450 PawBucks awarded."
}`}
 </pre>
 </div>
 </div>

 {/* Webhook Documentation */}
 <div className="pt-6 border-t space-y-4">
 <h3 className="font-semibold text-lg flex items-center gap-2">
 <Webhook className="h-5 w-5" />
 Webhook Events
 </h3>
 <p className="text-sm text-muted-foreground">
 Webhooks are sent as POST requests with a JSON body. Verify the signature using the 
 <code className="mx-1 px-1 bg-muted rounded">X-Webhook-Signature</code> header.
 </p>
 <div className="grid gap-4">
 {WEBHOOK_EVENTS.map((event) => (
 <div key={event.id} className="p-4 border rounded-lg">
 <div className="flex items-center gap-2 mb-1">
 <Badge variant="outline">{event.id}</Badge>
 <span className="font-medium">{event.label}</span>
 </div>
 <p className="text-sm text-muted-foreground">{event.description}</p>
 </div>
 ))}
 </div>
 <div>
 <Label className="text-sm font-medium">Example Payload</Label>
 <pre className="mt-1 p-3 bg-muted rounded-md text-sm overflow-x-auto">
{`{
"event":"reward.awarded",
"timestamp":"2024-01-15T14:30:00Z",
"data": {
"transaction_id":"uuid-here",
"external_transaction_id":"POS-12345",
"customer_email":"user@example.com",
"amount": 45.99,
"pawbucks_awarded": 450
 }
}`}
 </pre>
 </div>
 </div>

 {/* Support */}
 <div className="pt-6 border-t">
 <h3 className="font-semibold text-lg mb-3">Developer Support</h3>
 <p className="text-sm text-muted-foreground mb-4">
 As a POS & API Integration subscriber, you have access to priority developer support 
 for custom integration assistance.
 </p>
 <Button variant="outline" onClick={() => navigate("/merchant-dashboard")}>
 <span className="h-4 w-4 mr-2" aria-hidden="true">📖</span>
 Contact Developer Support
 </Button>
 </div>
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>
 </main>

 {/* Create API Key Dialog */}
 <Dialog open={showCreateKeyDialog} onOpenChange={setShowCreateKeyDialog}>
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
 <Button variant="outline" onClick={() => setShowCreateKeyDialog(false)}>
 Cancel
 </Button>
 <Button onClick={handleCreateApiKey} disabled={creating}>
 {creating ?"Creating..." :"Create API Key"}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* Show API Key Dialog */}
 <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <AlertTriangle className="h-5 w-5 text-warning" />
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

 {/* Create Webhook Dialog */}
 <Dialog open={showCreateWebhookDialog} onOpenChange={setShowCreateWebhookDialog}>
 <DialogContent className="max-w-lg">
 <DialogHeader>
 <DialogTitle>Add Webhook Endpoint</DialogTitle>
 <DialogDescription>
 Configure a URL to receive real-time event notifications
 </DialogDescription>
 </DialogHeader>
 <div className="space-y-4">
 <div>
 <Label htmlFor="webhook-name">Name</Label>
 <Input
 id="webhook-name"
 placeholder="e.g., Production Webhook"
 value={newWebhook.name}
 onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
 />
 </div>
 <div>
 <Label htmlFor="webhook-url">Endpoint URL</Label>
 <Input
 id="webhook-url"
 placeholder="https://your-server.com/webhook"
 value={newWebhook.url}
 onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
 />
 </div>
 <div>
 <Label className="mb-2 block">Events to Subscribe</Label>
 <div className="space-y-2">
 {WEBHOOK_EVENTS.map((event) => (
 <div key={event.id} className="flex items-center space-x-2">
 <Checkbox
 id={event.id}
 checked={newWebhook.events.includes(event.id)}
 onCheckedChange={(checked) => {
 if (checked) {
 setNewWebhook({ ...newWebhook, events: [...newWebhook.events, event.id] });
 } else {
 setNewWebhook({ ...newWebhook, events: newWebhook.events.filter(e => e !== event.id) });
 }
 }}
 />
 <Label htmlFor={event.id} className="text-sm font-normal cursor-pointer">
 {event.label}
 </Label>
 </div>
 ))}
 </div>
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => setShowCreateWebhookDialog(false)}>
 Cancel
 </Button>
 <Button onClick={handleCreateWebhook}>
 Create Webhook
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 <BottomNav />
 </div>
 );
}
