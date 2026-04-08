import { useState, useEffect } from "react";
import { SignedReceiptImage } from "@/components/shared/SignedReceiptImage";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Check, X, Eye, Loader2, Search, FileText, Store, Receipt, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type ReceiptSubmission = {
  id: string;
  user_id: string;
  receipt_image_url: string;
  merchant_name: string;
  purchase_amount: number;
  receipt_date: string;
  status: string;
  admin_notes: string | null;
  pawbucks_awarded: number | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  submission_type: string;
  merchant_id: string | null;
  credit_rate_percent: number | null;
  subscription_tier: string | null;
  confirmation_id: string | null;
  // joined
  user_profile?: { full_name: string; email: string } | null;
  merchant_confirmation?: { confirmation_code: string; amount: number; customer_email: string } | null;
};

const TIER_RATES: Record<string, number> = {
  free: 1,
  pawpass: 2,
  pawpass_plus: 3,
};

export const ReceiptsTab = () => {
  const [receipts, setReceipts] = useState<ReceiptSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptSubmission | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [adminNotes, setAdminNotes] = useState("");
  const [pawbucksToAward, setPawbucksToAward] = useState("");

  useEffect(() => {
    loadReceipts();
  }, []);

  const loadReceipts = async () => {
    try {
      const { data, error } = await supabase
        .from("receipt_submissions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Enrich with user profiles
      const userIds = [...new Set((data || []).map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      // Check for matching merchant confirmations
      const receiptIds = (data || []).filter(r => r.merchant_id).map(r => r.id);
      const { data: confirmations } = receiptIds.length > 0
        ? await supabase
            .from("merchant_sale_confirmations")
            .select("receipt_submission_id, confirmation_code, amount, customer_email")
            .in("receipt_submission_id", receiptIds)
        : { data: [] };

      const enriched = (data || []).map(r => ({
        ...r,
        user_profile: profiles?.find(p => p.id === r.user_id) || null,
        merchant_confirmation: confirmations?.find(c => c.receipt_submission_id === r.id) || null,
      }));

      setReceipts(enriched);
    } catch (error) {
      console.error("Error loading receipts:", error);
      toast.error("Failed to load receipts");
    } finally {
      setLoading(false);
    }
  };

  const getSuggestedPawBucks = (receipt: ReceiptSubmission): number => {
    const rate = receipt.credit_rate_percent || TIER_RATES[receipt.subscription_tier || "free"] || 1;
    return Math.round(receipt.purchase_amount * rate * 10);
  };

  const handleUpdateStatus = async (status: "approved" | "rejected") => {
    if (!selectedReceipt) return;

    setUpdating(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const updateData: Record<string, any> = {
        status,
        admin_notes: adminNotes || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId,
      };

      if (status === "approved" && pawbucksToAward) {
        const pbAmount = parseInt(pawbucksToAward);
        updateData.pawbucks_awarded = pbAmount;

        // Credit wallet
        const { data: wallet } = await supabase
          .from("pawbucks_wallet")
          .select("balance")
          .eq("user_id", selectedReceipt.user_id)
          .single();

        if (wallet) {
          await supabase
            .from("pawbucks_wallet")
            .update({ balance: wallet.balance + pbAmount, last_updated: new Date().toISOString() })
            .eq("user_id", selectedReceipt.user_id);

          const isNonPartner = selectedReceipt.submission_type === "non_partner";
          await supabase.from("pawbucks_activity").insert({
            user_id: selectedReceipt.user_id,
            amount: pbAmount,
            type: "earn",
            source: isNonPartner ? "non-partner" : "receipt_submission",
            description: `PawBucks earned from receipt at ${selectedReceipt.merchant_name} (${selectedReceipt.credit_rate_percent || 1}% rate)`,
            pawbucks_status: isNonPartner ? "pending" : "available",
            vest_date: isNonPartner ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null,
          });

          // Create a transaction record so it appears in all dashboards
          if (selectedReceipt.merchant_id) {
            const { error: txError } = await supabase
              .from("transactions")
              .insert({
                user_id: selectedReceipt.user_id,
                merchant_id: selectedReceipt.merchant_id,
                amount: selectedReceipt.purchase_amount,
                cashback_earned: pbAmount,
                rewards_earned: pbAmount,
                status: "completed",
                description: `Receipt submission: ${selectedReceipt.merchant_name}`,
              });
            if (txError) {
              console.error("Failed to create transaction record:", txError);
            }
          }
        }

        await supabase.from("notifications").insert({
          user_id: selectedReceipt.user_id,
          title: "Receipt Approved! 🎉",
          message: `Your receipt from ${selectedReceipt.merchant_name} has been approved. ${pbAmount.toLocaleString()} PawBucks have been added to your wallet!`,
          category: "rewards",
        });
      } else if (status === "rejected") {
        await supabase.from("notifications").insert({
          user_id: selectedReceipt.user_id,
          title: "Receipt Not Approved",
          message: `Your receipt from ${selectedReceipt.merchant_name} could not be approved. ${adminNotes ? `Reason: ${adminNotes}` : "Please ensure the receipt is clear and shows all required details."}`,
          category: "system",
        });
      }

      const { error } = await supabase
        .from("receipt_submissions")
        .update(updateData)
        .eq("id", selectedReceipt.id);

      if (error) throw error;

      toast.success(`Receipt ${status === "approved" ? "approved" : "rejected"} successfully`);
      setUpdateDialogOpen(false);
      setSelectedReceipt(null);
      setAdminNotes("");
      setPawbucksToAward("");
      loadReceipts();
    } catch (error) {
      console.error("Error updating receipt:", error);
      toast.error("Failed to update receipt status");
    } finally {
      setUpdating(false);
    }
  };

  const filteredReceipts = receipts.filter((receipt) => {
    const matchesStatus = statusFilter === "all" || receipt.status === statusFilter;
    const matchesType = typeFilter === "all" || receipt.submission_type === typeFilter;
    const matchesSearch =
      receipt.merchant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (receipt.user_profile?.full_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (receipt.user_profile?.email || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesType && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Pending</Badge>;
      case "approved": return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Approved</Badge>;
      case "rejected": return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">Rejected</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    return type === "partner"
      ? <Badge variant="secondary" className="text-xs"><Store className="w-3 h-3 mr-1" />Partner</Badge>
      : <Badge variant="outline" className="text-xs"><Receipt className="w-3 h-3 mr-1" />Non-Partner</Badge>;
  };

  const getTierLabel = (tier: string | null) => {
    switch (tier) {
      case "pawpass_plus": return "PawPass+";
      case "pawpass": return "PawPass";
      default: return "Free";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by merchant, user name, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="partner">Partner</SelectItem>
            <SelectItem value="non_partner">Non-Partner</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-yellow-500/10 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-yellow-600">{receipts.filter(r => r.status === "pending").length}</p>
          <p className="text-xs text-muted-foreground">Pending Review</p>
        </div>
        <div className="bg-green-500/10 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{receipts.filter(r => r.status === "approved").length}</p>
          <p className="text-xs text-muted-foreground">Approved</p>
        </div>
        <div className="bg-primary/10 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-primary">{receipts.filter(r => r.submission_type === "partner").length}</p>
          <p className="text-xs text-muted-foreground">Partner Receipts</p>
        </div>
        <div className="bg-muted rounded-lg p-3 text-center">
          <p className="text-2xl font-bold">{receipts.filter(r => r.merchant_confirmation).length}</p>
          <p className="text-xs text-muted-foreground">Merchant Confirmed</p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Submitter</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Tier / Rate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Confirmed</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReceipts.map((receipt) => (
              <TableRow key={receipt.id}>
                <TableCell>
                  <div>
                    <span className="font-medium text-sm">{receipt.user_profile?.full_name || "Unknown"}</span>
                    <p className="text-xs text-muted-foreground">{receipt.user_profile?.email || receipt.user_id}</p>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{receipt.merchant_name}</TableCell>
                <TableCell>{getTypeBadge(receipt.submission_type)}</TableCell>
                <TableCell>${receipt.purchase_amount.toFixed(2)}</TableCell>
                <TableCell>
                  <div className="text-xs">
                    <span className="font-medium">{getTierLabel(receipt.subscription_tier)}</span>
                    <span className="text-muted-foreground ml-1">({receipt.credit_rate_percent || 1}%)</span>
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(receipt.status)}</TableCell>
                <TableCell>
                  {receipt.merchant_confirmation ? (
                    <Badge className="bg-green-600 text-xs"><ShieldCheck className="w-3 h-3 mr-1" />Yes</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setSelectedReceipt(receipt); setViewDialogOpen(true); }}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    {receipt.status === "pending" && (
                      <Button size="sm" onClick={() => {
                        setSelectedReceipt(receipt);
                        setAdminNotes(receipt.admin_notes || "");
                        setPawbucksToAward(String(getSuggestedPawBucks(receipt)));
                        setUpdateDialogOpen(true);
                      }}>
                        Review
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredReceipts.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No receipts found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* View Receipt Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Receipt Details</DialogTitle>
            <DialogDescription>View receipt submission details</DialogDescription>
          </DialogHeader>
          {selectedReceipt && (
            <div className="space-y-4">
              <div className="aspect-[3/4] max-h-[400px] overflow-hidden rounded-lg border bg-muted">
                <SignedReceiptImage receiptPath={selectedReceipt.receipt_image_url} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Submitter</Label>
                  <p className="font-medium">{selectedReceipt.user_profile?.full_name || "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">{selectedReceipt.user_profile?.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Merchant</Label>
                  <p className="font-medium">{selectedReceipt.merchant_name}</p>
                  <div className="mt-1">{getTypeBadge(selectedReceipt.submission_type)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Amount</Label>
                  <p className="font-medium">${selectedReceipt.purchase_amount.toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Tier / Rate</Label>
                  <p className="font-medium">{getTierLabel(selectedReceipt.subscription_tier)} ({selectedReceipt.credit_rate_percent || 1}%)</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Receipt Date</Label>
                  <p className="font-medium">{format(new Date(selectedReceipt.receipt_date), "MMM d, yyyy")}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedReceipt.status)}</div>
                </div>
                {selectedReceipt.merchant_confirmation && (
                  <div className="col-span-2 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldCheck className="w-4 h-4 text-green-600" />
                      <span className="font-semibold text-sm text-green-700">Merchant Confirmed</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Code: {selectedReceipt.merchant_confirmation.confirmation_code} •
                      Amount: ${selectedReceipt.merchant_confirmation.amount.toFixed(2)}
                    </p>
                  </div>
                )}
                {selectedReceipt.pawbucks_awarded != null && (
                  <div>
                    <Label className="text-muted-foreground text-xs">PawBucks Awarded</Label>
                    <p className="font-medium">{selectedReceipt.pawbucks_awarded.toLocaleString()}</p>
                  </div>
                )}
                {selectedReceipt.admin_notes && (
                  <div className="col-span-2">
                    <Label className="text-muted-foreground text-xs">Admin Notes</Label>
                    <p className="font-medium">{selectedReceipt.admin_notes}</p>
                  </div>
                )}
              </div>
              {selectedReceipt.status === "pending" && (
                <Button className="w-full" onClick={() => {
                  setViewDialogOpen(false);
                  setAdminNotes(selectedReceipt.admin_notes || "");
                  setPawbucksToAward(String(getSuggestedPawBucks(selectedReceipt)));
                  setUpdateDialogOpen(true);
                }}>
                  Review This Receipt
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Receipt</DialogTitle>
            <DialogDescription>
              {selectedReceipt?.merchant_name} • ${selectedReceipt?.purchase_amount.toFixed(2)} • {getTierLabel(selectedReceipt?.subscription_tier || null)} ({selectedReceipt?.credit_rate_percent || 1}%)
            </DialogDescription>
          </DialogHeader>
          {selectedReceipt && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                <p><strong>Submitter:</strong> {selectedReceipt.user_profile?.full_name} ({selectedReceipt.user_profile?.email})</p>
                <p><strong>Amount:</strong> ${selectedReceipt.purchase_amount.toFixed(2)}</p>
                <p><strong>Type:</strong> {selectedReceipt.submission_type === "partner" ? "Partner Merchant" : "Non-Partner"}</p>
                <p><strong>Date:</strong> {format(new Date(selectedReceipt.receipt_date), "MMM d, yyyy")}</p>
                {selectedReceipt.merchant_confirmation && (
                  <div className="mt-2 p-2 bg-green-500/10 rounded border border-green-500/20 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-green-600" />
                    <span className="text-green-700 text-xs font-medium">
                      Merchant confirmed: ${selectedReceipt.merchant_confirmation.amount.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="pawbucks">PawBucks to Award</Label>
                <Input
                  id="pawbucks"
                  type="number"
                  placeholder="e.g., 100"
                  value={pawbucksToAward}
                  onChange={(e) => setPawbucksToAward(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Suggested: {getSuggestedPawBucks(selectedReceipt).toLocaleString()} PB
                  ({selectedReceipt.credit_rate_percent || 1}% × ${selectedReceipt.purchase_amount.toFixed(2)} × 10)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Admin Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any notes about this receipt..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <Button className="flex-1" onClick={() => handleUpdateStatus("approved")} disabled={updating || !pawbucksToAward}>
                  {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                  Approve
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => handleUpdateStatus("rejected")} disabled={updating}>
                  {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <X className="w-4 h-4 mr-2" />}
                  Reject
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReceiptsTab;
