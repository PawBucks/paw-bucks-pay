import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Search,
  RefreshCw,
  Download,
  UserPlus,
  Mail,
  Phone,
  Repeat,
  DollarSign,
  BookmarkPlus,
  Trash2,
  Pencil,
} from "lucide-react";
import { MerchantWorkspaceLayout } from "@/components/merchant/workspace/MerchantWorkspaceLayout";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClientManager } from "@/components/invoicing";
import { supabase } from "@/integrations/supabase/client";
import { useMerchantContext } from "@/hooks/useMerchantContext";
import { invoicingService, type InvoiceClient } from "@/services/api/invoicing.service";
import { Formatters } from "@/utils/formatters";
import { formatDateOnly } from "@/lib/timezone";
import { toast } from "sonner";

type Customer = {
  key: string;
  userId?: string;
  clientId?: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  sources: string[];
  transactions: number;
  bookings: number;
  totalSpent: number;
  rewardsEarned: number;
  lastActivity?: string;
  subscriptionStatus?: string;
  marketingOptOut: boolean;
  saved: boolean;
};

type Summary = {
  total: number;
  saved: number;
  platform: number;
  subscribers: number;
  repeat: number;
  totalSpent: number;
};

const SOURCE_LABELS: Record<string, string> = {
  purchase: "Purchase",
  booking: "Booking",
  subscriber: "Subscriber",
  contact: "Saved contact",
};

