import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SEO } from "@/components/SEO";
import pawMark from "@/assets/pawbucks-logo.png";
import brandLogo from "@/assets/logo.png";
import petfestArt from "@/assets/petfest-2027.png";
import "./PetFest.css";

const EVENT_START = new Date("2027-03-20T10:00:00-07:00").getTime();

const eventSchema = {
  "@context": "https://schema.org",
  "@type": "Event",
  name: "PetFest 2027",
  description:
    "PetFest 2027 is a free one-day pet festival in West Los Angeles with local pet businesses, rescues, experts, shopping and 15,000 PawBucks up for grabs.",
  startDate: "2027-03-20T10:00:00-07:00",
  endDate: "2027-03-20T18:00:00-07:00",
  eventStatus: "https://schema.org/EventScheduled",
  eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  location: {
    "@type": "Place",
    name: "West Los Angeles Veterans Park",
    address: {
      "@type": "PostalAddress",
      streetAddress: "11301 Wilshire Blvd",
      addressLocality: "Los Angeles",
      addressRegion: "CA",
      postalCode: "90024",
      addressCountry: "US",
    },
  },
  organizer: { "@type": "Organization", name: "PawBucks", url: "https://pawbucks.app" },
  offers: {
    "@type": "Offer",
    price: 0,
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
    url: "https://pawbucks.app/petfest",
  },
};

const experiences = [
  {
    emoji: "🐕",
    title: "Discover local favorites",
    copy: "Meet pet businesses from across West LA and discover your next groomer, trainer, walker, shop or pet-care obsession.",
  },
  {
    emoji: "🎤",
    title: "Learn from the pros",
    copy: "Hear from veterinarians, trainers, nutrition experts and other people who know pets inside and out.",
  },
  {
    emoji: "❤️",
    title: "Meet rescue heroes",
    copy: "Connect with local rescue organizations and learn how you can help pets waiting for their forever homes.",
  },
  {
    emoji: "🛍️",
    title: "Shop the pet world",
    copy: "Browse products, discover new brands and find event-only offers you won't see every day.",
  },
  {
    pawIcon: true,
    title: "Make new friends",
    copy: "Because sometimes the easiest way to meet your neighbors is through the furry family member walking beside you.",
  },
  {
    pawIcon: true,
    title: "Earn PawBucks",
    copy: "Explore the festival, complete your PetFest Passport and turn your adventure into rewards you can spend with PawBucks partners.",
  },
];

const passportSteps = [
  "Check in at PawBucks HQ",
  "Explore participating PetFest booths",
  "Collect your stamps",
  "Turn it in & claim your PawBucks",
];

const perks = [
  "Free admission",
  "Leashed pets welcome",
  "15,000 PawBucks available through the Passport",
  "Local pet businesses + rescues + experts",
  "Exclusive PetFest offers",
];

const pad = (n: number) => String(Math.max(0, n)).padStart(2, "0");

