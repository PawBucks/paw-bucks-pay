import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { SEO } from "@/components/SEO";
import pawMark from "@/assets/pawbucks-logo.png";
import { readPetFestBonus, trackPetFestBonusEvent } from "@/lib/petfestBonus";
import "./PetFest.css";

interface RsvpState {
  name?: string;
  petName?: string;
  petCount?: number;
  bonus?: { token: string; expiresAt: string; amount: number } | null;
}

const FALLBACK_WINDOW_MS = 5 * 60 * 1000;

/** Counts down to the server-issued reservation expiry (never a client-invented deadline). */
const useOfferCountdown = (serverExpiresAt?: string | null) => {
  const deadline = useMemo(() => {
    const stored = readPetFestBonus();
    const iso = serverExpiresAt || stored?.expiresAt;
    const parsed = iso ? new Date(iso).getTime() : NaN;
    return Number.isFinite(parsed) ? parsed : Date.now() + FALLBACK_WINDOW_MS;
  }, [serverExpiresAt]);

  const [msLeft, setMsLeft] = useState(() => Math.max(0, deadline - Date.now()));

  useEffect(() => {
    const id = setInterval(() => setMsLeft(Math.max(0, deadline - Date.now())), 250);
    return () => clearInterval(id);
  }, [deadline]);

  const mins = Math.floor(msLeft / 60000);
  const secs = Math.floor((msLeft % 60000) / 1000);
  return { expired: msLeft <= 0, label: `${mins}:${String(secs).padStart(2, "0")}` };
};

const PetFestRsvpSuccess = () => {
  const { state } = useLocation();
  const rsvp = (state || {}) as RsvpState;
  const { expired, label } = useOfferCountdown(rsvp.bonus?.expiresAt);


  return (
    <div className="petfest">
      <SEO
        title="You're In! PetFest 2027 RSVP Confirmed"
        description="Your free PetFest 2027 RSVP is confirmed. Claim 5,000 bonus PawBucks and see you March 20 in West Los Angeles."
        canonical="https://pawbucks.app/petfest/rsvp/success"
        noIndex
      />

      <section className="pf-form-section">
        <div className="wrap">
          <div className="pf-form-card pf-success-card">
            <div className="pf-success-badge">🎉</div>
            <span className="pf-form-kicker">RSVP Confirmed</span>
            <h1>{rsvp.name ? `You're in, ${rsvp.name}!` : "You're in!"}</h1>
            <p className="pf-form-intro">
              {rsvp.petName
                ? `We saved a spot for you and ${rsvp.petName}${rsvp.petCount && rsvp.petCount > 1 ? ` (plus ${rsvp.petCount - 1} more good ${rsvp.petCount - 1 === 1 ? "pet" : "pets"})` : ""}.`
                : "We saved your spot at PetFest 2027."}{" "}
              Keep this page handy — we'll reach out with PetFest updates before the big day.
            </p>

            <div className={`pf-offer${expired ? " pf-offer-expired" : ""}`}>
              <span className="pf-offer-flag">
                <img src={pawMark} alt="" className="pf-paw pf-paw-xs" /> PetFest Sign-Up Bonus
              </span>
              <h2 className="pf-offer-amount">5,000 PawBucks</h2>
              <p className="pf-offer-value">$5.00 USD value — free when you create your PawBucks account</p>

              {expired ? (
                <p className="pf-offer-timer pf-offer-timer-done">
                  This bonus window closed. Create your free account anyway — you'll still earn PawBucks on every
                  purchase at PawBucks merchants.
                </p>
              ) : (
                <>
                  <div className="pf-offer-timer" role="timer" aria-live="off">
                    <span className="pf-offer-clock">{label}</span>
                    <span className="pf-offer-clock-label">left to claim</span>
                  </div>
                  <p className="pf-offer-fine">
                    Offer expires 5 minutes after your RSVP confirmation. One bonus per new account.
                  </p>
                </>
              )}

              <Link
                to="/auth?offer=petfest5000"
                className="btn btn-primary pf-offer-cta"
                onClick={() => trackPetFestBonusEvent("cta_click", { expired })}
              >
                <img src={pawMark} alt="" className="pf-paw pf-paw-sm" />{" "}
                {expired ? "Create My Free Account" : "Claim My 5,000 PawBucks"}
              </Link>
            </div>

            <div className="pf-success-details">
              <div>
                <strong>📅 WHEN</strong>
                Saturday, March 20, 2027 · 10 AM–6 PM
              </div>
              <div>
                <strong>📍 WHERE</strong>
                Coming Soon
              </div>
              <div>
                <strong>🎟️ COST</strong>
                $0 — just show up with your pack
              </div>
            </div>

            <div className="pf-success-actions">
              <Link to="/petfest" className="btn btn-secondary">
                Back to PetFest
              </Link>
            </div>
            <p className="pf-form-note">#PawBucksPetFest2027</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PetFestRsvpSuccess;
