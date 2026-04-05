import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AddTransactionTool } from "@/components/admin/AddTransactionTool";
import { PawBucksManagementTool } from "@/components/admin/PawBucksManagementTool";
import { PawBucksCreditLogsTab } from "@/components/admin/PawBucksCreditLogsTab";
import { PawBucksDebitLogsTab } from "@/components/admin/PawBucksDebitLogsTab";
import { SecurityMonitoringTab } from "@/components/admin/SecurityMonitoringTab";
import { ConsultationBookingsTab } from "@/components/admin/ConsultationBookingsTab";
import FeedbackTab from "@/components/admin/FeedbackTab";
import { SupportTicketsTab } from "@/components/admin/SupportTicketsTab";
import { NonPartnerReceiptVerificationTab } from "@/components/admin/NonPartnerReceiptVerificationTab";
import { EmailTab } from "@/components/admin/EmailTab";
import { TextCampaignsTab } from "@/components/admin/TextCampaignsTab";
import { UsersTab } from "@/components/admin/UsersTab";
import { UserLookupTab } from "@/components/admin/UserLookupTab";
import { MerchantsTab } from "@/components/admin/MerchantsTab";
import { TransactionsTab } from "@/components/admin/TransactionsTab";
import { RewardsTab } from "@/components/admin/RewardsTab";
import { FinancingTab } from "@/components/admin/FinancingTab";
import { ProductsTab } from "@/components/admin/ProductsTab";
import { BadgePromotionsTab } from "@/components/admin/BadgePromotionsTab";
import { CMSTab } from "@/components/admin/CMSTab";
import { TrainingCourseManagementTab } from "@/components/admin/TrainingCourseManagementTab";
import { SettingsTab } from "@/components/admin/SettingsTab";
import { OverviewTab } from "@/components/admin/OverviewTab";
import { AnalyticsTab } from "@/components/admin/AnalyticsTab";
import { AuditLogsTab } from "@/components/admin/AuditLogsTab";
import { AdminInvoicingTab } from "@/components/admin/AdminInvoicingTab";
import { ApprovalsTab } from "@/components/admin/ApprovalsTab";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  LogOut,
  Shield,
  Users,
  Store,
  DollarSign,
  FileText,
  Bell,
  Loader2,
  ShieldAlert,
  CalendarDays,
  MessageSquare,
  Receipt,
  Mail,
  LayoutDashboard,
  Settings,
  BarChart3,
  Package,
  FileEdit,
  Banknote,
  History,
  Menu,
  ChevronRight,
  HelpCircle,
  GraduationCap,
  ExternalLink,
  Clock,
  Gift,
  UserSearch,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Define navigation sections with descriptions for clarity
