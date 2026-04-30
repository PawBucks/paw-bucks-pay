import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { seoMeta } from "@/lib/seoMeta";
import logo from "@/assets/logo.png";

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
  width: 100px; height: 100px; border-radius: 50%;
  background: var(--teal-pale);
  border: 3px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  font-size: 2.5rem; margin: 0 auto 1rem;
}
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
          <div className="pa-hero-eyebrow">Our Story</div>
          <h1 className="pa-hero-title">
            Built for pet people,<br />
            <em>by a pet person.</em>
          </h1>
          <p className="pa-hero-sub">
            PawBucks was born from 15 years inside the pet care industry — and a simple
            belief that every dollar spent on your pet should reward you, your pet, and
            the small businesses that care for them.
          </p>
        </div>
      </section>

      {/* STORY */}
      <section className="pa-section pa-story">
        <div className="pa-story-inner">
          <div>
            <div className="pa-eyebrow">The Origin</div>
            <h2 className="pa-section-title">A pet care veteran's frustration.</h2>
            <div className="pa-story-body">
              <p>
                After <strong>15 years</strong> grooming, walking, training, and caring for
                pets across Los Angeles, our founder kept seeing the same broken pattern:
                local pet businesses pouring everything into their craft, while customers
                drove past them to chain stores offering generic loyalty points that
                expired before anyone could use them.
              </p>
              <p>
                Meanwhile, pet parents were spending <strong>thousands a year</strong> on
                food, vet visits, grooming, and boarding — and getting almost nothing back.
                The few rewards programs that existed locked you into a single store.
              </p>
              <p>
                PawBucks was built to fix that. <strong>One wallet.</strong> One reward
                currency. Earned everywhere your pet is cared for, redeemable everywhere
                in the network. Real cashback for real spend.
              </p>
            </div>
          </div>
          <div className="pa-story-pull">
            <div className="pa-pull-quote">
              <div className="pa-pull-quote-text">
                "I built PawBucks because <em>local pet businesses deserve better</em> —
                and so do the people who love their pets enough to choose them."
              </div>
              <div className="pa-pull-quote-attr">— Founder, PawBucks</div>
            </div>
          </div>
        </div>
      </section>

      {/* MISSION */}
      <section className="pa-section pa-mission">
        <div className="pa-eyebrow">Our Mission</div>
        <h2 className="pa-section-title">Keep money in the local pet economy.</h2>
        <div className="pa-mission-inner">
          <div className="pa-mission-statement">
            We're building the rewards layer for the <em>independent pet economy</em> —
            so your favorite groomer, vet, and pet store can compete with the chains, and
            your loyalty actually pays you back.
          </div>
          <div className="pa-mission-body">
            <p>
              Every PawBuck earned is a small vote for a <strong>local business</strong>.
              Every PawBuck redeemed is a discount that came out of network economics — not
              the merchant's margin.
            </p>
            <p>
              We charge a transparent <strong>3% Success Fee</strong> on USD payments
              processed through the platform. That's it. No hidden cuts, no data sales, no
              surprise auto-renewals.
            </p>
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section className="pa-section pa-values">
        <div className="pa-eyebrow">What We Stand For</div>
        <h2 className="pa-section-title">Four values. No compromises.</h2>
        <div className="pa-values-grid">
          <div className="pa-value-card">
            <span className="pa-value-icon">🐾</span>
            <h3 className="pa-value-name">Pet-first decisions</h3>
            <p className="pa-value-desc">
              Every feature ships through one filter: does it make life better for the pet,
              the pet parent, or the people caring for them? If not, it doesn't ship.
            </p>
          </div>
          <div className="pa-value-card">
            <span className="pa-value-icon">🏪</span>
            <h3 className="pa-value-name">Local over chain</h3>
            <p className="pa-value-desc">
              We will always prioritize the independent groomer, vet, trainer, and pet
              store. Their margins are tighter; their care is closer.
            </p>
          </div>
          <div className="pa-value-card">
            <span className="pa-value-icon">🔍</span>
            <h3 className="pa-value-name">Radical transparency</h3>
            <p className="pa-value-desc">
              Our fees are public. Our reward math is public. Our expiration rules are
              public. If we can't explain it on a single page, we don't do it.
            </p>
          </div>
        </div>
      </section>

      {/* TRACTION */}
      <section className="pa-section pa-traction">
        <div className="pa-traction-inner">
          <div>
            <div className="pa-eyebrow">Where We Are</div>
            <h2 className="pa-section-title">Early. Focused. Real.</h2>
            <p className="pa-section-sub">
              We're a young company building carefully. Every merchant onboarded is
              hand-verified. Every pet parent gets a real welcome credit. No vanity
              metrics — just the work.
            </p>
          </div>
          <div>
            <div className="pa-stats-grid">
              <div className="pa-stat-card">
                <div className="pa-stat-num">15+</div>
                <div className="pa-stat-label">Years of pet industry experience behind the platform</div>
              </div>
              <div className="pa-stat-card">
                <div className="pa-stat-num">100%</div>
                <div className="pa-stat-label">Merchant reimbursement on PawBucks redemptions</div>
              </div>
              <div className="pa-stat-card">
                <div className="pa-stat-num">3%</div>
                <div className="pa-stat-label">Flat Success Fee — never hidden, never raised silently</div>
              </div>
              <div className="pa-stat-card">
                <div className="pa-stat-num">0</div>
                <div className="pa-stat-label">Customer data sold to third parties. Ever.</div>
              </div>
            </div>
            <div className="pa-traction-note">
              <strong>What we're focused on right now:</strong> onboarding the best local
              pet businesses in our launch markets, paying out merchants fast, and proving
              that a fair rewards network can outcompete chain loyalty programs.
            </div>
          </div>
        </div>
      </section>

      {/* FOUNDER */}
      <section className="pa-section pa-founder">
        <div className="pa-founder-inner">
          <div className="pa-founder-card">
            <div className="pa-founder-avatar">🐶</div>
            <div className="pa-founder-name">The Founder</div>
            <div className="pa-founder-title">Founder &amp; CEO, PawBucks Inc.</div>
            <div>
              <span className="pa-founder-tag">15 yrs in pet care</span>
            </div>
            <div>
              <span className="pa-founder-tag">Los Angeles, CA</span>
            </div>
          </div>
          <div>
            <div className="pa-eyebrow">Who's Behind This</div>
            <h2 className="pa-section-title">A decade and a half in the trenches.</h2>
            <div className="pa-founder-bio">
              <p>
                Before PawBucks, our founder spent <strong>15 years</strong> on the floor
                of the pet industry — grooming tables, training fields, boarding kennels,
                vet front desks. Not as an investor. Not as a consultant. As the person
                handing the leash back to the owner.
              </p>
              <p>
                That experience shaped everything about PawBucks: how merchants get paid,
                how PawBucks expire, why we refuse to sell customer data, and why every
                line of copy tries to read like a real person wrote it — because one did.
              </p>
              <p>
                <strong>This isn't a tech company that discovered pets.</strong> It's a
                pet company that built the technology it always wished existed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ROADMAP */}
      <section className="pa-section pa-roadmap">
        <div className="pa-eyebrow">What's Next</div>
        <h2 className="pa-section-title">The road ahead.</h2>
        <p className="pa-section-sub">A focused roadmap. No moonshots — just real things, shipped well.</p>
        <div className="pa-roadmap-track">
          <div className="pa-roadmap-phase">
            <div className="pa-phase-dot done">✓</div>
            <div className="pa-phase-label">Phase 1 · Done</div>
            <div className="pa-phase-title">Launch the wallet</div>
            <div className="pa-phase-desc">
              Earn-and-redeem live across local merchants, with PawPass tiers and a real
              cashback economy.
            </div>
          </div>
          <div className="pa-roadmap-phase">
            <div className="pa-phase-dot active">2</div>
            <div className="pa-phase-label">Phase 2 · Now</div>
            <div className="pa-phase-title">Deepen the network</div>
            <div className="pa-phase-desc">
              More verified vets, groomers, and trainers. Booking, messaging, and lost-pet
              tools built into one app.
            </div>
          </div>
          <div className="pa-roadmap-phase">
            <div className="pa-phase-dot upcoming">3</div>
            <div className="pa-phase-label muted">Phase 3 · Soon</div>
            <div className="pa-phase-title">A real pet OS</div>
            <div className="pa-phase-desc">
              Health records, financing, and pet-life planning — all paid for in part by
              the rewards you've already earned.
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pa-cta">
        <div className="pa-eyebrow">Join Us</div>
        <h2 className="pa-section-title">Get rewarded for loving your pet.</h2>
        <p className="pa-section-sub">
          Free to start. New members get a welcome credit. No credit card required.
        </p>
        <div className="pa-cta-btns">
          <button className="pa-btn-primary" onClick={goSignup}>Create free account</button>
          <button className="pa-btn-outline" onClick={goDirectory}>Browse merchants</button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="pa-footer">
        <div>© {new Date().getFullYear()} PawBucks, Inc. · Los Angeles, CA</div>
        <div style={{ display: "flex", gap: "1.5rem" }}>
          <a href="mailto:Legal@PawBucks.app">Legal@PawBucks.app</a>
          <button onClick={() => navigate("/privacy")}>Privacy</button>
          <button onClick={() => navigate("/terms")}>Terms</button>
        </div>
      </footer>
    </div>
  );
};

export default About;