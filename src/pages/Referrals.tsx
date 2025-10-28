import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { Input } from "@/components/ui/input";
import { BottomNav } from "@/components/BottomNav";
import { Gift, Copy, Check, Users, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Referral = {
  id: string;
  referee_id: string;
  referrer_bonus_awarded: boolean;
  referee_bonus_awarded: boolean;
  created_at: string;
  profiles?: {
    full_name: string;
  };
};

const Referrals = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [referralCode, setReferralCode] = useState<string>("");
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadReferralData();
    }
  }, [user]);

  const loadReferralData = async () => {
    if (!user) return;

    try {
      // Get user's referral code
      const { data: profile } = await supabase
        .from("profiles")
        .select("referral_code")
        .eq("id", user.id)
        .single();

      if (profile) {
        setReferralCode(profile.referral_code || "");
      }

      // Get referrals
      const { data: referralsData } = await supabase
        .from("referrals")
        .select("id, referee_id, referrer_bonus_awarded, referee_bonus_awarded, created_at")
        .eq("referrer_id", user.id)
        .order("created_at", { ascending: false });

      if (referralsData) {
        const enrichedReferrals = await Promise.all(
          referralsData.map(async (ref) => {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", ref.referee_id)
              .single();
            
            return {
              ...ref,
              profiles: profile,
            };
          })
        );
        setReferrals(enrichedReferrals);
      }
    } catch (error) {
      console.error("Error loading referral data:", error);
      toast.error("Failed to load referral data");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!referralCode) return;
    
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      toast.success("Referral code copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy code");
    }
  };

  const shareUrl = `${window.location.origin}/auth?ref=${referralCode}`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join PetalPay",
          text: `Use my referral code ${referralCode} and we both get $10!`,
          url: shareUrl,
        });
      } catch (error) {
        // User cancelled share
      }
    } else {
      handleCopyCode();
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const totalEarned = referrals.filter(r => r.referrer_bonus_awarded).length * 10;

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--gradient-hero)] pb-24">
      <Header isAuthenticated={true} onLogout={handleSignOut} />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Referrals</h1>
          <p className="text-muted-foreground">
            Share your code and earn $10 for each friend who makes their first purchase
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <GradientCard gradient>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Referrals</p>
                <p className="text-2xl font-bold">{referrals.length}</p>
              </div>
            </div>
          </GradientCard>

          <GradientCard>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Earned</p>
                <p className="text-2xl font-bold">${totalEarned}</p>
              </div>
            </div>
          </GradientCard>
        </div>

        {/* Referral Code Card */}
        <GradientCard className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold">Your Referral Code</h3>
              <p className="text-xs text-muted-foreground">Share with friends</p>
            </div>
          </div>

          <div className="flex gap-2 mb-3">
            <Input
              value={referralCode}
              readOnly
              className="font-mono text-lg font-bold text-center"
            />
            <Button onClick={handleCopyCode} variant="outline" size="icon">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          
          <Button onClick={handleShare} className="w-full" size="lg">
            Share Code
          </Button>
        </GradientCard>

        {/* Referrals List */}
        <GradientCard>
          <h3 className="font-semibold mb-4">Your Referrals</h3>
          
          {referrals.length > 0 ? (
            <div className="space-y-3">
              {referrals.map((referral) => (
                <div
                  key={referral.id}
                  className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border/50"
                >
                  <div className="flex-1">
                    <p className="font-medium">
                      {referral.profiles?.full_name || "User"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(referral.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  {referral.referrer_bonus_awarded ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/20 rounded-full">
                      <Check className="w-4 h-4 text-accent" />
                      <span className="text-sm font-medium text-accent">
                        +$10
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground px-3 py-1.5 bg-muted rounded-full">
                      Pending
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <Users className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-2">No referrals yet</p>
              <p className="text-sm text-muted-foreground">
                Share your code to start earning rewards!
              </p>
            </div>
          )}
        </GradientCard>
      </div>

      <BottomNav />
    </div>
  );
};

export default Referrals;
