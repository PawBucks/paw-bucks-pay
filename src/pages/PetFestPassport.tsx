import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import pawMark from "@/assets/pawbucks-logo.png";
import "./PetFest.css";

interface Booth {
  id: string;
  name: string;
  booth_number: string;
  sponsor_name: string;
  description: string;
  pawbucks_reward: number;
  is_required: boolean;
  sort_order: number;
}

interface Stamp {
  booth_id: string;
  pawbucks_awarded: number;
  scanned_at: string;
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const extractToken = (raw: string): string | null => {
  const match = raw.match(UUID_RE);
  return match ? match[0] : null;
};

const PetFestPassport = () => {
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [claiming, setClaiming] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const claimedTokens = useRef<Set<string>>(new Set());

  const pendingToken = searchParams.get("stamp");

  const { data: settings } = useQuery({
    queryKey: ["petfest-passport-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("petfest_passport_settings")
        .select("event_label, required_stamps, completion_bonus_pawbucks, is_live")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: booths = [] } = useQuery({
    queryKey: ["petfest-passport-booths"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("petfest_passport_booths")
        .select("id, name, booth_number, sponsor_name, description, pawbucks_reward, is_required, sort_order")
        .eq("is_active", true)
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data || []) as Booth[];
    },
  });

  const { data: stamps = [] } = useQuery({
    queryKey: ["petfest-passport-stamps", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("petfest_passport_stamps")
        .select("booth_id, pawbucks_awarded, scanned_at")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data || []) as Stamp[];
    },
  });

  const { data: completion } = useQuery({
    queryKey: ["petfest-passport-completion", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("petfest_passport_completions")
        .select("stamps_count, bonus_pawbucks, completed_at")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const requiredStamps = settings?.required_stamps ?? booths.length ?? 0;
  const stampedIds = new Set(stamps.map((s) => s.booth_id));
  const earned = stamps.reduce((sum, s) => sum + (s.pawbucks_awarded || 0), 0) + (completion?.bonus_pawbucks || 0);
  const progressPct = requiredStamps > 0 ? Math.min(100, (stamps.length / requiredStamps) * 100) : 0;

  const claimStamp = useCallback(
    async (token: string) => {
      if (claimedTokens.current.has(token)) return;
      claimedTokens.current.add(token);
      setClaiming(true);
      try {
        const { data, error } = await supabase.functions.invoke("petfest-passport-scan", {
          body: { action: "scan", qrToken: token },
        });
        if (error) throw error;

        if (!data?.success) {
          const reasons: Record<string, string> = {
            invalid_code: "That code isn't a PetFest Passport booth.",
            booth_inactive: "This booth isn't collecting stamps right now.",
            passport_not_live: "The PetFest Passport opens on event day.",
            credit_failed: "We couldn't add your PawBucks. Try again in a moment.",
          };
          toast.error(reasons[data?.reason] || "We couldn't add that stamp. Try again.");
          claimedTokens.current.delete(token);
          return;
        }

        if (data.alreadyStamped) {
          toast.info(`${data.booth?.name || "This booth"} is already stamped in your passport.`);
        } else if (data.bonusAwarded) {
          toast.success(
            `Passport complete! ${(data.awarded + data.bonusAwarded).toLocaleString()} PawBucks added, including your ${data.bonusAwarded.toLocaleString()} completion bonus.`,
          );
        } else {
          toast.success(`${data.booth?.name} stamped — ${(data.awarded || 0).toLocaleString()} PawBucks added.`);
        }

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["petfest-passport-stamps"] }),
          queryClient.invalidateQueries({ queryKey: ["petfest-passport-completion"] }),
          queryClient.invalidateQueries({ queryKey: ["pawbucks"] }),
        ]);
      } catch (err) {
        console.error("passport claim failed", err);
        claimedTokens.current.delete(token);
        toast.error("We couldn't add that stamp. Try again.");
      } finally {
        setClaiming(false);
      }
    },
    [queryClient],
  );

