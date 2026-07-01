import { Link } from "react-router-dom";
import { SEO, createFAQSchema } from "@/components/SEO";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, PawPrint, Coffee, Trees, CalendarDays } from "lucide-react";

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
      "Book grooming, boarding, day care, training, or vet visits through PawBucks partner merchants in Los Angeles to earn 10–30 PawBucks per $1 spent. Redeem those rewards on future pet care, treats, or the PawBucks Pet Store.",
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

const dogParks = [
  { name: "Runyon Canyon Park", area: "Hollywood Hills", note: "Iconic off-leash hike with city views. Go early — parking fills fast." },
  { name: "Silver Lake Dog Park", area: "Silver Lake", note: "Fenced, shaded, with separate small-dog area. Best mid-morning." },
  { name: "Griffith Park Off-Leash Area", area: "Los Feliz", note: "Large open field near John Ferraro Soccer Field. Great for high-energy dogs." },
  { name: "Hermon Dog Park", area: "Highland Park", note: "Small but tidy neighborhood spot with agility features." },
  { name: "Sepulveda Basin Off-Leash Park", area: "Encino", note: "One of the largest off-leash areas in LA — perfect for weekend zoomies." },
  { name: "Barrington Dog Park", area: "Brentwood", note: "Popular Westside pick with separate small/large enclosures." },
];

const cafes = [
  { name: "Alfred Coffee", area: "Melrose Place / Silver Lake / Brentwood", note: "Iconic dog-welcoming patios across the city." },
  { name: "Lady & Larder", area: "Santa Monica", note: "Cheese boards and pastries with a shaded dog-friendly patio." },
  { name: "Dog Haus", area: "Multiple locations", note: "Hot dogs for you, water bowls for pup." },
  { name: "Lazy Dog Restaurant", area: "Torrance / Woodland Hills", note: "Full dog menu on the patio (grilled chicken, brown rice)." },
  { name: "Blue Bottle Coffee", area: "Abbot Kinney / DTLA / Larchmont", note: "Leashed dogs welcome on outdoor seating." },
  { name: "Café Gratitude", area: "Larchmont / Venice", note: "Plant-based menu with generous patio space for dogs." },
];

const beachesAndTrails = [
  { name: "Rosie's Dog Beach", area: "Long Beach", note: "The nearest fully off-leash beach — a must-visit day trip." },
  { name: "Leo Carrillo State Beach", area: "Malibu", note: "Leashed dogs welcome on the north end." },
  { name: "Fryman Canyon Trail", area: "Studio City", note: "Shaded 3-mile loop, popular with leashed dogs." },
  { name: "Kenneth Hahn Park Trails", area: "Baldwin Hills", note: "Great views, dog-friendly leashed trails, and dedicated dog park." },
  { name: "Elysian Park", area: "Echo Park", note: "Miles of paths perfect for morning walks with your dog." },
];

const events = [
  { name: "Yappy Hour at Fairmont Miramar", area: "Santa Monica", note: "Monthly dog-friendly cocktail hour on the terrace." },
  { name: "Bark in the Park Night", area: "Dodger Stadium", note: "Bring your dog to select summer home games." },
  { name: "Rose Bowl Flea Market Pup-Ups", area: "Pasadena", note: "Pet vendor pop-ups the second Sunday of the month." },
  { name: "Wags & Whiskers", area: "Silver Lake Reservoir", note: "Seasonal adoption + community meetup." },
];

const PetFriendlyLosAngelesGuide = () => {
  return (
    <div className="min-h-screen bg-background">
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
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-12 md:py-16">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-primary">Home</Link>
          <span className="mx-2">/</span>
          <span>Guides</span>
          <span className="mx-2">/</span>
          <span className="text-foreground">Pet-Friendly Los Angeles</span>
        </nav>

        <header className="mb-10">
          <p className="text-sm font-semibold text-primary uppercase tracking-wide mb-3">Local Guide</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Pet-Friendly Los Angeles: Dog Parks, Cafes, Trails &amp; Events
          </h1>
          <p className="text-lg text-muted-foreground">
            Everything you need to plan a great day out with your dog in LA — from Runyon Canyon
            to Rosie's Dog Beach, plus the patios, hikes, and events locals actually use.
          </p>
        </header>

        <section className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <Trees className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">Best Off-Leash Dog Parks in LA</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {dogParks.map((p) => (
              <Card key={p.name}>
                <CardHeader>
                  <CardTitle className="text-lg">{p.name}</CardTitle>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {p.area}
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{p.note}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <Coffee className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">Dog-Friendly Cafes &amp; Patios</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {cafes.map((c) => (
              <Card key={c.name}>
                <CardHeader>
                  <CardTitle className="text-lg">{c.name}</CardTitle>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {c.area}
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{c.note}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <PawPrint className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">Beaches &amp; Hiking Trails</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {beachesAndTrails.map((b) => (
              <Card key={b.name}>
                <CardHeader>
                  <CardTitle className="text-lg">{b.name}</CardTitle>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {b.area}
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{b.note}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">Recurring Pet Events in LA</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {events.map((e) => (
              <Card key={e.name}>
                <CardHeader>
                  <CardTitle className="text-lg">{e.name}</CardTitle>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {e.area}
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{e.note}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-12 bg-primary/5 border border-primary/20 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-3">Earn PawBucks on Your LA Pet Outings</h2>
          <p className="text-muted-foreground mb-4">
            Book grooming, boarding, training, day care, or vet visits at PawBucks partner
            merchants across Los Angeles and earn 10–30 PawBucks per $1 — then redeem on future
            pet care and the PawBucks Pet Store.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/discover">Discover LA pet merchants</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/auth">Create a free account</Link>
            </Button>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqs.map((f) => (
              <Card key={f.question}>
                <CardHeader>
                  <CardTitle className="text-base">{f.question}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{f.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default PetFriendlyLosAngelesGuide;