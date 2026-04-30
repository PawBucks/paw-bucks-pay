import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { seoMeta } from "@/lib/seoMeta";
import logo from "@/assets/logo.png";

const EFFECTIVE_DATE = "April 24, 2026";

const styles = `
.pt-root {
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
.pt-root * { box-sizing: border-box; }
.pt-root h1, .pt-root h2, .pt-root h3 { font-family: 'Playfair Display', Georgia, serif; }

/* NAV */
.pt-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.75rem 2.5rem;
  background: rgba(255,255,255,0.96);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}
.pt-nav-logo { display: flex; align-items: center; background: none; border: none; cursor: pointer; padding: 0; }
.pt-nav-logo img { height: 44px; width: auto; display: block; }
.pt-nav-links { display: flex; gap: 2rem; align-items: center; }
.pt-nav-links button, .pt-nav-links a {
  color: var(--muted); text-decoration: none;
  font-size: 0.875rem; font-weight: 400;
  background: none; border: none; cursor: pointer;
  font-family: inherit; transition: color 0.2s;
}
.pt-nav-links button:hover, .pt-nav-links a:hover { color: var(--teal); }
.pt-nav-cta {
  background: var(--teal) !important; color: #fff !important;
  padding: 0.6rem 1.4rem; border-radius: 3px;
  font-size: 0.85rem; font-weight: 500 !important;
  letter-spacing: 0.03em; transition: background 0.2s;
}
.pt-nav-cta:hover { background: var(--ink) !important; color: #fff !important; }
.pt-nav-mobile-cta { display: none; }

/* HERO */
.pt-hero {
  background: var(--dark-bg);
  padding: 10rem 5rem 6rem;
  position: relative; overflow: hidden;
}
.pt-hero::before {
  content: ''; position: absolute;
  top: -100px; right: -100px;
  width: 600px; height: 600px; border-radius: 50%;
  background: radial-gradient(circle, #1ec8d414 0%, transparent 70%);
  pointer-events: none;
}
.pt-hero::after {
  content: ''; position: absolute;
  bottom: -100px; left: -100px;
  width: 400px; height: 400px; border-radius: 50%;
  background: radial-gradient(circle, #1ec8d40a 0%, transparent 70%);
  pointer-events: none;
}
.pt-hero-inner { max-width: 780px; position: relative; z-index: 1; }
.pt-hero-eyebrow {
  font-size: 0.75rem; font-weight: 500;
  letter-spacing: 0.15em; text-transform: uppercase;
  color: var(--teal-light); margin-bottom: 1.5rem;
}
.pt-hero-title {
  font-size: clamp(2.8rem, 5vw, 4.5rem);
  font-weight: 900; line-height: 1.05;
  letter-spacing: -0.03em; color: #fff;
  margin-bottom: 1.75rem;
}
.pt-hero-meta {
  font-size: 0.95rem; color: #6ab8c0;
  font-weight: 300; margin-bottom: 1.5rem;
}
.pt-hero-warn {
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
.pt-body { background: var(--white); padding: 5rem 5rem 6rem; }
.pt-body-inner { max-width: 760px; margin: 0 auto; }
.pt-intro {
  font-size: 1.075rem; color: var(--muted);
  line-height: 1.85; font-weight: 400;
  padding-bottom: 2.5rem; margin-bottom: 2.5rem;
  border-bottom: 1px solid var(--border);
}
.pt-intro strong { color: var(--ink); font-weight: 600; }
.pt-intro a { color: var(--teal); text-decoration: none; border-bottom: 1px solid var(--border); }
.pt-intro a:hover { color: var(--teal-dark); border-color: var(--teal); }

.pt-section { margin-bottom: 2.75rem; }
.pt-section-num {
  font-size: 0.7rem; font-weight: 500;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--teal); margin-bottom: 0.65rem;
}
.pt-section h2 {
  font-size: clamp(1.5rem, 2.5vw, 1.85rem);
  font-weight: 700; line-height: 1.2;
  letter-spacing: -0.015em; color: var(--ink);
  margin: 0 0 1rem;
}
.pt-section p, .pt-section li {
  font-size: 1rem; color: var(--muted);
  line-height: 1.85; margin: 0 0 1rem;
}
.pt-section ul { padding-left: 1.25rem; margin: 0 0 1rem; }
.pt-section li { margin-bottom: 0.4rem; }
.pt-section strong { color: var(--ink); font-weight: 600; }
.pt-section a { color: var(--teal); text-decoration: none; border-bottom: 1px solid var(--border); }
.pt-section a:hover { color: var(--teal-dark); border-color: var(--teal); }
.pt-section .pt-caps {
  text-transform: uppercase; font-size: 0.825rem;
  letter-spacing: 0.02em; line-height: 1.85;
  color: var(--muted-light);
}

/* FOOTER */
.pt-footer {
  background: var(--dark-bg);
  color: #3d8a94; padding: 2rem 5rem;
  display: flex; justify-content: space-between; align-items: center;
  font-size: 0.8rem; border-top: 1px solid #0f2d36;
}
.pt-footer a, .pt-footer button {
  color: #3d8a94; text-decoration: none;
  background: none; border: none; cursor: pointer;
  font-family: inherit; font-size: inherit;
}
.pt-footer a:hover, .pt-footer button:hover { color: var(--teal-light); }

@keyframes pt-fadeUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}
.pt-hero-eyebrow { animation: pt-fadeUp 0.5s 0.0s ease both; }
.pt-hero-title   { animation: pt-fadeUp 0.5s 0.1s ease both; }
.pt-hero-meta    { animation: pt-fadeUp 0.5s 0.2s ease both; }
.pt-hero-warn    { animation: pt-fadeUp 0.5s 0.3s ease both; }

@media (max-width: 900px) {
  .pt-nav { padding: 0.75rem 1.5rem; }
  .pt-nav-links { display: none; }
  .pt-nav-mobile-cta { display: inline-block; }
  .pt-hero { padding: 8rem 1.5rem 4.5rem; }
  .pt-body { padding: 3.5rem 1.5rem 4rem; }
  .pt-footer { flex-direction: column; gap: 0.75rem; text-align: center; padding: 2rem 1.5rem; }
}
`;

