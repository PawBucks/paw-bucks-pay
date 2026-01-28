import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { SEO } from "@/components/SEO";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VetMessagesPanel } from "@/components/VetMessagesPanel";
import { EMRDashboard, ConsentManagement } from "@/components/vet-portal";
import { Stethoscope, Users, MessageSquare, FileText, FileSignature } from "lucide-react";
import { toast } from "sonner";

type VetInfo = {
  id: string;
  name: string;
  location: string;
  contact_email: string;
};

export default function VetDashboard() {
  const navigate = useNavigate();
  const [vetInfo, setVetInfo] = useState<VetInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPatients: 0,
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
      const { count: patientCount } = await supabase
        .from("vet_messages")
        .select("user_id", { count: "exact", head: true })
        .eq("vet_id", vetId);

      setStats({
        totalPatients: patientCount || 0,
        unreadMessages: 0,
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
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Stethoscope className="w-8 h-8 text-primary" />
            Veterinary Portal
          </h1>
          <p className="text-muted-foreground">
            Welcome back, {vetInfo.name}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
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
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <p className="text-lg font-semibold">{vetInfo.location}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Contact</p>
                <p className="text-sm font-medium truncate">{vetInfo.contact_email}</p>
              </div>
            </div>
          </Card>
        </div>

        <Tabs defaultValue="emr" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="emr" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              EMR Dashboard
            </TabsTrigger>
            <TabsTrigger value="consent" className="flex items-center gap-2">
              <FileSignature className="w-4 h-4" />
              Consent Forms
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Messages
            </TabsTrigger>
          </TabsList>

          <TabsContent value="emr">
            <EMRDashboard vetId={vetInfo.id} />
          </TabsContent>

          <TabsContent value="consent">
            <ConsentManagement vetId={vetInfo.id} />
          </TabsContent>

          <TabsContent value="messages">
            <VetMessagesPanel vetId={vetInfo.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
