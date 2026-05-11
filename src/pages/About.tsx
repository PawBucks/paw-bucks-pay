import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { seoMeta } from "@/lib/seoMeta";
import logo from "@/assets/logo.png";
import founderPhoto from "@/assets/founder-jonathan.jpeg";
import { PawBucksLogo } from "@/components/PawBucksLogo";

const styles = `
.pa-root {
  --ink: #0a1f26;
  --teal: #12a8b3;
  --teal-light: #1ec8d4;
  --teal-pale: #e8f9fa;
  --teal-dark: #0a8f9a;
  --muted: #3d6068;
  --muted-light: #5a8a94;
  --border: #caeaee;
  --white: #ffffff;
  --section-alt: #f5fbfc;
  --dark-bg: #0a1f26;
  font-family: 'DM Sans', system-ui, sans-serif;
  background: var(--white);
  color: var(--ink);
  line-height: 1.6;
  overflow-x: hidden;
}
.pa-root * { box-sizing: border-box; }
.pa-root h1, .pa-root h2, .pa-root h3, .pa-root .pa-display { font-family: 'Playfair Display', Georgia, serif; }

/* NAV */
.pa-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.75rem 2.5rem;
  background: rgba(255,255,255,0.96);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}
.pa-nav-logo { display: flex; align-items: center; background: none; border: none; cursor: pointer; padding: 0; }
.pa-nav-logo img { height: 44px; width: auto; display: block; }
.pa-nav-links { display: flex; gap: 2rem; align-items: center; }
.pa-nav-links button, .pa-nav-links a {
  color: var(--muted); text-decoration: none;
  font-size: 0.875rem; font-weight: 400;
  background: none; border: none; cursor: pointer;
  font-family: inherit;
  transition: color 0.2s;
}
.pa-nav-links button:hover, .pa-nav-links a:hover { color: var(--teal); }
.pa-nav-cta {
  background: var(--teal) !important; color: #fff !important;
  padding: 0.6rem 1.4rem; border-radius: 3px;
  font-size: 0.85rem; font-weight: 500 !important;
  letter-spacing: 0.03em;
  transition: background 0.2s;
}
.pa-nav-cta:hover { background: var(--ink) !important; color: #fff !important; }
.pa-nav-mobile-cta { display: none; }

/* HERO */
.pa-hero {
  background: var(--dark-bg);
  padding: 10rem 5rem 7rem;
  position: relative; overflow: hidden;
}
.pa-hero::before {
  content: ''; position: absolute;
  top: -100px; right: -100px;
  width: 600px; height: 600px; border-radius: 50%;
  background: radial-gradient(circle, #1ec8d414 0%, transparent 70%);
  pointer-events: none;
}
.pa-hero::after {
  content: ''; position: absolute;
  bottom: -100px; left: -100px;
  width: 400px; height: 400px; border-radius: 50%;
  background: radial-gradient(circle, #1ec8d40a 0%, transparent 70%);
  pointer-events: none;
}
.pa-hero-inner { max-width: 780px; position: relative; z-index: 1; }
.pa-hero-eyebrow {
  font-size: 0.75rem; font-weight: 500;
  letter-spacing: 0.15em; text-transform: uppercase;
  color: var(--teal-light); margin-bottom: 1.5rem;
}
.pa-hero-title {
  font-size: clamp(2.8rem, 5vw, 4.5rem);
  font-weight: 900; line-height: 1.05;
  letter-spacing: -0.03em; color: #fff;
  margin-bottom: 1.75rem;
}
.pa-hero-title em { font-style: italic; color: var(--teal-light); }
.pa-hero-sub {
  font-size: 1.15rem; color: #6ab8c0;
  font-weight: 300; max-width: 600px; line-height: 1.8;
}

/* SECTIONS */
.pa-section { padding: 6rem 5rem; }
.pa-eyebrow {
  font-size: 0.7rem; font-weight: 500;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--teal); margin-bottom: 1rem;
}
.pa-section-title {
  font-size: clamp(2rem, 3.5vw, 2.8rem);
  font-weight: 900; line-height: 1.1;
  letter-spacing: -0.02em; color: var(--ink);
  margin-bottom: 1.25rem;
}
.pa-section-sub {
  font-size: 1rem; color: var(--muted);
  font-weight: 400; line-height: 1.8;
}

/* STORY */
.pa-story { background: var(--white); }
.pa-story-inner {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 6rem; align-items: start;
}
.pa-story-body { font-size: 1rem; color: var(--muted); line-height: 1.9; }
.pa-story-body p { margin-bottom: 1.25rem; }
.pa-story-body p:last-child { margin-bottom: 0; }
.pa-story-body strong { color: var(--ink); font-weight: 500; }
.pa-story-pull { position: sticky; top: 7rem; }
.pa-pull-quote {
  border-left: 3px solid var(--teal);
  padding: 1.5rem 0 1.5rem 2rem;
  margin-bottom: 2rem;
}
.pa-pull-quote-text {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 1.35rem; font-weight: 700; line-height: 1.4;
  color: var(--ink); margin-bottom: 0.75rem;
  letter-spacing: -0.01em;
}
.pa-pull-quote-text em { font-style: italic; color: var(--teal); }
.pa-pull-quote-attr { font-size: 0.8rem; color: var(--muted-light); letter-spacing: 0.05em; }

/* MISSION */
.pa-mission { background: var(--dark-bg); }
.pa-mission .pa-eyebrow { color: var(--teal-light); }
.pa-mission .pa-section-title { color: #fff; }
.pa-mission-inner {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 5rem; align-items: center; margin-top: 3rem;
}
.pa-mission-statement {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: clamp(1.5rem, 2.5vw, 2rem);
  font-weight: 700; line-height: 1.45;
  color: #fff; letter-spacing: -0.01em;
}
.pa-mission-statement em { font-style: italic; color: var(--teal-light); }
.pa-mission-body { font-size: 0.95rem; color: #6ab8c0; line-height: 1.9; font-weight: 300; }
.pa-mission-body p { margin-bottom: 1rem; }
.pa-mission-body p:last-child { margin-bottom: 0; }
.pa-mission-body strong { color: #fff; font-weight: 500; }

/* VALUES */
.pa-values { background: var(--section-alt); }
.pa-values-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem; margin-top: 3rem;
}
.pa-value-card {
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2.25rem 2rem;
  position: relative; overflow: hidden;
  transition: box-shadow 0.2s, transform 0.2s;
}
.pa-value-card:hover {
  box-shadow: 0 8px 30px rgba(10,31,38,0.08);
  transform: translateY(-2px);
}
.pa-value-card::before {
  content: ''; position: absolute;
  top: 0; left: 0; width: 100%; height: 3px;
  background: var(--teal);
}
.pa-value-icon { font-size: 2rem; margin-bottom: 1rem; display: block; }
.pa-value-name {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 1.2rem; font-weight: 700;
  color: var(--ink); margin-bottom: 0.6rem;
}
.pa-value-desc { font-size: 0.875rem; color: var(--muted); line-height: 1.75; }

/* TRACTION */
.pa-traction { background: var(--white); }
.pa-traction-inner {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 5rem; align-items: center;
}
.pa-stats-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 1.5rem; margin-top: 1.5rem;
}
.pa-stat-card {
  background: var(--teal-pale);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1.5rem;
}
.pa-stat-num {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 2rem; font-weight: 900;
  color: var(--teal-dark); line-height: 1;
  margin-bottom: 0.3rem;
}
.pa-stat-label { font-size: 0.8rem; color: var(--muted); line-height: 1.5; }
.pa-traction-note {
  background: var(--dark-bg); border-radius: 4px;
  padding: 2rem 2.25rem; color: #6ab8c0;
  font-size: 0.875rem; line-height: 1.75;
  font-weight: 300; margin-top: 1.5rem;
}
.pa-traction-note strong { color: var(--teal-light); font-weight: 500; }

/* FOUNDER */
.pa-founder { background: var(--section-alt); }
.pa-founder-inner {
  display: grid; grid-template-columns: 280px 1fr;
  gap: 4rem; align-items: start;
}
.pa-founder-card {
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2rem; text-align: center;
  position: sticky; top: 7rem;
}
.pa-founder-avatar {
  width: 140px; height: 140px; border-radius: 50%;
  background: var(--teal-pale);
  border: 3px solid var(--border);
  margin: 0 auto 1rem;
  overflow: hidden;
  object-fit: cover;
  object-position: center top;
  display: block;
}
.pa-founder-linkedin {
  display: inline-flex; align-items: center; gap: 0.4rem;
  margin-top: 0.75rem;
  font-size: 0.78rem; letter-spacing: 0.04em;
  color: var(--teal-dark); text-decoration: none;
  border-bottom: 1px solid var(--border);
  padding-bottom: 2px;
  transition: color 0.2s, border-color 0.2s;
}
.pa-founder-linkedin:hover { color: var(--teal); border-color: var(--teal); }
.pa-founder-name {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 1.2rem; font-weight: 700;
  color: var(--ink); margin-bottom: 0.25rem;
}
.pa-founder-title { font-size: 0.8rem; color: var(--muted-light); margin-bottom: 1rem; }
.pa-founder-tag {
  display: inline-block; background: var(--teal-pale);
  border: 1px solid var(--border); border-radius: 2px;
  padding: 0.2rem 0.6rem; font-size: 0.72rem;
  color: var(--teal-dark); font-weight: 500;
  margin-bottom: 0.4rem; letter-spacing: 0.03em;
}
.pa-founder-bio { font-size: 0.975rem; color: var(--muted); line-height: 1.9; }
.pa-founder-bio p { margin-bottom: 1.25rem; }
.pa-founder-bio p:last-child { margin-bottom: 0; }
.pa-founder-bio strong { color: var(--ink); font-weight: 500; }

/* ROADMAP */
.pa-roadmap { background: var(--white); }
.pa-roadmap-track {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 0; margin-top: 3rem; position: relative;
}
.pa-roadmap-track::before {
  content: ''; position: absolute;
  top: 1.35rem; left: calc(100% / 6); right: calc(100% / 6);
  height: 2px; background: var(--border); z-index: 0;
}
.pa-roadmap-phase {
  display: flex; flex-direction: column; align-items: center;
  text-align: center; padding: 0 1.5rem;
  position: relative; z-index: 1;
}
.pa-phase-dot {
  width: 2.75rem; height: 2.75rem; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.8rem; font-weight: 700;
  margin-bottom: 1rem; flex-shrink: 0;
}
.pa-phase-dot.active {
  background: var(--teal); color: #fff;
  box-shadow: 0 0 0 4px var(--teal-pale);
}
.pa-phase-dot.upcoming {
  background: var(--white); color: var(--muted-light);
  border: 2px solid var(--border);
}
.pa-phase-dot.done { background: var(--teal-dark); color: #fff; }
.pa-phase-label {
  font-size: 0.68rem; font-weight: 500;
  letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--teal); margin-bottom: 0.4rem;
}
.pa-phase-label.muted { color: var(--muted-light); }
.pa-phase-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 1.1rem; font-weight: 700;
  color: var(--ink); margin-bottom: 0.5rem;
}
.pa-phase-desc { font-size: 0.825rem; color: var(--muted); line-height: 1.65; }

/* CTA */
.pa-cta {
  background: var(--dark-bg); color: #fff;
  text-align: center; padding: 7rem 5rem;
  position: relative; overflow: hidden;
}
.pa-cta::before {
  content: ''; position: absolute;
  top: 50%; left: 50%; transform: translate(-50%,-50%);
  width: 800px; height: 400px;
  background: radial-gradient(ellipse, #1ec8d412 0%, transparent 70%);
  pointer-events: none;
}
.pa-cta .pa-eyebrow { color: var(--teal-light); }
.pa-cta .pa-section-title { color: #fff; max-width: 600px; margin: 0 auto 1rem; }
.pa-cta .pa-section-sub { color: #6ab8c0; max-width: 560px; margin: 0 auto 2.5rem; }
.pa-cta-btns { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }

.pa-btn-primary {
  background: var(--teal); color: #fff !important;
  padding: 0.9rem 2rem; border-radius: 3px;
  font-weight: 500; font-size: 0.95rem;
  letter-spacing: 0.02em; border: none; cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}
.pa-btn-primary:hover { background: #fff; color: var(--ink) !important; transform: translateY(-1px); }

.pa-btn-outline {
  background: transparent; color: #fff !important;
  padding: 0.9rem 2rem; border-radius: 3px;
  font-weight: 500; font-size: 0.95rem;
  letter-spacing: 0.02em;
  border: 1px solid #2a5a64; cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}
.pa-btn-outline:hover { border-color: var(--teal-light); color: var(--teal-light) !important; transform: translateY(-1px); }

/* FOOTER */
.pa-footer {
  background: var(--dark-bg);
  color: #3d8a94; padding: 2rem 5rem;
  display: flex; justify-content: space-between; align-items: center;
  font-size: 0.8rem; border-top: 1px solid #0f2d36;
}
.pa-footer a, .pa-footer button {
  color: #3d8a94; text-decoration: none;
  background: none; border: none; cursor: pointer;
  font-family: inherit; font-size: inherit;
}
.pa-footer a:hover, .pa-footer button:hover { color: var(--teal-light); }

/* ANIMATIONS */
@keyframes pa-fadeUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}
.pa-hero-eyebrow { animation: pa-fadeUp 0.5s 0.0s ease both; }
.pa-hero-title   { animation: pa-fadeUp 0.5s 0.1s ease both; }
.pa-hero-sub     { animation: pa-fadeUp 0.5s 0.2s ease both; }

/* RESPONSIVE */
@media (max-width: 900px) {
  .pa-nav { padding: 0.75rem 1.5rem; }
  .pa-nav-links { display: none; }
  .pa-nav-mobile-cta { display: inline-block; }
  .pa-section { padding: 4rem 1.5rem; }
  .pa-hero { padding: 8rem 1.5rem 5rem; }
  .pa-story-inner { grid-template-columns: 1fr; gap: 2.5rem; }
  .pa-story-pull { position: static; }
  .pa-mission-inner { grid-template-columns: 1fr; gap: 2.5rem; }
  .pa-values-grid { grid-template-columns: 1fr; }
  .pa-traction-inner { grid-template-columns: 1fr; gap: 2.5rem; }
  .pa-founder-inner { grid-template-columns: 1fr; gap: 2rem; }
  .pa-founder-card { position: static; }
  .pa-roadmap-track { grid-template-columns: 1fr; gap: 2rem; }
  .pa-roadmap-track::before { display: none; }
  .pa-cta { padding: 5rem 1.5rem; }
  .pa-footer { flex-direction: column; gap: 0.75rem; text-align: center; padding: 2rem 1.5rem; }
}
`;

