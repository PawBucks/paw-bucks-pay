import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useUserEarnRate } from "@/hooks/useUserEarnRate";
import { useDashboardData } from "@/hooks/useDashboardData";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BottomNav } from "@/components/BottomNav";
import { SponsoredAdBar } from "@/components/SponsoredAdBar";
import { FeedbackButton } from "@/components/FeedbackButton";
import { PullToRefresh } from "@/components/PullToRefresh";
import { DeleteMyAccountCard } from "@/components/profile/DeleteMyAccountCard";
import {
  LogOut,
  Settings,
  Loader2,
  Mail,
  User as UserIcon,
  Calendar,
  Bell,
  MessageSquare,
  Shield,
  ChevronRight,
  Plus,
  Pencil,
  Crown,
  PawPrint,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatInTimeZone } from "date-fns-tz";
import { DEFAULT_MERCHANT_TZ } from "@/lib/timezone";
import { Formatters } from "@/utils/formatters";

type ProfileRow = {
  full_name: string;
  email: string;
  user_type: string;
  created_at: string;
};

const tierStyles = {
  Free: {
    emoji: "🐾",
    chip: "bg-muted text-muted-foreground border-border",
    icon: "bg-muted text-muted-foreground",
  },
  PawPass: {
    emoji: "⭐",
    chip: "bg-primary/10 text-primary border-primary/30",
    icon: "bg-gradient-to-br from-warning to-warning text-white",
  },
  "PawPass+": {
    emoji: "👑",
    chip: "bg-accent/10 text-accent border-accent/30",
    icon: "bg-gradient-to-br from-accent to-accent text-white",
  },
} as const;

const SPECIES_EMOJI: Record<string, string> = {
  dog: "🐶",
  cat: "🐱",
  bird: "🐦",
  rabbit: "🐰",
  other: "🐾",
};