  // Auto-claim when the attendee lands here from a booth QR code.
  useEffect(() => {
    if (!pendingToken || !user) return;
    const token = extractToken(pendingToken);
    if (!token) return;
    claimStamp(token).finally(() => {
      searchParams.delete("stamp");
      setSearchParams(searchParams, { replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingToken, user]);

  // Camera scanner
  useEffect(() => {
    if (!scannerOpen) return;
    let cancelled = false;
    const start = async () => {
      try {
        const scanner = new Html5Qrcode("petfest-passport-reader");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          async (decoded) => {
            const token = extractToken(decoded);
            if (!token) return;
            setScannerOpen(false);
            await claimStamp(token);
          },
          () => {},
        );
        if (cancelled) await scanner.stop().catch(() => {});
      } catch {
        toast.error("We couldn't open your camera. Scan the booth QR with your camera app instead.");
        setScannerOpen(false);
      }
    };
    start();
    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      scanner?.stop().catch(() => {});
    };
  }, [scannerOpen, claimStamp]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = extractToken(manualCode.trim());
    if (!token) {
      toast.error("Enter the full booth code from the PetFest booth sign.");
      return;
    }
    setManualCode("");
    await claimStamp(token);
  };

  const signInPath = `/auth?redirect=${encodeURIComponent(
    `/petfest/passport${pendingToken ? `?stamp=${pendingToken}` : ""}`,
  )}`;

  return (
    <div className="petfest">
      <SEO
        title="PetFest Passport | Collect Stamps, Earn PawBucks"
        description="Collect a stamp at every PetFest booth, earn PawBucks with each stamp and unlock a completion bonus when your passport is full."
        canonical="https://pawbucks.app/petfest/passport"
      />

      <section className="pf-form-section">
        <div className="wrap">
          <div className="pf-passport-page">
            <header className="pf-passport-head">
              <span className="pf-form-kicker">{settings?.event_label || "PetFest"} Passport</span>
              <h1>Collect stamps. Earn PawBucks.</h1>
              <p className="pf-form-intro">
                Scan the QR code at each participating booth to stamp your passport. Every stamp pays PawBucks
                instantly, and filling your passport unlocks a bonus.
              </p>
            </header>

            {!user && !authLoading ? (
              <div className="pf-passport-gate">
                <img src={pawMark} alt="" className="pf-paw pf-paw-lg" />
                <h2>Sign in to start stamping</h2>
                <p>
                  Your stamps and PawBucks land in your free PawBucks wallet, so you'll need an account to play
                  along.
                </p>
                <Link className="btn btn-primary" to={signInPath}>
                  Sign in or create a free account
                </Link>
              </div>
            ) : (
              <>
                <div className="pf-passport-progress-card">
                  <div className="pf-passport-progress-top">
                    <div>
                      <span className="tiny">Stamps collected</span>
                      <strong>
                        {stamps.length}
                        <span>/{requiredStamps || booths.length}</span>
                      </strong>
                    </div>
                    <div className="pf-passport-earned">
                      <span className="tiny">PawBucks earned</span>
                      <strong>{earned.toLocaleString()}</strong>
                    </div>
                  </div>
                  <div className="pf-passport-bar" role="progressbar" aria-valuenow={stamps.length} aria-valuemin={0} aria-valuemax={requiredStamps}>
                    <span style={{ width: `${progressPct}%` }} />
                  </div>
                  {completion ? (
                    <p className="pf-passport-complete">
                      Passport complete! Your {completion.bonus_pawbucks.toLocaleString()} PawBucks completion bonus
                      is in your wallet.
                    </p>
                  ) : (
                    <p className="pf-passport-hint">
                      {Math.max(0, (requiredStamps || booths.length) - stamps.length)} more stamp
                      {(requiredStamps || booths.length) - stamps.length === 1 ? "" : "s"} to unlock your{" "}
                      {(settings?.completion_bonus_pawbucks ?? 0).toLocaleString()} PawBucks bonus.
                    </p>
                  )}
                </div>

                <div className="pf-passport-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setScannerOpen((v) => !v)}
                    disabled={claiming}
                  >
                    {scannerOpen ? "Close scanner" : claiming ? "Stamping..." : "Scan a booth QR"}
                  </button>
                  <Link className="btn btn-secondary" to="/petfest/passport/print">
                    Printable passport
                  </Link>
                </div>

                {scannerOpen && <div id="petfest-passport-reader" className="pf-passport-reader" />}

                <form className="pf-passport-manual" onSubmit={handleManualSubmit}>
                  <label htmlFor="pf-booth-code">No camera? Enter the booth code</label>
                  <div className="pf-passport-manual-row">
                    <input
                      id="pf-booth-code"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      placeholder="Booth code from the booth sign"
                      autoComplete="off"
                    />
                    <button type="submit" className="btn btn-secondary" disabled={claiming}>
                      Add stamp
                    </button>
                  </div>
                </form>

                <h2 className="pf-passport-subhead">Your passport</h2>
                {booths.length === 0 ? (
                  <p className="pf-passport-hint">
                    Participating booths are being announced soon — check back before the festival.
                  </p>
                ) : (
                  <div className="pf-stamp-grid">
                    {booths.map((booth) => {
                      const stamped = stampedIds.has(booth.id);
                      return (
                        <article key={booth.id} className={`pf-stamp-slot${stamped ? " is-stamped" : ""}`}>
                          <div className="pf-stamp-mark" aria-hidden="true">
                            {stamped ? <img src={pawMark} alt="" className="pf-paw pf-paw-lg" /> : <span>?</span>}
                          </div>
                          <h3>{booth.name}</h3>
                          {booth.booth_number && <span className="pf-stamp-number">Booth {booth.booth_number}</span>}
                          {booth.sponsor_name && <p className="pf-stamp-sponsor">{booth.sponsor_name}</p>}
                          <span className="pf-stamp-reward">
                            {stamped ? "Stamped" : `${booth.pawbucks_reward.toLocaleString()} PawBucks`}
                          </span>
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            <p className="pf-passport-foot">
              <Link to="/petfest">Back to PetFest</Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PetFestPassport;
