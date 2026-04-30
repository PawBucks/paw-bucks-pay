import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { seoMeta } from "@/lib/seoMeta";
import logo from "@/assets/logo.png";

const EFFECTIVE_DATE = "April 24, 2026";

const styles = `
.pp-root {
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
.pp-root * { box-sizing: border-box; }
.pp-root h1, .pp-root h2, .pp-root h3 { font-family: 'Playfair Display', Georgia, serif; }

/* NAV */
.pp-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.75rem 2.5rem;
  background: rgba(255,255,255,0.96);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}
.pp-nav-logo { display: flex; align-items: center; background: none; border: none; cursor: pointer; padding: 0; }
.pp-nav-logo img { height: 44px; width: auto; display: block; }
.pp-nav-links { display: flex; gap: 2rem; align-items: center; }
.pp-nav-links button, .pp-nav-links a {
  color: var(--muted); text-decoration: none;
  font-size: 0.875rem; font-weight: 400;
  background: none; border: none; cursor: pointer;
  font-family: inherit; transition: color 0.2s;
}
.pp-nav-links button:hover, .pp-nav-links a:hover { color: var(--teal); }
.pp-nav-cta {
  background: var(--teal) !important; color: #fff !important;
  padding: 0.6rem 1.4rem; border-radius: 3px;
  font-size: 0.85rem; font-weight: 500 !important;
  letter-spacing: 0.03em; transition: background 0.2s;
}
.pp-nav-cta:hover { background: var(--ink) !important; color: #fff !important; }
.pp-nav-mobile-cta { display: none; }

/* HERO */
.pp-hero {
  background: var(--dark-bg);
  padding: 10rem 5rem 6rem;
  position: relative; overflow: hidden;
}
.pp-hero::before {
  content: ''; position: absolute;
  top: -100px; right: -100px;
  width: 600px; height: 600px; border-radius: 50%;
  background: radial-gradient(circle, #1ec8d414 0%, transparent 70%);
  pointer-events: none;
}
.pp-hero::after {
  content: ''; position: absolute;
  bottom: -100px; left: -100px;
  width: 400px; height: 400px; border-radius: 50%;
  background: radial-gradient(circle, #1ec8d40a 0%, transparent 70%);
  pointer-events: none;
}
.pp-hero-inner { max-width: 780px; position: relative; z-index: 1; }
.pp-hero-eyebrow {
  font-size: 0.75rem; font-weight: 500;
  letter-spacing: 0.15em; text-transform: uppercase;
  color: var(--teal-light); margin-bottom: 1.5rem;
}
.pp-hero-title {
  font-size: clamp(2.8rem, 5vw, 4.5rem);
  font-weight: 900; line-height: 1.05;
  letter-spacing: -0.03em; color: #fff;
  margin-bottom: 1.75rem;
}
.pp-hero-meta {
  font-size: 0.95rem; color: #6ab8c0;
  font-weight: 300; margin-bottom: 1.5rem;
}
.pp-hero-warn {
  display: block;
  font-size: 0.72rem; font-weight: 600;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--teal-light);
  border-left: 2px solid var(--teal-light);
  padding-left: 0.875rem;
  max-width: 600px; line-height: 1.7;
  font-family: 'DM Sans', system-ui, sans-serif;
}

/* BODY */
.pp-body { background: var(--white); padding: 5rem 5rem 6rem; }
.pp-body-inner { max-width: 760px; margin: 0 auto; }
.pp-intro {
  font-size: 1.075rem; color: var(--muted);
  line-height: 1.85; font-weight: 400;
  padding-bottom: 2.5rem; margin-bottom: 2.5rem;
  border-bottom: 1px solid var(--border);
}
.pp-intro strong { color: var(--ink); font-weight: 600; }
.pp-intro a { color: var(--teal); text-decoration: none; border-bottom: 1px solid var(--border); }
.pp-intro a:hover { color: var(--teal-dark); border-color: var(--teal); }

.pp-section { margin-bottom: 2.75rem; }
.pp-section-num {
  font-size: 0.7rem; font-weight: 500;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--teal); margin-bottom: 0.65rem;
}
.pp-section h2 {
  font-size: clamp(1.5rem, 2.5vw, 1.85rem);
  font-weight: 700; line-height: 1.2;
  letter-spacing: -0.015em; color: var(--ink);
  margin: 0 0 1rem;
}
.pp-section h3 {
  font-size: 1.1rem; font-weight: 600;
  color: var(--ink); margin: 1.5rem 0 0.65rem;
  letter-spacing: -0.01em;
}
.pp-section p, .pp-section li {
  font-size: 1rem; color: var(--muted);
  line-height: 1.85; margin: 0 0 1rem;
}
.pp-section ul { padding-left: 1.25rem; margin: 0 0 1rem; }
.pp-section li { margin-bottom: 0.4rem; }
.pp-section strong { color: var(--ink); font-weight: 600; }
.pp-section a { color: var(--teal); text-decoration: none; border-bottom: 1px solid var(--border); }
.pp-section a:hover { color: var(--teal-dark); border-color: var(--teal); }

/* FOOTER */
.pp-footer {
  background: var(--dark-bg);
  color: #3d8a94; padding: 2rem 5rem;
  display: flex; justify-content: space-between; align-items: center;
  font-size: 0.8rem; border-top: 1px solid #0f2d36;
}
.pp-footer a, .pp-footer button {
  color: #3d8a94; text-decoration: none;
  background: none; border: none; cursor: pointer;
  font-family: inherit; font-size: inherit;
}
.pp-footer a:hover, .pp-footer button:hover { color: var(--teal-light); }

@keyframes pp-fadeUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}
.pp-hero-eyebrow { animation: pp-fadeUp 0.5s 0.0s ease both; }
.pp-hero-title   { animation: pp-fadeUp 0.5s 0.1s ease both; }
.pp-hero-meta    { animation: pp-fadeUp 0.5s 0.2s ease both; }
.pp-hero-warn    { animation: pp-fadeUp 0.5s 0.3s ease both; }

@media (max-width: 900px) {
  .pp-nav { padding: 0.75rem 1.5rem; }
  .pp-nav-links { display: none; }
  .pp-nav-mobile-cta { display: inline-block; }
  .pp-hero { padding: 8rem 1.5rem 4.5rem; }
  .pp-body { padding: 3.5rem 1.5rem 4rem; }
  .pp-footer { flex-direction: column; gap: 0.75rem; text-align: center; padding: 2rem 1.5rem; }
}
`;

