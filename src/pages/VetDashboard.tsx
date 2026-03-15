import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { SEO } from "@/components/SEO";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "@/components/vet-portal";
import { SalesReportGenerator } from "@/components/shared/SalesReportGenerator";
import { MerchantLoyaltyProgramTab } from "@/components/merchant/MerchantLoyaltyProgramTab";
import {
  Stethoscope,
  Users,
  MessageSquare,
  FileText,
  FileSignature,
  Bell,
  Pill,
  Share2,
  Activity,
  Heart,
  ArrowRightLeft,
  Sparkles,
  Wallet,
  TrendingUp,
  Scale,
  Zap,
  BarChart3,
  Stamp,
  LifeBuoy,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { PendingApprovalNotice } from "@/components/PendingApprovalNotice";
import { SupportTab } from "@/components/support/SupportTab";
import { PolicyDocumentUpload } from "@/components/merchant/PolicyDocumentUpload";

type VetInfo = {
  id: string;
  name: string;
  location: string;
  contact_email: string;
  approval_status?: 'pending' | 'approved' | 'denied';
  denial_reason?: string | null;
  logo_url?: string | null;
  tos_url?: string | null;
  privacy_policy_url?: string | null;
  shipping_returns_policy_url?: string | null;
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
        if (error.code === "PGRST116") {
          toast.error("You are not registered as a partner vet");
          navigate("/dashboard");
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
        .select("user_id", { count: "exact", head: true })
        .eq("vet_id", vetId);

      // Get pending refill requests
      const { count: refillCount } = await supabase
        .from("prescription_refill_requests")
        .select("id", { count: "exact", head: true })
        .eq("vet_id", vetId)
        .eq("status", "pending");

      // Get unread messages
      const { count: unreadCount } = await supabase
        .from("vet_messages")
        .select("id", { count: "exact", head: true })
        .eq("vet_id", vetId)
        .eq("sender_type", "owner")
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

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Veterinary Portal" description="Manage your veterinary practice" />
      <Header />
      <div className="container max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            {vetInfo.logo_url ? (
              <img src={vetInfo.logo_url} alt={vetInfo.name} className="w-10 h-10 rounded-xl object-cover shadow-md" />
            ) : (
              <Stethoscope className="w-8 h-8 text-primary" />
            )}
            Veterinary Portal
          </h1>
          <p className="text-muted-foreground">
            Welcome back, {vetInfo.name}
          </p>
        </div>

        {/* Pending Approval Notice */}
        {vetInfo.approval_status !== 'approved' && (
          <PendingApprovalNotice 
            entityType="vet" 
            approvalStatus={vetInfo.approval_status || 'pending'}
            denialReason={vetInfo.denial_reason}
          />
        )}

        {/* Lost Pet Alerts - Always visible at top */}
        <LostPetAlertsWidget vetId={vetInfo.id} />

        <div className="grid gap-6 md:grid-cols-4">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Patients</p>
                <p className="text-2xl font-bold">{stats.totalPatients}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <Pill className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Refills</p>
                <p className="text-2xl font-bold">{stats.pendingRefills}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unread Messages</p>
                <p className="text-2xl font-bold">{stats.unreadMessages}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <p className="text-sm font-medium truncate">{vetInfo.location}</p>
              </div>
            </div>
          </Card>
        </div>

        <Tabs defaultValue="emr" className="space-y-4">
          <TabsList className="grid w-full grid-cols-8 lg:grid-cols-15">
            <TabsTrigger value="emr" className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">EMR</span>
            </TabsTrigger>
            <TabsTrigger value="ai-assistant" className="flex items-center gap-1">
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">AI</span>
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-1">
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Messages</span>
              {stats.unreadMessages > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 ml-1">
                  {stats.unreadMessages}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="refills" className="flex items-center gap-1">
              <Pill className="w-4 h-4" />
              <span className="hidden sm:inline">Refills</span>
            </TabsTrigger>
            <TabsTrigger value="reminders" className="flex items-center gap-1">
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">Reminders</span>
            </TabsTrigger>
            <TabsTrigger value="consent" className="flex items-center gap-1">
              <FileSignature className="w-4 h-4" />
              <span className="hidden sm:inline">Consent</span>
            </TabsTrigger>
            <TabsTrigger value="care-network" className="flex items-center gap-1">
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Network</span>
            </TabsTrigger>
            <TabsTrigger value="data-sync" className="flex items-center gap-1">
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">Sync</span>
            </TabsTrigger>
            <TabsTrigger value="data-bridge" className="flex items-center gap-1">
              <ArrowRightLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Bridge</span>
            </TabsTrigger>
            <TabsTrigger value="financial" className="flex items-center gap-1">
              <Wallet className="w-4 h-4" />
              <span className="hidden sm:inline">Financial</span>
            </TabsTrigger>
            <TabsTrigger value="growth" className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Growth</span>
            </TabsTrigger>
            <TabsTrigger value="wellness" className="flex items-center gap-1">
              <Heart className="w-4 h-4" />
              <span className="hidden sm:inline">Wellness</span>
            </TabsTrigger>
            <TabsTrigger value="claim-recovery" className="flex items-center gap-1">
              <Scale className="w-4 h-4" />
              <span className="hidden sm:inline">Recovery</span>
            </TabsTrigger>
            <TabsTrigger value="quick-actions" className="flex items-center gap-1">
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">Actions</span>
            </TabsTrigger>
            <TabsTrigger value="loyalty-program" className="flex items-center gap-1">
              <Stamp className="w-4 h-4" />
              <span className="hidden sm:inline">Loyalty</span>
            </TabsTrigger>
            <TabsTrigger value="sales-report" className="flex items-center gap-1">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Reports</span>
            </TabsTrigger>
            <TabsTrigger value="support" className="flex items-center gap-1">
              <LifeBuoy className="w-4 h-4" />
              <span className="hidden sm:inline">Support</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="emr">
            <EMRDashboard vetId={vetInfo.id} />
          </TabsContent>

          <TabsContent value="ai-assistant">
            <AIClinicalAssistant vetId={vetInfo.id} />
          </TabsContent>

          <TabsContent value="messages">
            <SecureMessagingTab vetId={vetInfo.id} />
          </TabsContent>

          <TabsContent value="refills">
            <PrescriptionRefillsTab vetId={vetInfo.id} />
          </TabsContent>

          <TabsContent value="reminders">
            <ComplianceRemindersTab vetId={vetInfo.id} />
          </TabsContent>

          <TabsContent value="consent">
            <ConsentManagement vetId={vetInfo.id} />
          </TabsContent>

          <TabsContent value="care-network">
            <CollaborativeCareTab vetId={vetInfo.id} />
          </TabsContent>

          <TabsContent value="data-sync">
            <MerchantDataSyncTab vetId={vetInfo.id} />
          </TabsContent>

          <TabsContent value="data-bridge">
            <DataBridgeTab vetId={vetInfo.id} />
          </TabsContent>

          <TabsContent value="financial">
            <FinancialFrictionTab vetId={vetInfo.id} />
          </TabsContent>

          <TabsContent value="growth">
            <PracticeGrowthTab vetId={vetInfo.id} />
          </TabsContent>

          <TabsContent value="wellness">
            <WellnessPlansTab vetId={vetInfo.id} />
          </TabsContent>

          <TabsContent value="claim-recovery">
            <ClaimRecoveryDashboard vetId={vetInfo.id} />
          </TabsContent>

          <TabsContent value="quick-actions">
            <VetQuickActionsTab vetId={vetInfo.id} hasStripeAccount={false} />
          </TabsContent>

          <TabsContent value="loyalty-program">
            <MerchantLoyaltyProgramTab merchantId={vetInfo.id} />
          </TabsContent>

          <TabsContent value="sales-report">
            <SalesReportGenerator entityId={vetInfo.id} entityType="vet" entityName={vetInfo.name} />
          </TabsContent>

          <TabsContent value="support">
            <SupportTab submitterType="vet" entityId={vetInfo.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