const NAV_SECTIONS = [
  {
    title: "Dashboard",
    items: [
      {
        id: "overview",
        label: "Overview",
        icon: LayoutDashboard,
        description: "Platform statistics and key metrics at a glance",
      },
      {
        id: "analytics",
        label: "Analytics",
        icon: BarChart3,
        description: "Detailed charts and insights about platform performance",
      },
    ],
  },
  {
    title: "User Management",
    items: [
      {
        id: "approvals",
        label: "Pending Approvals",
        icon: Clock,
        description: "Review and approve new Merchant and Vet applications",
      },
      {
        id: "users",
        label: "Users",
        icon: Users,
        description: "View, edit, and manage all registered users including role assignments",
      },
      {
        id: "merchants",
        label: "Merchants",
        icon: Store,
        description: "Manage merchant accounts, points rates, and Stripe status",
      },
      {
        id: "user-lookup",
        label: "User Lookup",
        icon: UserSearch,
        description: "Search for any user and view their full platform history",
      },
    ],
  },
  {
    title: "Financial",
    items: [
      {
        id: "transactions",
        label: "Transactions",
        icon: FileText,
        description: "View all platform transactions, issue refunds, and track revenue",
      },
      {
        id: "rewards",
        label: "PawBucks Rewards",
        icon: DollarSign,
        description: "Configure earn/conversion rates and manually credit/debit PawBucks",
      },
      {
        id: "financing",
        label: "Financing & Loans",
        icon: Banknote,
        description: "Approve or deny merchant funding requests and consumer vet loans",
      },
      {
        id: "invoicing",
        label: "Invoicing",
        icon: Receipt,
        description: "Create and manage invoices for billing merchants and vets",
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        id: "receipts",
        label: "Receipt Verification",
        icon: Receipt,
        description: "Review and approve non-partner receipt submissions for PawBucks",
      },
      {
        id: "consultations",
        label: "Consultations",
        icon: CalendarDays,
        description: "View and manage scheduled consultation bookings",
      },
      {
        id: "feedback",
        label: "User Feedback",
        icon: MessageSquare,
        description: "Review, respond to, and resolve user feedback submissions",
      },
      {
        id: "support-tickets",
        label: "Support Tickets",
        icon: HelpCircle,
        description: "Manage detailed support tickets from merchants, vets, and pet owners",
      },
    ],
  },
  {
    title: "Content & Products",
    items: [
      {
        id: "products",
        label: "Pet Store Products",
        icon: Package,
        description: "Add, edit, and manage products available in the Pet Store",
      },
      {
        id: "badge-promotions",
        label: "Guilt-Free Splurge",
        icon: Gift,
        description: "Manage promotional discounts for badge earners in the Pet Store",
      },
      {
        id: "cms",
        label: "Content Management",
        icon: FileEdit,
        description: "Manage banners, promotions, and platform announcements",
      },
      {
        id: "training-course",
        label: "Training Course",
        icon: GraduationCap,
        description: "Manage modules, lessons, and resources for the Exclusive Training Course",
      },
    ],
  },
  {
    title: "Communication",
    items: [
      {
        id: "notifications",
        label: "Push Notifications",
        icon: Bell,
        description: "Send in-app notifications to users, merchants, or everyone",
      },
      {
        id: "email",
        label: "Email Campaigns",
        icon: Mail,
        description: "Send bulk or individual emails to users and merchants",
      },
      {
        id: "text-campaigns",
        label: "Text Campaigns",
        icon: MessageSquare,
        description: "Send SMS text messages to users and merchants with phone numbers",
      },
    ],
  },
  {
    title: "Security & Logs",
    items: [
      {
        id: "security",
        label: "Security Monitoring",
        icon: ShieldAlert,
        description: "Monitor failed login attempts, suspicious activity, and security alerts",
      },
      {
        id: "audit",
        label: "Audit Logs",
        icon: History,
        description: "Track all admin actions and changes made to the platform",
      },
      {
        id: "pawbucks-credit-logs",
        label: "PawBucks Credit Logs",
        icon: DollarSign,
        description: "View history of manual PawBucks credits",
      },
      {
        id: "pawbucks-debit-logs",
        label: "PawBucks Debit Logs",
        icon: DollarSign,
        description: "View history of manual PawBucks debits",
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        id: "settings",
        label: "Settings",
        icon: Settings,
        description: "Configure security settings, 2FA, and platform configuration",
      },
    ],
  },
];