const Section = ({ num, title, children }: { num: string; title: string; children: React.ReactNode }) => (
  <div className="pp-section">
    <div className="pp-section-num">Section {num}</div>
    <h2>{title}</h2>
    {children}
  </div>
);

const Privacy = () => {
  const navigate = useNavigate();
  const goHome = () => navigate("/");
  const goSignup = () => navigate("/auth?role=pet_owner");

  return (
    <div className="pp-root">
      <SEO
        title={seoMeta.privacy.title}
        description={seoMeta.privacy.description}
        keywords={[...seoMeta.privacy.keywords]}
        canonical={seoMeta.privacy.canonical}
      />
      <style>{styles}</style>

      {/* NAV */}
      <nav className="pp-nav">
        <button className="pp-nav-logo" onClick={goHome} aria-label="PawBucks home">
          <img src={logo} alt="PawBucks" />
        </button>
        <div className="pp-nav-links">
          <button onClick={() => navigate("/about")}>About</button>
          <button onClick={() => navigate("/directory")}>Explore Merchants</button>
          <button onClick={() => navigate("/auth?role=pet_owner&mode=signin")}>Sign In</button>
          <button className="pp-nav-cta" onClick={goSignup}>Get Started</button>
        </div>
        <button className="pp-nav-cta pp-nav-mobile-cta" onClick={goSignup}>Get Started</button>
      </nav>

      {/* HERO */}
      <section className="pp-hero">
        <div className="pp-hero-inner">
          <div className="pp-hero-eyebrow">Legal</div>
          <h1 className="pp-hero-title">Privacy Policy</h1>
          <div className="pp-hero-meta">
            Effective Date: {EFFECTIVE_DATE} · Last Updated: {EFFECTIVE_DATE}
          </div>
          <div className="pp-hero-warn">
            Your privacy matters. This policy explains what we collect, how we use it, and the rights you have over your data.
          </div>
        </div>
      </section>

      {/* BODY */}
      <main role="main" className="pp-body">
        <div className="pp-body-inner">
          <p className="pp-intro">
            This Privacy Policy ("Policy") describes how <strong>PawBucks, Inc.</strong> ("PawBucks," "we," "us," or "our") collects, uses, discloses, and protects information about you when you access or use the PawBucks website, mobile applications, APIs, and related services (collectively, the "Platform"). By accessing or using the Platform, you agree to this Policy. If you do not agree, do not use the Platform.
          </p>

          <Section num="01" title="Who We Are">
            <p>PawBucks, Inc. is a Delaware corporation headquartered at 12609 Woodgreen St., Los Angeles, CA 90066, USA. For any privacy-related inquiries, contact us at <a href="mailto:Legal@PawBucks.app">Legal@PawBucks.app</a>.</p>
          </Section>

          <Section num="02" title="Information We Collect">
            <h3>2.1 Information You Provide</h3>
            <ul>
              <li>Account information: name, email address, phone number, password, profile photo.</li>
              <li>Pet information: pet name, species, breed, age, photos, medical and vaccination records you upload.</li>
              <li>Payment information: billing address, payment method details (processed and stored by Stripe; we do not store full card numbers).</li>
              <li>Communications: messages you send to merchants, veterinarians, support, or other users.</li>
              <li>User-generated content: reviews, lost-pet flyers, photos, comments.</li>
            </ul>
            <h3>2.2 Information Collected Automatically</h3>
            <ul>
              <li>Device data: device type, operating system, browser, IP address, unique identifiers.</li>
              <li>Usage data: pages viewed, features used, clicks, timestamps, referring URLs, crash logs.</li>
              <li>Location data: approximate location from IP, and precise location only with your permission (e.g., to find merchants near you).</li>
              <li>Cookies and similar technologies as described in Section 8.</li>
            </ul>
            <h3>2.3 Information from Third Parties</h3>
            <ul>
              <li>Authentication providers (e.g., Google) when you sign in with them.</li>
              <li>Payment processors (Stripe) — transaction status, payout details, dispute information.</li>
              <li>Merchants, veterinarians, and shared-account members who add information about you or your pets.</li>
              <li>Service providers (analytics, fraud prevention, communications).</li>
            </ul>
          </Section>

          <Section num="03" title="How We Use Information">
            <p>We use information to:</p>
            <ul>
              <li>Provide, operate, secure, and improve the Platform.</li>
              <li>Process transactions, issue PawBucks rewards, and prevent fraud.</li>
              <li>Personalize content, recommend merchants, and surface relevant offers.</li>
              <li>Communicate with you about your account, transactions, security, and product updates.</li>
              <li>Send marketing communications (you may opt out at any time).</li>
              <li>Comply with legal obligations and enforce our Terms of Service.</li>
              <li>Train, evaluate, and improve our internal models and analytics in aggregated or de-identified form.</li>
            </ul>
          </Section>

          <Section num="04" title="Legal Bases (EEA / UK Users)">
            <p>Where applicable law requires a legal basis, we rely on: (a) performance of a contract; (b) our legitimate interests in operating, securing, and improving the Platform; (c) compliance with legal obligations; and (d) your consent, which you may withdraw at any time.</p>
          </Section>

          <Section num="05" title="How We Share Information">
            <ul>
              <li><strong>Merchants and veterinarians</strong> you transact with, to facilitate orders, bookings, and care.</li>
              <li><strong>Service providers</strong> performing services on our behalf (hosting, analytics, email/SMS, payments, customer support) under contractual confidentiality obligations.</li>
              <li><strong>Payment processors</strong> (including Stripe, Inc.) under their own privacy policies.</li>
              <li><strong>Legal and safety</strong> recipients when we believe disclosure is required by law, subpoena, court order, or to protect rights, property, safety, or to investigate fraud.</li>
              <li><strong>Business transfers:</strong> in connection with any merger, acquisition, financing, or sale of assets.</li>
              <li><strong>With your consent</strong> or at your direction.</li>
            </ul>
            <p>We do <strong>not</strong> sell your personal information for monetary consideration.</p>
          </Section>

          <Section num="06" title="Pet Health and Medical Data">
            <p>Pet health data you upload (vaccination records, SOAP notes, prescriptions) is treated as sensitive. Access is restricted to you, members of your shared account, and veterinary professionals you explicitly authorize. PawBucks administrators are prohibited from viewing pet medical records, clinical notes, or medical visit details.</p>
          </Section>

          <Section num="07" title="Data Retention">
            <p>We retain personal data for as long as necessary to provide the Platform, comply with legal, tax, accounting, and regulatory obligations, resolve disputes, and enforce agreements. When data is no longer needed, we delete or de-identify it. Backup copies may persist for a limited additional period.</p>
          </Section>

          <Section num="08" title="Cookies and Tracking">
            <p>We use cookies, local storage, pixels, and similar technologies for authentication, preferences, analytics, security, and to measure performance. You may control cookies through your browser settings; disabling cookies may limit functionality.</p>
          </Section>

          <Section num="09" title="Your Choices and Rights">
            <ul>
              <li>Access, correct, or delete account information from your profile.</li>
              <li>Opt out of marketing communications via the unsubscribe link or notification preferences.</li>
              <li>Manage push, SMS, and email preferences in your account settings.</li>
              <li>Request data export or deletion by emailing <a href="mailto:Legal@PawBucks.app">Legal@PawBucks.app</a>.</li>
            </ul>
            <p>Depending on your jurisdiction (e.g., California, EEA, UK), you may have additional rights including the right to access, rectification, erasure, restriction, portability, and to object to certain processing. You also have the right to lodge a complaint with a supervisory authority.</p>
          </Section>

          <Section num="10" title="California Residents (CCPA/CPRA)">
            <p>California residents may request disclosure of categories and specific pieces of personal information collected, sold, or shared (we do not sell personal information). You may also request deletion or correction. We will not discriminate against you for exercising your rights. To exercise these rights, contact <a href="mailto:Legal@PawBucks.app">Legal@PawBucks.app</a>.</p>
          </Section>

          <Section num="11" title="Children's Privacy">
            <p>The Platform is not directed to children under 13 (or under 16 in the EEA). We do not knowingly collect personal information from children. If you believe a child has provided us personal information, contact us so we can delete it.</p>
          </Section>

          <Section num="12" title="International Transfers">
            <p>We are based in the United States and process data there. If you access the Platform from outside the U.S., your information may be transferred to, stored, and processed in the U.S. and other countries that may have different data protection laws than your jurisdiction. We use appropriate safeguards (e.g., Standard Contractual Clauses) where required.</p>
          </Section>

          <Section num="13" title="Security">
            <p>We implement administrative, technical, and physical safeguards designed to protect your information, including encryption in transit (TLS), encryption at rest where applicable, role-based access controls, audit logging, and least-privilege architecture. No system is 100% secure, and we cannot guarantee absolute security.</p>
          </Section>

          <Section num="14" title="Third-Party Links and Services">
            <p>The Platform may contain links to third-party websites or integrations (including Stripe and authentication providers). Their privacy practices are governed by their own policies, and we are not responsible for them.</p>
          </Section>

          <Section num="15" title="Automated Decision-Making">
            <p>We may use automated systems for fraud prevention, recommendations, search ranking, and PawBucks reward calculations. These systems do not produce legal or similarly significant effects without human oversight. You may contact us to request human review of any automated decision affecting you materially.</p>
          </Section>

          <Section num="16" title="Changes to This Policy">
            <p>We may update this Policy from time to time. Material changes will be communicated by updating the "Last Updated" date and, when appropriate, by additional notice (email or in-Platform). Your continued use of the Platform after changes become effective constitutes your acceptance of the revised Policy.</p>
          </Section>

          <Section num="17" title="Contact Us">
            <p>
              <strong>PawBucks, Inc.</strong><br />
              12609 Woodgreen St.<br />
              Los Angeles, CA 90066, USA<br />
              Email: <a href="mailto:Legal@PawBucks.app">Legal@PawBucks.app</a>
            </p>
          </Section>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="pp-footer">
        <div>© {new Date().getFullYear()} PawBucks, Inc. · Los Angeles, CA</div>
        <div style={{ display: "flex", gap: "1.5rem" }}>
          <a href="mailto:Legal@PawBucks.app">Legal@PawBucks.app</a>
          <button onClick={() => navigate("/terms")}>Terms</button>
          <button onClick={() => navigate("/about")}>About</button>
        </div>
      </footer>
    </div>
  );
};

export default Privacy;