const Profile = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const { subscription, loading: subLoading, createCheckout, manageSubscription } = useSubscription();
  const { tierLabel } = useUserEarnRate();
  const { pets, pawbucksWallet } = useDashboardData();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      setProfile(data as ProfileRow);
    } catch (e) {
      console.error("Error loading profile:", e);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadProfile();
  }, [user, loadProfile]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate("/auth");
  }, [signOut, navigate]);

  const handleSubscribe = async (tier: "basic" | "plus") => {
    setIsSubscribing(true);
    try {
      const url = await createCheckout(tier);
      if (url) {
        toast.success("Redirecting to checkout...");
        const opened = window.open(url, "_top");
        if (!opened) window.location.assign(url);
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (e) {
      console.error("Subscription error:", e);
      toast.error("Failed to start subscription. Please try again.");
      setIsSubscribing(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      await manageSubscription();
    } catch (e) {
      console.error("Portal error:", e);
      toast.error("Failed to open subscription portal. Please try again.");
    }
  };

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    await loadProfile();
  }, [loadProfile]);

  const { containerRef, isRefreshing, pullDistance, progress } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  const openEdit = () => {
    setEditName(profile?.full_name || "");
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!user || !editName.trim()) return;
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: editName.trim() })
      .eq("id", user.id);
    if (error) {
      toast.error("Failed to update profile");
      return;
    }
    setProfile((p) => (p ? { ...p, full_name: editName.trim() } : p));
    toast.success("Profile updated");
    setEditOpen(false);
  };

  if (loading || authLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const initials = profile.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const accountTypeLabel =
    profile.user_type === "pet_owner"
      ? "Pet Owner"
      : profile.user_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const currentTier = tierLabel;
  const ts = tierStyles[currentTier];
  const isUpgradeable = currentTier !== "PawPass+";
  const pbBalance = pawbucksWallet?.balance ?? 0;
  const pbBalanceUsd = `${Formatters.pawBucksToUSD(pbBalance)} USD`;
  const earnRateMap = { Free: "10x", PawPass: "20x", "PawPass+": "30x" } as const;

  return (
    <>
      <SEO
        title="My Profile - PawBucks"
        description="Manage your PawBucks profile, subscription settings, and notification preferences."
        keywords={["PawBucks profile", "account settings", "subscription management"]}
        noIndex={true}
      />
      <div className="min-h-[100dvh] bg-[var(--gradient-hero)] flex flex-col">
        <Header isAuthenticated={true} onLogout={handleSignOut} />
        <PullToRefresh
          ref={containerRef}
          isRefreshing={isRefreshing}
          pullDistance={pullDistance}
          progress={progress}
          className="flex-1 overflow-auto"
        >
          <div className="container mx-auto px-4 pt-4 pb-24 md:pb-8 max-w-4xl">
            <div className="mb-4">
              <SponsoredAdBar variant="top" />
            </div>

            {/* Top bar */}
            <div className="flex items-center justify-between mb-5">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Profile</h1>
              <button
                onClick={openEdit}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition"
              >
                <Pencil className="w-4 h-4" /> Edit
              </button>
            </div>

            {/* Hero card */}
            <GradientCard gradient className="mb-5">
              <div className="flex flex-col items-center text-center space-y-3">
                <Avatar className="w-24 h-24 border-4 border-background shadow-md">
                  <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-2xl font-bold">{profile.full_name}</h2>
                  <p className="text-sm text-muted-foreground">{accountTypeLabel}</p>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${ts.chip}`}
                >
                  <span aria-hidden>{ts.emoji}</span> {currentTier}
                </span>
              </div>

              {/* Stats strip */}
              <div className="mt-5 grid grid-cols-3 divide-x divide-border border-t border-border pt-4">
                {[
                  { label: "Wallet", value: pbBalanceUsd },
                  { label: "Earn Rate", value: earnRateMap[currentTier] },
                  {
                    label: "Member Since",
                    value: formatInTimeZone(new Date(profile.created_at), DEFAULT_MERCHANT_TZ, "yyyy"),
                  },
                ].map((s) => (
                  <div key={s.label} className="px-2 text-center">
                    <div className="text-lg font-bold tracking-tight">{s.value}</div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground mt-0.5">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </GradientCard>

            {/* Account info */}
            <GradientCard className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Account Info</h3>
                <button
                  onClick={openEdit}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
              </div>
              <div className="divide-y divide-border">
                {[
                  { icon: Mail, label: "Email", value: profile.email },
                  { icon: UserIcon, label: "Account Type", value: accountTypeLabel },
                  {
                    icon: Calendar,
                    label: "Member Since",
                    value: formatInTimeZone(new Date(profile.created_at), DEFAULT_MERCHANT_TZ, "MMMM d, yyyy"),
                  },
                ].map((row) => {
                  const Icon = row.icon;
                  return (
                    <div key={row.label} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {row.label}
                        </div>
                        <div className="text-sm font-medium truncate">{row.value}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </GradientCard>

            {/* PawPass card */}
            {profile.user_type === "pet_owner" && (
              <GradientCard className="mb-5">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${ts.icon}`}
                  >
                    <span aria-hidden>{ts.emoji}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{currentTier}</h3>
                    <p className="text-xs text-muted-foreground">
                      {currentTier === "Free" ? "Free plan — no subscription" : "Active Subscription"}
                    </p>
                  </div>
                  {subscription.subscribed && (
                    <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                      {subscription.status === "trialing" ? "Trial" : "Active"}
                    </Badge>
                  )}
                </div>

                {subscription.subscribed && subscription.subscription_end && (
                  <div className="flex justify-between text-sm bg-muted/40 rounded-lg px-3 py-2 mb-4">
                    <span className="text-muted-foreground">Renews on</span>
                    <span className="font-medium">
                      {formatInTimeZone(new Date(subscription.subscription_end), DEFAULT_MERCHANT_TZ, "MMMM d, yyyy 'ET'")}
                    </span>
                  </div>
                )}

                {/* Earn rate comparison */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {(["Free", "PawPass", "PawPass+"] as const).map((k) => {
                    const active = k === currentTier;
                    return (
                      <div
                        key={k}
                        className={`rounded-lg border p-3 text-center transition ${
                          active
                            ? "border-primary bg-primary/5"
                            : "border-border bg-background/40"
                        }`}
                      >
                        <div
                          className={`text-base font-bold ${active ? "text-primary" : "text-foreground"}`}
                        >
                          {earnRateMap[k]}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{k}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-2">
                  {subscription.subscribed && (
                    <Button variant="outline" className="w-full" onClick={handleManageSubscription}>
                      <Settings className="w-4 h-4 mr-2" /> Manage Billing
                    </Button>
                  )}
                  {isUpgradeable && (
                    <Button
                      className="w-full"
                      onClick={() => handleSubscribe(currentTier === "Free" ? "basic" : "plus")}
                      disabled={isSubscribing || subLoading}
                    >
                      {isSubscribing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...
                        </>
                      ) : (
                        <>
                          <Crown className="w-4 h-4 mr-2" />
                          {currentTier === "Free" ? "Upgrade to PawPass" : "Upgrade to PawPass+"}
                        </>
                      )}
                    </Button>
                  )}
                  {subscription.subscribed && (
                    <Button
                      variant="ghost"
                      className="w-full text-muted-foreground"
                      onClick={() => navigate("/my-subscriptions")}
                    >
                      View All Subscriptions
                    </Button>
                  )}
                </div>
              </GradientCard>
            )}

            {/* My Pets */}
            {profile.user_type === "pet_owner" && (
              <GradientCard className="mb-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">My Pets</h3>
                  <button
                    onClick={() => navigate("/create-pet-profile")}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Pet
                  </button>
                </div>
                {pets.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No pets added yet
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {pets.map((pet) => {
                      const emoji = SPECIES_EMOJI[(pet.type || "other").toLowerCase()] || "🐾";
                      const age = pet.birthday
                        ? Math.max(
                            0,
                            new Date().getFullYear() - new Date(pet.birthday).getFullYear()
                          )
                        : null;
                      return (
                        <button
                          key={pet.id}
                          onClick={() => navigate(`/pet-health/${pet.id}`)}
                          className="w-full flex items-center gap-3 py-3 first:pt-0 last:pb-0 text-left hover:bg-primary/5 -mx-2 px-2 rounded-md transition"
                        >
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg shrink-0">
                            <span aria-hidden>{emoji}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold truncate">{pet.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {[pet.breed, age != null ? `${age} years old` : null]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </GradientCard>
            )}

            {/* Settings links */}
            <GradientCard className="mb-5">
              <div className="divide-y divide-border">
                {[
                  { icon: Settings, label: "Settings", onClick: () => navigate("/notification-preferences") },
                  { icon: Bell, label: "Notifications", onClick: () => navigate("/notification-preferences") },
                  {
                    icon: MessageSquare,
                    label: "Support & Feedback",
                    onClick: () => setFeedbackOpen(true),
                  },
                  { icon: Shield, label: "Privacy & Security", onClick: () => navigate("/notification-preferences") },
                ].map((row) => {
                  const Icon = row.icon;
                  return (
                    <button
                      key={row.label}
                      onClick={row.onClick}
                      className="w-full flex items-center gap-3 py-3 first:pt-0 last:pb-0 text-left hover:bg-primary/5 -mx-2 px-2 rounded-md transition"
                    >
                      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium flex-1">{row.label}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            </GradientCard>

            {/* Sign out */}
            <Button
              variant="outline"
              className="w-full mb-5"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>

            {/* Danger zone */}
            <DeleteMyAccountCard />

            <FeedbackButton open={feedbackOpen} onOpenChange={setFeedbackOpen} trigger={<span />} />
          </div>
        </PullToRefresh>
        <BottomNav />
      </div>

      {/* Edit profile modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email Address</Label>
              <Input id="edit-email" value={profile.email} disabled />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Profile;