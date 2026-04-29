import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Mail, Phone, Calendar, Shield, Crown, Gift, Users, Ban } from "lucide-react";
import { BanUserCard } from "./BanUserCard";
import { DeleteUserCard } from "./DeleteUserCard";

type ProfileData = {
  id: string;
  email: string;
  full_name: string;
  user_type: string;
  phone: string | null;
  created_at: string;
  avatar_url: string | null;
  referral_code: string | null;
  subscription_tier?: string | null;
  is_banned?: boolean | null;
  banned_at?: string | null;
  banned_reason?: string | null;
};

type RoleData = { role: string };
type WelcomeCreditData = {
  status: string;
  credit_amount: number;
  expires_at: string;
  phase_1_amount: number;
  phase_2_amount: number;
  phase_2_unlocked: boolean;
};
type SharedAccountData = {
  owner_id: string;
  member_id: string;
  status: string;
};

export function UserDetailProfile({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [welcomeCredit, setWelcomeCredit] = useState<WelcomeCreditData | null>(null);
  const [sharedWith, setSharedWith] = useState<string | null>(null);
  const [sharedMembers, setSharedMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const [profileRes, rolesRes, creditRes, memberOfRes, ownerOfRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("user_welcome_credits").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("shared_account_members").select("owner_id").eq("member_id", userId).eq("status", "accepted"),
        supabase.from("shared_account_members").select("member_id").eq("owner_id", userId).eq("status", "accepted"),
      ]);

      if (profileRes.data) setProfile(profileRes.data as unknown as ProfileData);
      if (rolesRes.data) setRoles(rolesRes.data);
      if (creditRes.data) setWelcomeCredit(creditRes.data as WelcomeCreditData);

      // Resolve shared account owner email
      if (memberOfRes.data && memberOfRes.data.length > 0) {
        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", memberOfRes.data[0].owner_id)
          .single();
        if (ownerProfile) setSharedWith(ownerProfile.email);
      }

      // Resolve shared members emails
      if (ownerOfRes.data && ownerOfRes.data.length > 0) {
        const memberIds = ownerOfRes.data.map(m => m.member_id);
        const { data: memberProfiles } = await supabase
          .from("profiles")
          .select("email")
          .in("id", memberIds);
        if (memberProfiles) setSharedMembers(memberProfiles.map(p => p.email));
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-8 w-64" /></CardHeader>
        <CardContent><Skeleton className="h-24 w-full" /></CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">User not found.</CardContent>
      </Card>
    );
  }

  const isProtected = roles.some(r => r.role === "admin" || r.role === "superadmin");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span>{profile.full_name || "Unnamed User"}</span>
                {profile.is_banned && (
                  <Badge variant="destructive" className="gap-1">
                    <Ban className="w-3 h-3" />
                    Banned
                  </Badge>
                )}
              </div>
              <div className="text-sm font-normal text-muted-foreground">{profile.email}</div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <InfoItem icon={<Calendar className="w-4 h-4" />} label="Joined" value={new Date(profile.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} />
            <InfoItem icon={<Phone className="w-4 h-4" />} label="Phone" value={profile.phone || "N/A"} />
            <InfoItem icon={<Shield className="w-4 h-4" />} label="User Type">
              <Badge variant={profile.user_type === "merchant" ? "default" : "secondary"}>
                {profile.user_type}
              </Badge>
            </InfoItem>
            <InfoItem icon={<Crown className="w-4 h-4" />} label="Roles">
              <div className="flex gap-1 flex-wrap">
                {roles.length > 0
                  ? roles.map(r => <Badge key={r.role} variant="outline">{r.role}</Badge>)
                  : <span className="text-muted-foreground text-sm">user</span>}
              </div>
            </InfoItem>

            {profile.subscription_tier && (
              <InfoItem icon={<Crown className="w-4 h-4" />} label="Subscription" value={profile.subscription_tier} />
            )}

            {profile.referral_code && (
              <InfoItem icon={<Mail className="w-4 h-4" />} label="Referral Code" value={profile.referral_code} />
            )}

            {welcomeCredit && (
              <InfoItem icon={<Gift className="w-4 h-4" />} label="Welcome Credit">
                <div className="space-y-1">
                  <Badge variant="outline" className={
                    welcomeCredit.status === "active"
                      ? "bg-success/10 text-success border-success/30/30"
                      : welcomeCredit.status === "used"
                      ? "bg-info/10 text-info border-info/30/30"
                      : "bg-muted text-muted-foreground"
                  }>
                    {welcomeCredit.status} — ${(welcomeCredit.credit_amount / 1000).toFixed(0)}
                  </Badge>
                  {welcomeCredit.status === "active" && (
                    <p className="text-xs text-muted-foreground">
                      Exp {new Date(welcomeCredit.expires_at).toLocaleDateString()}
                      {!welcomeCredit.phase_2_unlocked && " · Phase 2 locked"}
                    </p>
                  )}
                </div>
              </InfoItem>
            )}

            {sharedWith && (
              <InfoItem icon={<Users className="w-4 h-4" />} label="Shared With Owner" value={sharedWith} />
            )}

            {sharedMembers.length > 0 && (
              <InfoItem icon={<Users className="w-4 h-4" />} label="Shared Members">
                <div className="space-y-0.5">
                  {sharedMembers.map(email => (
                    <p key={email} className="text-sm">{email}</p>
                  ))}
                </div>
              </InfoItem>
            )}
          </div>
        </CardContent>
      </Card>

      {!isProtected && (
        <>
          <BanUserCard
            userId={profile.id}
            isBanned={!!profile.is_banned}
            bannedAt={profile.banned_at ?? null}
            bannedReason={profile.banned_reason ?? null}
            onChange={loadProfile}
          />
          <DeleteUserCard userId={profile.id} userEmail={profile.email} />
        </>
      )}
    </div>
  );
}

function InfoItem({ icon, label, value, children }: { icon: React.ReactNode; label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {value ? <p className="text-sm font-medium">{value}</p> : children}
      </div>
    </div>
  );
}
