import { Link } from "react-router-dom";
import { SEO, createFAQSchema } from "@/components/SEO";
import { MapPin } from "lucide-react";
import "./WellnessPlansGuide.css";
import pawbucksLogo from "@/assets/logo.png";
import { useAuth } from "@/hooks/useAuth";

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Veterinary Wellness Plans vs. Traditional Care: A Cost-Saving Guide",
  description:
    "Compare veterinary wellness plans to pay-per-visit traditional vet care. See how wellness plans, low-cost vet clinics, and PawBucks rewards make quality pet care more affordable.",
  author: { "@type": "Organization", name: "PawBucks" },
  publisher: {
    "@type": "Organization",
    name: "PawBucks",
    logo: { "@type": "ImageObject", url: "https://pawbucks.app/logo.png" },
  },
  datePublished: "2026-06-13",
  dateModified: "2026-08-30",
  mainEntityOfPage: "https://pawbucks.app/guides/wellness-plans-comparison",
};

const faqs = [
  {
    question: "What is a veterinary wellness plan?",
    answer:
      "A veterinary wellness plan is a recurring monthly subscription from a vet clinic that bundles preventive care — annual exams, vaccinations, fecal and heartworm tests, and dental cleanings — into a predictable monthly payment instead of large one-off bills.",
  },
  {
    question: "How is a wellness plan different from pet insurance?",
    answer:
      "Wellness plans cover scheduled preventive care (exams, vaccines, screenings). Pet insurance reimburses you for unexpected accidents and illnesses. Most owners who want full protection pair the two — a wellness plan for the predictable care and insurance for emergencies.",
  },
  {
    question: "Are wellness plans cheaper than paying per visit?",
    answer:
      "For owners who keep up with annual exams, vaccines, and dental cleanings, wellness plans typically save 10–25% versus paying à la carte — and the monthly billing makes routine care affordable without a surprise $400+ vet bill.",
  },
  {
    question: "How do PawBucks rewards make wellness plans more affordable?",
    answer:
      "Every wellness plan payment made through a PawBucks partner vet earns PawBucks rewards (10–30 PB per $1 depending on your tier). Those rewards can be redeemed on future visits, pet store purchases, grooming, and other services — effectively giving you cashback on care you were going to pay for anyway.",
  },
  {
    question: "Can I find a low-cost vet clinic or wellness clinic on PawBucks?",
    answer:
      "Yes. PawBucks Discover lets you search verified local vets, low-cost wellness clinics, and partner practices that offer wellness plans — filtered by location, services, and the rewards they offer.",
  },
];