export default function MerchantCustomers() {
  const navigate = useNavigate();
  const { merchantId, loading: merchantLoading } = useMerchantContext();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent");

  const [clients, setClients] = useState<InvoiceClient[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);

  const loadCustomers = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("merchant-customers");
    if (error || !data?.success) {
      toast.error("Could not load customers");
      setCustomers([]);
      setSummary(null);
    } else {
      setCustomers(data.customers || []);
      setSummary(data.summary || null);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  const loadClients = useCallback(async () => {
    if (!merchantId) return;
    setClientsLoading(true);
    const { data } = await invoicingService.getClients(merchantId);
    setClients(data || []);
    setClientsLoading(false);
  }, [merchantId]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    if (!merchantLoading) loadClients();
  }, [merchantLoading, loadClients]);

  const refreshAll = () => {
    setRefreshing(true);
    loadCustomers();
    loadClients();
  };

  const handleCreateClient = async (data: Partial<InvoiceClient>) => {
    if (!merchantId) throw new Error("No merchant");
    const { error } = await invoicingService.createClient({ ...data, merchant_id: merchantId });
    if (error) throw error;
    loadCustomers();
  };

  const handleUpdateClient = async (clientId: string, data: Partial<InvoiceClient>) => {
    const { error } = await invoicingService.updateClient(clientId, data);
    if (error) throw error;
    loadCustomers();
  };

  const handleDeleteClient = async (clientId: string) => {
    const { error } = await invoicingService.deleteClient(clientId);
    if (error) throw error;
    loadCustomers();
  };

  const saveAsContact = async (customer: Customer) => {
    if (!merchantId) return;
    if (!customer.email) {
      toast.error("This customer has no email on file");
      return;
    }
    const { error } = await invoicingService.createClient({
      merchant_id: merchantId,
      name: customer.name,
      email: customer.email,
      phone: customer.phone || null,
    });
    if (error) {
      toast.error("Could not save contact");
      return;
    }
    toast.success(`${customer.name} added to your customer list`);
    loadClients();
    loadCustomers();
  };

  const removeContact = async (customer: Customer) => {
    if (!customer.clientId) return;
    if (!confirm(`Remove ${customer.name} from your customer list?`)) return;
    const { error } = await invoicingService.deleteClient(customer.clientId);
    if (error) {
      toast.error("Could not remove customer");
      return;
    }
    toast.success("Customer removed");
    loadClients();
    loadCustomers();
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let rows = customers.filter((c) => {
      if (sourceFilter !== "all" && !c.sources.includes(sourceFilter)) return false;
      if (!term) return true;
      return (
        c.name.toLowerCase().includes(term) ||
        (c.email || "").toLowerCase().includes(term) ||
        (c.phone || "").toLowerCase().includes(term) ||
        (c.company || "").toLowerCase().includes(term)
      );
    });
    rows = [...rows].sort((a, b) => {
      if (sortBy === "spend") return b.totalSpent - a.totalSpent;
      if (sortBy === "visits") return b.transactions + b.bookings - (a.transactions + a.bookings);
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return (b.lastActivity || "").localeCompare(a.lastActivity || "");
    });
    return rows;
  }, [customers, search, sourceFilter, sortBy]);

  const exportCsv = () => {
    const header = [
      "Name",
      "Email",
      "Phone",
      "Company",
      "Sources",
      "Purchases",
      "Bookings",
      "Total Spent",
      "Last Activity",
      "Marketing Opt-Out",
    ];
    const rows = filtered.map((c) => [
      c.name,
      c.email || "",
      c.phone || "",
      c.company || "",
      c.sources.join(" / "),
      c.transactions,
      c.bookings,
      c.totalSpent.toFixed(2),
      c.lastActivity ? formatDateOnly(c.lastActivity) : "",
      c.marketingOptOut ? "yes" : "no",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = [
    { label: "Total Customers", value: summary?.total ?? 0, icon: Users },
    { label: "Repeat Customers", value: summary?.repeat ?? 0, icon: Repeat },
    { label: "Saved Contacts", value: summary?.saved ?? 0, icon: BookmarkPlus },
    {
      label: "Lifetime Revenue",
      value: Formatters.currency(summary?.totalSpent ?? 0),
      icon: DollarSign,
    },
  ];

  return (
    <>
      <SEO
        title="Customers · Merchant Workspace"
        description="Manage every customer who has purchased, booked, or subscribed with your business."
      />
      <MerchantWorkspaceLayout>
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Users className="h-6 w-6 text-primary" />
                Customers
              </h1>
              <p className="text-sm text-muted-foreground">
                Everyone who purchased, booked, subscribed, or was added by you.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={refreshAll} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <Card key={s.label}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      <Icon className="h-4 w-4" />
                      {s.label}
                    </div>
                    <p className="text-2xl font-bold mt-1">
                      {loading ? <Skeleton className="h-7 w-20" /> : s.value}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All Customers</TabsTrigger>
              <TabsTrigger value="manage">Manage Customer List</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, phone, or company..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-full md:w-[190px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sources</SelectItem>
                    <SelectItem value="purchase">Purchases</SelectItem>
                    <SelectItem value="booking">Bookings</SelectItem>
                    <SelectItem value="subscriber">Subscribers</SelectItem>
                    <SelectItem value="contact">Saved contacts</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Most recent</SelectItem>
                    <SelectItem value="spend">Highest spend</SelectItem>
                    <SelectItem value="visits">Most visits</SelectItem>
                    <SelectItem value="name">Name (A–Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-1">No customers found</h3>
                    <p className="text-muted-foreground text-sm">
                      {search || sourceFilter !== "all"
                        ? "Try adjusting your search or filters."
                        : "Customers appear here after their first purchase, booking, or when you add them manually."}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filtered.map((c) => (
                    <Card key={c.key}>
                      <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold truncate">{c.name}</p>
                            {c.sources.map((s) => (
                              <Badge key={s} variant="secondary" className="text-[10px]">
                                {SOURCE_LABELS[s] || s}
                              </Badge>
                            ))}
                            {c.subscriptionStatus === "active" && (
                              <Badge className="text-[10px]">Active subscription</Badge>
                            )}
                            {c.marketingOptOut && (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                Do not contact
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                            {c.email && (
                              <p className="flex items-center gap-2 truncate">
                                <Mail className="h-3.5 w-3.5" />
                                {c.email}
                              </p>
                            )}
                            {c.phone && (
                              <p className="flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5" />
                                {c.phone}
                              </p>
                            )}
                            {c.lastActivity && (
                              <p className="text-xs">Last activity {formatDateOnly(c.lastActivity)}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-6 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Purchases</p>
                            <p className="font-semibold">{c.transactions}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Bookings</p>
                            <p className="font-semibold">{c.bookings}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Spent</p>
                            <p className="font-semibold">{Formatters.currency(c.totalSpent)}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {c.saved ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeContact(c)}
                            >
                              <Trash2 className="h-4 w-4 mr-1.5" />
                              Remove
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => saveAsContact(c)}>
                              <BookmarkPlus className="h-4 w-4 mr-1.5" />
                              Add to list
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate("/merchant/invoicing")}
                          >
                            <Pencil className="h-4 w-4 mr-1.5" />
                            Invoice
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate("/merchant/messages")}
                          >
                            <Mail className="h-4 w-4 mr-1.5" />
                            Message
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="manage">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Customer records you manage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ClientManager
                    clients={clients}
                    loading={clientsLoading || merchantLoading}
                    onCreateClient={handleCreateClient}
                    onUpdateClient={handleUpdateClient}
                    onDeleteClient={handleDeleteClient}
                    onRefresh={loadClients}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </MerchantWorkspaceLayout>
    </>
  );
}
