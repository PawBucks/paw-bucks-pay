import { useState, useEffect } from"react";
import { useNavigate } from"react-router-dom";
import { supabase } from"@/integrations/supabase/client";
import { useAuth } from"@/hooks/useAuth";
import { Header } from"@/components/Header";
import { SEO } from"@/components/SEO";
import { Card } from"@/components/ui/card";
import {
 Select,
 SelectContent,
 SelectGroup,
 SelectItem,
 SelectLabel,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
import { cn } from"@/lib/utils";

import {
 EMRDashboard,
 ConsentManagement,
 ComplianceRemindersTab,
 PrescriptionRefillsTab,
 SecureMessagingTab,
 CollaborativeCareTab,
 MerchantDataSyncTab,
 WellnessPlansTab,
 LostPetAlertsWidget,
 DataBridgeTab,
 AIClinicalAssistant,
 FinancialFrictionTab,
 PracticeGrowthTab,
 ClaimRecoveryDashboard,
 VetQuickActionsTab,
} from"@/components/vet-portal";
import { SalesReportGenerator } from"@/components/shared/SalesReportGenerator";
import { MerchantLoyaltyProgramTab } from"@/components/merchant/MerchantLoyaltyProgramTab";
import { CheckInDashboard } from"@/components/checkin";
import { PromotionInvitationsInbox } from"@/components/PromotionInvitationsInbox";
import { ArrowRightLeft, BarChart3, Bell, FileSignature, FileText, Heart, LifeBuoy, Link2, MessageSquare, Pill, QrCode, Scale, Settings, Stamp, Stethoscope, TrendingUp, Users, Wallet, Zap, Sparkles } from "lucide-react";

import { toast } from"sonner";
import { PendingApprovalNotice } from"@/components/PendingApprovalNotice";
import { SupportTab } from"@/components/support/SupportTab";
import { PolicyDocumentUpload } from"@/components/merchant/PolicyDocumentUpload";
import { EditorialPageHeader } from"@/components/shared/EditorialPageHeader";
import { EditVetProfileDialog } from"@/components/vet-portal/EditVetProfileDialog";
import { Button } from"@/components/ui/button";
import { Pencil } from "lucide-react";

type VetInfo = {
 id: string;
 name: string;
 location: string;
 contact_email: string;
 approval_status?:'pending' |'approved' |'denied';
 denial_reason?: string | null;
 logo_url?: string | null;
 tos_url?: string | null;
 privacy_policy_url?: string | null;
 shipping_returns_policy_url?: string | null;
 clinic_phone?: string | null;
 website_url?: string | null;
 clinic_bio?: string | null;
};

export default function VetDashboard() {
 const navigate = useNavigate();
 const { user } = useAuth();
 const [vetInfo, setVetInfo] = useState<VetInfo | null>(null);
 const [isLoading, setIsLoading] = useState(true);
 const [stats, setStats] = useState({
 totalPatients: 0,
 pendingRefills: 0,
 unreadMessages: 0,
 });
 const [editProfileOpen, setEditProfileOpen] = useState(false);

 useEffect(() => {
 const checkAuth = async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) {
 navigate("/auth");
 return;
 }

 loadVetInfo(user.id);
 };

 checkAuth();
 }, [navigate]);

 const loadVetInfo = async (userId: string) => {
 try {
 const { data: vet, error } = await supabase
 .from("partner_vets")
 .select("*")
 .eq("user_id", userId)
 .single();

 if (error) {
 if (error.code ==="PGRST116") {
 toast.error("You are not registered as a partner vet");
 navigate("/home");
 return;
 }
 throw error;
 }

 setVetInfo(vet);
 loadStats(vet.id);
 } catch (error) {
 console.error("Error loading vet info:", error);
 toast.error("Failed to load vet information");
 } finally {
 setIsLoading(false);
 }
 };

 const loadStats = async (vetId: string) => {
 try {
 // Get unique patient count
 const { count: patientCount } = await supabase
 .from("vet_messages")
 .select("user_id", { count:"exact", head: true })
 .eq("vet_id", vetId);

 // Get pending refill requests
 const { count: refillCount } = await supabase
 .from("prescription_refill_requests")
 .select("id", { count:"exact", head: true })
 .eq("vet_id", vetId)
 .eq("status","pending");

 // Get unread messages
 const { count: unreadCount } = await supabase
 .from("vet_messages")
 .select("id", { count:"exact", head: true })
 .eq("vet_id", vetId)
 .eq("sender_type","owner")
 .eq("is_read", false);

 setStats({
 totalPatients: patientCount || 0,
 pendingRefills: refillCount || 0,
 unreadMessages: unreadCount || 0,
 });
 } catch (error) {
 console.error("Error loading stats:", error);
 }
 };

 if (isLoading) {
 return (
 <div className="min-h-screen bg-background">
 <Header />
 <div className="container max-w-6xl mx-auto px-4 py-8">
 <div className="text-center">Loading...</div>
 </div>
 </div>
 );
 }

 if (!vetInfo) {
 return null;
 }

  const NAV: { section: string; items: { value: string; label: string; icon: typeof FileText; badge?: number }[] }[] = [
    {
      section: "Clinical",
      items: [
        { value: "emr", label: "Patient Records", icon: FileText },
        { value: "ai-assistant", label: "Clinical AI", icon: Sparkles },
        { value: "refills", label: "Prescription Refills", icon: Pill },
        { value: "consent", label: "Consent Forms", icon: FileSignature },
        { value: "wellness", label: "Wellness Plans", icon: Heart },
        { value: "reminders", label: "Reminders", icon: Bell },
      ],
    },
    {
      section: "Clients",
      items: [
        { value: "messages", label: "Messages", icon: MessageSquare, badge: stats.unreadMessages },
        { value: "checkins", label: "Check-Ins", icon: QrCode },
        { value: "care-network", label: "Care Network", icon: Link2 },
        { value: "loyalty-program", label: "Loyalty", icon: Stamp },
        { value: "promotions", label: "Promotions", icon: Sparkles },
      ],
    },
    {
      section: "Business",
      items: [
        { value: "financial", label: "Payments", icon: Wallet },
        { value: "claim-recovery", label: "Claim Recovery", icon: Scale },
        { value: "growth", label: "Practice Growth", icon: TrendingUp },
        { value: "quick-actions", label: "Quick Actions", icon: Zap },
        { value: "sales-report", label: "Reports", icon: BarChart3 },
      ],
    },
    {
      section: "Integrations",
      items: [
        { value: "data-sync", label: "Data Sync", icon: BarChart3 },
        { value: "data-bridge", label: "Data Bridge", icon: ArrowRightLeft },
      ],
    },
    {
      section: "Account",
      items: [
        { value: "settings", label: "Practice Settings", icon: Settings },
        { value: "support", label: "Support", icon: LifeBuoy },
      ],
    },
  ];

  const allItems = NAV.flatMap((s) => s.items);
  const activeItem = allItems.find((i) => i.value === activeTab);

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Veterinary Portal" description="Manage your veterinary practice" />
      <Header />
      <div className="container max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-6">
        <div className="flex items-center gap-3">
          {vetInfo.logo_url ? (
            <img src={vetInfo.logo_url} alt={vetInfo.name} className="w-11 h-11 rounded-xl object-cover border border-border" />
          ) : (
            <span className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-primary" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Veterinary Portal</p>
            <h1 className="text-xl md:text-2xl font-semibold truncate">{vetInfo.name}</h1>
          </div>
        </div>

        {vetInfo.approval_status !== 'approved' && (
          <PendingApprovalNotice
            entityType="vet"
            approvalStatus={vetInfo.approval_status || 'pending'}
            denialReason={vetInfo.denial_reason}
          />
        )}

        <LostPetAlertsWidget vetId={vetInfo.id} />

        {/* Compact stats strip */}
        <Card className="divide-y sm:divide-y-0 sm:divide-x divide-border grid sm:grid-cols-4 overflow-hidden">
          {[
            { icon: Users, label: "Patients", value: String(stats.totalPatients) },
            { icon: Pill, label: "Pending Refills", value: String(stats.pendingRefills) },
            { icon: MessageSquare, label: "Unread", value: String(stats.unreadMessages) },
            { icon: FileText, label: "Location", value: vetInfo.location },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 p-4">
              <Icon className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
                <p className="text-base font-semibold tabular-nums truncate">{value}</p>
              </div>
            </div>
          ))}
        </Card>

        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          {/* Mobile nav */}
          <div className="lg:hidden">
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger className="w-full">
                <SelectValue>{activeItem?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {NAV.map((section) => (
                  <SelectGroup key={section.section}>
                    <SelectLabel>{section.section}</SelectLabel>
                    {section.items.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Desktop nav */}
          <nav className="hidden lg:block self-start sticky top-20 space-y-5">
            {NAV.map((section) => (
              <div key={section.section}>
                <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {section.section}
                </p>
                <div className="space-y-0.5">
                  {section.items.map(({ value, label, icon: Icon, badge }) => (
                    <button
                      key={value}
                      onClick={() => setActiveTab(value)}
                      className={cn(
                        "w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-left transition-colors",
                        activeTab === value
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{label}</span>
                      {badge ? (
                        <span className="ml-auto text-[10px] font-semibold rounded-full bg-destructive text-destructive-foreground px-1.5 py-0.5">
                          {badge}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="min-w-0">
            {activeTab === "emr" && <EMRDashboard vetId={vetInfo.id} />}
            {activeTab === "ai-assistant" && <AIClinicalAssistant vetId={vetInfo.id} />}
            {activeTab === "messages" && <SecureMessagingTab vetId={vetInfo.id} />}
            {activeTab === "refills" && <PrescriptionRefillsTab vetId={vetInfo.id} />}
            {activeTab === "reminders" && <ComplianceRemindersTab vetId={vetInfo.id} />}
            {activeTab === "consent" && <ConsentManagement vetId={vetInfo.id} />}
            {activeTab === "care-network" && <CollaborativeCareTab vetId={vetInfo.id} />}
            {activeTab === "data-sync" && <MerchantDataSyncTab vetId={vetInfo.id} />}
            {activeTab === "data-bridge" && <DataBridgeTab vetId={vetInfo.id} />}
            {activeTab === "financial" && <FinancialFrictionTab vetId={vetInfo.id} />}
            {activeTab === "growth" && <PracticeGrowthTab vetId={vetInfo.id} />}
            {activeTab === "wellness" && <WellnessPlansTab vetId={vetInfo.id} />}
            {activeTab === "claim-recovery" && <ClaimRecoveryDashboard vetId={vetInfo.id} />}
            {activeTab === "quick-actions" && <VetQuickActionsTab vetId={vetInfo.id} hasStripeAccount={false} />}
            {activeTab === "loyalty-program" && <MerchantLoyaltyProgramTab merchantId={vetInfo.id} />}
            {activeTab === "sales-report" && (
              <SalesReportGenerator entityId={vetInfo.id} entityType="vet" entityName={vetInfo.name} />
            )}
            {activeTab === "support" && <SupportTab submitterType="vet" entityId={vetInfo.id} />}
            {activeTab === "checkins" && (
              <CheckInDashboard entityId={vetInfo.id} entityType="vet" entityName={vetInfo.name} />
            )}
            {activeTab === "promotions" && (
              <PromotionInvitationsInbox recipientType="vet" recipientId={vetInfo.id} />
            )}
            {activeTab === "settings" && (
              <Card className="p-6">
                <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
                  <div>
                    <h3 className="text-lg font-semibold">Practice Profile</h3>
                    <p className="text-sm text-muted-foreground">
                      Update your practice name, contact info, logo, and "About" description.
                    </p>
                  </div>
                  <Button onClick={() => setEditProfileOpen(true)} className="gap-2">
                    <Pencil className="w-4 h-4" />
                    Edit Profile
                  </Button>
                </div>
                {vetInfo.clinic_bio && (
                  <div className="mb-6 p-4 rounded-lg bg-muted/40 border border-border">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">About</p>
                    <p className="text-sm whitespace-pre-wrap">{vetInfo.clinic_bio}</p>
                  </div>
                )}
                <h3 className="text-lg font-semibold mb-4">Policy Documents</h3>
                {user && vetInfo && (
                  <PolicyDocumentUpload
                    userId={user.id}
                    entityId={vetInfo.id}
                    entityType="vet"
                    tosUrl={vetInfo.tos_url}
                    privacyPolicyUrl={vetInfo.privacy_policy_url}
                    shippingReturnsPolicyUrl={vetInfo.shipping_returns_policy_url}
                    onUpdate={() => loadVetInfo(user.id)}
                  />
                )}
              </Card>
            )}
          </div>
        </div>

        {user && (
          <EditVetProfileDialog
            open={editProfileOpen}
            onOpenChange={setEditProfileOpen}
            vet={vetInfo}
            userId={user.id}
            onSaved={() => loadVetInfo(user.id)}
          />
        )}
      </div>
    </div>
  );
}