const WellnessPlansGuide = () => {
  const { user } = useAuth();

  return (
    <div className="wpg-page">
      <SEO
        title="Veterinary Wellness Plans vs. Traditional Care: Cost-Saving Guide"
        description="Compare vet wellness plans to traditional pay-per-visit care. See costs, what's covered, and how PawBucks rewards bridge affordability with quality pet care."
        canonical="/guides/wellness-plans-comparison"
        type="article"
        keywords={[
          "veterinary wellness plans",
          "wellness clinic",
          "low cost vet clinic",
          "affordable pet care",
          "vet wellness plan vs pet insurance",
          "pet care rewards",
          "PawBucks rewards",
        ]}
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Guides", url: "/guides" },
          { name: "Wellness Plans vs Traditional Care", url: "/guides/wellness-plans-comparison" },
        ]}
        jsonLd={{ ...articleSchema, faq: createFAQSchema(faqs) }}
      />

      <nav className="nav">
        <Link to="/" className="nav-logo" aria-label="PawBucks home">
          <img src={pawbucksLogo} alt="PawBucks" className="nav-logo-img" />
        </Link>
        <div className="nav-right">
          {user ? (
            <Link to="/dashboard" className="nav-cta">Dashboard</Link>
          ) : (
            <>
              <Link to="/merchants" className="nav-link">Merchants</Link>
              <Link to="/auth" className="nav-cta">Join Free</Link>
            </>
          )}
        </div>
      </nav>

      <div className="breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to="/community">Guides</Link>
        <span>/</span>
        Wellness Plans vs Traditional Care
      </div>

      <section className="hero">
        <div className="hero-eyebrow">🩺 Pet Care Guide</div>
        <h1>Veterinary Wellness Plans vs. Traditional Care: A Cost-Saving Guide</h1>
        <p className="hero-sub">
          Routine vet visits, vaccines, and dental cleanings add up fast. Here's how wellness
          plans, low-cost vet clinics, and PawBucks rewards compare — and how to pick the right
          mix for your pet and your budget.
        </p>
        <div className="hero-actions">
          <Link to="/discover" className="btn-hero-primary">❤️ Find a Partner Vet</Link>
          {!user && <Link to="/auth" className="btn-hero-outline">Sign Up to Earn PawBucks</Link>}
        </div>
        <div className="section-nav">
          <a href="#what-is-it" className="section-pill">🩺 What Is It</a>
          <a href="#comparison" className="section-pill">⚖️ Comparison</a>
          <a href="#low-cost" className="section-pill">💊 Low-Cost Clinics</a>
          <a href="#rewards" className="section-pill">🐾 PawBucks Rewards</a>
          <a href="#when-to-pick" className="section-pill">✅ When to Pick Which</a>
          <a href="#faq" className="section-pill">❓ FAQ</a>
        </div>
      </section>

      <div className="earn-banner">
        <div className="eb-icon">💰</div>
        <div className="eb-text">
          <strong>PawBucks rewards make vet care more affordable.</strong> Every wellness plan
          payment at a partner vet earns 10–30 PawBucks per $1 — redeemable on future care,
          grooming, and pet store purchases.
        </div>
      </div>

      <main className="content">
        <section id="what-is-it" className="guide-section">
          <div className="section-header">
            <div className="section-icon">🩺</div>
            <h2>What Is a Veterinary Wellness Plan?</h2>
          </div>
          <p className="prose">
            A veterinary wellness plan is a recurring monthly subscription from a vet clinic that
            bundles preventive care — annual exams, vaccinations, fecal and heartworm tests, and
            dental cleanings — into a predictable monthly payment instead of large one-off bills.
          </p>
          <p className="prose">
            A typical plan covers annual exams, core vaccines, heartworm and fecal testing, a
            dental cleaning, and sometimes discounts on unexpected visits. Instead of paying
            <strong> $300–$600 once a year</strong>, you pay a flat monthly fee — usually
            <strong> $25–$75</strong> depending on your pet.
          </p>
          <div className="info-card">
            <h3>What a typical wellness plan includes</h3>
            <p>
              Annual wellness exam · Core vaccines (rabies, DHPP, bordetella) · Heartworm &
              fecal testing · One dental cleaning per year · Discounts on sick visits and
              prescriptions · Sometimes: flea/tick prevention
            </p>
          </div>
        </section>

        <section id="comparison" className="guide-section">
          <div className="section-header">
            <div className="section-icon">⚖️</div>
            <h2>Wellness Plan vs. Traditional Pay-Per-Visit</h2>
          </div>
          <p className="prose">
            Traditional care means you pay for each service the day of the visit. It's simple, but
            it can leave you skipping routine care to avoid the bill — which often costs more
            long-term as small issues become big ones.
          </p>
          <div className="comparison-grid">
            <div className="compare-card featured">
              <div className="compare-card-header">
                <span className="cc-icon">🩺</span>
                <h3>Wellness Plan</h3>
                <span className="cc-badge">Recommended</span>
              </div>
              <ul className="feature-list">
                <li><span className="fi-icon yes">✓</span> Predictable monthly payment ($25–$75)</li>
                <li><span className="fi-icon yes">✓</span> Routine exams, vaccines, dental cleaning included</li>
                <li><span className="fi-icon yes">✓</span> Discounts on sick visits and prescriptions</li>
                <li><span className="fi-icon yes">✓</span> Saves ~10–25% vs paying per visit</li>
                <li><span className="fi-icon yes">✓</span> Earns PawBucks rewards at partner vets</li>
                <li><span className="fi-icon no">✗</span> Does not cover accidents or emergencies</li>
              </ul>
            </div>
            <div className="compare-card">
              <div className="compare-card-header">
                <span className="cc-icon">💵</span>
                <h3>Traditional Pay-Per-Visit</h3>
              </div>
              <ul className="feature-list">
                <li><span className="fi-icon yes">✓</span> No long-term commitment</li>
                <li><span className="fi-icon yes">✓</span> Pick and choose services</li>
                <li><span className="fi-icon no">✗</span> Annual exam + vaccines can be $300–$600 at once</li>
                <li><span className="fi-icon no">✗</span> Easy to skip preventive care to save money</li>
                <li><span className="fi-icon no">✗</span> No bundled discount on dental cleanings</li>
                <li><span className="fi-icon no">✗</span> Skipping care often leads to larger bills later</li>
              </ul>
            </div>
          </div>
          <div className="info-card">
            <h3>💡 Wellness plan vs. pet insurance — what's the difference?</h3>
            <p>
              Wellness plans cover scheduled preventive care (exams, vaccines, screenings). Pet
              insurance reimburses you for unexpected accidents and illnesses. Most owners who want
              full protection pair the two — a wellness plan for the predictable care and insurance
              for emergencies.
            </p>
          </div>
        </section>

        <section id="low-cost" className="guide-section">
          <div className="section-header">
            <div className="section-icon">💊</div>
            <h2>What About Low-Cost Vet Clinics?</h2>
          </div>
          <p className="prose">
            Low-cost vet clinics and community wellness clinics — including nonprofits and mobile
            vaccination clinics — focus on essential preventive care at reduced prices. They're a
            great fit for healthy adult pets that mostly need vaccines, heartworm testing, and
            routine exams.
          </p>
          <p className="prose">
            For more complex care, a full-service clinic with a wellness plan usually offers better
            continuity. Many PawBucks partner vets blend both: low-cost wellness packages with the
            option to add specialty services as your pet ages.
          </p>
          <div className="info-card">
            <h3>When a low-cost clinic makes sense</h3>
            <p>
              Healthy adult pet with no chronic conditions · Budget-conscious owner focused on
              essentials · Vaccines, heartworm testing, and routine exams only · Supplemented by
              PawBucks rewards to offset costs
            </p>
          </div>
        </section>

        <section id="rewards" className="guide-section">
          <div className="section-header">
            <div className="section-icon">🐾</div>
            <h2>How PawBucks Rewards Bridge Quality Care & Affordability</h2>
          </div>
          <p className="prose">
            PawBucks rewards earn back a percentage of every dollar you spend at partner vets,
            groomers, and pet stores. Pay your monthly wellness plan through a PawBucks partner vet
            and you earn <strong>10–30 PawBucks per $1</strong> depending on your tier.
          </p>
          <div className="rewards-steps">
            <div className="reward-step">
              <div className="step-num">1</div>
              <div className="step-info">
                <h3>Pay your wellness plan monthly</h3>
                <p>Process your $25–$75 monthly wellness plan payment through your PawBucks partner vet.</p>
                <span className="step-highlight">Earn 10–30 PawBucks per $1 spent</span>
              </div>
            </div>
            <div className="reward-step">
              <div className="step-num">2</div>
              <div className="step-info">
                <h3>Rewards stack across all PawBucks merchants</h3>
                <p>PawBucks earned at the vet can be redeemed at groomers, pet stores, dog walkers — any partner merchant.</p>
                <span className="step-highlight">Redeem across the full ecosystem</span>
              </div>
            </div>
            <div className="reward-step">
              <div className="step-num">3</div>
              <div className="step-info">
                <h3>Effective cashback on care you'd pay for anyway</h3>
                <p>A $50/month wellness plan at the PawPass+ tier earns $5–$15 back every month on top of the plan's bundled discount.</p>
                <span className="step-highlight">$5–$15/month effective savings</span>
              </div>
            </div>
          </div>

          <div className="savings-callout">
            <div className="sc-eyebrow">💰 Annual Savings Estimate</div>
            <h3>A typical PawBucks pet owner saves $200–$500 per year</h3>
            <p>
              Combined wellness plan discounts and PawBucks cashback — without skipping the
              preventive visits that keep pets healthy and future bills low.
            </p>
            <div className="savings-stat">
              <span className="ss-amount">$200–$500</span>
              <span className="ss-label">saved per year vs traditional care</span>
            </div>
            <div>
              <Link to="/discover" className="sc-btn">❤️ Find a Partner Vet Near You</Link>
            </div>
          </div>
        </section>

        <section id="when-to-pick" className="guide-section">
          <div className="section-header">
            <div className="section-icon">✅</div>
            <h2>When to Pick Which</h2>
          </div>
          <div className="pick-grid">
            <div className="pick-card">
              <div className="pick-icon">🐶</div>
              <div className="pick-info">
                <h3>Puppy or kitten</h3>
                <p>Wellness plan — high volume of vaccines and checkups in year one makes a bundled plan the clear winner financially.</p>
              </div>
            </div>
            <div className="pick-card">
              <div className="pick-icon">🐾</div>
              <div className="pick-info">
                <h3>Senior pet</h3>
                <p>Wellness plan + pet insurance — more frequent screenings plus emergency coverage as your pet ages into higher-risk years.</p>
              </div>
            </div>
            <div className="pick-card">
              <div className="pick-icon">💊</div>
              <div className="pick-info">
                <h3>Healthy adult, tight budget</h3>
                <p>Low-cost wellness clinic + PawBucks rewards for the essentials. Cover the basics affordably and let rewards reduce the net cost.</p>
              </div>
            </div>
            <div className="pick-card">
              <div className="pick-icon">🏠</div>
              <div className="pick-info">
                <h3>Multi-pet household</h3>
                <p>Wellness plans per pet at a PawBucks partner — the rewards stack across pets, making each plan incrementally cheaper in real terms.</p>
              </div>
            </div>
          </div>

          <div className="earn-card">
            <h3>Find a Wellness-Plan Vet Near You & Start Earning PawBucks</h3>
            <p>Browse verified local vets and wellness clinics, then earn rewards every time you pay for care.</p>
            <Link to="/discover" className="ec-btn">❤️ Find a Partner Vet</Link>
          </div>
        </section>

        <section id="faq" className="faq-section">
          <h2>Frequently Asked Questions</h2>
          <div className="faq-list">
            {faqs.map((f) => (
              <div key={f.question} className="faq-card">
                <h3>{f.question}</h3>
                <p>{f.answer}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <section className="footer-cta">
        <h2>Start Earning on Every Vet Visit</h2>
        <p>Join PawBucks free and earn rewards at partner vets, groomers, and pet stores across West LA.</p>
        {user ? (
          <Link to="/discover" className="fc-btn">❤️ Discover Partner Vets</Link>
        ) : (
          <Link to="/auth" className="fc-btn">🐾 Create Your Free Account</Link>
        )}
      </section>

      <footer className="footer-nav">
        <div className="fn-logo">
          <img src={pawbucksLogo} alt="PawBucks" className="fn-logo-img" />
        </div>
        <p>Stronger Pets. Happier People. Stronger Community.</p>
        <p>Santa Monica · Venice · Mar Vista · Marina Del Rey · Culver City · Westchester</p>
      </footer>
    </div>
  );
};

export default WellnessPlansGuide;