const AdminDashboard = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/admin");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      checkAdminAccess();
    }
  }, [user]);

  const checkAdminAccess = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "superadmin"]);

      if (error || !data || data.length === 0) {
        toast.error("Access denied. Admin privileges required.");
        await supabase.auth.signOut();
        navigate("/admin");
        return;
      }

      const hasSuperAdmin = data.some(r => r.role === "superadmin");
      setIsSuperAdmin(hasSuperAdmin);
      setIsAdmin(true);
    } catch (error) {
      console.error("Error checking admin access:", error);
      await supabase.auth.signOut();
      navigate("/admin");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate("/admin");
  }, [signOut, navigate]);

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
    setMobileNavOpen(false);
  }, []);

  // Find current tab info for header
  const currentTabInfo = useMemo(() => {
    for (const section of NAV_SECTIONS) {
      const item = section.items.find(i => i.id === activeTab);
      if (item) return item;
    }
    return NAV_SECTIONS[0].items[0];
  }, [activeTab]);

  // Render tab content
  const renderTabContent = useCallback(() => {
    switch (activeTab) {
      case "overview":
        return <OverviewTab />;
      case "analytics":
        return <AnalyticsTab />;
      case "approvals":
        return <ApprovalsTab />;
      case "users":
        return <UsersTab />;
      case "merchants":
        return <MerchantsTab />;
      case "user-lookup":
        return <UserLookupTab />;
      case "transactions":
        return <TransactionsTab />;
      case "rewards":
        return <RewardsTab />;
      case "financing":
        return <FinancingTab />;
      case "invoicing":
        return <AdminInvoicingTab />;
      case "receipts":
        return <NonPartnerReceiptVerificationTab />;
      case "consultations":
        return <ConsultationBookingsTab />;
      case "feedback":
        return <FeedbackTab />;
      case "support-tickets":
        return <SupportTicketsTab />;
      case "products":
        return <ProductsTab />;
      case "badge-promotions":
        return <BadgePromotionsTab />;
      case "cms":
        return <CMSTab />;
      case "training-course":
        return <TrainingCourseManagementTab />;
      case "notifications":
        return <NotificationsTab />;
      case "email":
        return <EmailTab />;
      case "text-campaigns":
        return <TextCampaignsTab />;
      case "security":
        return <SecurityMonitoringTab />;
      case "audit":
        return <AuditLogsTab />;
      case "pawbucks-credit-logs":
        return <PawBucksCreditLogsTab />;
      case "pawbucks-debit-logs":
        return <PawBucksDebitLogsTab />;
      case "settings":
        return <SettingsTab />;
      default:
        return <OverviewTab />;
    }
  }, [activeTab]);

  // Navigation sidebar component
  const NavigationSidebar = ({ className }: { className?: string }) => (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Logo and Title */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Admin Dashboard</h1>
            <p className="text-xs text-muted-foreground">PawBucks Platform</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Badge variant={isSuperAdmin ? "default" : "secondary"} className="text-xs">
            {isSuperAdmin ? "SuperAdmin" : "Admin"}
          </Badge>
          <span className="text-xs text-muted-foreground truncate">
            {user?.email}
          </span>
        </div>
      </div>

      {/* Navigation Items */}
      <ScrollArea className="flex-1 py-2">
        <div className="px-3 space-y-6">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
                {section.title}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <TooltipProvider key={item.id} delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleTabChange(item.id)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                              "hover:bg-accent/50 hover:text-accent-foreground",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              isActive && "bg-primary/10 text-primary border-l-2 border-primary"
                            )}
                          >
                            <Icon className={cn("w-4 h-4 flex-shrink-0", isActive && "text-primary")} />
                            <span className="truncate">{item.label}</span>
                            {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[250px]">
                          <p className="font-semibold">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className="p-3 border-t space-y-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/admin/merchant-services")}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Merchant Services
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/admin/pet-store")}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Pet Store Admin
        </Button>
        <Separator />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-64 border-r bg-card flex-shrink-0 sticky top-0 h-screen">
          <NavigationSidebar />
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-screen">
          {/* Top Header */}
          <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 safe-area-inset-top">
            <div className="flex items-center justify-between px-4 h-16">
              {/* Mobile Menu */}
              <div className="flex items-center gap-3 lg:hidden">
                <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Menu className="w-5 h-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="p-0 w-72">
                    <NavigationSidebar />
                  </SheetContent>
                </Sheet>
              </div>

              {/* Current Page Info */}
              <div className="flex items-center gap-3">
                <div className="hidden lg:block">
                  {currentTabInfo && (
                    <div className="flex items-center gap-2">
                      <currentTabInfo.icon className="w-5 h-5 text-primary" />
                      <div>
                        <h2 className="font-semibold">{currentTabInfo.label}</h2>
                      </div>
                    </div>
                  )}
                </div>
                <div className="lg:hidden">
                  <h2 className="font-semibold">{currentTabInfo?.label}</h2>
                </div>
              </div>

              {/* Header Actions */}
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-muted-foreground">
                        <HelpCircle className="w-5 h-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[300px]">
                      <p className="font-semibold mb-1">{currentTabInfo?.label}</p>
                      <p className="text-xs text-muted-foreground">{currentTabInfo?.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSignOut}
                  className="lg:hidden"
                >
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
            <div className="max-w-7xl mx-auto">
              {/* Description Card for Context */}
              <Card className="mb-6 bg-muted/30 border-dashed">
                <CardContent className="py-3 px-4">
                  <div className="flex items-start gap-3">
                    <HelpCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      {currentTabInfo?.description}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Tab Content */}
              {renderTabContent()}
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
};

