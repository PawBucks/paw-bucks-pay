import { Link } from "react-router-dom";
import { SEO, createFAQSchema } from "@/components/SEO";
import { MapPin } from "lucide-react";

const faqs = [
  {
    question: "What are the best off-leash dog parks in Los Angeles?",
    answer:
      "Runyon Canyon (Hollywood), Silver Lake Dog Park, Griffith Park's off-leash area near John Ferraro Soccer Field, Hermon Dog Park (Highland Park), and Sepulveda Basin Off-Leash Dog Park (Encino) are consistently the most-loved off-leash dog parks in LA.",
  },
  {
    question: "Are there pet-friendly beaches near Los Angeles?",
    answer:
      "Yes. Rosie's Dog Beach in Long Beach is the closest fully off-leash beach. Leo Carrillo State Beach (Malibu) allows leashed dogs on the north end, and Huntington Dog Beach (about an hour south) is a favorite weekend trip.",
  },
  {
    question: "Which LA cafes and restaurants allow dogs on the patio?",
    answer:
      "Lady & Larder (Santa Monica), Alfred Coffee (multiple), Dog Haus, Lazy Dog Restaurant, Blue Bottle Coffee patios, and most Café Gratitude locations welcome leashed dogs on outdoor patios. Always call ahead to confirm current policy.",
  },
  {
    question: "Where can I find pet-friendly events in Los Angeles?",
    answer:
      "Pup-ups at Rose Bowl Flea Market, Yappy Hour at The Fairmont Miramar, Wags & Whiskers at Silver Lake Reservoir, and seasonal Bark in the Park nights at Dodger Stadium. PawBucks Discover surfaces upcoming pet events from local merchants and partners.",
  },
  {
    question: "How do I earn PawBucks on pet outings in LA?",
    answer:
      "Book grooming, boarding, day care, training, or vet visits through PawBucks partner merchants in Los Angeles to earn 10–30 PawBucks per $1 spent. Redeem those rewards on future pet care, treats, or the PawBucks Marketplace.",
  },
];

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

type Tag = "off-leash" | "leashed" | "partner" | "free" | "monthly";
type Place = { name: string; area: string; desc: string; tag?: Tag; tagLabel?: string; tip?: string; tipIcon?: string };

const dogParks: Place[] = [
  { name: "Runyon Canyon Park", area: "Hollywood Hills", tag: "off-leash", tagLabel: "Off-Leash", desc: "Iconic off-leash hike with sweeping city views — one of LA's most beloved spots for dogs and their people.", tip: "Go early — parking fills fast on weekends, and the trail gets crowded after 9am.", tipIcon: "💡" },
  { name: "Silver Lake Dog Park", area: "Silver Lake", tag: "off-leash", tagLabel: "Off-Leash", desc: "Fenced and shaded with a separate small-dog area. A reliable neighborhood favorite with a social atmosphere.", tip: "Best mid-morning on weekdays before it gets crowded.", tipIcon: "💡" },
  { name: "Griffith Park Off-Leash Area", area: "Los Feliz", tag: "off-leash", tagLabel: "Off-Leash", desc: "Large open field near John Ferraro Soccer Field — great for high-energy dogs who need room to run." },
  { name: "Barrington Dog Park", area: "Brentwood", tag: "off-leash", tagLabel: "Off-Leash", desc: "Popular Westside pick with separate small and large dog enclosures. Well maintained and close to Santa Monica." },
  { name: "Sepulveda Basin Off-Leash Park", area: "Encino", tag: "off-leash", tagLabel: "Off-Leash", desc: "One of the largest off-leash areas in LA — perfect for weekend zoomies and dogs who need serious space." },
];

const beachesAndTrails: Place[] = [
  { name: "Rosie's Dog Beach", area: "Long Beach", tag: "off-leash", tagLabel: "Off-Leash", desc: "The nearest fully off-leash beach to LA — a must-visit day trip. Dogs can run, swim, and socialize freely.", tip: "Bring fresh water — the salt and sun tire dogs out fast.", tipIcon: "💡" },
  { name: "Leo Carrillo State Beach", area: "Malibu", tag: "leashed", tagLabel: "Leashed", desc: "Leashed dogs welcome on the north end of the beach. Scenic coastal setting with sea caves and tide pools nearby." },
  { name: "Fryman Canyon Trail", area: "Studio City", tag: "leashed", tagLabel: "Leashed", desc: "Shaded 3-mile loop trail popular with leashed dogs. Cooler than most LA hikes thanks to the tree canopy.", tip: "Packed on weekend mornings — arrive before 8am for a peaceful experience.", tipIcon: "💡" },
  { name: "Kenneth Hahn Park Trails", area: "Baldwin Hills", tag: "leashed", tagLabel: "Leashed", desc: "Great views, dog-friendly leashed trails, and a dedicated dog park within the larger park. A hidden gem on the Westside." },
  { name: "Elysian Park", area: "Echo Park", tag: "leashed", tagLabel: "Leashed", desc: "Miles of paths perfect for morning walks with your dog. Quieter than Runyon, with genuine neighborhood character." },
];

