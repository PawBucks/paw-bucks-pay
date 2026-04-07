import { useState, useEffect, useCallback, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GradientCard } from "@/components/ui/gradient-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Gift, Copy, Check, Users } from "lucide-react";
import { toast } from "sonner";
import { buildAppUrl } from "@/lib/url";

type Referral = {
  id: string;
  referee_id: string;
  referrer_bonus_awarded: boolean;
  created_at: string;
  profiles?: {
    full_name: string;
  };
};

const ReferralCardComponent = () => {
  const [referralCode, setReferralCode] = useState<string>("");
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadReferralData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's referral code and referrals in parallel
      const [profileResult, referralsResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("referral_code")
          .eq("id", user.id)
          .single(),
        supabase
          .from("referrals")
          .select("id, referee_id, referrer_bonus_awarded, created_at")
          .eq("referrer_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10) // Limit for performance
      ]);

      if (profileResult.data) {
        setReferralCode(profileResult.data.referral_code || "");
      }

      if (referralsResult.data && referralsResult.data.length > 0) {
        // Batch fetch profile names
        const refereeIds = referralsResult.data.map(r => r.referee_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", refereeIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
        
        const enrichedReferrals = referralsResult.data.map(ref => ({
          ...ref,
          profiles: { full_name: profileMap.get(ref.referee_id) || "User" },
        }));
        
        setReferrals(enrichedReferrals);
      }
    } catch (error) {
      console.error("Error loading referral data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReferralData();
  }, [loadReferralData]);

  const handleCopyCode = useCallback(async () => {
    if (!referralCode) return;
    
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      toast.success("Referral code copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy code");
    }
  }, [referralCode]);

  const shareUrl = buildAppUrl(`/auth?ref=${referralCode}`);

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join PawBucks",
          text: `Use my referral code ${referralCode} and we both get $10!`,
          url: shareUrl,
        });
      } catch (error) {
        // User cancelled share
      }
    } else {
      handleCopyCode();
    }
  }, [referralCode, shareUrl, handleCopyCode]);

  if (loading) {
    return null;
  }

  return (
    <GradientCard className="md:col-span-3">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
          <Gift className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h3 className="text-xl font-semibold">Referral Program</h3>
          <p className="text-sm text-muted-foreground">
            Share your code and both get $10 after the first transaction
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={referralCode}
            readOnly
            className="font-mono text-lg font-bold"
          />
          <Button onClick={handleCopyCode} variant="outline" size="icon">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
          <Button onClick={handleShare}>Share</Button>
        </div>

        {referrals.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-medium">
                Your Referrals ({referrals.length})
              </p>
            </div>
            <div className="space-y-2">
              {referrals.map((referral) => (
                <div
                  key={referral.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <span className="text-sm">
                    {referral.profiles?.full_name || "User"}
                  </span>
                  {referral.referrer_bonus_awarded ? (
                    <span className="text-xs text-accent font-medium">
                      ✓ $10 Awarded
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Pending first transaction
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {referrals.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No referrals yet. Share your code to start earning!
          </p>
        )}
      </div>
    </GradientCard>
  );
};

export const ReferralCard = memo(ReferralCardComponent);