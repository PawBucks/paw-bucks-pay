import { ReactNode, useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LayoutGrid,
  DollarSign,
  BarChart3,
  CalendarDays,
  FileText,
  CheckCircle2,
  Users,
  Heart,
  Star,
  Zap,
  MessageSquare,
  Activity,
  Gift,
  HelpCircle,
  LogOut,
  Bell,
  User,
  Package,
  Tag,
  Wallet,
  Receipt,
  Calendar,
  Megaphone,
  Store,
  Sparkles,
} from "lucide-react";
import { PawBucksLogo } from "@/components/PawBucksLogo";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useMerchantPawBucksRealtime } from "@/hooks/usePawBucksRealtime";

type NavItem = { id: string; label: string; icon: typeof LayoutGrid; to: string };
type NavSection = { section: string; items: NavItem[] };

const NAV: NavSection[] = [
  {
    section: "Dashboard",
    items: [
      { id: "overview", label: "Overview", icon: LayoutGrid, to: "/merchant/workspace" },
      { id: "dashboard", label: "Full Dashboard", icon: LayoutGrid, to: "/merchant-dashboard" },
      { id: "earnings", label: "Total Earnings", icon: DollarSign, to: "/merchant/total-earnings" },
      { id: "available-balance", label: "Available Balance", icon: Wallet, to: "/merchant/available-balance" },
      { id: "pending-balance", label: "Pending Balance", icon: CalendarDays, to: "/merchant/pending-balance" },
      { id: "sales-report", label: "Analytics", icon: BarChart3, to: "/merchant-analytics" },
      { id: "transactions", label: "Transactions", icon: FileText, to: "/merchant/transactions" },
      { id: "tax-vault", label: "Tax Vault", icon: Receipt, to: "/merchant/tax-vault" },
    ],
  },
  {
    section: "Wallet",
    items: [
      { id: "pawbucks-wallet", label: "PawBucks Wallet", icon: Wallet, to: "/merchant/pawbucks" },
      { id: "store-rewards", label: "Store Rewards", icon: Gift, to: "/merchant/store-rewards" },
    ],
  },
  {
    section: "Catalog & Services",
    items: [
      { id: "products", label: "Products", icon: Package, to: "/merchant/products" },
      { id: "offers", label: "Offers & Promotions", icon: Tag, to: "/merchant/offers" },
      { id: "scheduling", label: "Scheduling", icon: Calendar, to: "/merchant/scheduling" },
      { id: "invoicing", label: "Invoicing", icon: FileText, to: "/merchant/invoicing" },
      { id: "subscription-plans", label: "Subscription Plans", icon: Users, to: "/merchant/subscription-plans" },
      { id: "marketplace", label: "Services Marketplace", icon: Star, to: "/merchant/market" },
      { id: "pos", label: "POS Integration", icon: Store, to: "/merchant/pos-integration" },
    ],
  },
  {
    section: "Marketing",
    items: [
      { id: "messages", label: "Messages", icon: MessageSquare, to: "/merchant/messages" },
      { id: "campaigns", label: "Campaigns", icon: Megaphone, to: "/merchant/campaigns" },
    ],
  },
  {
    section: "Support",
    items: [{ id: "support", label: "Support Center", icon: HelpCircle, to: "/merchant/support" }],
  },
];