// Notifications Tab Component (inline since it's small)
const NotificationsTab = () => {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const [recipient, setRecipient] = useState<"all" | "merchants" | "merchant_specific" | "pet_owners">("all");
  const [specificMerchantId, setSpecificMerchantId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [profilesRes, merchantsRes] = await Promise.all([
      supabase.from("profiles").select("id, user_type").order("created_at", { ascending: false }),
      supabase.from("merchants").select("id, business_name, user_id").order("created_at", { ascending: false }),
    ]);
    setProfiles(profilesRes.data || []);
    setMerchants(merchantsRes.data || []);
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    try {
      let userIds: string[] = [];
      if (recipient === "all") {
        userIds = profiles.map((p) => p.id);
      } else if (recipient === "merchants") {
        userIds = merchants.map((m) => m.user_id);
      } else if (recipient === "merchant_specific") {
        if (!specificMerchantId) {
          toast.error("Please select a merchant");
          setSending(false);
          return;
        }
        const merchant = merchants.find((m) => m.id === specificMerchantId);
        if (!merchant) {
          toast.error("Selected merchant not found");
          setSending(false);
          return;
        }
        userIds = [merchant.user_id];
      } else if (recipient === "pet_owners") {
        userIds = profiles.filter((p) => p.user_type === "pet_owner").map((p) => p.id);
      }

      if (userIds.length === 0) {
        toast.error("No recipients found for this selection");
        setSending(false);
        return;
      }

      const notifications = userIds.map((userId) => ({
        user_id: userId,
        title,
        message,
      }));

      const { error } = await supabase.from("notifications").insert(notifications);
      if (error) throw error;

      toast.success(`Notification sent to ${userIds.length} users!`);
      setTitle("");
      setMessage("");
    } catch (error: any) {
      console.error("Error sending notification:", error);
      toast.error("Failed to send notification");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Push Notifications</h2>
        <p className="text-muted-foreground">Send in-app notifications to users</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compose Notification</CardTitle>
          <CardDescription>
            Notifications will appear in the user's notification center within the app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSendNotification} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Recipients</label>
              <select
                className="w-full h-10 px-3 rounded-md border bg-background"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value as any)}
              >
                <option value="all">All Users ({profiles.length})</option>
                <option value="merchants">All Merchants ({merchants.length})</option>
                <option value="merchant_specific">Specific Merchant</option>
                <option value="pet_owners">All Pet Owners ({profiles.filter(p => p.user_type === "pet_owner").length})</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Choose who will receive this notification
              </p>
            </div>

            {recipient === "merchant_specific" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Merchant</label>
                <select
                  className="w-full h-10 px-3 rounded-md border bg-background"
                  value={specificMerchantId}
                  onChange={(e) => setSpecificMerchantId(e.target.value)}
                >
                  <option value="">Choose a merchant...</option>
                  {merchants.map((m) => (
                    <option key={m.id} value={m.id}>{m.business_name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <input
                type="text"
                className="w-full h-10 px-3 rounded-md border bg-background"
                placeholder="Notification title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Keep it short and attention-grabbing (max 50 characters recommended)
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Message</label>
              <textarea
                className="w-full px-3 py-2 rounded-md border bg-background min-h-[100px]"
                placeholder="Your message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                The main content of your notification (max 200 characters recommended)
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setTitle(""); setMessage(""); }}
                className="flex-1"
              >
                Clear
              </Button>
              <Button type="submit" className="flex-1" disabled={sending}>
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4 mr-2" />
                    Send Notification
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Info Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">What are Push Notifications?</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              Push notifications appear in the user's notification center within the app. 
              They're ideal for quick announcements, promotions, or alerts that don't require
              an email.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Best Practices</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ul className="list-disc list-inside space-y-1">
              <li>Keep titles under 50 characters</li>
              <li>Messages should be actionable</li>
              <li>Don't send too frequently</li>
              <li>Target the right audience</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
