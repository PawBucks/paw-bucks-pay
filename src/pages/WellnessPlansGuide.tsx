import { Link } from "react-router-dom";
import { SEO, createFAQSchema } from "@/components/SEO";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X, PawPrint, Heart, DollarSign, Stethoscope } from "lucide-react";

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
  dateModified: "2026-06-13",
  mainEntityOfPage: "https://pawbucks.app/guides/wellness-plans-comparison",
};

const WellnessPlansGuide = () => {
  return (
    <div className="min-h-screen bg-background">
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
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-12 md:py-16">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-primary">Home</Link>
          <span className="mx-2">/</span>
          <span>Guides</span>
          <span className="mx-2">/</span>
          <span className="text-foreground">Wellness Plans vs Traditional Care</span>
        </nav>

        <header className="mb-10">
          <p className="text-sm font-semibold text-primary uppercase tracking-wide mb-3">
            Pet Care Guide
          </p>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
            Veterinary Wellness Plans vs. Traditional Care: A Cost-Saving Guide
          </h1>
          <p className="text-lg text-muted-foreground">
            Routine vet visits, vaccines, and dental cleanings add up fast. Here's how
            wellness plans, low-cost vet clinics, and PawBucks rewards compare — and how
            to pick the right mix for your pet and your budget.
          </p>
        </header>

        <section className="prose prose-lg max-w-none mb-12">
          <h2 className="text-2xl font-bold mt-8 mb-4">What is a veterinary wellness plan?</h2>
          <p className="text-foreground/90">
            A veterinary wellness plan is a monthly subscription from your vet clinic that
            bundles preventive care into a predictable bill. A typical plan covers annual
            exams, core vaccines, heartworm and fecal testing, a dental cleaning, and
            sometimes discounts on unexpected visits. Instead of paying $300–$600 once a
            year, you pay a flat monthly fee — usually $25–$75 depending on your pet.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-4">
            Wellness plan vs. traditional pay-per-visit care
          </h2>
          <p className="text-foreground/90">
            Traditional care means you pay for each service the day of the visit. It's
            simple, but it can leave you skipping routine care to avoid the bill — which
            often costs more long-term as small issues become big ones.
          </p>
        </section>

        <section aria-labelledby="comparison" className="mb-12">
          <h2 id="comparison" className="text-2xl font-bold mb-6">Side-by-side comparison</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-primary" />
                  Wellness Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="flex gap-2"><Check className="w-5 h-5 text-primary shrink-0" /> Predictable monthly payment ($25–$75)</p>
                <p className="flex gap-2"><Check className="w-5 h-5 text-primary shrink-0" /> Routine exams, vaccines, dental cleaning included</p>
                <p className="flex gap-2"><Check className="w-5 h-5 text-primary shrink-0" /> Discounts on sick visits and prescriptions</p>
                <p className="flex gap-2"><Check className="w-5 h-5 text-primary shrink-0" /> Saves ~10–25% vs paying per visit</p>
                <p className="flex gap-2"><X className="w-5 h-5 text-muted-foreground shrink-0" /> Does not cover accidents or emergencies</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  Traditional Pay-Per-Visit
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="flex gap-2"><Check className="w-5 h-5 text-primary shrink-0" /> No long-term commitment</p>
                <p className="flex gap-2"><Check className="w-5 h-5 text-primary shrink-0" /> Pick and choose services</p>
                <p className="flex gap-2"><X className="w-5 h-5 text-muted-foreground shrink-0" /> Annual exam + vaccines can be $300–$600 at once</p>
                <p className="flex gap-2"><X className="w-5 h-5 text-muted-foreground shrink-0" /> Easy to skip preventive care to save money</p>
                <p className="flex gap-2"><X className="w-5 h-5 text-muted-foreground shrink-0" /> No bundled discount on dental cleanings</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="prose prose-lg max-w-none mb-12">
          <h2 className="text-2xl font-bold mt-4 mb-4">
            What about low-cost vet clinics and wellness clinics?
          </h2>
          <p className="text-foreground/90">
            Low-cost vet clinics and community wellness clinics — including nonprofits and
            mobile vaccination clinics — focus on essential preventive care at reduced
            prices. They're a great fit for healthy adult pets that mostly need vaccines,
            heartworm testing, and routine exams. For more complex care, a full-service
            clinic with a wellness plan usually offers better continuity. Many PawBucks
            partner vets blend both: low-cost wellness packages with the option to add
            specialty services as your pet ages.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-4">
            How PawBucks rewards bridge quality care and affordability
          </h2>
          <p className="text-foreground/90">
            PawBucks rewards earn back a percentage of every dollar you spend at partner
            vets, groomers, and pet stores. Pay your monthly wellness plan with PawBucks
            and you earn <strong>10–30 PawBucks per $1</strong> depending on your tier.
            Those rewards redeem 1:1 on future care — turning a $50/month wellness plan
            into effective savings of $5–$15 every month, on top of the plan's bundled
            discount.
          </p>
          <p className="text-foreground/90">
            Combined, a typical PawBucks pet owner saves an estimated{" "}
            <strong>$200–$500 per year</strong> compared to traditional pay-per-visit
            care — without skipping the preventive visits that keep pets healthy and
            future bills low.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-4">When to pick which</h2>
          <ul className="list-disc pl-6 space-y-2 text-foreground/90">
            <li>
              <strong>Puppy or kitten:</strong> Wellness plan — high volume of vaccines and
              checkups in year one.
            </li>
            <li>
              <strong>Senior pet:</strong> Wellness plan + pet insurance — more frequent
              screenings plus emergency coverage.
            </li>
            <li>
              <strong>Healthy adult, tight budget:</strong> Low-cost wellness clinic +
              PawBucks rewards for the essentials.
            </li>
            <li>
              <strong>Multi-pet household:</strong> Wellness plans per pet at a PawBucks
              partner — the rewards stack across pets.
            </li>
          </ul>
        </section>

        <section aria-labelledby="faqs" className="mb-12">
          <h2 id="faqs" className="text-2xl font-bold mb-6">Frequently asked questions</h2>
          <div className="space-y-4">
            {faqs.map((f) => (
              <Card key={f.question}>
                <CardHeader>
                  <CardTitle className="text-lg">{f.question}</CardTitle>
                </CardHeader>
                <CardContent className="text-foreground/90">{f.answer}</CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="bg-primary/5 border border-primary/20 rounded-2xl p-8 text-center">
          <PawPrint className="w-10 h-10 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-3">
            Find a wellness-plan vet near you and start earning PawBucks
          </h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Browse verified local vets and wellness clinics, then earn rewards every time
            you pay for care.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg">
              <Link to="/discover">
                <Heart className="w-4 h-4 mr-2" />
                Find a Partner Vet
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">Sign Up to Earn PawBucks</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default WellnessPlansGuide;