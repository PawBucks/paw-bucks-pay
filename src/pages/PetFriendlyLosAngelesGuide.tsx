import { Link } from "react-router-dom";
import { SEO, createFAQSchema } from "@/components/SEO";
import { MapPin } from "lucide-react";
import "./PetFriendlyLosAngelesGuide.css";
import pawbucksLogo from "@/assets/logo.png";
import { useGuideContent, type GuidePlace } from "@/hooks/useGuideContent";
import { useAuth } from "@/hooks/useAuth";

const GUIDE_SLUG = "pet-friendly-los-angeles";

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Pet-Friendly Los Angeles: Best Dog Parks, Cafes & Events (2026)",
  description:
    "A local guide to pet-friendly Los Angeles: the best off-leash dog parks, dog-welcome cafes and patios, hiking trails, beaches, and events your dog will love.",
  author: { "@type": "Organization", name: "PawBucks" },
  publisher: {
    "@type": "Organization",
    name: "PawBucks",
    logo: { "@type": "ImageObject", url: "https://pawbucks.app/logo.png" },
  },
  datePublished: "2026-07-01",
  dateModified: "2026-07-01",
  mainEntityOfPage: "https://pawbucks.app/guides/pet-friendly-los-angeles",
};

const PlaceCard = ({ p }: { p: GuidePlace }) => (
  <div className="place-card">
    <div className="place-card-top">
      <h3>{p.name}</h3>
      {p.tag_label && <span className={`place-tag ${p.tag ?? ""}`}>{p.tag_label}</span>}
    </div>
    <div className="place-location">
      <MapPin size={12} strokeWidth={2.5} />
      {p.area}
    </div>
    <p className="place-desc">{p.description}</p>
    {p.tip && (
      <div className="place-tip">
        <span className="tip-icon">{p.tip_icon ?? "💡"}</span>
        <span>{p.tip}</span>
      </div>
    )}
  </div>
);