const cafes: Place[] = [
  { name: "Alfred Coffee", area: "Melrose Place · Silver Lake · Brentwood", tag: "partner", tagLabel: "Dog Welcome", desc: "Iconic dog-welcoming patios across the city. Known for their specialty coffee and genuinely relaxed outdoor seating." },
  { name: "Lady & Larder", area: "Santa Monica", tag: "partner", tagLabel: "Dog Welcome", desc: "Cheese boards and pastries with a shaded dog-friendly patio. One of the best spots on the Westside for a leisurely afternoon." },
  { name: "Dog Haus", area: "Multiple locations", tag: "partner", tagLabel: "Dog Welcome", desc: "Hot dogs for you, water bowls for your pup. Multiple LA locations with consistent dog-friendly outdoor seating." },
  { name: "Lazy Dog Restaurant", area: "Torrance · Woodland Hills", tag: "partner", tagLabel: "Dog Menu", desc: "Full dog menu on the patio — grilled chicken, brown rice, and more. One of the most genuinely dog-forward restaurants in LA.", tip: "Dogs eat here too — not just tolerated on the patio.", tipIcon: "🐾" },
  { name: "Blue Bottle Coffee", area: "Abbot Kinney · DTLA · Larchmont", tag: "partner", tagLabel: "Dog Welcome", desc: "Leashed dogs welcome on outdoor seating at all LA locations. The Abbot Kinney spot is especially spacious and relaxed." },
  { name: "Café Gratitude", area: "Larchmont · Venice", tag: "partner", tagLabel: "Dog Welcome", desc: "Plant-based menu with generous patio space for dogs. The Venice location is particularly popular with West LA dog owners.", tip: "Always call ahead to confirm current patio policy at any venue.", tipIcon: "💡" },
];

const events: Place[] = [
  { name: "Yappy Hour at Fairmont Miramar", area: "Santa Monica", tag: "monthly", tagLabel: "Monthly", desc: "Monthly dog-friendly cocktail hour on the terrace of one of Santa Monica's best hotels. A genuinely upscale outing with your pup." },
  { name: "Bark in the Park Night", area: "Dodger Stadium", tag: "monthly", tagLabel: "Seasonal", desc: "Bring your dog to select summer home games. A bucket-list experience for sports fans and dog owners alike.", tip: "Tickets sell out quickly — watch Dodgers social channels for announcements.", tipIcon: "💡" },
  { name: "Rose Bowl Flea Market Pup-Ups", area: "Pasadena", tag: "monthly", tagLabel: "2nd Sunday", desc: "Pet vendor pop-ups on the second Sunday of each month at the Rose Bowl Flea Market. Treats, gear, and a very social crowd." },
  { name: "Wags & Whiskers", area: "Silver Lake Reservoir", tag: "monthly", tagLabel: "Seasonal", desc: "Seasonal outdoor pet event at the reservoir featuring local pet vendors, adoptable animals, and community meetups.", tip: "PawBucks Discover surfaces upcoming pet events from local merchants and partners — check the app.", tipIcon: "🐾" },
];

const PlaceCard = ({ p }: { p: Place }) => (
  <div className="place-card">
    <div className="place-card-top">
      <h3>{p.name}</h3>
      {p.tagLabel && <span className={`place-tag ${p.tag ?? ""}`}>{p.tagLabel}</span>}
    </div>
    <div className="place-location">
      <MapPin size={12} strokeWidth={2.5} />
      {p.area}
    </div>
    <p className="place-desc">{p.desc}</p>
    {p.tip && (
      <div className="place-tip">
        <span className="tip-icon">{p.tipIcon ?? "💡"}</span>
        <span>{p.tip}</span>
      </div>
    )}
  </div>
);

const PetFriendlyLosAngelesGuide = () => {
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
        jsonLd={{ ...articleSchema, faq: createFAQSchema(faqs) }}
      />

      <nav className="nav">
        <Link to="/" className="nav-logo">🐾 Paw<span>Bucks</span></Link>
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
            {dogParks.map((p) => <PlaceCard key={p.name} p={p} />)}
          </div>
        </section>

        <section id="beaches" className="guide-section">
          <div className="section-header">
            <div className="section-icon">🏖️</div>
            <h2>Beaches &amp; Hiking Trails</h2>
          </div>
          <div className="place-list">
            {beachesAndTrails.map((p) => <PlaceCard key={p.name} p={p} />)}
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

        <section id="cafes" className="guide-section">
          <div className="section-header">
            <div className="section-icon">☕</div>
            <h2>Dog-Friendly Cafes &amp; Patios</h2>
          </div>
          <div className="place-list">
            {cafes.map((p) => <PlaceCard key={p.name} p={p} />)}
          </div>
        </section>

        <section id="events" className="guide-section">
          <div className="section-header">
            <div className="section-icon">📅</div>
            <h2>Recurring Pet Events in LA</h2>
          </div>
          <div className="place-list">
            {events.map((p) => <PlaceCard key={p.name} p={p} />)}
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
        <h2>Ready to Earn on Every Pet Outing?</h2>
        <p>Join PawBucks free and start earning rewards at local pet merchants across West LA.</p>
        <Link to="/auth" className="fc-btn">🐾 Create Your Free Account</Link>
      </section>

      <footer className="footer-nav">
        <div className="fn-logo">🐾 Paw<span>Bucks</span></div>
        <p>Stronger Pets. Happier People. Stronger Community.</p>
        <p>Santa Monica · Venice · Mar Vista · Marina Del Rey · Culver City · Westchester</p>
      </footer>
    </div>
  );
};

export default PetFriendlyLosAngelesGuide;