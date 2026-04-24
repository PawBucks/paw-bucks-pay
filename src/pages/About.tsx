import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { SEO } from "@/components/SEO";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  CreditCard,
  Building2,
  Mail,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  Users,
  Store,
  Lock,
  FileText,
} from "lucide-react";
import logo from "@/assets/logo.png";

const About = () => {
  const navigate = useNavigate();

  const aboutSchema = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "About PawBucks",
    description:
      "PawBucks is a pet rewards and services marketplace operated by PawBucks, Inc. Learn about our business model, security practices, and how we make money.",
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

  return (
    <div className="min-h-[100dvh] bg-[var(--gradient-hero)] overflow-x-hidden">
      <SEO
        title="About PawBucks – How We Work, How We Make Money, and Who We Are"
        description="PawBucks is a transparent pet rewards marketplace operated by PawBucks, Inc. (Los Angeles, CA). Payments are processed by Stripe. Learn how we make money and how rewards work."
        keywords={[
          "About PawBucks",
          "PawBucks legit",
          "PawBucks business model",
          "PawBucks security",
          "Stripe payments pets",
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutSchema) }}
      />

      <Header
        menuItems={[
          { label: "About", path: "/about" },
          { label: "Explore Pet Merchants", path: "/directory" },
          { label: "Sign In", path: "/auth?role=pet_owner" },
        ]}
      />

      <main role="main" className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 max-w-4xl space-y-10">
        <section className="text-center space-y-5">
          <img src={logo} alt="PawBucks Logo" className="h-20 w-auto mx-auto" />
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            About PawBucks
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            PawBucks is an all-in-one pet rewards marketplace that connects pet owners with
            verified local businesses — and rewards every dollar you spend on your pet.
          </p>
          <p className="text-sm text-muted-foreground">
            Operated by <strong className="text-foreground">PawBucks, Inc.</strong> · Los Angeles, California
          </p>
        </section>

        <Card className="p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">What is PawBucks?</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            PawBucks is a marketplace technology platform. We don't sell pet products ourselves —
            we connect pet owners with independent pet stores, groomers, trainers, dog walkers,
            boarding providers, and licensed veterinary clinics. Every purchase made through a
            partner merchant earns the customer cashback rewards called <strong>PawBucks</strong>,
            which can be redeemed for discounts on future purchases at any participating business.
          </p>
        </Card>

        <Card className="p-6 sm:p-8 space-y-4 border-2 border-primary/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">How PawBucks Makes Money</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            We believe in radical transparency about our business model. Here's exactly how we earn revenue:
          </p>
          <ul className="space-y-3 text-muted-foreground">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <span>
                <strong className="text-foreground">3% Network Fee.</strong> When a customer pays a
                merchant through our platform, PawBucks collects a 3% network service fee from the
                transaction. This is disclosed at checkout — never hidden.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <span>
                <strong className="text-foreground">Optional PawPass &amp; PawPass+ memberships.</strong>{" "}
                Pet owners can stay on the free tier forever, or upgrade for higher reward
                multipliers (10x → 20x → 30x PawBucks per dollar). Memberships are clearly priced
                and cancellable any time from your account.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <span>
                <strong className="text-foreground">Optional merchant marketing services.</strong>{" "}
                Merchants can pay for premium placement, sponsored listings, or marketing campaigns.
              </span>
            </li>
          </ul>
          <p className="text-sm text-muted-foreground italic pt-2 border-t border-border">
            We do <strong>not</strong> sell your data, run hidden auto-renewing subscriptions, or
            charge pet owners to sign up. The free tier is genuinely free.
          </p>
        </Card>

        <Card className="p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
              <Store className="w-6 h-6 text-accent" />
            </div>
            <h2 className="text-2xl font-bold">How Rewards Work</h2>
          </div>
          <ul className="space-y-2 text-muted-foreground">
            <li>• Earn 10x PawBucks per dollar spent (Free), 20x (PawPass), or 30x (PawPass+).</li>
            <li>• 1,000 PawBucks = $1 in redeemable value.</li>
            <li>• Redeem PawBucks at any participating merchant or in the PawBucks Pet Store.</li>
            <li>• PawBucks earned from purchases expire 60 days after they're issued.</li>
          </ul>
        </Card>

        <Card className="p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-secondary" />
            </div>
            <h2 className="text-2xl font-bold">Security &amp; Payments</h2>
          </div>
          <ul className="space-y-3 text-muted-foreground">
            <li className="flex items-start gap-3">
              <CreditCard className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <span>
                <strong className="text-foreground">Payments processed by Stripe.</strong> PawBucks
                never sees, stores, or transmits your full card number. All payments run through{" "}
                <a
                  href="https://stripe.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline hover:no-underline"
                >
                  Stripe
                </a>
                , a PCI-DSS Level 1 certified payment processor used by millions of businesses.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <span>
                <strong className="text-foreground">TLS 1.2+ encryption</strong> for every request,
                with strict Content-Security-Policy headers and HSTS enforced site-wide.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <span>
                <strong className="text-foreground">Database-level access controls</strong>{" "}
                (Row-Level Security) ensure every user can only access their own pet, transaction,
                and wallet data.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <span>
                <strong className="text-foreground">Two-factor authentication</strong> available for
                all accounts; required for administrators.
              </span>
            </li>
          </ul>
        </Card>

        <Card className="p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <Building2 className="w-6 h-6 text-foreground" />
            </div>
            <h2 className="text-2xl font-bold">Company Information</h2>
          </div>
          <div className="text-muted-foreground space-y-2">
            <p>
              <strong className="text-foreground">Legal entity:</strong> PawBucks, Inc.
            </p>
            <p>
              <strong className="text-foreground">Registered address:</strong> 12609 Woodgreen St.,
              Los Angeles, CA 90066, United States
            </p>
            <p className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              <strong className="text-foreground">Contact:</strong>
              <a href="mailto:Legal@PawBucks.app" className="text-primary underline hover:no-underline">
                Legal@PawBucks.app
              </a>
            </p>
            <p>
              <strong className="text-foreground">Founded:</strong> 2025
            </p>
          </div>
        </Card>

        <section className="text-center space-y-4 pt-4">
          <h2 className="text-2xl sm:text-3xl font-bold">Ready to start earning?</h2>
          <Button
            size="lg"
            onClick={() => navigate("/auth?role=pet_owner")}
            className="text-base px-8 py-6"
          >
            Create a Free Account
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          <p className="text-sm text-muted-foreground">No credit card required.</p>
        </section>
      </main>
    </div>
  );
};

export default About;