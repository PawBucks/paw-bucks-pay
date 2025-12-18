import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { MessageSquare, User, Mail, Clock, CheckCircle, AlertCircle, Eye } from "lucide-react";

interface FeedbackSubmission {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  feedback: string;
  status: string;
  admin_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

const statusColors: Record<string, string> = {
  new: "bg-blue-500",
  in_progress: "bg-yellow-500",
  resolved: "bg-green-500",
  dismissed: "bg-gray-500",
};

const statusLabels: Record<string, string> = {
  new: "New",
  in_progress: "In Progress",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

export default function FeedbackTab() {
  const queryClient = useQueryClient();
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackSubmission | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: feedbackList, isLoading } = useQuery({
    queryKey: ["admin-feedback", filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("feedback_submissions")
        .select("*")
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as FeedbackSubmission[];
    },
  });

  const updateFeedbackMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      adminNotes,
    }: {
      id: string;
      status: string;
      adminNotes?: string;
    }) => {
      const updateData: Record<string, unknown> = { status };
      
      if (adminNotes !== undefined) {
        updateData.admin_notes = adminNotes;
      }
      
      if (status === "resolved" || status === "dismissed") {
        const { data: { user } } = await supabase.auth.getUser();
        updateData.resolved_by = user?.id;
        updateData.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("feedback_submissions")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-feedback"] });
      toast.success("Feedback updated successfully");
      setSelectedFeedback(null);
    },
    onError: (error) => {
      toast.error("Failed to update feedback: " + error.message);
    },
  });

  const handleStatusChange = (id: string, newStatus: string) => {
    updateFeedbackMutation.mutate({ id, status: newStatus });
  };

  const handleSaveNotes = () => {
    if (selectedFeedback) {
      updateFeedbackMutation.mutate({
        id: selectedFeedback.id,
        status: selectedFeedback.status,
        adminNotes,
      });
    }
  };

  const openFeedbackDetail = (feedback: FeedbackSubmission) => {
    setSelectedFeedback(feedback);
    setAdminNotes(feedback.admin_notes || "");
  };

  const getStatusCounts = () => {
    if (!feedbackList) return { new: 0, in_progress: 0, resolved: 0, dismissed: 0 };
    return {
      new: feedbackList.filter((f) => f.status === "new").length,
      in_progress: feedbackList.filter((f) => f.status === "in_progress").length,
      resolved: feedbackList.filter((f) => f.status === "resolved").length,
      dismissed: feedbackList.filter((f) => f.status === "dismissed").length,
    };
  };

  const counts = filterStatus === "all" ? getStatusCounts() : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">User Feedback</h2>
          <p className="text-muted-foreground">Manage feedback submitted by users</p>
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {counts && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">New</span>
              </div>
              <p className="text-2xl font-bold">{counts.new}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-muted-foreground">In Progress</span>
              </div>
              <p className="text-2xl font-bold">{counts.in_progress}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Resolved</span>
              </div>
              <p className="text-2xl font-bold">{counts.resolved}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-muted-foreground">Dismissed</span>
              </div>
              <p className="text-2xl font-bold">{counts.dismissed}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8">Loading feedback...</div>
      ) : feedbackList?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No feedback submissions yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {feedbackList?.map((feedback) => (
            <Card key={feedback.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={statusColors[feedback.status]}>
                        {statusLabels[feedback.status]}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(feedback.created_at), "MMM d, yyyy h:mm a")}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>{feedback.user_name || "Anonymous"}</span>
                      </div>
                      {feedback.user_email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <span>{feedback.user_email}</span>
                        </div>
                      )}
                    </div>
                    
                    <p className="text-sm line-clamp-2">{feedback.feedback}</p>
                    
                    {feedback.admin_notes && (
                      <p className="text-xs text-muted-foreground mt-2 italic">
                        Notes: {feedback.admin_notes.substring(0, 100)}...
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Select
                      value={feedback.status}
                      onValueChange={(value) => handleStatusChange(feedback.id, value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="dismissed">Dismissed</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openFeedbackDetail(feedback)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedFeedback} onOpenChange={() => setSelectedFeedback(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Feedback Details</DialogTitle>
          </DialogHeader>
          
          {selectedFeedback && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={statusColors[selectedFeedback.status]}>
                  {statusLabels[selectedFeedback.status]}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Submitted {format(new Date(selectedFeedback.created_at), "MMMM d, yyyy 'at' h:mm a")}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>
                  <p className="font-medium">{selectedFeedback.user_name || "Anonymous"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span>
                  <p className="font-medium">{selectedFeedback.user_email || "N/A"}</p>
                </div>
              </div>
              
              <div>
                <span className="text-sm text-muted-foreground">Feedback:</span>
                <Card className="mt-1">
                  <CardContent className="p-4">
                    <p className="whitespace-pre-wrap">{selectedFeedback.feedback}</p>
                  </CardContent>
                </Card>
              </div>
              
              <div>
                <label className="text-sm text-muted-foreground">Admin Notes:</label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add internal notes about this feedback..."
                  className="mt-1"
                  rows={3}
                />
              </div>
              
              <div className="flex items-center justify-between pt-4">
                <Select
                  value={selectedFeedback.status}
                  onValueChange={(value) => {
                    setSelectedFeedback({ ...selectedFeedback, status: value });
                  }}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="dismissed">Dismissed</SelectItem>
                  </SelectContent>
                </Select>
                
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setSelectedFeedback(null)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveNotes}
                    disabled={updateFeedbackMutation.isPending}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