function WorkspaceSidebar() {
  const { pathname } = useLocation();
  const { signOut } = useAuth();
  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {NAV.map((group) => (
          <SidebarGroup key={group.section}>
            <SidebarGroupLabel className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted-foreground/70">
              {group.section}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = pathname === item.to;
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton asChild isActive={active}>
                        <NavLink to={item.to} className="flex items-center gap-2 text-sm">
                          <Icon className="h-4 w-4 shrink-0" />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => signOut()} className="text-sm text-muted-foreground">
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

interface MerchantWorkspaceLayoutProps {
  businessName?: string;
  pawBucksBalance?: number;
  isPremium?: boolean;
  logoUrl?: string | null;
  children: ReactNode;
}

export function MerchantWorkspaceLayout({
  businessName: businessNameProp,
  pawBucksBalance: pawBucksBalanceProp,
  isPremium: isPremiumProp,
  logoUrl: logoUrlProp,
  children,
}: MerchantWorkspaceLayoutProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [merchant, setMerchant] = useState<{
    id: string;
    business_name: string | null;
    logo_url: string | null;
  } | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("merchants")
        .select("id, business_name, logo_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled || !data) return;
      setMerchant(data as any);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Fetch wallet balance + re-fetch on realtime events
  useEffect(() => {
    if (!merchant?.id) return;
    let cancelled = false;
    const fetchBalance = async () => {
      const { data: wallet } = await supabase
        .from("merchant_pawbucks_wallet")
        .select("balance")
        .eq("merchant_id", merchant.id)
        .maybeSingle();
      if (!cancelled) setWalletBalance(Number(wallet?.balance) || 0);
    };
    fetchBalance();

    const channel = supabase
      .channel(`workspace-merchant-wallet-${merchant.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "merchant_pawbucks_wallet",
          filter: `merchant_id=eq.${merchant.id}`,
        },
        () => fetchBalance()
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "merchant_pawbucks_activity",
          filter: `merchant_id=eq.${merchant.id}`,
        },
        () => fetchBalance()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `merchant_id=eq.${merchant.id}`,
        },
        () => fetchBalance()
      )
      .subscribe();

    // Refresh when tab regains focus
    const onFocus = () => fetchBalance();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
    };
  }, [merchant?.id]);

  // Also invalidate any react-query caches for merchant wallet
  useMerchantPawBucksRealtime(merchant?.id);

  const businessName = businessNameProp ?? merchant?.business_name ?? "Your Business";
  const logoUrl = logoUrlProp ?? merchant?.logo_url ?? null;
  const pawBucksBalance = pawBucksBalanceProp ?? walletBalance;
  const isPremium = isPremiumProp ?? false;
  const initials = businessName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const usd = (pawBucksBalance * 0.001).toFixed(2);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/30">
        <WorkspaceSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Topbar */}
          <header className="h-14 flex items-center gap-3 border-b bg-card px-3 md:px-4 sticky top-0 z-30">
            <SidebarTrigger />
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${businessName} logo`}
                className="h-8 w-8 rounded-md object-cover border border-border bg-card"
              />
            ) : (
              <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary to-accent text-primary-foreground flex items-center justify-center text-xs font-bold">
                {initials}
              </div>
            )}
            <div className="hidden md:block h-5 w-px bg-border" />
            <span className="hidden md:inline text-[10px] font-semibold tracking-[0.1em] uppercase text-muted-foreground">
              Merchant Workspace
            </span>
            <div className="h-5 w-px bg-border hidden md:block" />
            <span className="text-sm font-semibold truncate">{businessName}</span>
            <Badge variant="secondary" className="text-[10px] hidden sm:inline-flex">
              Merchant
            </Badge>
            {isPremium && (
              <Badge className="text-[10px] hidden sm:inline-flex bg-[hsl(262_52%_56%/0.12)] text-[hsl(262_52%_46%)] hover:bg-[hsl(262_52%_56%/0.12)] border-[hsl(262_52%_56%/0.25)]">
                + Premium
              </Badge>
            )}

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => navigate("/merchant/pawbucks")}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
              >
                <PawBucksLogo className="w-3.5 h-3.5" />
                <span>{pawBucksBalance.toLocaleString()}</span>
                <span className="font-normal text-muted-foreground">· ${usd}</span>
              </button>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Notifications">
                <Bell className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Profile">
                <User className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

interface PageHeaderProps {
  title: string;
  section: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function WorkspacePageHeader({ title, section, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between border-b bg-card px-4 md:px-6 py-4">
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground mb-1">
          Merchant Workspace <span className="mx-1 opacity-60">›</span> {section}{" "}
          <span className="mx-1 opacity-60">›</span> {title}
        </p>
        <h1 className="text-xl md:text-2xl font-bold text-foreground truncate">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}