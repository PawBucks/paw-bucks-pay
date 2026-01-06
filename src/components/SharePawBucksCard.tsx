import { useState, useEffect, useCallback, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GradientCard } from "@/components/ui/gradient-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, UserPlus, Mail, Check, X, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type SharedMember = {
  id: string;
  owner_id: string;
  member_email: string;
  member_id: string | null;
  status: string;
  invited_at: string;
  accepted_at: string | null;
};

type PendingInvite = SharedMember & {
  owner_profile?: {
    full_name: string;
    email: string;
  };
};

const SharePawBucksCardComponent = () => {
  const [sharedMembers, setSharedMembers] = useState<SharedMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadSharedMembers = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get members I've shared with
      const { data: members } = await supabase
        .from("shared_account_members")
        .select("*")
        .eq("owner_id", user.id)
        .order("invited_at", { ascending: false });

      setSharedMembers(members || []);

      // Get invites sent to me
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", user.id)
        .single();

      if (profile?.email) {
        const { data: invites } = await supabase
          .from("shared_account_members")
          .select("*")
          .eq("member_email", profile.email)
          .eq("status", "pending");

        if (invites && invites.length > 0) {
          // Fetch owner profiles
          const ownerIds = invites.map(i => i.owner_id);
          const { data: ownerProfiles } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", ownerIds);

          const profileMap = new Map(ownerProfiles?.map(p => [p.id, p]) || []);
          
          const enrichedInvites = invites.map(invite => ({
            ...invite,
            owner_profile: profileMap.get(invite.owner_id),
          }));

          setPendingInvites(enrichedInvites);
        } else {
          setPendingInvites([]);
        }
      }
    } catch (error) {
      console.error("Error loading shared members:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSharedMembers();
  }, [loadSharedMembers]);

  const handleInvite = useCallback(async () => {
    if (!email.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    setInviting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check if already invited
      const { data: existing } = await supabase
        .from("shared_account_members")
        .select("id")
        .eq("owner_id", user.id)
        .eq("member_email", email.toLowerCase())
        .maybeSingle();

      if (existing) {
        toast.error("This person has already been invited");
        return;
      }

      // Check if the email exists in profiles
      const { data: memberProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email.toLowerCase())
        .maybeSingle();

      const { error } = await supabase
        .from("shared_account_members")
        .insert({
          owner_id: user.id,
          member_email: email.toLowerCase(),
          member_id: memberProfile?.id || null,
          status: "pending",
        });

      if (error) throw error;

      toast.success("Invitation sent!");
      setEmail("");
      setDialogOpen(false);
      loadSharedMembers();
    } catch (error: any) {
      toast.error(error.message || "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  }, [email, loadSharedMembers]);

  const handleRemoveMember = useCallback(async (memberId: string) => {
    try {
      const { error } = await supabase
        .from("shared_account_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      toast.success("Member removed");
      loadSharedMembers();
    } catch (error: any) {
      toast.error("Failed to remove member");
    }
  }, [loadSharedMembers]);

  const handleRespondToInvite = useCallback(async (inviteId: string, accept: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("shared_account_members")
        .update({
          status: accept ? "accepted" : "declined",
          member_id: accept ? user.id : null,
          accepted_at: accept ? new Date().toISOString() : null,
        })
        .eq("id", inviteId);

      if (error) throw error;

      toast.success(accept ? "Invitation accepted!" : "Invitation declined");
      loadSharedMembers();
    } catch (error: any) {
      toast.error("Failed to respond to invitation");
    }
  }, [loadSharedMembers]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" /> Pending</Badge>;
      case "accepted":
        return <Badge variant="default" className="gap-1 bg-green-500"><Check className="w-3 h-3" /> Accepted</Badge>;
      case "declined":
        return <Badge variant="destructive" className="gap-1"><X className="w-3 h-3" /> Declined</Badge>;
      default:
        return null;
    }
  };

  if (loading) {
    return null;
  }

  return (
    <GradientCard className="md:col-span-3">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">Share The PawBucks</h3>
            <p className="text-sm text-muted-foreground">
              Add family or friends to experience PawBucks together
            </p>
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <UserPlus className="w-4 h-4" />
              Add Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite a Family Member or Friend</DialogTitle>
              <DialogDescription>
                Enter their email address to share your PawBucks experience with them.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Enter email address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleInvite} disabled={inviting}>
                {inviting ? "Sending..." : "Send Invitation"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pending invites for this user */}
      {pendingInvites.length > 0 && (
        <div className="mb-4 p-3 bg-accent/10 rounded-lg border border-accent/20">
          <p className="text-sm font-medium mb-2">You have pending invitations:</p>
          <div className="space-y-2">
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between p-2 bg-background rounded"
              >
                <span className="text-sm">
                  {invite.owner_profile?.full_name || invite.owner_profile?.email || "Someone"} wants to share PawBucks with you
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRespondToInvite(invite.id, false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleRespondToInvite(invite.id, true)}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My shared members */}
      {sharedMembers.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            Your Shared Members ({sharedMembers.length})
          </p>
          <div className="space-y-2">
            {sharedMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mail className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <span className="text-sm font-medium">{member.member_email}</span>
                    <p className="text-xs text-muted-foreground">
                      Invited {new Date(member.invited_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(member.status)}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveMember(member.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          No shared members yet. Invite family or friends to share PawBucks!
        </p>
      )}
    </GradientCard>
  );
};

export const SharePawBucksCard = memo(SharePawBucksCardComponent);
