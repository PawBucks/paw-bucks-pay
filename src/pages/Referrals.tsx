import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { SEO } from "@/components/SEO";
import { seoMeta } from "@/lib/seoMeta";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BottomNav } from "@/components/BottomNav";
import {
  Copy,
  Check,
  Users,
  Coins,
  Repeat,
  Store,
  Crown,
  TrendingUp,
  Infinity as InfinityIcon,
  Zap,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { buildAppUrl } from "@/lib/url";

type Referral = {
  id: string;
  referee_id: string;
  referee_user_type: string | null;
  referee_subscription_tier: string | null;
  referrer_bonus_awarded: boolean;
  pro_sales_total: number | null;
  pro_sales_bonus_awarded: boolean;
  created_at: string;
  full_name?: string;
};

type Reward = {
  id: string;
  reward_type: string;
  amount_pb: number;
  amount_cents: number;
  description: string | null;
  created_at: string;
};

const PB = (n: number) => `${n.toLocaleString()} PB`;
const USD = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const PRO_SALES_TARGET = 1700;

const Referrals = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [referralCode, setReferralCode] = useState("");
  const [isPro, setIsPro] = useState(false);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [creditCents, setCreditCents] = useState(0);
  const [appliedCents, setAppliedCents] = useState(0);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [profileRes, proRes, referralsRes, rewardsRes, creditRes] = await Promise.all([
        supabase.from("profiles").select("referral_code").eq("id", user.id).maybeSingle(),
        supabase.rpc("is_pet_pro", { _user_id: user.id }),
        supabase
          .from("referrals")
          .select(
            "id, referee_id, referee_user_type, referee_subscription_tier, referrer_bonus_awarded, pro_sales_total, pro_sales_bonus_awarded, created_at",
          )
          .eq("referrer_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("referral_rewards")
          .select("id, reward_type, amount_pb, amount_cents, description, created_at")
          .eq("beneficiary_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("pet_pro_referral_credits")
          .select("balance_cents, lifetime_applied_cents")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      setReferralCode(profileRes.data?.referral_code || "");
      setIsPro(!!proRes.data);
      setRewards(rewardsRes.data || []);
      setCreditCents(creditRes.data?.balance_cents || 0);
      setAppliedCents(creditRes.data?.lifetime_applied_cents || 0);

      const rows = referralsRes.data || [];
      if (rows.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", rows.map((r) => r.referee_id));
        const names = new Map(profiles?.map((p) => [p.id, p.full_name]) || []);
        setReferrals(
          rows.map((r) => ({ ...r, full_name: names.get(r.referee_id) || "New member" })),
        );
      } else {
        setReferrals([]);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load referral data");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  const handleCopyCode = async () => {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      toast.success("Referral code copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy code");
    }
  };

  const shareUrl = buildAppUrl(`/auth?ref=${referralCode}`);

  const handleShare = async () => {
    const text = isPro
      ? `Join PawBucks with my code ${referralCode} and start earning rewards at pet businesses.`
      : `Join PawBucks with my code ${referralCode} and get 10,000 PawBucks in your wallet.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join PawBucks", text, url: shareUrl });
      } catch {
        /* cancelled */
      }
    } else {
      handleCopyCode();
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const totalPbEarned = rewards
    .filter((r) => r.amount_pb > 0)
    .reduce((s, r) => s + r.amount_pb, 0);
  const totalUsdEarned = rewards
    .filter((r) => r.amount_cents > 0)
    .reduce((s, r) => s + r.amount_cents, 0);
  const recurringActive = referrals.filter(
    (r) => r.referee_subscription_tier && r.referee_user_type === "pet_owner",
  ).length;

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const rewardRows = isPro
    ? [
        {
          icon: Repeat,
          title: "Refer a Pet Parent to PawPass",
          reward: "$1 / month",
          note: "Paid every month their $10 membership stays active",
        },
        {
          icon: Crown,
          title: "Refer a Pet Parent to PawPass+",
          reward: "$2 / month",
          note: "Paid every month their $20 membership stays active",
        },
        {
          icon: Store,
          title: "Refer another Pet Pro",
          reward: "$50 one time",
          note: "Unlocks once they process $1,700 in platform sales",
        },
      ]
    : [
        {
          icon: Coins,
          title: "Friend joins PawPass ($10/mo)",
          reward: PB(10000),
          note: "Added after their first paid month clears",
        },
        {
          icon: Crown,
          title: "Friend joins PawPass+ ($20/mo)",
          reward: PB(20000),
          note: "Added after their first paid month clears",
        },
        {
          icon: Store,
          title: "You refer a Pet Pro business",
          reward: PB(25000),
          note: "Added when their Pet Pro account is created",
        },
      ];

  return (
    <>
      <SEO
        title={seoMeta.referrals.title}
        description={seoMeta.referrals.description}
        keywords={[...seoMeta.referrals.keywords]}
        canonical={seoMeta.referrals.canonical}
        noIndex={true}
      />
      <div className="min-h-screen bg-[var(--gradient-hero)] pb-24">
        <Header isAuthenticated={true} onLogout={handleSignOut} />
        <div className="container mx-auto px-4 py-8 max-w-7xl lg:max-w-5xl">
          <div className="mb-8">
            <Badge variant="secondary" className="mb-3">
              {isPro ? "Pet Pro Referrals" : "Pet Parent Referrals"}
            </Badge>
            <h1 className="text-3xl font-bold mb-2">PawBucks Referral Program</h1>
            <p className="text-muted-foreground">
              {isPro
                ? "Earn recurring monthly rewards for every member you bring to PawPass, plus a $50 bonus for every Pet Pro you refer."
                : "Every friend you invite gets 10,000 PawBucks. You earn PawBucks when they start a membership or open a Pet Pro account."}
            </p>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <GradientCard gradient>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Referrals</p>
                  <p className="text-2xl font-bold">{referrals.length}</p>
                </div>
              </div>
            </GradientCard>

            <GradientCard>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                  <Coins className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">PawBucks earned</p>
                  <p className="text-2xl font-bold">{totalPbEarned.toLocaleString()}</p>
                </div>
              </div>
            </GradientCard>

            <GradientCard>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-info/10 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-5 h-5 text-info" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {isPro ? "Referral credit" : "Cash rewards"}
                  </p>
                  <p className="text-2xl font-bold">{USD(isPro ? creditCents : totalUsdEarned)}</p>
                </div>
              </div>
            </GradientCard>

            <GradientCard>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                  <Repeat className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Active memberships</p>
                  <p className="text-2xl font-bold">{recurringActive}</p>
                </div>
              </div>
            </GradientCard>
          </div>

          {/* Share code */}
          <GradientCard className="mb-6">
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <div>
                <h2 className="font-semibold text-lg">Your referral code</h2>
                <p className="text-sm text-muted-foreground">
                  Share it anywhere — there is no limit on how many people you can refer.
                </p>
              </div>
              <Badge variant="outline" className="gap-1">
                <InfinityIcon className="w-3.5 h-3.5" /> Unlimited referrals
              </Badge>
            </div>
            <div className="flex gap-2 mb-3">
              <Input
                value={referralCode}
                readOnly
                className="font-mono text-lg font-bold text-center"
              />
              <Button onClick={handleCopyCode} variant="outline" size="icon" aria-label="Copy code">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <Button onClick={handleShare} className="w-full" size="lg">
              Share Code
            </Button>
          </GradientCard>

          {/* Reward ladder */}
          <GradientCard className="mb-6">
            <h2 className="font-semibold text-lg mb-4">What you earn</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {rewardRows.map(({ icon: Icon, title, reward, note }) => (
                <div
                  key={title}
                  className="p-4 rounded-lg border border-border/60 bg-muted/30 flex flex-col gap-2"
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <p className="text-sm font-medium leading-snug">{title}</p>
                  <p className="text-xl font-bold text-primary">{reward}</p>
                  <p className="text-xs text-muted-foreground">{note}</p>
                </div>
              ))}
            </div>
            {!isPro && (
              <div className="mt-4 p-3 rounded-lg bg-accent/10 border border-accent/20 flex items-start gap-2">
                <Zap className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <p className="text-sm">
                  Your friend also gets <strong>10,000 PawBucks</strong> the moment they sign up
                  with your code.
                </p>
              </div>
            )}
          </GradientCard>

          {/* Referral list */}
          <GradientCard className="mb-6">
            <h2 className="font-semibold text-lg mb-4">Your referrals</h2>
            {referrals.length > 0 ? (
              <div className="space-y-3">
                {referrals.map((r) => {
                  const isProReferee = r.referee_user_type === "merchant" || r.referee_user_type === "vet";
                  const tierLabel =
                    r.referee_subscription_tier === "pawpass_plus"
                      ? "PawPass+"
                      : r.referee_subscription_tier === "pawpass"
                        ? "PawPass"
                        : null;
                  const progress = Math.min(
                    100,
                    Math.round(((r.pro_sales_total || 0) / PRO_SALES_TARGET) * 100),
                  );
                  return (
                    <div
                      key={r.id}
                      className="p-4 bg-muted/30 rounded-md border border-border/50"
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <p className="font-medium">{r.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {isProReferee ? "Pet Pro account" : "Pet Parent"} ·{" "}
                            {format(new Date(r.created_at), "MMM d, yyyy")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {tierLabel && (
                            <Badge variant="secondary" className="gap-1">
                              <Crown className="w-3 h-3" /> {tierLabel}
                            </Badge>
                          )}
                          {r.referrer_bonus_awarded ? (
                            <Badge className="gap-1 bg-success/20 text-success border-success/30 hover:bg-success/30">
                              <Check className="w-3 h-3" /> Rewarded
                            </Badge>
                          ) : (
                            <Badge variant="outline">Pending</Badge>
                          )}
                        </div>
                      </div>

                      {isPro && isProReferee && !r.pro_sales_bonus_awarded && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>Progress to $50 bonus</span>
                            <span>
                              ${Number(r.pro_sales_total || 0).toLocaleString()} / $
                              {PRO_SALES_TARGET.toLocaleString()}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-1">No referrals yet</p>
                <p className="text-sm text-muted-foreground">
                  Share your code to start earning rewards.
                </p>
              </div>
            )}
          </GradientCard>

          {/* Reward history */}
          {rewards.length > 0 && (
            <GradientCard className="mb-6">
              <h2 className="font-semibold text-lg mb-4">Reward history</h2>
              <div className="space-y-2">
                {rewards.map((rw) => (
                  <div
                    key={rw.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-md bg-muted/30 border border-border/50"
                  >
                    <div>
                      <p className="text-sm font-medium">{rw.description || rw.reward_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(rw.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-success whitespace-nowrap">
                      {rw.amount_pb > 0 ? `+${PB(rw.amount_pb)}` : `+${USD(rw.amount_cents)}`}
                    </span>
                  </div>
                ))}
              </div>
            </GradientCard>
          )}

          {/* Rules footer */}
          <GradientCard>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-start gap-2">
                <InfinityIcon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Unlimited referrals — there is no cap on how much you can earn.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Rewards are applied automatically once the qualifying payment clears.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Monthly rewards continue only while the referred membership stays active.
                </p>
              </div>
            </div>
          </GradientCard>
        </div>

        <BottomNav />
      </div>
    </>
  );
};

export default Referrals;
