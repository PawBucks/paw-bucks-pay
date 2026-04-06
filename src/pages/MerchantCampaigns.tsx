import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Bell, Mail, MessageSquare, Send, Settings, Plus, Users, CheckCircle, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

interface Campaign {
  id: string;
  title: string;
  message: string;
  channel: string;
  recipient_type: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  status: string;
  sent_at: string | null;
  created_at: string;
}

interface Recipient {
  userId: string;
  name: string;
  phone?: string;
  email?: string;
}

interface TwilioSettings {
  twilio_account_sid: string;
  twilio_auth_token: string;
  twilio_phone_number: string;
}

export default function MerchantCampaigns() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState<"push" | "email" | "sms">("push");
  const [recipientType, setRecipientType] = useState("all");

  // Twilio settings
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioToken, setTwilioToken] = useState("");
  const [twilioPhone, setTwilioPhone] = useState("");
  const [hasTwilio, setHasTwilio] = useState(false);
  const [savingTwilio, setSavingTwilio] = useState(false);

  useEffect(() => {
    if (user) loadMerchant();
  }, [user]);

  async function loadMerchant() {
    const { data: merchant } = await supabase
      .from("merchants")
      .select("id")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (!merchant) {
      // Check vet
      const { data: vet } = await supabase
        .from("partner_vets")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      
      if (vet) {
        const { data: vetMerchant } = await supabase
          .from("merchants")
          .select("id")
          .eq("user_id", user!.id)
          .maybeSingle();
        if (vetMerchant) setMerchantId(vetMerchant.id);
      }
    } else {
      setMerchantId(merchant.id);
    }
  }

  useEffect(() => {
    if (merchantId) {
      loadCampaigns();
      loadTwilioSettings();
    }
  }, [merchantId]);

  async function loadCampaigns() {
    setLoading(true);
    const { data } = await supabase
      .from("merchant_campaigns")
      .select("*")
      .eq("merchant_id", merchantId!)
      .order("created_at", { ascending: false });
    setCampaigns((data as Campaign[]) || []);
    setLoading(false);
  }

  async function loadTwilioSettings() {
    const { data } = await supabase
      .from("merchant_twilio_settings_safe" as any)
      .select("*")
      .eq("merchant_id", merchantId!)
      .maybeSingle();
    if (data) {
      setHasTwilio(true);
      setTwilioSid((data as any).twilio_account_sid || "");
      setTwilioToken(""); // Don't show token
      setTwilioPhone((data as any).twilio_phone_number || "");
    }
  }

  async function loadRecipients() {
    if (!merchantId) return;
    setLoadingRecipients(true);

    // Get customers: people who transacted, subscribed, or follow
    const { data: transactions } = await supabase
      .from("transactions")
      .select("user_id")
      .eq("merchant_id", merchantId)
      .eq("status", "completed");

    const { data: subscribers } = await supabase
      .from("merchant_subscriptions")
      .select("user_id")
      .eq("merchant_id", merchantId)
      .eq("status", "active");

    // Combine unique user IDs
    const userIds = new Set<string>();
    transactions?.forEach((t: any) => t.user_id && userIds.add(t.user_id));
    subscribers?.forEach((s: any) => s.user_id && userIds.add(s.user_id));

    if (userIds.size === 0) {
      setRecipients([]);
      setLoadingRecipients(false);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, phone, email")
      .in("id", Array.from(userIds));

    const recipientList: Recipient[] = (profiles || []).map((p: any) => ({
      userId: p.id,
      name: p.full_name || "Unknown",
      phone: p.phone || undefined,
      email: p.email || undefined,
    }));

    setRecipients(recipientList);
    setLoadingRecipients(false);
  }

  useEffect(() => {
    if (showCreate && merchantId) loadRecipients();
  }, [showCreate, merchantId]);

  async function handleSend() {
    if (!title.trim() || !message.trim()) {
      toast.error("Please fill in title and message");
      return;
    }

    const filteredRecipients = recipients.filter((r) => {
      if (channel === "sms") return !!r.phone;
      if (channel === "email") return !!r.email;
      return true;
    });

    if (filteredRecipients.length === 0) {
      toast.error(`No recipients with ${channel === "sms" ? "phone numbers" : channel === "email" ? "email addresses" : "accounts"} found`);
      return;
    }

    if (channel === "sms" && !hasTwilio) {
      toast.error("Please configure your Twilio settings first");
      setShowSettings(true);
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("merchant-send-campaign", {
        body: { title, message, channel, recipientType, recipients: filteredRecipients },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Campaign sent! ${data.sent} delivered, ${data.failed} failed`);
        setShowCreate(false);
        setTitle("");
        setMessage("");
        loadCampaigns();
      } else {
        toast.error(data?.error || "Failed to send campaign");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send campaign");
    } finally {
      setSending(false);
    }
  }

  async function handleSaveTwilio() {
    if (!twilioSid.trim() || !twilioPhone.trim()) {
      toast.error("Please fill in all Twilio fields");
      return;
    }

    setSavingTwilio(true);
    try {
      if (hasTwilio) {
        const updates: any = {
          twilio_account_sid: twilioSid,
          twilio_phone_number: twilioPhone,
        };
        if (twilioToken.trim()) updates.twilio_auth_token = twilioToken;

        const { error } = await supabase
          .from("merchant_twilio_settings")
          .update(updates)
          .eq("merchant_id", merchantId!);
        if (error) throw error;
      } else {
        if (!twilioToken.trim()) {
          toast.error("Auth token is required for initial setup");
          setSavingTwilio(false);
          return;
        }
        const { error } = await supabase
          .from("merchant_twilio_settings")
          .insert({
            merchant_id: merchantId!,
            twilio_account_sid: twilioSid,
            twilio_auth_token: twilioToken,
            twilio_phone_number: twilioPhone,
          });
        if (error) throw error;
      }

      toast.success("Twilio settings saved");
      setHasTwilio(true);
      setShowSettings(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSavingTwilio(false);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent": return <Badge className="bg-green-500/10 text-green-600 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Sent</Badge>;
      case "partial": return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200"><Clock className="w-3 h-3 mr-1" />Partial</Badge>;
      case "failed": return <Badge className="bg-red-500/10 text-red-600 border-red-200"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case "sending": return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200"><Send className="w-3 h-3 mr-1" />Sending</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getChannelIcon = (ch: string) => {
    switch (ch) {
      case "push": return <Bell className="w-4 h-4" />;
      case "email": return <Mail className="w-4 h-4" />;
      case "sms": return <MessageSquare className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Campaigns</h1>
              <p className="text-muted-foreground text-sm">Reach your customers via push, email & text</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
              <Settings className="w-4 h-4 mr-1" />SMS Settings
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-1" />New Campaign
            </Button>
          </div>
        </div>

        {/* Campaign History */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Campaign History</h2>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading campaigns...</div>
          ) : campaigns.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Send className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">No campaigns yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Create your first campaign to engage your customers</p>
                <Button className="mt-4" onClick={() => setShowCreate(true)}>
                  <Plus className="w-4 h-4 mr-1" />Create Campaign
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => (
                <Card key={c.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                          {getChannelIcon(c.channel)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium truncate">{c.title}</h3>
                            {getStatusBadge(c.status)}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{c.message}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />{c.recipient_count} recipients
                            </span>
                            <span className="text-green-600">{c.sent_count} sent</span>
                            {c.failed_count > 0 && <span className="text-red-500">{c.failed_count} failed</span>}
                            <span>{new Date(c.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Create Campaign Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Campaign</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Channel</Label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {[
                    { value: "push" as const, icon: Bell, label: "Push" },
                    { value: "email" as const, icon: Mail, label: "Email" },
                    { value: "sms" as const, icon: MessageSquare, label: "SMS" },
                  ].map((ch) => (
                    <Button
                      key={ch.value}
                      variant={channel === ch.value ? "default" : "outline"}
                      className="flex-col h-auto py-3"
                      onClick={() => setChannel(ch.value)}
                    >
                      <ch.icon className="w-5 h-5 mb-1" />
                      <span className="text-xs">{ch.label}</span>
                    </Button>
                  ))}
                </div>
                {channel === "sms" && !hasTwilio && (
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ Configure your Twilio account in SMS Settings first
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="title">Campaign Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Weekend Special 🐾"
                />
              </div>

              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write your message to customers..."
                  rows={4}
                />
                {channel === "sms" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {message.length}/160 characters ({Math.ceil(message.length / 160) || 1} SMS segment{Math.ceil(message.length / 160) > 1 ? "s" : ""})
                  </p>
                )}
              </div>

              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm font-medium mb-1">
                  <Users className="w-4 h-4" />
                  Recipients
                </div>
                {loadingRecipients ? (
                  <p className="text-xs text-muted-foreground">Loading customers...</p>
                ) : (
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>{recipients.length} total customers</p>
                    {channel === "sms" && (
                      <p>{recipients.filter((r) => r.phone).length} with phone numbers</p>
                    )}
                    {channel === "email" && (
                      <p>{recipients.filter((r) => r.email).length} with email addresses</p>
                    )}
                  </div>
                )}
              </div>

              <Button
                className="w-full"
                onClick={handleSend}
                disabled={sending || !title.trim() || !message.trim()}
              >
                {sending ? "Sending..." : "Send Campaign"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Twilio Settings Dialog */}
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>SMS Settings (Twilio)</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">
                Connect your own Twilio account to send SMS campaigns to your customers.
                Get credentials from{" "}
                <a href="https://console.twilio.com" target="_blank" rel="noopener" className="text-primary underline">
                  console.twilio.com
                </a>
              </p>
              <div>
                <Label htmlFor="sid">Account SID</Label>
                <Input
                  id="sid"
                  value={twilioSid}
                  onChange={(e) => setTwilioSid(e.target.value)}
                  placeholder="AC..."
                />
              </div>
              <div>
                <Label htmlFor="token">Auth Token {hasTwilio && "(leave blank to keep existing)"}</Label>
                <Input
                  id="token"
                  type="password"
                  value={twilioToken}
                  onChange={(e) => setTwilioToken(e.target.value)}
                  placeholder="••••••••••"
                />
              </div>
              <div>
                <Label htmlFor="phone">Twilio Phone Number</Label>
                <Input
                  id="phone"
                  value={twilioPhone}
                  onChange={(e) => setTwilioPhone(e.target.value)}
                  placeholder="+1234567890"
                />
              </div>
              <Button className="w-full" onClick={handleSaveTwilio} disabled={savingTwilio}>
                {savingTwilio ? "Saving..." : hasTwilio ? "Update Settings" : "Save Settings"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
