import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Edit, Pause, Play, Archive, ArchiveRestore, BarChart3, QrCode } from "lucide-react";
import { toast } from "sonner";
import { ErrorHandler } from "@/utils/errorHandler";
import { MerchantOfferImport } from "@/components/MerchantOfferImport";

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
  created_at: string;
}

export default function MerchantOffers() {
  const navigate = useNavigate();
  const { signOut: globalSignOut } = useAuth();
  const [user, setUser] = useState<any>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
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
    if (user) {
      fetchOffers();
    }
  }, [user, statusFilter, searchQuery, page]);

  const fetchOffers = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20"
      });

      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      if (searchQuery) {
        params.append("search", searchQuery);
      }

      const { data, error } = await supabase.functions.invoke("merchant-list-offers", {
        body: {},
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      setOffers(data.offers || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      ErrorHandler.handle(error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (offerId: string, action: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke("merchant-manage-offer-status", {
        body: { offer_id: offerId, action },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      toast.success(`Offer ${action}d successfully`);
      fetchOffers();
    } catch (error) {
      ErrorHandler.handle(error);
    }
  };

const handleSignOut = async () => {
  await globalSignOut();
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

  return (
    <>
      <SEO 
        title="Partner Offers Management | PawBucks Merchant"
        description="Create and manage PawBucks redemption offers for your customers"
        keywords={["merchant", "offers", "rewards", "management"]}
      />
      <div className="min-h-screen bg-background">
        <Header isAuthenticated={!!user} onLogout={handleSignOut} userId={user?.id} variant="merchant" />
        
        <main className="container mx-auto px-4 py-8 pb-24 max-w-7xl">
          <div className="flex flex-col gap-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold">Partner Offers</h1>
                <p className="text-muted-foreground mt-1">
                  Create and manage PawBucks redemption offers
                </p>
              </div>
              <div className="flex gap-2">
                <MerchantOfferImport onImportComplete={fetchOffers} />
                <Button onClick={() => navigate("/merchant/offers/new")}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Offer
                </Button>
              </div>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search offers..."
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
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Offers List */}
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
                <p className="mt-4 text-muted-foreground">Loading offers...</p>
              </div>
            ) : offers.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No offers found. Create your first offer to get started!</p>
                  <Button className="mt-4" onClick={() => navigate("/merchant/offers/new")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Offer
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {offers.map((offer) => (
                  <Card key={offer.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <CardTitle>{offer.title}</CardTitle>
                            {getStatusBadge(offer.status)}
                          </div>
                          <CardDescription className="line-clamp-2">
                            {offer.description}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-muted-foreground">PawBucks Required</p>
                          <p className="text-lg font-semibold">{offer.coins_required.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Redemptions</p>
                          <p className="text-lg font-semibold">
                            {offer.redemption_count}
                            {offer.redemption_cap && ` / ${offer.redemption_cap}`}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Start Date</p>
                          <p className="text-sm">
                            {offer.start_date ? new Date(offer.start_date).toLocaleDateString() : "Immediate"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">End Date</p>
                          <p className="text-sm">
                            {offer.end_date ? new Date(offer.end_date).toLocaleDateString() : "No expiry"}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/merchant/offers/${offer.id}`)}
                        >
                          <BarChart3 className="mr-2 h-4 w-4" />
                          View Details
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/merchant/offers/${offer.id}/edit`)}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        {offer.status === "active" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusChange(offer.id, "pause")}
                          >
                            <Pause className="mr-2 h-4 w-4" />
                            Pause
                          </Button>
                        )}
                        {offer.status === "paused" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusChange(offer.id, "resume")}
                          >
                            <Play className="mr-2 h-4 w-4" />
                            Resume
                          </Button>
                        )}
                        {offer.status === "archived" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusChange(offer.id, "unarchive")}
                          >
                            <ArchiveRestore className="mr-2 h-4 w-4" />
                            Unarchive
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusChange(offer.id, "archive")}
                          >
                            <Archive className="mr-2 h-4 w-4" />
                            Archive
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/merchant/offers/${offer.id}/codes`)}
                        >
                          <QrCode className="mr-2 h-4 w-4" />
                          Codes
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
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
