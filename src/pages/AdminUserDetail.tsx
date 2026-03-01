import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { UserDetailProfile } from "@/components/admin/user-detail/UserDetailProfile";
import { UserDetailTransactions } from "@/components/admin/user-detail/UserDetailTransactions";
import { UserDetailPets } from "@/components/admin/user-detail/UserDetailPets";
import { UserDetailWallet } from "@/components/admin/user-detail/UserDetailWallet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AdminUserDetail = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

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
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "superadmin"]);

      if (data && data.length > 0) {
        setIsAdmin(true);
      } else {
        navigate("/admin");
      }
    } catch {
      navigate("/admin");
    } finally {
      setLoading(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAdmin || !userId) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/admin/dashboard")}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Admin Dashboard
        </Button>

        <UserDetailProfile userId={userId} />

        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="pets">Pets & Medical</TabsTrigger>
            <TabsTrigger value="wallet">PawBucks & Wallet</TabsTrigger>
          </TabsList>
          <TabsContent value="transactions">
            <UserDetailTransactions userId={userId} />
          </TabsContent>
          <TabsContent value="pets">
            <UserDetailPets userId={userId} />
          </TabsContent>
          <TabsContent value="wallet">
            <UserDetailWallet userId={userId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminUserDetail;
