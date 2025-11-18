import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Edit, Pause, Play, Archive, QrCode, BarChart3, Download } from "lucide-react";
import { toast } from "sonner";
import { ErrorHandler } from "@/utils/errorHandler";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Offer {
  id: string;
  title: string;
  description: string;
  coins_required: number;
  cash_equivalent?: number;
  status: string;
  is_active: boolean;
  redemption_count: number;
  redemption_cap?: number;
  start_date?: string;
  end_date?: string;
  per_user_limit: number;
  created_at: string;
  recent_redemptions?: any[];
}

interface Analytics {
  total_offers: number;
  total_redemptions: number;
  confirmed_redemptions: number;
  conversion_rate: string;
  monthly_redemptions: Record<string, number>;
}

export default function MerchantOfferDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [user, setUser] = useState<any>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user && id) {
      fetchOfferDetails();
      fetchAnalytics();
    }
  }, [user, id]);

  const fetchOfferDetails = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merchant-get-offer/${id}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch offer");
      }

      const data = await response.json();
      setOffer(data);
    } catch (error) {
      ErrorHandler.handle(error);
      navigate("/merchant/offers");
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke("merchant-offer-analytics", {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;
      setAnalytics(data);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    }
  };

  const handleStatusChange = async (action: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke("merchant-manage-offer-status", {
        body: { offer_id: id, action },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      toast.success(`Offer ${action}d successfully`);
      fetchOfferDetails();
    } catch (error) {
      ErrorHandler.handle(error);
    }
  };

  const exportRedemptions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merchant-offer-redemptions/${id}?limit=1000`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error("Failed to export redemptions");
      }

      const data = await response.json();
      
      // Convert to CSV
      const csv = [
        ["Code", "User ID", "Redeemed At", "Confirmed"].join(","),
        ...data.redemptions.map((r: any) => [
          r.redemption_code,
          r.user_id,
          new Date(r.redeemed_at).toISOString(),
          r.partner_confirmed ? "Yes" : "No"
        ].join(","))
      ].join("\n");

      // Download
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `offer-${id}-redemptions.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success("Redemptions exported successfully");
    } catch (error) {
      ErrorHandler.handle(error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      active: "default",
      draft: "secondary",
      paused: "outline",
      pending: "outline",
      expired: "destructive",
      archived: "secondary"
    };

    return (
      <Badge variant={variants[status] || "secondary"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const chartData = analytics?.monthly_redemptions
    ? Object.entries(analytics.monthly_redemptions).map(([date, count]) => ({
        date,
        redemptions: count
      }))
    : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading offer details...</p>
        </div>
      </div>
    );
  }

  if (!offer) {
    return null;
  }

  return (
    <>
      <SEO 
        title={`${offer.title} - Offer Details | PetalPay Merchant`}
        description="View offer details, analytics, and redemptions"
        keywords={["merchant", "offers", "analytics"]}
      />
      <div className="min-h-screen bg-background">
        <Header isAuthenticated={!!user} onLogout={handleSignOut} />
        
        <main className="container mx-auto px-4 py-8 pb-24 max-w-7xl">
          <Button variant="ghost" onClick={() => navigate("/merchant/offers")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Offers
          </Button>

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-3xl font-bold">{offer.title}</h1>
                {getStatusBadge(offer.status)}
              </div>
              <p className="text-muted-foreground">{offer.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => navigate(`/merchant/offers/${id}/edit`)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
              {offer.status === "active" && (
                <Button
                  variant="outline"
                  onClick={() => handleStatusChange("pause")}
                >
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </Button>
              )}
              {offer.status === "paused" && (
                <Button
                  variant="outline"
                  onClick={() => handleStatusChange("resume")}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Resume
                </Button>
              )}
              {offer.status !== "archived" && (
                <Button
                  variant="outline"
                  onClick={() => handleStatusChange("archive")}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </Button>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>PawBucks Required</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{offer.coins_required.toLocaleString()}</p>
                {offer.cash_equivalent && (
                  <p className="text-sm text-muted-foreground">${offer.cash_equivalent} value</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Redemptions</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {offer.redemption_count}
                  {offer.redemption_cap && ` / ${offer.redemption_cap}`}
                </p>
                {offer.redemption_cap && (
                  <p className="text-sm text-muted-foreground">
                    {((offer.redemption_count / offer.redemption_cap) * 100).toFixed(1)}% used
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Per User Limit</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{offer.per_user_limit}</p>
                <p className="text-sm text-muted-foreground">redemptions each</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Date Range</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">
                  {offer.start_date ? new Date(offer.start_date).toLocaleDateString() : "Immediate"}
                </p>
                <p className="text-sm text-muted-foreground">
                  to {offer.end_date ? new Date(offer.end_date).toLocaleDateString() : "No expiry"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Redemptions Over Time (Last 30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="redemptions" stroke="hsl(var(--primary))" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Button
              variant="outline"
              className="h-auto py-6"
              onClick={() => navigate(`/merchant/offers/${id}/codes`)}
            >
              <QrCode className="mr-2 h-5 w-5" />
              Manage Codes
            </Button>
            <Button
              variant="outline"
              className="h-auto py-6"
              onClick={() => navigate(`/merchant/offers/${id}/redemptions`)}
            >
              <BarChart3 className="mr-2 h-5 w-5" />
              View All Redemptions
            </Button>
            <Button
              variant="outline"
              className="h-auto py-6"
              onClick={exportRedemptions}
            >
              <Download className="mr-2 h-5 w-5" />
              Export CSV
            </Button>
          </div>

          {/* Recent Redemptions */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Redemptions</CardTitle>
              <CardDescription>Last 10 redemptions for this offer</CardDescription>
            </CardHeader>
            <CardContent>
              {offer.recent_redemptions && offer.recent_redemptions.length > 0 ? (
                <div className="space-y-2">
                  {offer.recent_redemptions.map((redemption: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-mono text-sm">{redemption.redemption_code || "N/A"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(redemption.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant={redemption.partner_confirmed ? "default" : "secondary"}>
                        {redemption.partner_confirmed ? "Confirmed" : "Pending"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No redemptions yet</p>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  );
}
