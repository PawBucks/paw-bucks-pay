import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { SEO } from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getUserAccessInfo } from "@/lib/userAccessCache";
import { PETFEST_VENDOR_TIERS, type PetFestTierId } from "@/lib/petfestVendorTiers";
import pawMark from "@/assets/pawbucks-logo.png";
import "./PetFest.css";

const applicationSchema = z.object({
  businessName: z.string().trim().min(1, { message: "Business name is required" }).max(120),
  contactName: z.string().trim().min(1, { message: "Contact name is required" }).max(100),
  email: z.string().trim().email({ message: "Enter a valid email address" }).max(255),
  phone: z
    .string()
    .trim()
    .min(7, { message: "Enter a valid phone number" })
    .max(20)
    .regex(/^[\d\s\-()+.]+$/, { message: "Invalid phone number format" }),
  website: z.string().trim().max(255).optional().or(z.literal("")),
  businessCategory: z.string().trim().max(80).optional().or(z.literal("")),
  boothCount: z.coerce.number().int().min(1).max(5),
  powerNeeded: z.boolean(),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

const PetFestVendors = () => {
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tier, setTier] = useState<PetFestTierId>(
    (searchParams.get("tier") as PetFestTierId) || "tier_2",
  );
  const [form, setForm] = useState({
    businessName: "",
    contactName: "",
    email: "",
    phone: "",
    website: "",
    businessCategory: "",
    boothCount: "1",
    powerNeeded: false,
    notes: "",
  });

  const selectedTier = useMemo(
    () => PETFEST_VENDOR_TIERS.find((t) => t.id === tier) ?? PETFEST_VENDOR_TIERS[1],
    [tier],
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setEligible(false);
      setChecking(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const info = await getUserAccessInfo(user.id);
        const isPro =
          info.is_merchant ||
          info.is_vet ||
          info.user_type === "merchant" ||
          info.user_type === "vet";
        if (!cancelled) setEligible(isPro);
      } catch (err) {
        console.error("Vendor eligibility check failed", err);
        if (!cancelled) setEligible(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  useEffect(() => {
    if (user?.email && !form.email) {
      setForm((prev) => ({ ...prev, email: user.email ?? "" }));
    }
  }, [user, form.email]);

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = applicationSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        const key = String(err.path[0]);
        if (!fieldErrors[key]) fieldErrors[key] = err.message;
      });
      setErrors(fieldErrors);
      toast.error("Please fix the highlighted fields");
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const v = parsed.data;
      const { data: created, error } = await supabase
        .from("petfest_vendor_applications")
        .insert({
          user_id: user.id,
          business_name: v.businessName,
          contact_name: v.contactName,
          email: v.email,
          phone: v.phone,
          website: v.website || null,
          business_category: v.businessCategory || null,
          tier,
          booth_count: v.boothCount,
          power_needed: form.powerNeeded,
          notes: v.notes || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      setSubmitted(true);
      toast.success("Application received! We'll be in touch soon.");
      if (created?.id) {
        supabase.functions
          .invoke("petfest-vendor-notify", {
            body: { applicationId: created.id, event: "received" },
          })
          .catch((emailErr) => console.error("Vendor confirmation email failed", emailErr));
      }
    } catch (err) {
      console.error("Vendor application failed", err);
      toast.error("We couldn't submit your application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="petfest">
      <SEO
        title="Apply to be a PetFest 2027 Vendor | PawBucks"
        description="Showcase your pet business to 1,000+ West LA pet parents at PetFest 2027. Compare Tier 1, 2 and 3 booth packages and apply for your space."
        canonical="https://pawbucks.app/petfest/vendors"
      />

      <section className="pf-form-section">
        <div className="wrap">
          <div className="center">
            <p className="eyebrow">For pet pros</p>
            <h2 className="section-title">
              Put your business
              <br />
              in front of the Westside.
            </h2>
            <p className="section-copy">
              PetFest 2027 brings 1,000+ local pet parents to one park for one day. Pick the booth
              package that fits your business and apply below — spaces are limited and go in the
              order applications are approved.
            </p>
          </div>

          <div className="pro-tiers">
            {PETFEST_VENDOR_TIERS.map((t) => (
              <article
                key={t.id}
                className={`pro-tier${t.featured ? " featured" : ""}${
                  tier === t.id ? " selected" : ""
                }`}
              >
                <span className="pro-tier-label">{t.label}</span>
                <h3>{t.name}</h3>
                <div className="pro-tier-price">
                  ${t.price.toLocaleString()}
                  <span> / booth</span>
                </div>
                <div className="pro-tier-spaces">{t.spaces} spaces available</div>
                <p className="pro-tier-best">
                  <strong>Best for:</strong> {t.bestFor}
                </p>
                <ul className="pro-tier-list">
                  {t.includes.map((item) => (
                    <li key={item}>
                      <span aria-hidden="true">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`btn ${tier === t.id ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setTier(t.id)}
                >
                  {tier === t.id ? "Selected" : `Choose ${t.label}`}
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="pf-form-section" id="apply">
        <div className="wrap">
          <div className="pf-form-card">
            <span className="pf-form-kicker">
              <img src={pawMark} alt="" className="pf-paw pf-paw-xs" /> Vendor application ·{" "}
              {selectedTier.label} · ${selectedTier.price.toLocaleString()}
            </span>

            {checking || authLoading ? (
              <p className="pf-form-note">Checking your account…</p>
            ) : submitted ? (
              <>
                <h2>Application received.</h2>
                <p className="pf-form-note">
                  Thanks! Our team reviews applications in the order they arrive and will email you
                  at <strong>{form.email}</strong> with booth confirmation and payment details.
                </p>
                <Link to="/petfest" className="btn btn-secondary">
                  Back to PetFest
                </Link>
              </>
            ) : !eligible ? (
              <>
                <h2>First, create your pro account.</h2>
                <p className="pf-form-note">
                  PetFest booths are reserved for PawBucks Merchant and Vet partners. Create your
                  free business account (or sign in to your existing one) and you'll come right back
                  to this application.
                </p>
                <div className="passport-actions">
                  <Link
                    to={`/auth?role=merchant&redirect=${encodeURIComponent("/petfest/vendors")}`}
                    className="btn btn-primary"
                  >
                    Create a Merchant account
                  </Link>
                  <Link
                    to={`/auth?role=vet&redirect=${encodeURIComponent("/petfest/vendors")}`}
                    className="btn btn-secondary"
                  >
                    Create a Vet account
                  </Link>
                </div>
              </>
            ) : (
              <form className="pf-form" onSubmit={handleSubmit} noValidate>
                <label>
                  Business name
                  <input value={form.businessName} onChange={set("businessName")} maxLength={120} />
                  {errors.businessName && <em className="pf-error">{errors.businessName}</em>}
                </label>
                <label>
                  Contact name
                  <input value={form.contactName} onChange={set("contactName")} maxLength={100} />
                  {errors.contactName && <em className="pf-error">{errors.contactName}</em>}
                </label>
                <label>
                  Email
                  <input type="email" value={form.email} onChange={set("email")} maxLength={255} />
                  {errors.email && <em className="pf-error">{errors.email}</em>}
                </label>
                <label>
                  Phone
                  <input type="tel" value={form.phone} onChange={set("phone")} maxLength={20} />
                  {errors.phone && <em className="pf-error">{errors.phone}</em>}
                </label>
                <label>
                  Website or social (optional)
                  <input value={form.website} onChange={set("website")} maxLength={255} />
                </label>
                <label>
                  What kind of pet business? (optional)
                  <input
                    value={form.businessCategory}
                    onChange={set("businessCategory")}
                    maxLength={80}
                    placeholder="Groomer, trainer, boutique, vet…"
                  />
                </label>
                <label>
                  Booths requested
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={form.boothCount}
                    onChange={set("boothCount")}
                  />
                  {errors.boothCount && <em className="pf-error">{errors.boothCount}</em>}
                </label>
                <label className="pf-check">
                  <input
                    type="checkbox"
                    checked={form.powerNeeded}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, powerNeeded: e.target.checked }))
                    }
                  />
                  I need access to power at my booth
                </label>
                <label>
                  Anything else we should know? (optional)
                  <textarea value={form.notes} onChange={set("notes")} maxLength={1000} rows={4} />
                </label>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting
                    ? "Submitting…"
                    : `Apply for ${selectedTier.label} · $${selectedTier.price.toLocaleString()}`}
                </button>
                <p className="pf-form-note">
                  Applying doesn't charge you. Once your booth is approved we'll email an invoice you
                  can pay right inside PawBucks.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default PetFestVendors;
