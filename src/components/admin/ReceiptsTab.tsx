import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Check, X, Eye, Loader2, Search, FileText } from "lucide-react";
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
};

export const ReceiptsTab = () => {
  const [receipts, setReceipts] = useState<ReceiptSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
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
      setReceipts(data || []);
    } catch (error) {
      console.error("Error loading receipts:", error);
      toast.error("Failed to load receipts");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (status: "approved" | "rejected") => {
    if (!selectedReceipt) return;

    setUpdating(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const updateData: any = {
        status,
        admin_notes: adminNotes || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId,
      };

      if (status === "approved" && pawbucksToAward) {
        updateData.pawbucks_awarded = parseInt(pawbucksToAward);

        // Credit the user's PawBucks wallet
        const { data: wallet } = await supabase
          .from("pawbucks_wallet")
          .select("balance")
          .eq("user_id", selectedReceipt.user_id)
          .single();

        if (wallet) {
          const newBalance = wallet.balance + parseInt(pawbucksToAward);
          await supabase
            .from("pawbucks_wallet")
            .update({ balance: newBalance, last_updated: new Date().toISOString() })
            .eq("user_id", selectedReceipt.user_id);

          // Log the activity
          await supabase.from("pawbucks_activity").insert({
            user_id: selectedReceipt.user_id,
            amount: parseInt(pawbucksToAward),
            type: "credit",
            source: "receipt_submission",
            description: `PawBucks awarded for receipt from ${selectedReceipt.merchant_name}`,
          });
        }

        // Send notification to user
        await supabase.from("notifications").insert({
          user_id: selectedReceipt.user_id,
          title: "Receipt Approved! 🎉",
          message: `Your receipt from ${selectedReceipt.merchant_name} has been approved. ${pawbucksToAward} PawBucks have been added to your wallet!`,
          category: "rewards",
        });
      } else if (status === "rejected") {
        // Send rejection notification
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
    const matchesSearch = 
      receipt.merchant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      receipt.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Pending</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Approved</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">Rejected</Badge>;
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
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-yellow-500/10 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-yellow-600">
            {receipts.filter(r => r.status === "pending").length}
          </p>
          <p className="text-xs text-muted-foreground">Pending</p>
        </div>
        <div className="bg-green-500/10 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-600">
            {receipts.filter(r => r.status === "approved").length}
          </p>
          <p className="text-xs text-muted-foreground">Approved</p>
        </div>
        <div className="bg-red-500/10 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-red-600">
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
              <TableHead>Amount</TableHead>
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
                        onClick={() => {
                          setSelectedReceipt(receipt);
                          setAdminNotes(receipt.admin_notes || "");
                          setPawbucksToAward("");
                          setUpdateDialogOpen(true);
                        }}
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
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
                <img
                  src={selectedReceipt.receipt_image_url}
                  alt="Receipt"
                  className="w-full h-full object-contain"
                />
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
                    <p className="font-medium">{selectedReceipt.pawbucks_awarded}</p>
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
                <Button
                  className="w-full"
                  onClick={() => {
                    setViewDialogOpen(false);
                    setAdminNotes(selectedReceipt.admin_notes || "");
                    setPawbucksToAward("");
                    setUpdateDialogOpen(true);
                  }}
                >
                  Review This Receipt
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Update Receipt Dialog */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Receipt</DialogTitle>
            <DialogDescription>
              Approve or reject this receipt submission from {selectedReceipt?.merchant_name}
            </DialogDescription>
          </DialogHeader>
          {selectedReceipt && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-3 text-sm">
                <p><strong>Amount:</strong> ${selectedReceipt.purchase_amount.toFixed(2)}</p>
                <p><strong>Date:</strong> {format(new Date(selectedReceipt.receipt_date), "MMM d, yyyy")}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pawbucks">PawBucks to Award (if approving)</Label>
                <Input
                  id="pawbucks"
                  type="number"
                  placeholder="e.g., 100"
                  value={pawbucksToAward}
                  onChange={(e) => setPawbucksToAward(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Suggested: {Math.round(selectedReceipt.purchase_amount * 10)} PawBucks (10x purchase amount)
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
                <Button
                  className="flex-1"
                  onClick={() => handleUpdateStatus("approved")}
                  disabled={updating || !pawbucksToAward}
                >
                  {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => handleUpdateStatus("rejected")}
                  disabled={updating}
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

export default ReceiptsTab;
