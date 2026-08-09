import { useEffect, useState, useRef } from"react";
import { useNavigate, useSearchParams } from"react-router-dom";
import { useQueryClient } from"@tanstack/react-query";
import { useAuth } from"@/hooks/useAuth";
import { supabase } from"@/integrations/supabase/client";
import { SEO } from"@/components/SEO";
import { GradientCard } from"@/components/ui/gradient-card";
import { Button } from"@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, LogIn } from"lucide-react";
import { toast } from"sonner";

interface BrandedAward {
 campaign_name: string;
 brand_name: string;
 amount: number;
 brand_logo?: string | null;
}

interface UnlockedOffer {
  offer_id: string;
  title: string;
  redemption_code: string;
  already_unlocked: boolean;
  redeemed: boolean;
  offer_type?: string | null;
}

const PROCESS_CHECKIN_TIMEOUT_MS = 10000;
const MAX_TIMEOUT_RETRIES = 2;
const RETRY_BACKOFF_MS = 750;

type LastResult = {
 success: boolean;
 entityName: string | null;
 message: string;
 brandedAwards?: BrandedAward[];
};

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
 return new Promise<T>((resolve, reject) => {
 const timer = setTimeout(() => {
 const err = new Error("process_checkin timed out");
 (err as Error & { isTimeout?: boolean }).isTimeout = true;
 reject(err);
 }, ms);
 Promise.resolve(promise).then(
 (v) => {
 clearTimeout(timer);
 resolve(v);
 },
 (e) => {
 clearTimeout(timer);
 reject(e);
 },
 );
 });
}