const useCountdown = () => {
  const [left, setLeft] = useState(() => EVENT_START - Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setLeft(EVENT_START - Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const total = Math.max(0, left);
  return {
    days: Math.floor(total / 86400000),
    hours: Math.floor((total / 3600000) % 24),
    minutes: Math.floor((total / 60000) % 60),
    seconds: Math.floor((total / 1000) % 60),
  };
};

const PetFest = () => {
  const { days, hours, minutes, seconds } = useCountdown();

  return (
    <div className="petfest">
      <SEO
        title="PetFest 2027 – Free Pet Festival in West LA"
        description="PetFest 2027: a free one-day pet festival in West LA on March 20, 2027. Local pet businesses, rescues, experts, shopping and 15,000 PawBucks up for grabs."
        keywords={["PetFest", "pet festival Los Angeles", "free pet event LA", "West LA pet event", "PawBucks PetFest", "dog festival 2027"]}
        canonical="/petfest"
        jsonLd={eventSchema}
      />

      <div className="topbar">
        <span>
          <img src={pawMark} alt="" className="pf-paw pf-paw-xs" /> FREE ADMISSION · ONE DAY ONLY ·
          WEST LA · MARCH 20, 2027 · 10 AM–6 PM{" "}
          <img src={pawMark} alt="" className="pf-paw pf-paw-xs" />
        </span>
      </div>

      <div className="wrap">
        <nav>
          <Link to="/" className="pf-logo" aria-label="PawBucks home">
            <img src={brandLogo} alt="PawBucks" className="pf-brand-logo" />
          </Link>
          <Link to="/petfest/rsvp" className="nav-btn">
            Get Your Free Pass →
          </Link>
        </nav>

        {/* HERO */}
        <header className="hero">
          <div className="hero-copy">
            <div className="kicker">
              <i /> West LA · March 20, 2027
            </div>
            <h1>
              <span className="word-pet">PET</span>
              <span className="word-fest">FEST</span>
            </h1>
            <p className="hero-tagline">West Los Angeles' biggest day for pets.</p>
            <p className="hero-description">
              Bring your whole pack for a day of local pet businesses, rescue groups, expert advice,
              shopping, community and <strong>15,000 PawBucks up for grabs</strong>.
            </p>
            <div className="hero-buttons">
              <Link to="/petfest/rsvp" className="btn btn-primary">
                <img src={pawMark} alt="" className="pf-paw pf-paw-sm" /> Register Free
              </Link>
              <a href="#experience" className="btn btn-secondary">
                Explore PetFest ↓
              </a>
            </div>
            <div className="hero-details">
              <div className="hero-detail">
                <strong>📅 WHEN</strong>
                Saturday · March 20
              </div>
              <div className="hero-detail">
                <strong>📍 WHERE</strong>
                Coming Soon
              </div>
              <div className="hero-detail">
                <strong>🎟️ COST</strong>
                $0 Admission
              </div>
            </div>
            <div className="countdown">
              <span className="countdown-label">Until we party...</span>
              <span className="cd">{days}d</span>
              <span className="cd">{pad(hours)}h</span>
              <span className="cd">{pad(minutes)}m</span>
              <span className="cd">{pad(seconds)}s</span>
            </div>
          </div>

          <div className="hero-art">
            <img
              src={petfestArt}
              alt="PetFest 2027 — a band of dogs performing on a globe stage, powered by PawBucks. Free entry, $0 to get in, 15,000 PawBucks up for grabs."
              className="hero-art-img"
              loading="eager"
              fetchPriority="high"
            />
          </div>
        </header>
      </div>

      {/* EVENT BAR */}
      <div className="event-bar">
        <div className="wrap">
          <div className="event-grid">
            <div className="event-item">
              <div className="event-number">15K</div>
              <div className="event-label">PawBucks Up For Grabs</div>
            </div>
            <div className="event-item">
              <div className="event-number">$0</div>
              <div className="event-label">Admission</div>
            </div>
            <div className="event-item">
              <div className="event-number">6+</div>
              <div className="event-label">Ways To Experience PetFest</div>
            </div>
            <div className="event-item">
              <div className="event-number">1</div>
              <div className="event-label">Very Good Day</div>
            </div>
          </div>
        </div>
      </div>

      {/* EXPERIENCE */}
      <section id="experience">
        <div className="wrap">
          <div className="center">
            <p className="eyebrow">This isn't just a pet event</p>
            <h2 className="section-title">
              Come for the pets.
              <br />
              Stay for everything else.
            </h2>
            <p className="section-copy">
              PetFest brings the West LA pet community together in one place. Discover businesses you
              didn't know existed, meet people who get your obsession with your pets, and leave with a
              few new favorites.
            </p>
          </div>

          <div className="experience-grid">
            {experiences.map((item) => (
              <article className="experience" key={item.title}>
                <span className="tape" aria-hidden="true" />
                <div className="emoji" aria-hidden="true">
                  {"pawIcon" in item ? (
                    <img src={pawMark} alt="" className="pf-paw pf-paw-lg" />
                  ) : (
                    item.emoji
                  )}
                </div>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* PASSPORT */}
      <section className="passport-section">
        <div className="wrap">
          <div className="passport">
            <div className="passport-grid">
              <div>
                <p className="eyebrow">The PetFest Passport</p>
                <h2>
                  Don't just walk around.
                  <br />
                  <span>Play along.</span>
                </h2>
                <p className="passport-copy">
                  Your PetFest Passport turns the entire festival into a game. Visit participating
                  booths, collect your stamps and complete your passport before the festival ends.
                </p>
                <div className="steps">
                  {passportSteps.map((step, i) => (
                    <div className="step" key={step}>
                      <span className="step-number">{i + 1}</span>
                      {step}
                    </div>
                  ))}
                </div>
                <div className="passport-actions">
                  <Link to="/petfest/passport" className="btn btn-primary">
                    Open my passport
                  </Link>
                  <Link to="/petfest/passport/print" className="btn btn-secondary">
                    Print a paper passport
                  </Link>
                </div>
              </div>

              <div className="passport-card">
                <div className="tiny">PetFest 2027</div>
                <div className="stamp" aria-hidden="true">
                  <img src={pawMark} alt="" className="pf-paw pf-paw-lg" />
                </div>
                <div className="amount">15K</div>
                <div className="pb">PAWBUCKS</div>
                <div className="note">Explore · Earn · Spend · Support</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOMO */}
      <section>
        <div className="wrap fomo">
          <div className="fomo-art" aria-hidden="true">
            <div className="fomo-circle">
              <strong>
                ONE
                <br />
                DAY.
              </strong>
              <span>Make it a good one.</span>
            </div>
            <div className="fomo-doodle a">{"bring\nyour buddy! →"}</div>
            <div className="fomo-doodle b">{"free is\nour favorite price."}</div>
          </div>

          <div className="fomo-copy">
            <p className="eyebrow">Why you'll want to be there</p>
            <h2>
              Your dog has plans. <span>You should too.</span>
            </h2>
            <p>
              PetFest is designed to be the kind of Saturday you talk about afterward. Bring your pet,
              grab your friends, wander from booth to booth and see what you find.
            </p>
            <div className="fomo-list">
              {perks.map((perk) => (
                <div key={perk}>
                  <span className="check" aria-hidden="true">
                    ✓
                  </span>
                  {perk}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* VENUE */}
      <section className="venue-section">
        <div className="wrap">
          <div className="center">
            <p className="eyebrow">Mark your calendar</p>
            <h2 className="section-title">
              West LA.
              <br />
              We're coming outside.
            </h2>
          </div>

          <div className="venue">
            <div className="venue-card">
              <div className="venue-row">
                <span className="venue-icon" aria-hidden="true">📍</span>
                <div>
                  <strong>West Los Angeles Veterans Park</strong>
                  <span>
                    11301 Wilshire Blvd
                    <br />
                    Los Angeles, CA 90024
                  </span>
                </div>
              </div>
              <div className="venue-row">
                <span className="venue-icon" aria-hidden="true">
                  📅
                </span>
                <div>
                  <strong>Saturday, March 20, 2027</strong>
                  <span>10 AM – 6 PM</span>
                </div>
              </div>
              <div className="venue-row">
                <span className="venue-icon" aria-hidden="true">
                  🎟️
                </span>
                <div>
                  <strong>Free admission</strong>
                  <span>Registration is required.</span>
                </div>
              </div>
              <div className="venue-row">
                <span className="venue-icon" aria-hidden="true">
                  <img src={pawMark} alt="" className="pf-paw pf-paw-sm" />
                </span>
                <div>
                  <strong>Bring your best friend</strong>
                  <span>Leashed pets welcome. Bring water and prepare for a full day outside.</span>
                </div>
              </div>
            </div>

            <div className="map" aria-hidden="true">
              <div className="map-pin">📍</div>
              <div className="map-note">
                PetFest lives here! <img src={pawMark} alt="" className="pf-paw pf-paw-sm" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="final">
        <div className="wrap">
          <div className="final-card">
            <h2>
              Your pet already said{" "}
              <span>
                “We're going.” <img src={pawMark} alt="" className="pf-paw pf-paw-md" />
              </span>
            </h2>
            <p>Admission is free. The rewards are real. And there's only one PetFest 2027.</p>
            <Link to="/petfest/rsvp" className="btn">
              Reserve My Free Spot →
            </Link>
            <p className="final-note">March 20, 2027 · West LA · 10 AM–6 PM</p>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div className="footer-logo">
            <img src={brandLogo} alt="PawBucks" className="pf-brand-logo pf-brand-logo-footer" />
            <span className="footer-presents">presents PetFest 2027</span>
          </div>
          <p>West Los Angeles Veterans Park · March 20, 2027</p>
          <p>#PawBucksPetFest2027</p>
        </div>
      </footer>
    </div>
  );
};

export default PetFest;
