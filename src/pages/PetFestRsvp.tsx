import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { SEO } from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import "./PetFest.css";

const rsvpSchema = z.object({
  fullName: z.string().trim().min(1, { message: "Your name is required" }).max(100, { message: "Name must be less than 100 characters" }),
  email: z.string().trim().email({ message: "Enter a valid email address" }).max(255),
  phone: z
    .string()
    .trim()
    .min(7, { message: "Enter a valid phone number" })
    .max(20, { message: "Phone number must be less than 20 characters" })
    .regex(/^[\d\s\-()+.]+$/, { message: "Invalid phone number format" })
    .refine((v) => (v.match(/\d/g) || []).length >= 10, { message: "Phone number must contain at least 10 digits" }),
  petCount: z.coerce.number().int().min(1, { message: "Bring at least one pet" }).max(20, { message: "That's a lot of pets! Max 20" }),
  petName: z.string().trim().min(1, { message: "Your pet's name is required" }).max(50),
  petBreed: z.string().trim().max(50).optional().or(z.literal("")),
  petBirthday: z.string().optional().or(z.literal("")),
});

const PetFestRsvp = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    petCount: "1",
    petName: "",
    petBreed: "",
    petBirthday: "",
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = rsvpSchema.safeParse(form);
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
      const { data: sessionData } = await supabase.auth.getSession();
      const v = parsed.data;
      const { error } = await supabase.from("petfest_rsvps").insert({
        user_id: sessionData.session?.user.id ?? null,
        full_name: v.fullName,
        email: v.email,
        phone: v.phone,
        pet_count: v.petCount,
        pet_name: v.petName,
        pet_breed: v.petBreed || null,
        pet_birthday: v.petBirthday || null,
      });
      if (error) throw error;
      navigate("/petfest/rsvp/success", {
        state: { name: v.fullName, petName: v.petName, petCount: v.petCount },
        replace: true,
      });
    } catch (err) {
      console.error("PetFest RSVP failed", err);
      toast.error("We couldn't save your RSVP. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="petfest">
      <SEO
        title="RSVP for PetFest 2027 | Free Pet Festival in West LA"
        description="Reserve your free spot at PetFest 2027 in West Los Angeles. Tell us about you and your pet and we'll save your place at the biggest pet day of the year."
        canonical="https://pawbucks.app/petfest/rsvp"
      />

      <section className="pf-form-section">
        <div className="wrap">
          <div className="pf-form-card">
            <span className="pf-form-kicker">🐾 PetFest 2027 · March 20 · West LA</span>
            <h1>Save your spot</h1>
            <p className="pf-form-intro">
              Admission is free — we just need a few details so we can print your PetFest Passport and say hi to your pet by name.
            </p>

            <form className="pf-form" onSubmit={handleSubmit} noValidate>
              <div className="pf-field">
                <label htmlFor="fullName">Your name</label>
                <input id="fullName" value={form.fullName} onChange={set("fullName")} placeholder="Jamie Rivera" autoComplete="name" maxLength={100} />
                {errors.fullName && <span className="pf-error">{errors.fullName}</span>}
              </div>

              <div className="pf-row">
                <div className="pf-field">
                  <label htmlFor="email">Email</label>
                  <input id="email" type="email" value={form.email} onChange={set("email")} placeholder="you@email.com" autoComplete="email" maxLength={255} />
                  {errors.email && <span className="pf-error">{errors.email}</span>}
                </div>
                <div className="pf-field">
                  <label htmlFor="phone">Phone number</label>
                  <input id="phone" type="tel" value={form.phone} onChange={set("phone")} placeholder="(310) 555-0142" autoComplete="tel" maxLength={20} />
                  {errors.phone && <span className="pf-error">{errors.phone}</span>}
                </div>
              </div>

              <div className="pf-row">
                <div className="pf-field">
                  <label htmlFor="petCount">How many pets are coming?</label>
                  <input id="petCount" type="number" min={1} max={20} value={form.petCount} onChange={set("petCount")} />
                  {errors.petCount && <span className="pf-error">{errors.petCount}</span>}
                </div>
                <div className="pf-field">
                  <label htmlFor="petName">Pet's name</label>
                  <input id="petName" value={form.petName} onChange={set("petName")} placeholder="Biscuit" maxLength={50} />
                  {errors.petName && <span className="pf-error">{errors.petName}</span>}
                </div>
              </div>

              <div className="pf-row">
                <div className="pf-field">
                  <label htmlFor="petBreed">Breed <em>(optional)</em></label>
                  <input id="petBreed" value={form.petBreed} onChange={set("petBreed")} placeholder="Golden Retriever" maxLength={50} />
                  {errors.petBreed && <span className="pf-error">{errors.petBreed}</span>}
                </div>
                <div className="pf-field">
                  <label htmlFor="petBirthday">Pet's birthday <em>(optional)</em></label>
                  <input id="petBirthday" type="date" value={form.petBirthday} onChange={set("petBirthday")} />
                  {errors.petBirthday && <span className="pf-error">{errors.petBirthday}</span>}
                </div>
              </div>

              <button type="submit" className="btn btn-primary pf-submit" disabled={submitting}>
                {submitting ? "Saving your spot..." : "🐾 Confirm My Free RSVP"}
              </button>
              <p className="pf-form-note">
                Free admission · No ticket needed · <Link to="/petfest">Back to PetFest</Link>
              </p>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PetFestRsvp;
