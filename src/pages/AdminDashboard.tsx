import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  LogOut,
  Shield,
  Users,
  Store,
  DollarSign,
  FileText,
  Bell,
  Loader2,
  Check,
  X,
  Edit,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Merchant = {
  id: string;
  business_name: string;
  contact_person: string;
  business_type: string;
  cashback_rate: number;
  stripe_account_status?: string;
  user_id: string;
};

type Profile = {
  id: string;
  full_name: string;
  email: string;
  user_type: string;
  created_at: string;
};

type FundingRequest = {
  id: string;
  merchant_id: string;
  requested_amount: number;
  reason: string;
  estimated_monthly_sales: number;
  status: string;
  created_at: string;
  merchants?: {
    business_name: string;
  };
};

type Transaction = {
  id: string;
  amount: number;
  cashback_earned: number;
  description: string;
  created_at: string;
  merchants?: {
    business_name: string;
  };
};

const AdminDashboard = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [fundingRequests, setFundingRequests] = useState<FundingRequest[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalCashback, setTotalCashback] = useState(0);
  
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [editCashbackDialogOpen, setEditCashbackDialogOpen] = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [sendingNotification, setSendingNotification] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/admin/login");
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
        .eq("role", "admin")
        .single();

      if (error || !data) {
        toast.error("Access denied. Admin privileges required.");
        await supabase.auth.signOut();
        navigate("/admin/login");
        return;
      }

      setIsAdmin(true);
      loadAdminData();
    } catch (error) {
      console.error("Error checking admin access:", error);
      await supabase.auth.signOut();
      navigate("/admin/login");
    }
  };

  const loadAdminData = async () => {
    try {
      // Load merchants
      const { data: merchantsData } = await supabase
        .from("merchants")
        .select("*")
        .order("created_at", { ascending: false });
      setMerchants(merchantsData || []);

      // Load profiles
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      setProfiles(profilesData || []);

      // Load funding requests with merchant names
      const { data: fundingData } = await supabase
        .from("funding_requests")
        .select("*, merchants(business_name)")
        .order("created_at", { ascending: false });
      setFundingRequests(fundingData || []);

      // Load transactions with merchant names
      const { data: transactionsData } = await supabase
        .from("transactions")
        .select("*, merchants(business_name)")
        .order("created_at", { ascending: false })
        .limit(50);
      setTransactions(transactionsData || []);

      // Calculate total cashback
      const total = transactionsData?.reduce((sum, t) => sum + (t.cashback_earned || 0), 0) || 0;
      setTotalCashback(total);
    } catch (error: any) {
      console.error("Error loading admin data:", error);
      toast.error("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateFundingRequest = async (requestId: string, status: "approved" | "denied") => {
    try {
      const { error } = await supabase
        .from("funding_requests")
        .update({ status })
        .eq("id", requestId);

      if (error) throw error;

      toast.success(`Funding request ${status}!`);
      loadAdminData();
    } catch (error: any) {
      console.error("Error updating funding request:", error);
      toast.error("Failed to update funding request");
    }
  };

  const handleUpdateCashback = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedMerchant) return;

    try {
      const formData = new FormData(e.currentTarget);
      const newRate = parseFloat(formData.get("cashbackRate") as string);

      const { error } = await supabase
        .from("merchants")
        .update({ cashback_rate: newRate })
        .eq("id", selectedMerchant.id);

      if (error) throw error;

      toast.success("Cashback rate updated successfully!");
      setEditCashbackDialogOpen(false);
      setSelectedMerchant(null);
      loadAdminData();
    } catch (error: any) {
      console.error("Error updating cashback rate:", error);
      toast.error("Failed to update cashback rate");
    }
  };

  const handleSendNotification = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSendingNotification(true);

    try {
      const formData = new FormData(e.currentTarget);
      const title = formData.get("title") as string;
      const message = formData.get("message") as string;
      const recipient = formData.get("recipient") as string;

      // Get all user IDs or specific user based on recipient
      let userIds: string[] = [];
      if (recipient === "all") {
        userIds = profiles.map(p => p.id);
      } else if (recipient === "merchants") {
        userIds = merchants.map(m => m.user_id);
      } else if (recipient === "pet_owners") {
        userIds = profiles.filter(p => p.user_type === "pet_owner").map(p => p.id);
      }

      // Insert notifications for each user
      const notifications = userIds.map(userId => ({
        user_id: userId,
        title,
        message,
      }));

      const { error } = await supabase
        .from("notifications")
        .insert(notifications);

      if (error) throw error;

      toast.success(`Notification sent to ${userIds.length} users!`);
      setNotificationDialogOpen(false);
    } catch (error: any) {
      console.error("Error sending notification:", error);
      toast.error("Failed to send notification");
    } finally {
      setSendingNotification(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Admin Dashboard</h1>
              <p className="text-xs text-muted-foreground">PetalPay Management</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setNotificationDialogOpen(true)}>
              <Bell className="w-4 h-4 mr-2" />
              Send Notification
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Stats Overview */}
        <div className="grid gap-6 md:grid-cols-4">
          <GradientCard gradient>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{profiles.length}</p>
              </div>
            </div>
          </GradientCard>

          <GradientCard>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                <Store className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Merchants</p>
                <p className="text-2xl font-bold">{merchants.length}</p>
              </div>
            </div>
          </GradientCard>

          <GradientCard>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Transactions</p>
                <p className="text-2xl font-bold">{transactions.length}</p>
              </div>
            </div>
          </GradientCard>

          <GradientCard>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Cashback</p>
                <p className="text-2xl font-bold">${totalCashback.toFixed(2)}</p>
              </div>
            </div>
          </GradientCard>
        </div>

        {/* Funding Requests */}
        <GradientCard>
          <h3 className="text-xl font-semibold mb-4">Pending Funding Requests</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Monthly Sales</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fundingRequests.filter(r => r.status === "pending").map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.merchants?.business_name}</TableCell>
                    <TableCell>${request.requested_amount.toFixed(2)}</TableCell>
                    <TableCell className="max-w-xs truncate">{request.reason}</TableCell>
                    <TableCell>${request.estimated_monthly_sales.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{request.status}</Badge>
                    </TableCell>
                    <TableCell>{format(new Date(request.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleUpdateFundingRequest(request.id, "approved")}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleUpdateFundingRequest(request.id, "denied")}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {fundingRequests.filter(r => r.status === "pending").length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No pending funding requests
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </GradientCard>

        {/* Merchants */}
        <GradientCard>
          <h3 className="text-xl font-semibold mb-4">Merchants</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business Name</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Cashback Rate</TableHead>
                  <TableHead>Stripe Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {merchants.map((merchant) => (
                  <TableRow key={merchant.id}>
                    <TableCell className="font-medium">{merchant.business_name}</TableCell>
                    <TableCell>{merchant.contact_person}</TableCell>
                    <TableCell>{merchant.business_type}</TableCell>
                    <TableCell>{merchant.cashback_rate}%</TableCell>
                    <TableCell>
                      <Badge variant={merchant.stripe_account_status === "complete" ? "default" : "outline"}>
                        {merchant.stripe_account_status || "pending"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedMerchant(merchant);
                          setEditCashbackDialogOpen(true);
                        }}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Cashback
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </GradientCard>

        {/* Recent Transactions */}
        <GradientCard>
          <h3 className="text-xl font-semibold mb-4">Recent Transactions</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Cashback</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.slice(0, 10).map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">{transaction.merchants?.business_name}</TableCell>
                    <TableCell>{transaction.description}</TableCell>
                    <TableCell>${transaction.amount.toFixed(2)}</TableCell>
                    <TableCell className="text-accent">${transaction.cashback_earned.toFixed(2)}</TableCell>
                    <TableCell>{format(new Date(transaction.created_at), "MMM d, h:mm a")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </GradientCard>
      </main>

      {/* Edit Cashback Dialog */}
      <Dialog open={editCashbackDialogOpen} onOpenChange={setEditCashbackDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Cashback Rate</DialogTitle>
            <DialogDescription>
              Update the cashback rate for {selectedMerchant?.business_name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateCashback} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cashbackRate">Cashback Rate (%)</Label>
              <Input
                id="cashbackRate"
                name="cashbackRate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                defaultValue={selectedMerchant?.cashback_rate}
                required
              />
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditCashbackDialogOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1">
                Update Rate
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Send Notification Dialog */}
      <Dialog open={notificationDialogOpen} onOpenChange={setNotificationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Notification</DialogTitle>
            <DialogDescription>
              Send a push notification or in-app message to users
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSendNotification} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recipient">Recipient</Label>
              <select
                id="recipient"
                name="recipient"
                className="w-full h-10 px-3 rounded-md border bg-background"
                required
              >
                <option value="all">All Users</option>
                <option value="merchants">All Merchants</option>
                <option value="pet_owners">All Pet Owners</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                placeholder="Notification title"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                name="message"
                placeholder="Your message here..."
                rows={4}
                required
              />
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setNotificationDialogOpen(false)}
                className="flex-1"
                disabled={sendingNotification}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={sendingNotification}>
                {sendingNotification ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Notification"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
