import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Search, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { ErrorHandler } from "@/utils/errorHandler";

interface Redemption {
  id: string;
  redemption_code: string;
  user_id: string;
  redeemed_at: string;
  partner_confirmed: boolean;
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

export default function MerchantOfferRedemptions() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [user, setUser] = useState<any>(null);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

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
      fetchRedemptions();
    }
  }, [user, id, statusFilter, page]);

  const fetchRedemptions = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50"
      });

      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merchant-offer-redemptions/${id}?${params}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch redemptions");
      }

      const data = await response.json();
      setRedemptions(data.redemptions || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      ErrorHandler.handle(error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmRedemption = async (redemptionCode: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke("merchant-confirm-redemption", {
        body: { redemption_code: redemptionCode, offer_id: id },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      toast.success("Redemption confirmed successfully");
      fetchRedemptions();
    } catch (error) {
      ErrorHandler.handle(error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const filteredRedemptions = redemptions.filter(r => {
    if (!searchQuery) return true;
    return r.redemption_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
           r.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           r.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <>
      <SEO 
        title="Offer Redemptions | PetalPay Merchant"
        description="View and manage offer redemptions"
        keywords={["merchant", "redemptions", "codes"]}
      />
      <div className="min-h-screen bg-background">
        <Header isAuthenticated={!!user} onLogout={handleSignOut} />
        
        <main className="container mx-auto px-4 py-8 pb-24 max-w-7xl">
          <Button variant="ghost" onClick={() => navigate(`/merchant/offers/${id}`)} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Offer Details
          </Button>

          <div className="flex flex-col gap-6">
            {/* Header */}
            <div>
              <h1 className="text-3xl font-bold">Redemptions</h1>
              <p className="text-muted-foreground mt-1">
                View and confirm customer redemptions
              </p>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by code, name, or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full md:w-[200px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Redemptions List */}
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
                <p className="mt-4 text-muted-foreground">Loading redemptions...</p>
              </div>
            ) : filteredRedemptions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No redemptions found.</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>All Redemptions</CardTitle>
                  <CardDescription>{filteredRedemptions.length} total redemptions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {filteredRedemptions.map((redemption) => (
                      <div
                        key={redemption.id}
                        className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg gap-4"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-mono font-semibold">{redemption.redemption_code}</p>
                            <Badge variant={redemption.partner_confirmed ? "default" : "secondary"}>
                              {redemption.partner_confirmed ? "Confirmed" : "Pending"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {redemption.profiles?.full_name || "Unknown User"} ({redemption.profiles?.email || "No email"})
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Redeemed: {new Date(redemption.redeemed_at || redemption.created_at).toLocaleString()}
                          </p>
                        </div>
                        {!redemption.partner_confirmed && (
                          <Button
                            size="sm"
                            onClick={() => handleConfirmRedemption(redemption.redemption_code)}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Confirm
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-2 px-4">
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
