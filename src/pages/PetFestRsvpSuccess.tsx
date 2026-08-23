import { Link, useLocation } from "react-router-dom";
import { SEO } from "@/components/SEO";
import "./PetFest.css";

interface RsvpState {
  name?: string;
  petName?: string;
  petCount?: number;
}

const PetFestRsvpSuccess = () => {
  const { state } = useLocation();
  const rsvp = (state || {}) as RsvpState;

  return (
    <div className="petfest">
      <SEO
        title="You're In! PetFest 2027 RSVP Confirmed"
        description="Your free PetFest 2027 RSVP is confirmed. See you March 20 in West Los Angeles."
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
              A confirmation is on its way to your inbox.
            </p>

            <div className="pf-success-details">
              <div>
                <strong>📅 WHEN</strong>
                Saturday, March 20, 2027 · 10 AM–6 PM
              </div>
              <div>
                <strong>📍 WHERE</strong>
                West LA Veterans Park · 11301 Wilshire Blvd
              </div>
              <div>
                <strong>🎟️ COST</strong>
                $0 — just show up with your pack
              </div>
            </div>

            <div className="pf-success-actions">
              <Link to="/petfest" className="btn btn-primary">
                Back to PetFest
              </Link>
              <Link to="/auth" className="btn btn-secondary">
                Start Earning PawBucks →
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