const About = () => {
  const navigate = useNavigate();

  const aboutSchema = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "About PawBucks",
    description:
      "PawBucks was built by a 15-year pet care veteran who wanted to keep money in the local pet economy. Learn our story, mission, and values.",
    url: "https://pawbucks.app/about",
    mainEntity: {
      "@type": "Organization",
      name: "PawBucks, Inc.",
      legalName: "PawBucks, Inc.",
      url: "https://pawbucks.app",
      logo: "https://pawbucks.app/logo.png",
      foundingDate: "2025",
      address: {
        "@type": "PostalAddress",
        streetAddress: "12609 Woodgreen St.",
        addressLocality: "Los Angeles",
        addressRegion: "CA",
        postalCode: "90066",
        addressCountry: "US",
      },
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer service",
        email: "Legal@PawBucks.app",
        availableLanguage: ["English"],
      },
    },
  };

  const goSignup = () => navigate("/auth?role=pet_owner");
  const goDirectory = () => navigate("/directory");
  const goHome = () => navigate("/");

  return (
    <div className="pa-root">
      <SEO
        title="About PawBucks — Built for Pet People, by a Pet Person"
        description="PawBucks was built by a 15-year pet care veteran who wanted to keep money in the local pet economy. Learn our story, mission, and values."
        keywords={[...seoMeta.about.keywords]}
        canonical={seoMeta.about.canonical}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutSchema) }}
      />
      <style>{styles}</style>

      {/* NAV */}
      <nav className="pa-nav">
        <button className="pa-nav-logo" onClick={goHome} aria-label="PawBucks home">
          <img src={logo} alt="PawBucks" />
        </button>
        <div className="pa-nav-links">
          <button onClick={goHome}>Home</button>
          <button onClick={goDirectory}>Explore Merchants</button>
          <button onClick={() => navigate("/auth?role=pet_owner&mode=signin")}>Sign In</button>
          <button className="pa-nav-cta" onClick={goSignup}>Get Started</button>
        </div>
        <button className="pa-nav-cta pa-nav-mobile-cta" onClick={goSignup}>Get Started</button>
      </nav>

      {/* HERO */}
      <section className="pa-hero">
        <div className="pa-hero-inner">
          <div className="pa-hero-eyebrow">Our Story — Los Angeles, CA</div>
          <h1 className="pa-hero-title">
            Built for pet people,<br />
            <em>by a pet person.</em>
          </h1>
          <p className="pa-hero-sub">
            PawBucks started on a hiking trail in Los Angeles with a simple frustration:
            too many great pet businesses, too little visibility — and too much money
            flowing out of the local pet economy into big tech ad platforms that don't
            deliver.
          </p>
        </div>
      </section>

      {/* STORY */}
      <section className="pa-section pa-story">
        <div className="pa-story-inner">
          <div>
            <div className="pa-eyebrow">The Origin</div>
            <h2 className="pa-section-title">A business card problem that became a platform.</h2>
            <div className="pa-story-body">
              <p>
                After 15 years working in the pet care industry— running dog hikes, working
                alongside trainers, groomers, and vets — <strong>Jonathan Fields</strong> had
                collected more business cards than he could count. Fellow pet professionals,
                small operations doing incredible work, businesses his own clients would have
                loved.
              </p>
              <p>
                The problem? Out in the world, names slip your mind. Great businesses stayed
                invisible while ad budgets bought clicks that never became clients. Small
                pet businesses were bleeding cash to platforms that didn't understand their
                world.
              </p>
              <p>
                So Jonathan asked a simple question: why not build a digital directory of
                local pet merchants — and layer a rewards system on top? Something that
                gives pet owners a reason to discover and return to local businesses, and
                gives those businesses a way to grow without paying for ads that don't convert.
              </p>
              <p>
                <strong>That question became PawBucks.</strong>
              </p>
            </div>
          </div>
          <div className="pa-story-pull">
            <div className="pa-pull-quote">
              <div className="pa-pull-quote-text">
                "I've received countless business cards from pet professionals. But out in the world,
                <em> all of their names slip my mind.</em>"
              </div>
              <div className="pa-pull-quote-attr">Jonathan Fields — Founder, PawBucks</div>
            </div>
            <div className="pa-pull-quote" style={{ marginTop: '1.5rem' }}>
              <div className="pa-pull-quote-text">
                "Small pet businesses <em>bleed cash to big tech</em> for ads that don't convert to dollars."
              </div>
              <div className="pa-pull-quote-attr">The problem PawBucks was built to solve</div>
            </div>
          </div>
        </div>
      </section>

      {/* MISSION */}
      <section className="pa-section pa-mission">
        <div className="pa-eyebrow">Our Mission</div>
        <h2 className="pa-section-title">Money should stay in the local pet economy.</h2>
        <div className="pa-mission-inner">
          <div className="pa-mission-statement">
            We exist to empower pet owners with more spending power, and local pet
            businesses with the funds they need to scale — <em>without debt, without
            equity, without paying for ads that don't work.</em>
          </div>
          <div className="pa-mission-body">
            <p>
              PawBucks was built on a belief that the pet care industry deserves better
              than pay-per-click. Every dollar a small groomer or independent vet spends
              on Google Ads, Yelp, or Groupon is a dollar that leaves the local economy —
              often with nothing to show for it.
            </p>
            <p>
              Our <strong>3% success fee model</strong> flips that dynamic. We only earn
              when we deliver value. No upfront ad spend. No monthly retainers. No equity.
              Just a performance-aligned partnership between PawBucks and the businesses
              we serve.
            </p>
            <p>
              And on the other side of the transaction, pet owners earn real rewards on
              every dollar they spend on their animals — PawBucks they can redeem anywhere
              on the platform, turning everyday pet care into <strong>genuine spending power</strong>.
            </p>
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section className="pa-section pa-values">
        <div className="pa-eyebrow">What We Stand For</div>
        <h2 className="pa-section-title">Three values that drive every decision we make.</h2>
        <div className="pa-values-grid">
          <div className="pa-value-card">
            <span className="pa-value-icon">🤝</span>
            <h3 className="pa-value-name">Community</h3>
            <p className="pa-value-desc">
              PawBucks exists to strengthen the local pet economy. We believe the best pet
              care businesses are the ones your neighbors built — and they deserve a
              platform that works as hard as they do. Every feature we build is designed
              to keep money circulating locally.
            </p>
          </div>
          <div className="pa-value-card">
            <span className="pa-value-icon">🔍</span>
            <h3 className="pa-value-name">Transparency</h3>
            <p className="pa-value-desc">
              No hidden fees. No confusing multipliers. No surprise charges. Our 3%
              success fee applies only to the USD portion of transactions processed
              through the platform — and pet owners always know exactly what their
              PawBucks are worth. 1,000 PawBucks = $1. Always.
            </p>
          </div>
          <div className="pa-value-card">
            <PawBucksLogo className="pa-value-icon" />
            <h3 className="pa-value-name">Pet Life Cycle</h3>
            <p className="pa-value-desc">
              We think about the full life of a pet — from adoption through every stage
              of care. PawBucks connects pet owners with the right service at the right
              moment: training when they're young, nutrition as they grow, veterinary
              care as they age. We're here for the whole journey.
            </p>
          </div>
        </div>
      </section>

      {/* TRACTION */}
      <section className="pa-section pa-traction">
        <div className="pa-traction-inner">
          <div>
            <div className="pa-eyebrow">Where We Are Today</div>
            <h2 className="pa-section-title">Early days. Real proof.</h2>
            <p className="pa-section-sub">
              PawBucks hasn't officially launched yet — but the model is already working.
              Our first proving ground is Jonathan's own pet business,
              <strong> iHikeDogs LLC</strong>, giving us real transaction data before we
              open the platform to the world.
            </p>
          </div>
          <div>
            <div className="pa-stats-grid">
              <div className="pa-stat-card">
                <div className="pa-stat-num">$22,816</div>
                <div className="pa-stat-label">GMV processed through iHikeDogs LLC</div>
              </div>
              <div className="pa-stat-card">
                <div className="pa-stat-num">$465</div>
                <div className="pa-stat-label">Platform revenue from 3% success fee</div>
              </div>
              <div className="pa-stat-card">
                <div className="pa-stat-num">$365</div>
                <div className="pa-stat-label">PawBucks rewards distributed to pet owners</div>
              </div>
              <div className="pa-stat-card">
                <div className="pa-stat-num">8</div>
                <div className="pa-stat-label">Merchants signed up ahead of launch</div>
              </div>
            </div>
            <div className="pa-traction-note">
              <strong>Pre-launch, Los Angeles.</strong> These numbers represent early
              validation from a single merchant before the platform opens to the public.
              The 3% fee works. Rewards get distributed. The model is real.
            </div>
          </div>
        </div>
      </section>

      {/* FOUNDER */}
      <section className="pa-section pa-founder">
        <div className="pa-founder-inner">
          <div className="pa-founder-card">
            <img
              src={founderPhoto}
              alt="Jonathan Fields, Founder of PawBucks"
              className="pa-founder-avatar"
            />
            <div className="pa-founder-name">Jonathan Fields</div>
            <div className="pa-founder-title">Founder &amp; CEO, PawBucks</div>
            <div>
              <span className="pa-founder-tag">15+ Years in Pet Care</span>
            </div>
            <div>
              <span className="pa-founder-tag">Founder, iHikeDogs LLC</span>
            </div>
            <div>
              <span className="pa-founder-tag">Los Angeles, CA</span>
            </div>
            <a
              href="https://www.linkedin.com/in/jonathan-fields-1b611a177"
              target="_blank"
              rel="noopener noreferrer"
              className="pa-founder-linkedin"
            >
              Connect on LinkedIn →
            </a>
          </div>
          <div>
            <div className="pa-eyebrow">The Founder</div>
            <h2 className="pa-section-title">Built by someone who's lived it.</h2>
            <div className="pa-founder-bio">
              <p>
                <strong>Jonathan Fields</strong> has spent over 15 years working in the
                pet care industry — running dog hikes, building client relationships, and
                watching the business of pet care up close. His company,
                <strong> iHikeDogs LLC</strong>, has given him a front-row seat to both
                the joy and the economics of running a small pet business in Los Angeles.
              </p>
              <p>
                Over those 15 years, Jonathan collected business cards from hundreds of
                fellow pet professionals — groomers, trainers, veterinarians, boarding
                operators, pet store owners. People doing great work. Businesses that
                deserved more visibility than a Yelp listing and a hope.
              </p>
              <p>
                But out in the world, away from those moments of connection, names and
                details would slip. Great businesses stayed hard to find. And when he
                looked at how those same businesses were trying to solve their discovery
                problem — Google Ads, Yelp subscriptions, Groupon deals that gutted their
                margins — he saw a fundamental mismatch between what they were paying and
                what they were getting.
              </p>
              <p>
                PawBucks is his answer to that. <strong>A platform built from the inside
                out</strong> — by someone who knows what it costs to run a pet business,
                what pet owners actually need, and what a fair partnership between a
                platform and its users looks like.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ROADMAP */}
      <section className="pa-section pa-roadmap">
        <div className="pa-eyebrow">The Roadmap</div>
        <h2 className="pa-section-title">Two phases. One mission.</h2>
        <p className="pa-section-sub">
          We're building this deliberately — merchants first, then pet owners — so that
          when owners arrive, the platform is already full of businesses worth discovering.
        </p>
        <div className="pa-roadmap-track">
          <div className="pa-roadmap-phase">
            <div className="pa-phase-dot active">Q2</div>
            <div className="pa-phase-label">Active Now — 2025</div>
            <div className="pa-phase-title">Merchant Onboarding</div>
            <div className="pa-phase-desc">
              Signing up groomers, trainers, vets, pet stores, and pet brands across Los
              Angeles. Building the merchant network before pet owners arrive.
            </div>
          </div>
          <div className="pa-roadmap-phase">
            <div className="pa-phase-dot upcoming">Q3</div>
            <div className="pa-phase-label muted">Coming Soon — 2025</div>
            <div className="pa-phase-title">Pet Owner Launch</div>
            <div className="pa-phase-desc">
              Opening the platform to pet owners once a strong merchant network is in
              place. Los Angeles first — then expanding from there.
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pa-cta">
        <div className="pa-eyebrow">Join Us</div>
        <h2 className="pa-section-title">Be part of building something different.</h2>
        <p className="pa-section-sub">
          Whether you're a pet owner who wants real rewards, a local business that's tired
          of paying for ads that don't convert, or just someone who loves animals — there's
          a place for you in PawBucks.
        </p>
        <div className="pa-cta-btns">
          <button className="pa-btn-primary" onClick={goSignup}>Join as a Pet Owner</button>
          <button className="pa-btn-outline" onClick={() => navigate("/auth?role=merchant")}>List Your Business</button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="pa-footer">
        <div>© {new Date().getFullYear()} PawBucks, Inc. · Los Angeles, CA</div>
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", justifyContent: "center" }}>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/merchants">For Merchants</a>
          <a href="/vets">For Vets</a>
          <a href="mailto:Legal@PawBucks.app">Legal@PawBucks.app</a>
        </div>
      </footer>
    </div>
  );
};

export default About;