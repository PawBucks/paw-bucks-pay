import { useState, useEffect } from "react";
import { SignedReceiptImage } from "@/components/shared/SignedReceiptImage";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, X, Eye, Loader2, Search, FileText, AlertTriangle, Info, Crown } from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";

const EARN_RATE = 5; // 5 PawBucks per $1 USD
const MONTHLY_CAP = 20000; // 20,000 PawBucks per month
const VESTING_DAYS = 30; // 30-day vesting period

type ReceiptSubmission = {
  id: string;
  user_id: string;
  receipt_image_url: string;
  merchant_name: string;
  purchase_amount: number;
  receipt_date: string;
  status: string;
  admin_notes: string | null;
  decision_reason: string | null;
  pawbucks_awarded: number | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

type UserInfo = {
  id: string;
  full_name: string;
  email: string;
  subscription_tier: string | null;
  monthly_non_partner_total: number;
};

export const NonPartnerReceiptVerificationTab = () => {
  const [receipts, setReceipts] = useState<ReceiptSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptSubmission | null>(null);
  const [selectedUserInfo, setSelectedUserInfo] = useState<UserInfo | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  const [adminNotes, setAdminNotes] = useState("");
  const [decisionReason, setDecisionReason] = useState("");

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
      setReceipts(data || []);
    } catch (error) {
      console.error("Error loading receipts:", error);
      toast.error("Failed to load receipts");
    } finally {
      setLoading(false);
    }
  };

  const loadUserInfo = async (userId: string) => {
    try {
      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", userId)
        .single();

      if (profileError) throw profileError;

      // Get subscription status
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      // Get monthly non-partner PawBucks total using RPC
      const { data: monthlyTotal, error: monthlyError } = await supabase
        .rpc("get_monthly_non_partner_pawbucks", { p_user_id: userId });

      if (monthlyError) {
        console.error("Error getting monthly total:", monthlyError);
      }

      setSelectedUserInfo({
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        subscription_tier: subscription ? "pawpass_plus" : null,
        monthly_non_partner_total: monthlyTotal || 0,
      });
    } catch (error) {
      console.error("Error loading user info:", error);
      setSelectedUserInfo(null);
    }
  };

  const calculatePawBucks = (usdAmount: number, currentMonthlyTotal: number): { pawbucks: number; capped: boolean; originalAmount: number } => {
    const calculatedPawBucks = Math.floor(usdAmount * EARN_RATE);
    const remainingCap = Math.max(0, MONTHLY_CAP - currentMonthlyTotal);
    const finalPawBucks = Math.min(calculatedPawBucks, remainingCap);
    
    return {
      pawbucks: finalPawBucks,
      capped: finalPawBucks < calculatedPawBucks,
      originalAmount: calculatedPawBucks,
    };
  };

  const handleOpenReview = async (receipt: ReceiptSubmission) => {
    setSelectedReceipt(receipt);
    setAdminNotes(receipt.admin_notes || "");
    setDecisionReason("");
    await loadUserInfo(receipt.user_id);
    setUpdateDialogOpen(true);
  };

  const handleUpdateStatus = async (status: "approved" | "rejected") => {
    if (!selectedReceipt || !selectedUserInfo) return;

    // Only PawPass+ subscribers can earn non-partner PawBucks
    if (status === "approved" && selectedUserInfo.subscription_tier !== "pawpass_plus") {
      toast.error("Only PawPass+ subscribers can earn non-partner PawBucks");
      return;
    }

    if (status === "rejected" && !decisionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    setUpdating(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const updateData: Record<string, unknown> = {
        status,
        admin_notes: adminNotes || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId,
      };

      if (status === "approved") {
        const { pawbucks, capped } = calculatePawBucks(
          selectedReceipt.purchase_amount,
          selectedUserInfo.monthly_non_partner_total
        );

        if (pawbucks === 0) {
          toast.error("User has reached their monthly non-partner PawBucks cap");
          setUpdating(false);
          return;
        }

        updateData.pawbucks_awarded = pawbucks;

        // Calculate vest date (30 days from now)
        const vestDate = addDays(new Date(), VESTING_DAYS);

        // Log the activity with pending status
        const { error: activityError } = await supabase.from("pawbucks_activity").insert({
          user_id: selectedReceipt.user_id,
          amount: pawbucks,
          type: "earn",
          source: "non-partner",
          description: `Non-partner PawBucks from ${selectedReceipt.merchant_name} (vesting in 30 days)`,
          pawbucks_status: "pending",
          vest_date: vestDate.toISOString(),
          receipt_id: selectedReceipt.id,
        });

        if (activityError) {
          console.error("Error logging activity:", activityError);
          throw activityError;
        }

        // Note: We don't update the wallet balance yet - it will be updated when vested
        // The balance in pawbucks_wallet represents available balance only

        // Send notification to user
        await supabase.from("notifications").insert({
          user_id: selectedReceipt.user_id,
          title: "Receipt Approved! 🎉",
          message: `Your receipt from ${selectedReceipt.merchant_name} has been approved! ${pawbucks} PawBucks have been credited and will be available in 30 days.${capped ? " Note: Monthly cap was applied." : ""}`,
          category: "rewards",
        });

        if (capped) {
          toast.success(`Receipt approved. Monthly cap applied - ${pawbucks} PawBucks credited (pending 30-day vesting).`);
        } else {
          toast.success(`Receipt approved. ${pawbucks} PawBucks credited (pending 30-day vesting).`);
        }
      } else if (status === "rejected") {
        updateData.decision_reason = decisionReason;

        // Send rejection notification
        await supabase.from("notifications").insert({
          user_id: selectedReceipt.user_id,
          title: "Receipt Not Approved",
          message: `Your receipt from ${selectedReceipt.merchant_name} could not be approved. Reason: ${decisionReason}`,
          category: "system",
        });

        toast.success("Receipt rejected.");
      }

      const { error } = await supabase
        .from("receipt_submissions")
        .update(updateData)
        .eq("id", selectedReceipt.id);

      if (error) throw error;

      setUpdateDialogOpen(false);
      setSelectedReceipt(null);
      setSelectedUserInfo(null);
      setAdminNotes("");
      setDecisionReason("");
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
    const matchesSearch = 
      receipt.merchant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      receipt.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30/30">Pending Review</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-success/10 text-success border-success/30/30">Approved</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30/30">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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
      {/* Info Banner */}
      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium mb-1">Non-Partner Receipt Verification</p>
            <ul className="text-muted-foreground space-y-1">
              <li>• Rate: 5 PawBucks per $1 USD spent</li>
              <li>• Monthly cap: 20,000 PawBucks per Pet Owner</li>
              <li>• 30-day vesting period after approval</li>
              <li>• <span className="font-medium text-primary">Only PawPass+ subscribers</span> can earn non-partner PawBucks</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by merchant name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-warning/10 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-warning">
            {receipts.filter(r => r.status === "pending").length}
          </p>
          <p className="text-xs text-muted-foreground">Pending</p>
        </div>
        <div className="bg-success/10 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-success">
            {receipts.filter(r => r.status === "approved").length}
          </p>
          <p className="text-xs text-muted-foreground">Approved</p>
        </div>
        <div className="bg-destructive/10 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-destructive">
            {receipts.filter(r => r.status === "rejected").length}
          </p>
          <p className="text-xs text-muted-foreground">Rejected</p>
        </div>
      </div>

      {/* Receipts Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Merchant</TableHead>
              <TableHead>Amount (USD)</TableHead>
              <TableHead>Calculated PB</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReceipts.map((receipt) => (
              <TableRow key={receipt.id}>
                <TableCell className="font-medium">{receipt.merchant_name}</TableCell>
                <TableCell>${receipt.purchase_amount.toFixed(2)}</TableCell>
                <TableCell>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        {Math.floor(receipt.purchase_amount * EARN_RATE)} PB
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>5 PawBucks × ${receipt.purchase_amount.toFixed(2)}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell>{format(new Date(receipt.receipt_date), "MMM d, yyyy")}</TableCell>
                <TableCell>{getStatusBadge(receipt.status)}</TableCell>
                <TableCell>{format(new Date(receipt.created_at), "MMM d, yyyy")}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedReceipt(receipt);
                        setViewDialogOpen(true);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    {receipt.status === "pending" && (
                      <Button
                        size="sm"
                        onClick={() => handleOpenReview(receipt)}
                      >
                        Review
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredReceipts.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
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
                  <Label className="text-muted-foreground text-xs">Merchant</Label>
                  <p className="font-medium">{selectedReceipt.merchant_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Purchase Amount</Label>
                  <p className="font-medium">${selectedReceipt.purchase_amount.toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Calculated PawBucks</Label>
                  <p className="font-medium">{Math.floor(selectedReceipt.purchase_amount * EARN_RATE)} PB</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Receipt Date</Label>
                  <p className="font-medium">{format(new Date(selectedReceipt.receipt_date), "MMM d, yyyy")}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedReceipt.status)}</div>
                </div>
                {selectedReceipt.pawbucks_awarded && (
                  <div>
                    <Label className="text-muted-foreground text-xs">PawBucks Awarded</Label>
                    <p className="font-medium">{selectedReceipt.pawbucks_awarded} PB</p>
                  </div>
                )}
                {selectedReceipt.admin_notes && (
                  <div className="col-span-2">
                    <Label className="text-muted-foreground text-xs">Admin Notes</Label>
                    <p className="font-medium">{selectedReceipt.admin_notes}</p>
                  </div>
                )}
                {selectedReceipt.decision_reason && (
                  <div className="col-span-2">
                    <Label className="text-muted-foreground text-xs">Rejection Reason</Label>
                    <p className="font-medium text-destructive">{selectedReceipt.decision_reason}</p>
                  </div>
                )}
              </div>
              {selectedReceipt.status === "pending" && (
                <Button
                  className="w-full"
                  onClick={() => {
                    setViewDialogOpen(false);
                    handleOpenReview(selectedReceipt);
                  }}
                >
                  Review This Receipt
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Review Receipt Dialog */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Non-Partner Receipt</DialogTitle>
            <DialogDescription>
              Approve or reject this receipt from {selectedReceipt?.merchant_name}
            </DialogDescription>
          </DialogHeader>
          {selectedReceipt && (
            <div className="space-y-4">
              {/* User Info Card */}
              {selectedUserInfo ? (
                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{selectedUserInfo.full_name}</p>
                      <p className="text-sm text-muted-foreground">{selectedUserInfo.email}</p>
                    </div>
                    {selectedUserInfo.subscription_tier === "pawpass_plus" ? (
                      <Badge className="bg-primary/10 text-primary border-primary/30/30">
                        <Crown className="w-3 h-3 mr-1" /> PawPass+
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Free Tier
                      </Badge>
                    )}
                  </div>
                  
                  {selectedUserInfo.subscription_tier !== "pawpass_plus" && (
                    <div className="p-3 bg-warning/10 rounded-lg flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-warning">
                        This user is not a PawPass+ subscriber. Only PawPass+ subscribers can earn non-partner PawBucks.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-2 bg-muted/30 rounded">
                      <p className="text-muted-foreground text-xs">This Month Earned</p>
                      <p className="font-semibold">{selectedUserInfo.monthly_non_partner_total.toLocaleString()} PB</p>
                    </div>
                    <div className="p-2 bg-muted/30 rounded">
                      <p className="text-muted-foreground text-xs">Remaining Cap</p>
                      <p className="font-semibold">{Math.max(0, MONTHLY_CAP - selectedUserInfo.monthly_non_partner_total).toLocaleString()} PB</p>
                    </div>
                  </div>
                </Card>
              ) : (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              )}

              {/* Receipt Details */}
              <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                <p><strong>Amount:</strong> ${selectedReceipt.purchase_amount.toFixed(2)}</p>
                <p><strong>Date:</strong> {format(new Date(selectedReceipt.receipt_date), "MMM d, yyyy")}</p>
                <p>
                  <strong>Calculated PawBucks:</strong>{" "}
                  {selectedUserInfo && (() => {
                    const { pawbucks, capped, originalAmount } = calculatePawBucks(
                      selectedReceipt.purchase_amount,
                      selectedUserInfo.monthly_non_partner_total
                    );
                    return (
                      <span>
                        {pawbucks} PB
                        {capped && (
                          <span className="text-warning ml-1">
                            (capped from {originalAmount} PB)
                          </span>
                        )}
                      </span>
                    );
                  })()}
                </p>
                <p className="text-muted-foreground"><strong>Vesting:</strong> 30 days after approval</p>
              </div>

              {/* Admin Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Admin Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Internal notes..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Rejection Reason (only shown when rejecting) */}
              <div className="space-y-2">
                <Label htmlFor="reason">Rejection Reason (required if rejecting)</Label>
                <Textarea
                  id="reason"
                  placeholder="Provide reason for rejection..."
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-success hover:bg-success"
                  onClick={() => handleUpdateStatus("approved")}
                  disabled={updating || !selectedUserInfo || selectedUserInfo.subscription_tier !== "pawpass_plus"}
                >
                  {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                  Approve & Credit
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => handleUpdateStatus("rejected")}
                  disabled={updating || !decisionReason.trim()}
                >
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

export default NonPartnerReceiptVerificationTab;
