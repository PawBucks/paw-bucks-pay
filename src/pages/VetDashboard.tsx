import { useState, useEffect } from"react";
import { useNavigate } from"react-router-dom";
import { supabase } from"@/integrations/supabase/client";
import { useAuth } from"@/hooks/useAuth";
import { Header } from"@/components/Header";
import { SEO } from"@/components/SEO";
import { Card } from"@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
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
import { Stethoscope, Users, MessageSquare, FileText, FileSignature, Bell, Pill, Share2, Activity, Heart, ArrowRightLeft, Wallet, TrendingUp, Scale, Zap, BarChart3, Stamp, LifeBuoy, Settings, QrCode } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { toast } from"sonner";
import { PendingApprovalNotice } from"@/components/PendingApprovalNotice";
import { SupportTab } from"@/components/support/SupportTab";
import { PolicyDocumentUpload } from"@/components/merchant/PolicyDocumentUpload";
import { EditorialPageHeader } from"@/components/shared/EditorialPageHeader";
import { EditVetProfileDialog } from"@/components/vet-portal/EditVetProfileDialog";
import { Button } from"@/components/ui/button";
import { Pencil } from"lucide-react";

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

 return (
 <div className="min-h-screen bg-background">
 <SEO title="Veterinary Portal" description="Manage your veterinary practice" />
 <Header />
  <div className="container max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-6">
  <EditorialPageHeader
    eyebrow="Veterinary Portal"
    title={
      <span className="inline-flex items-center gap-3 align-middle">
        {vetInfo.logo_url ? (
          <img src={vetInfo.logo_url} alt={vetInfo.name} className="w-10 h-10 md:w-12 md:h-12 rounded-lg object-cover border border-border" />
        ) : (
          <span className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Stethoscope className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          </span>
        )}
        <span>{vetInfo.name}</span>
      </span>
    }
    subtitle="Manage your patients, medical records, prescriptions, and practice growth — all in one calm, focused workspace."
  />

 {/* Pending Approval Notice */}
 {vetInfo.approval_status !=='approved' && (
 <PendingApprovalNotice 
 entityType="vet" 
 approvalStatus={vetInfo.approval_status ||'pending'}
 denialReason={vetInfo.denial_reason}
 />
 )}

 {/* Lost Pet Alerts - Always visible at top */}
 <LostPetAlertsWidget vetId={vetInfo.id} />

 {/* Stats Grid - Clean professional cards */}
 <div className="grid gap-4 md:grid-cols-4">
 <Card className="p-5">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-lg bg-primary/8 flex items-center justify-center">
 <Users className="w-5 h-5 text-primary" />
 </div>
 <div>
 <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Patients</p>
 <p className="text-xl font-bold tabular-nums">{stats.totalPatients}</p>
 </div>
 </div>
 </Card>

 <Card className="p-5">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-lg bg-[hsl(var(--warning))]/10 flex items-center justify-center">
 <Pill className="w-5 h-5 text-[hsl(var(--warning))]" />
 </div>
 <div>
 <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pending Refills</p>
 <p className="text-xl font-bold tabular-nums">{stats.pendingRefills}</p>
 </div>
 </div>
 </Card>

 <Card className="p-5">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-lg bg-[hsl(var(--info))]/10 flex items-center justify-center">
 <MessageSquare className="w-5 h-5 text-[hsl(var(--info))]" />
 </div>
 <div>
 <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Unread</p>
 <p className="text-xl font-bold tabular-nums">{stats.unreadMessages}</p>
 </div>
 </div>
 </Card>

 <Card className="p-5">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-lg bg-[hsl(var(--success))]/10 flex items-center justify-center">
 <FileText className="w-5 h-5 text-[hsl(var(--success))]" />
 </div>
 <div>
 <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Location</p>
 <p className="text-sm font-medium truncate max-w-[140px]">{vetInfo.location}</p>
 </div>
 </div>
 </Card>
 </div>

 <Tabs defaultValue="emr" className="space-y-4">
 <TabsList className="grid w-full grid-cols-8 lg:grid-cols-16">
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
 <span className="bg-destructive text-white text-xs rounded-full px-1.5 py-0.5 ml-1">
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
 <TabsTrigger value="checkins" className="flex items-center gap-1">
 <QrCode className="w-4 h-4" />
 <span className="hidden sm:inline">Check-Ins</span>
 </TabsTrigger>
 <TabsTrigger value="settings" className="flex items-center gap-1">
 <Settings className="w-4 h-4" />
 <span className="hidden sm:inline">Settings</span>
 </TabsTrigger>
  <TabsTrigger value="promotions" className="flex items-center gap-1">
   <Sparkles className="w-4 h-4" />
   <span className="hidden sm:inline">Promotions</span>
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
 <TabsContent value="checkins">
 <CheckInDashboard entityId={vetInfo.id} entityType="vet" entityName={vetInfo.name} />
 </TabsContent>
  <TabsContent value="promotions">
   <PromotionInvitationsInbox recipientType="vet" recipientId={vetInfo.id} />
  </TabsContent>
 <TabsContent value="settings">
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
 </TabsContent>
 </Tabs>
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