const Section = ({ num, title, children }: { num: string; title: string; children: React.ReactNode }) => (
  <div className="pt-section">
    <div className="pt-section-num">Section {num}</div>
    <h2>{title}</h2>
    {children}
  </div>
);

const Terms = () => {
  const navigate = useNavigate();
  const goHome = () => navigate("/");
  const goSignup = () => navigate("/auth?role=pet_owner");

  return (
    <div className="pt-root">
      <SEO
        title={seoMeta.terms.title}
        description={seoMeta.terms.description}
        keywords={[...seoMeta.terms.keywords]}
        canonical={seoMeta.terms.canonical}
      />
      <style>{styles}</style>

      {/* NAV */}
      <nav className="pt-nav">
        <button className="pt-nav-logo" onClick={goHome} aria-label="PawBucks home">
          <img src={logo} alt="PawBucks" />
        </button>
        <div className="pt-nav-links">
          <button onClick={() => navigate("/about")}>About</button>
          <button onClick={() => navigate("/directory")}>Explore Merchants</button>
          <button onClick={() => navigate("/auth?role=pet_owner&mode=signin")}>Sign In</button>
          <button className="pt-nav-cta" onClick={goSignup}>Get Started</button>
        </div>
        <button className="pt-nav-cta pt-nav-mobile-cta" onClick={goSignup}>Get Started</button>
      </nav>

      {/* HERO */}
      <section className="pt-hero">
        <div className="pt-hero-inner">
          <div className="pt-hero-eyebrow">Legal</div>
          <h1 className="pt-hero-title">Terms of Service</h1>
          <div className="pt-hero-meta">
            Effective Date: {EFFECTIVE_DATE} · Last Updated: {EFFECTIVE_DATE}
          </div>
          <div className="pt-hero-warn">
            Please read carefully. Section 16 contains a binding arbitration agreement and class action waiver that affects your legal rights.
          </div>
        </div>
      </section>

      {/* BODY */}
      <main role="main" className="pt-body">
        <div className="pt-body-inner">
          <p className="pt-intro">
            These Terms of Service ("Terms") form a binding agreement between you ("you" or "User") and <strong>PawBucks, Inc.</strong>, a Delaware corporation ("PawBucks," "we," "us," or "our"), governing your access to and use of the PawBucks website, mobile applications, APIs, software, and related services (collectively, the "Platform"). By creating an account, accessing, or using the Platform, you agree to these Terms and our <a href="/privacy">Privacy Policy</a>. If you do not agree, do not use the Platform.
          </p>

          <Section num="01" title="Eligibility and Accounts">
            <p>You must be at least 18 years old (or the age of majority in your jurisdiction) and legally capable of entering binding contracts. You are responsible for the accuracy of information you provide, for safeguarding your credentials, and for all activity occurring under your account. You must promptly notify us of any unauthorized access at <a href="mailto:Legal@PawBucks.app">Legal@PawBucks.app</a>.</p>
          </Section>

          <Section num="02" title="Platform Role">
            <p>PawBucks is a technology marketplace that connects pet owners with independent merchants and veterinary professionals. PawBucks is <strong>not</strong> a veterinary practice, medical provider, healthcare intermediary, retailer, or party to transactions between users and merchants. Merchants and veterinarians are independent third parties solely responsible for their goods, services, advice, conduct, licensing, and outcomes. PawBucks does not endorse, verify (except as expressly stated), or guarantee any merchant, veterinarian, listing, review, or content.</p>
          </Section>

          <Section num="03" title="PawBucks Rewards">
            <p>PawBucks rewards ("PawBucks") are a promotional digital store-credit unit issued at our sole discretion. PawBucks have <strong>no cash value</strong>, are non-transferable, are not legal tender, are not a stored-value instrument or gift card under applicable law, and may be modified, suspended, expired, forfeited, clawed back, or revoked at any time, including in cases of fraud, abuse, chargebacks, refunds, account closure, or violation of these Terms. Conversion rates, earning multipliers, expiration windows (including the standard 60-day expiration on non-promotional balances), and redemption rules may change without prior notice.</p>
          </Section>

          <Section num="04" title="Payments, Fees, and Taxes">
            <p>Payments are processed by third-party payment processors, including <strong>Stripe, Inc.</strong>, subject to their terms. By transacting on the Platform, you agree to the applicable Stripe agreements. PawBucks may charge a Success Fee (currently 3% of the transaction amount) and other fees disclosed at the point of purchase. You are responsible for all applicable taxes. All sales are between you and the relevant merchant; refunds, returns, disputes, and chargebacks are handled per the merchant's policies and Section 9.</p>
          </Section>

          <Section num="05" title="Subscriptions (PawPass / PawPass+)">
            <p>Optional subscription tiers (e.g., PawPass, PawPass+) automatically renew at the then-current price until canceled. You may cancel at any time from your account settings; cancellation takes effect at the end of the current billing period and is non-refundable for the current period except as required by law.</p>
          </Section>

          <Section num="06" title="User Content and License">
            <p>You retain ownership of content you submit (e.g., reviews, photos, lost-pet flyers) ("User Content"). You grant PawBucks a worldwide, non-exclusive, royalty-free, sublicensable, transferable, perpetual, and irrevocable license to host, store, reproduce, modify, create derivative works of, publicly display, publicly perform, distribute, and otherwise use User Content in connection with operating, marketing, and improving the Platform. You represent and warrant that you own or have all necessary rights in your User Content and that it does not infringe or violate any third-party rights or applicable law.</p>
          </Section>

          <Section num="07" title="Acceptable Use">
            <p>You agree not to:</p>
            <ul>
              <li>Violate any law, regulation, or third-party right.</li>
              <li>Misrepresent your identity, credentials, affiliation, or pets.</li>
              <li>Upload viruses, malware, or harmful code.</li>
              <li>Scrape, crawl, harvest, reverse engineer, decompile, or interfere with the Platform.</li>
              <li>Bypass, disable, or attempt to circumvent any security or access controls.</li>
              <li>Use the Platform for fraud, money laundering, or chargeback abuse.</li>
              <li>Submit false reviews or manipulate reward, ranking, or referral systems.</li>
              <li>Harass, threaten, defame, or harm other users, merchants, or veterinarians.</li>
              <li>Use the Platform to provide unlicensed veterinary or regulated services.</li>
            </ul>
          </Section>

          <Section num="08" title="Intellectual Property">
            <p>The Platform, including all software, design, text, graphics, logos, trademarks, and content (excluding User Content), is owned by PawBucks or its licensors and protected by intellectual property laws. We grant you a limited, revocable, non-exclusive, non-transferable license to use the Platform solely for personal, non-commercial purposes in accordance with these Terms. All other rights are reserved.</p>
          </Section>

          <Section num="09" title="Refunds, Disputes, and Chargebacks">
            <p>Refunds and dispute resolution for goods or services purchased from merchants are governed by the merchant's policies. PawBucks may, but is not obligated to, mediate disputes. Initiating a chargeback without first attempting to resolve a dispute with the merchant or PawBucks may result in account suspension, forfeiture of PawBucks balances, and recovery of associated fees.</p>
          </Section>

          <Section num="10" title="Third-Party Services">
            <p>The Platform integrates third-party services (e.g., Stripe, Mapbox, Google authentication, SMS/email providers). PawBucks is not responsible for, and disclaims all liability arising from, third-party services, websites, or content. Your use of third-party services is governed by their terms.</p>
          </Section>

          <Section num="11" title="Beta and Experimental Features">
            <p>Features designated as "beta," "preview," or "experimental" are provided as-is, may be modified or discontinued at any time, and may produce errors. You use them at your own risk.</p>
          </Section>

          <Section num="12" title="Termination and Suspension">
            <p>We may suspend, restrict, or terminate your access to the Platform, in whole or in part, at any time, with or without notice, for any reason, including suspected violation of these Terms, fraud, legal risk, payment processor requirements, or extended inactivity. Upon termination, all licenses granted to you cease, and any outstanding PawBucks balances may be forfeited. Sections that by their nature should survive (including Sections 3, 6, 8, 13–18) will survive termination.</p>
          </Section>

          <Section num="13" title="Disclaimers">
            <p className="pt-caps">THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE," WITH ALL FAULTS AND WITHOUT WARRANTY OF ANY KIND, EXPRESS, IMPLIED, OR STATUTORY, INCLUDING ANY IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, ACCURACY, OR THAT THE PLATFORM WILL BE UNINTERRUPTED, SECURE, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS. PAWBUCKS DOES NOT WARRANT THE QUALITY, SAFETY, LEGALITY, OR RESULTS OF ANY GOODS, SERVICES, OR ADVICE PROVIDED BY MERCHANTS OR VETERINARIANS, AND DISCLAIMS ALL LIABILITY RELATING THERETO. NO ADVICE OR INFORMATION OBTAINED FROM PAWBUCKS CREATES ANY WARRANTY NOT EXPRESSLY STATED IN THESE TERMS.</p>
          </Section>

          <Section num="14" title="Limitation of Liability">
            <p className="pt-caps">TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT WILL PAWBUCKS, ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, LICENSORS, OR SERVICE PROVIDERS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, DATA, GOODWILL, REPUTATION, BUSINESS, OR LOSS OF OR INJURY TO PETS, ARISING OUT OF OR RELATED TO THE PLATFORM, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. PAWBUCKS' TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS ARISING OUT OF OR RELATED TO THESE TERMS OR THE PLATFORM WILL NOT EXCEED THE GREATER OF (A) THE SUCCESS FEES PAID BY YOU TO PAWBUCKS IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS (US$100). THESE LIMITATIONS APPLY REGARDLESS OF THE LEGAL THEORY (CONTRACT, TORT, STATUTE, OR OTHERWISE) AND ARE A FUNDAMENTAL BASIS OF THE BARGAIN BETWEEN THE PARTIES.</p>
          </Section>

          <Section num="15" title="Indemnification">
            <p>You will defend, indemnify, and hold harmless PawBucks and its affiliates, officers, directors, employees, agents, licensors, and service providers from and against any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising out of or related to: (a) your use or misuse of the Platform; (b) your User Content; (c) your violation of these Terms or any law or third-party right; (d) your transactions with merchants or veterinarians; or (e) any care, advice, treatment, or product provided to you or your pet by a third party.</p>
          </Section>

          <Section num="16" title="Binding Arbitration; Class Action Waiver">
            <p className="pt-caps">PLEASE READ CAREFULLY. THIS SECTION AFFECTS YOUR LEGAL RIGHTS.</p>
            <p>Any dispute, claim, or controversy arising out of or relating to these Terms or the Platform ("Dispute") will be resolved exclusively by final and binding individual arbitration administered by JAMS under its Streamlined Arbitration Rules, before a single arbitrator, in Los Angeles County, California (or remotely at the User's election). The arbitrator has exclusive authority to decide all issues, including arbitrability. Judgment on the award may be entered in any court of competent jurisdiction.</p>
            <p className="pt-caps">YOU AND PAWBUCKS EACH WAIVE THE RIGHT TO A TRIAL BY JURY AND THE RIGHT TO PARTICIPATE IN ANY CLASS, COLLECTIVE, CONSOLIDATED, OR REPRESENTATIVE ACTION. THE ARBITRATOR MAY NOT CONSOLIDATE CLAIMS AND MAY AWARD RELIEF ONLY ON AN INDIVIDUAL BASIS.</p>
            <p>You may opt out of this arbitration agreement by sending written notice to <a href="mailto:Legal@PawBucks.app">Legal@PawBucks.app</a> within 30 days of first accepting these Terms. Notwithstanding the foregoing, either party may bring an individual action in small claims court or seek injunctive or equitable relief in court for infringement or misuse of intellectual property.</p>
          </Section>

          <Section num="17" title="Governing Law and Venue">
            <p>These Terms are governed by the laws of the State of California, USA, without regard to its conflict-of-laws principles. Subject to Section 16, the exclusive venue for any action not subject to arbitration is the state or federal courts located in Los Angeles County, California, and the parties consent to personal jurisdiction therein.</p>
          </Section>

          <Section num="18" title="Changes to These Terms">
            <p>We may modify these Terms at any time. Material changes will be communicated by updating the "Last Updated" date and, when appropriate, by additional notice. Your continued use of the Platform after changes become effective constitutes acceptance of the revised Terms. If you do not agree, you must stop using the Platform.</p>
          </Section>

          <Section num="19" title="Force Majeure">
            <p>PawBucks will not be liable for any delay or failure to perform resulting from causes beyond its reasonable control, including acts of God, natural disasters, war, terrorism, civil unrest, labor disputes, governmental action, internet or utility failures, or third-party service outages.</p>
          </Section>

          <Section num="20" title="Miscellaneous">
            <p>These Terms (together with our Privacy Policy and any policies or agreements expressly incorporated) constitute the entire agreement between you and PawBucks regarding the Platform and supersede all prior agreements. If any provision is held unenforceable, the remaining provisions will remain in full force and effect, and the unenforceable provision will be reformed to reflect the parties' original intent. Our failure to enforce any provision is not a waiver. You may not assign these Terms without our prior written consent; we may freely assign them. Notices to PawBucks must be sent to <a href="mailto:Legal@PawBucks.app">Legal@PawBucks.app</a>. The relationship between the parties is that of independent contractors; no agency, partnership, joint venture, or employment is created.</p>
          </Section>

          <Section num="21" title="Contact">
            <p>For legal notices, questions about these Terms, or to submit an arbitration opt-out, contact us at:</p>
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
      <footer className="pt-footer">
        <div>© {new Date().getFullYear()} PawBucks, Inc. · Los Angeles, CA</div>
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", justifyContent: "center" }}>
          <a href="/about">About</a>
          <a href="/privacy">Privacy</a>
          <a href="/merchants">For Merchants</a>
          <a href="/vets">For Vets</a>
          <a href="mailto:Legal@PawBucks.app">Legal@PawBucks.app</a>
        </div>
      </footer>
    </div>
  );
};

export default Terms;