const PetFriendlyLosAngelesGuide = () => {
  const { parks, beaches, cafes, events, faqs, merchants, loading } = useGuideContent(GUIDE_SLUG);
  return (
    <div className="pfla-page">
      <SEO
        title="Pet-Friendly Los Angeles: Best Dog Parks, Cafes & Events"
        description="A local guide to pet-friendly Los Angeles: top off-leash dog parks, dog-welcome cafes and patios, hiking trails, beaches, and events for you and your dog."
        canonical="/guides/pet-friendly-los-angeles"
        type="article"
        keywords={[
          "pet friendly things to do los angeles",
          "best dog parks in LA",
          "dog friendly cafes los angeles",
          "pet friendly restaurants LA",
          "dog beaches near Los Angeles",
          "LA dog events",
          "pet friendly hikes Los Angeles",
        ]}
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Guides", url: "/guides" },
          { name: "Pet-Friendly Los Angeles", url: "/guides/pet-friendly-los-angeles" },
        ]}
        jsonLd={{ ...articleSchema, faq: createFAQSchema(faqs.map((f) => ({ question: f.question, answer: f.answer }))) }}
      />

      <nav className="nav">
        <Link to="/" className="nav-logo" aria-label="PawBucks home">
          <img src={pawbucksLogo} alt="PawBucks" className="nav-logo-img" />
        </Link>
        <div className="nav-right">
          <Link to="/merchants" className="nav-link">Merchants</Link>
          <Link to="/auth" className="nav-cta">Join Free</Link>
        </div>
      </nav>

      <div className="breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to="/community">Guides</Link>
        <span>/</span>
        Pet-Friendly Los Angeles
      </div>

      <section className="hero">
        <div className="hero-eyebrow">🗺️ Local Guide</div>
        <h1>Pet-Friendly Los Angeles: Dog Parks, Cafes, Trails &amp; Events</h1>
        <p className="hero-sub">
          Everything you need to plan a great day out with your dog in LA — from Runyon Canyon
          to Rosie's Dog Beach, plus the patios, hikes, and events locals actually use.
        </p>
        <div className="hero-actions">
          <Link to="/discover" className="btn-hero-primary">🐾 Discover LA Pet Merchants</Link>
          <Link to="/auth" className="btn-hero-outline">Create a free account</Link>
        </div>
        <div className="section-nav">
          <a href="#parks" className="section-pill">🌳 Dog Parks</a>
          <a href="#beaches" className="section-pill">🏖️ Beaches &amp; Trails</a>
          <a href="#cafes" className="section-pill">☕ Cafes &amp; Patios</a>
          <a href="#events" className="section-pill">📅 Events</a>
          <a href="#faq" className="section-pill">❓ FAQ</a>
        </div>
      </section>

      <div className="earn-banner">
        <div className="eb-icon">💰</div>
        <div className="eb-text">
          <strong>Earn PawBucks on your pet outings.</strong> Book grooming, boarding, day care,
          training, or vet visits through PawBucks partner merchants in LA and earn 10–30
          PawBucks per $1 spent.
        </div>
      </div>

      <main className="content">
        <section id="parks" className="guide-section">
          <div className="section-header">
            <div className="section-icon">🌳</div>
            <h2>Best Off-Leash Dog Parks in LA</h2>
          </div>
          <div className="place-list">
            {loading && parks.length === 0 ? <div className="place-desc">Loading…</div> : parks.map((p) => <PlaceCard key={p.id} p={p} />)}
          </div>
        </section>

        <section id="beaches" className="guide-section">
          <div className="section-header">
            <div className="section-icon">🏖️</div>
            <h2>Beaches &amp; Hiking Trails</h2>
          </div>
          <div className="place-list">
            {beaches.map((p) => <PlaceCard key={p.id} p={p} />)}
          </div>
        </section>

        <div className="earn-card">
          <h3>Earn PawBucks on Your LA Pet Outings</h3>
          <p>
            Book grooming, boarding, training, day care, or vet visits at PawBucks partner
            merchants across Los Angeles and earn 10–30 PawBucks per $1 — then redeem on future
            pet care and the PawBucks Marketplace.
          </p>
          <Link to="/discover" className="ec-btn">🐾 Discover LA Pet Merchants</Link>
        </div>

        {merchants.length > 0 && (
          <section id="partners" className="guide-section">
            <div className="section-header">
              <div className="section-icon">🐾</div>
              <h2>Featured PawBucks Partner Merchants in LA</h2>
            </div>
            <div className="place-list">
              {merchants.map((m) => (
                <Link
                  key={m.id}
                  to={m.storefront_slug ? `/m/${m.storefront_slug}` : `/discover`}
                  className="place-card"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div className="place-card-top">
                    <h3>{m.business_name}</h3>
                    {m.cashback_rate ? (
                      <span className="place-tag partner">{Math.round(Number(m.cashback_rate) * 100)}% back</span>
                    ) : (
                      <span className="place-tag partner">Partner</span>
                    )}
                  </div>
                  <div className="place-location">
                    <MapPin size={12} strokeWidth={2.5} />
                    {m.address || m.business_type.replace(/_/g, " ")}
                  </div>
                  {m.description && <p className="place-desc">{m.description}</p>}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section id="cafes" className="guide-section">
          <div className="section-header">
            <div className="section-icon">☕</div>
            <h2>Dog-Friendly Cafes &amp; Patios</h2>
          </div>
          <div className="place-list">
            {cafes.map((p) => <PlaceCard key={p.id} p={p} />)}
          </div>
        </section>

        <section id="events" className="guide-section">
          <div className="section-header">
            <div className="section-icon">📅</div>
            <h2>Recurring Pet Events in LA</h2>
          </div>
          <div className="place-list">
            {events.map((p) => <PlaceCard key={p.id} p={p} />)}
          </div>
        </section>

        <section id="faq" className="faq-section">
          <h2>Frequently Asked Questions</h2>
          <div className="faq-list">
            {faqs.map((f) => (
              <div key={f.id} className="faq-card">
                <h3>{f.question}</h3>
                <p>{f.answer}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <section className="footer-cta">
        <h2>Ready to Earn on Every Pet Outing?</h2>
        <p>Join PawBucks free and start earning rewards at local pet merchants across West LA.</p>
        <Link to="/auth" className="fc-btn">🐾 Create Your Free Account</Link>
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

export default PetFriendlyLosAngelesGuide;