export default function CheckInPage() {
 const { user, loading: authLoading } = useAuth();
 const navigate = useNavigate();
 const queryClient = useQueryClient();
 const [searchParams] = useSearchParams();
 const token = searchParams.get("token");
 const [processing, setProcessing] = useState(false);
 const [result, setResult] = useState<{ success: boolean; entityName: string | null; message: string } | null>(null);
 const [brandedAwards, setBrandedAwards] = useState<BrandedAward[]>([]);
 const [unlockedOffers, setUnlockedOffers] = useState<UnlockedOffer[]>([]);
 const [unlockMerchantId, setUnlockMerchantId] = useState<string | null>(null);
 const checkinAttempted = useRef(false);

 // Refresh the My Deals surfaces after a check-in unlocks offers/promotions.
 const refreshDeals = () => {
  queryClient.invalidateQueries({ queryKey: ["my-deals-redemptions"] });
  queryClient.invalidateQueries({ queryKey: ["my-deals-branded"] });
  queryClient.invalidateQueries({ queryKey: ["my-deals-all-active-offers"] });
  queryClient.invalidateQueries({ queryKey: ["partner-offers"] });
 };

 useEffect(() => {
 if (authLoading) return;

 if (!user) {
 // Redirect to auth with return path
 navigate(`/auth?redirect=/checkin?token=${token}`);
 return;
 }

 if (!token) {
 navigate("/home");
 return;
 }

 // Process check-in
 const doCheckin = async () => {
 if (checkinAttempted.current) return;
 checkinAttempted.current = true;
 // Persistent idempotency across page reloads: if we've already processed
 // this exact token in this browser session, don't re-invoke the RPC or
 // the branded distributor. The server still enforces idempotency on the
 // checkin_id — this is a UX/load-saver to avoid an unnecessary round-trip.
 const storageKey = `checkin:processed:${token}`;
 try {
 const cached = sessionStorage.getItem(storageKey);
 if (cached) {
 const parsed = JSON.parse(cached);
 const cachedAwards: BrandedAward[] = Array.isArray(parsed.brandedAwards)
 ? parsed.brandedAwards
 : [];
 if (cachedAwards.length > 0) setBrandedAwards(cachedAwards);
 setResult({
 success: parsed.success ?? true,
 entityName: parsed.entityName ?? null,
 message:
 parsed.message ??
"You've already processed this check-in. Reloading does not award additional PawBucks.",
 });
 return;
 }
 } catch {
 // ignore storage errors
 }
 setProcessing(true);
 try {
 // Retry process_checkin ONLY on client-side timeouts. Other errors
 // (network/server) surface immediately so we don't risk duplicate work.
 let data: any = null;
 let lastTimeoutErr: Error | null = null;
 for (let attempt = 0; attempt <= MAX_TIMEOUT_RETRIES; attempt++) {
 try {
 const res = await withTimeout(
 supabase.rpc("process_checkin", {
 p_token: token,
 p_user_id: user.id,
 }),
 PROCESS_CHECKIN_TIMEOUT_MS,
 );
 if (res.error) throw res.error;
 data = res.data;
 lastTimeoutErr = null;
 break;
 } catch (e: any) {
 if (e?.isTimeout) {
 lastTimeoutErr = e;
 console.warn(
 `[checkin] process_checkin timed out (attempt ${attempt + 1}/${MAX_TIMEOUT_RETRIES + 1})`,
 );
 if (attempt < MAX_TIMEOUT_RETRIES) {
 await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS * (attempt + 1)));
 continue;
 }
 throw e;
 }
 throw e;
 }
 }
 if (lastTimeoutErr) throw lastTimeoutErr;

 const row = Array.isArray(data) ? data[0] : data;
 console.log("[checkin] process_checkin result", {
 success: row?.success,
 entity_name: row?.entity_name,
 entity_type: (row as any)?.entity_type,
 merchant_id: (row as any)?.merchant_id ?? null,
 vet_id: (row as any)?.vet_id ?? null,
 checkin_id: (row as any)?.checkin_id ?? null,
 });
 if (row) {
 setResult({
 success: row.success,
 entityName: row.entity_name,
 message: row.message,
 });
 if (row.success) {
 toast.success(`Checked in at ${row.entity_name}!`);
 // Distribute branded PawBucks if applicable
 const merchantId = (row as any).merchant_id as string | null;
 const checkinId = (row as any).checkin_id as string | null;
                if (merchantId) {
                  // Unlock New Customer and/or Partner Deal offers based on merchant fee_model.
 if (checkinId) {
 setUnlockMerchantId(merchantId);
 supabase.functions
                      .invoke("unlock-merchant-offers", {
 body: { merchant_id: merchantId, checkin_id: checkinId },
 })
 .then(({ data: unlockData, error: unlockError }) => {
 if (unlockError) {
                          console.warn("[checkin] unlock-merchant-offers failed", unlockError);
 return;
 }
 const offers = (unlockData?.unlocked ?? []) as UnlockedOffer[];
 if (offers.length > 0) {
 setUnlockedOffers(offers);
 refreshDeals();
 const newly = offers.filter((o) => !o.already_unlocked);
 if (newly.length > 0) {
                            const hasNew = newly.some((o) => o.offer_type === "new_customer");
                            const hasPartner = newly.some((o) => o.offer_type === "partner_deal");
                            const label = hasNew && hasPartner
                              ? `🎉 ${newly.length} deals unlocked at ${row.entity_name}!`
                              : hasNew
                                ? `🎉 New Customer deal unlocked at ${row.entity_name}!`
                                : `🎉 Partner deal${newly.length > 1 ? "s" : ""} unlocked at ${row.entity_name}!`;
                            toast.success(label, { duration: 6000 });
 }
 }
 })
 .catch((err) => {
                        console.warn("[checkin] unlock-merchant-offers threw", err);
 });
 }
 console.log("[checkin] invoking distribute-branded-pawbucks", {
 user_id: user.id,
 merchant_id: merchantId,
 checkin_id: checkinId,
 trigger:"checkin",
 });
 supabase.functions.invoke("distribute-branded-pawbucks", {
 body: {
 user_id: user.id,
 merchant_id: merchantId,
 checkin_id: checkinId,
 trigger:"checkin",
 },
 }).then(({ data: brandedData, error: brandedError }) => {
 console.log("[checkin] distribute-branded-pawbucks response", {
 error: brandedError?.message ?? null,
 distributed: brandedData?.distributed ?? false,
 total_amount: brandedData?.total_amount ?? 0,
 campaign_count: brandedData?.campaigns?.length ?? 0,
 campaigns: brandedData?.campaigns ?? [],
 });
 if (brandedData?.distributed && brandedData.campaigns?.length > 0) {
 const total = brandedData.total_amount;
 const brandNames = brandedData.campaigns.map((c: any) => c.brand_name).join(",");
 setBrandedAwards(brandedData.campaigns as BrandedAward[]);
 toast.success(`🎁 You received ${total.toLocaleString()} branded PawBucks from ${brandNames}!`, { duration: 5000 });
 refreshDeals();
 }
 try {
 sessionStorage.setItem(storageKey, JSON.stringify({
 success: row.success,
 entityName: row.entity_name,
 message: row.message,
 brandedAwards: (brandedData?.campaigns as BrandedAward[]) ?? [],
 }));
 } catch {
 // ignore storage errors
 }
 }).catch((err) => {
 console.warn("[checkin] distribute-branded-pawbucks failed", err);
 });
 } else {
 console.log("[checkin] skipping distributor — no merchant_id on check-in");
 try {
 sessionStorage.setItem(storageKey, JSON.stringify({
 success: row.success,
 entityName: row.entity_name,
 message: row.message,
 brandedAwards: [],
 }));
 } catch {
 // ignore storage errors
 }
 }
 }
 }
 } catch (error) {
 console.error("Check-in error:", error);
 setResult({ success: false, entityName: null, message:"Failed to process check-in" });
 } finally {
 setProcessing(false);
 }
 };

 doCheckin();
 }, [user, authLoading, token, navigate]);

 if (authLoading || processing) {
 return (
 <div className="min-h-screen flex items-center justify-center bg-background">
 <SEO title="Checking In..." description="Processing your check-in" />
 <div className="text-center space-y-4">
 <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
 <p className="text-muted-foreground">Processing your check-in...</p>
 </div>
 </div>
 );
 }

 return (
 <div className="min-h-screen flex items-center justify-center bg-background p-4">
 <SEO title="Check In" description="Check in at a PawBucks partner location" />
 <GradientCard className="max-w-md w-full p-8 text-center space-y-6">
 {result ? (
 <>
 {result.success ? (
 <>
 <CheckCircle2 className="w-20 h-20 mx-auto text-success" />
 <div>
 <h1 className="text-2xl font-bold">Checked In!</h1>
 <p className="text-muted-foreground mt-2">
 Welcome to {result.entityName}
 </p>
 </div>
 {brandedAwards.length > 0 && (
 <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-left space-y-3">
 <div className="flex items-center justify-between">
 <p className="text-sm font-semibold text-foreground">🎁 Branded PawBucks Awarded</p>
 <p className="text-sm font-bold text-primary">
 +{brandedAwards.reduce((s, a) => s + a.amount, 0).toLocaleString()} PB
 </p>
 </div>
 <ul className="space-y-2">
 {brandedAwards.map((a, i) => (
 <li key={i} className="flex items-center gap-3">
 {a.brand_logo ? (
 <img src={a.brand_logo} alt={a.brand_name} className="w-8 h-8 rounded object-cover" />
 ) : (
 <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
 {a.brand_name?.[0] ??"?"}
 </div>
 )}
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium text-foreground truncate">{a.brand_name}</p>
 <p className="text-xs text-muted-foreground truncate">{a.campaign_name}</p>
 </div>
 <p className="text-sm font-semibold text-primary">+{a.amount.toLocaleString()}</p>
 </li>
 ))}
 </ul>
 </div>
 )}
 {unlockedOffers.length > 0 && (
 <div className="rounded-lg border border-accent/40 bg-accent/5 p-4 text-left space-y-3">
 <div className="flex items-center justify-between">
							<p className="text-sm font-semibold text-foreground">
								🎟️ {(() => {
									const hasNew = unlockedOffers.some((o) => o.offer_type === "new_customer");
									const hasPartner = unlockedOffers.some((o) => o.offer_type === "partner_deal");
									if (hasNew && hasPartner) return `${unlockedOffers.length} Offers Unlocked`;
									if (hasPartner) return unlockedOffers.length > 1 ? "Partner Deals Unlocked" : "Partner Deal Unlocked";
									return "New Customer Deal Unlocked";
								})()}
							</p>
 <span className="text-[10px] uppercase tracking-wide font-semibold text-accent">In-store</span>
 </div>
 <ul className="space-y-3">
 {unlockedOffers.map((o) => (
 <li key={o.offer_id} className="space-y-1">
 <p className="text-sm font-medium text-foreground">{o.title}</p>
 <div className="flex items-center justify-between rounded-md border border-dashed border-accent/40 bg-background px-3 py-2">
 <span className="text-xs text-muted-foreground">Show this code</span>
 <span className="font-mono text-base font-bold tracking-widest text-foreground">
 {o.redemption_code}
 </span>
 </div>
 {o.redeemed && (
 <p className="text-xs text-muted-foreground">Already redeemed.</p>
 )}
 </li>
 ))}
 </ul>
 <p className="text-xs text-muted-foreground">
 Show this code to the cashier to redeem in person.
 </p>
 </div>
 )}
 </>
 ) : (
 <>
 <XCircle className="w-20 h-20 mx-auto text-destructive" />
 <div>
 <h1 className="text-2xl font-bold">
 {result.entityName ||"Check-In"}
 </h1>
 <p className="text-muted-foreground mt-2">{result.message}</p>
 </div>
 </>
 )}
 <Button onClick={() => navigate("/home")} className="w-full">
 Go to Dashboard
 </Button>
 </>
 ) : !user ? (
 <>
 <LogIn className="w-20 h-20 mx-auto text-muted-foreground" />
 <div>
 <h1 className="text-2xl font-bold">Sign In Required</h1>
 <p className="text-muted-foreground mt-2">
 Please sign in to check in at this location
 </p>
 </div>
 <Button onClick={() => navigate(`/auth?redirect=/checkin?token=${token}`)} className="w-full">
 Sign In
 </Button>
 </>
 ) : null}
 </GradientCard>
 </div>
 );
}
