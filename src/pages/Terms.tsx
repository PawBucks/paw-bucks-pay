import { Header } from "@/components/Header";
import { SEO } from "@/components/SEO";
import { seoMeta } from "@/lib/seoMeta";
import { FileText } from "lucide-react";

const EFFECTIVE_DATE = "April 24, 2026";

const Terms = () => {
  return (
    <div className="min-h-[100dvh] bg-[var(--gradient-hero)] overflow-x-hidden">
      <SEO
        title={seoMeta.terms.title}
        description={seoMeta.terms.description}
        keywords={[...seoMeta.terms.keywords]}
        canonical={seoMeta.terms.canonical}
      />
      <Header
        menuItems={[
          { label: "About", path: "/about" },
          { label: "Privacy", path: "/privacy" },
          { label: "Sign In", path: "/auth?role=pet_owner" },
        ]}
      />

      <main role="main" className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 max-w-3xl">
        <header className="text-center space-y-3 mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary">
            <FileText className="w-7 h-7" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Terms of Service
          </h1>
          <p className="text-sm text-muted-foreground">
            Effective Date: {EFFECTIVE_DATE} · Last Updated: {EFFECTIVE_DATE}
          </p>
          <p className="text-xs uppercase tracking-wide text-primary font-semibold">
            PLEASE READ CAREFULLY. SECTION 16 CONTAINS A BINDING ARBITRATION AGREEMENT AND CLASS ACTION WAIVER.
          </p>
        </header>

        <article className="prose prose-sm sm:prose-base max-w-none text-foreground space-y-6 [&_h2]:text-foreground [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-foreground [&_h3]:font-semibold [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_a]:text-primary">
          <p>
            These Terms of Service ("Terms") form a binding agreement between you ("you" or "User") and <strong className="text-foreground">PawBucks, Inc.</strong>, a Delaware corporation ("PawBucks," "we," "us," or "our"), governing your access to and use of the PawBucks website, mobile applications, APIs, software, and related services (collectively, the "Platform"). By creating an account, accessing, or using the Platform, you agree to these Terms and our <a href="/privacy">Privacy Policy</a>. If you do not agree, do not use the Platform.
          </p>

          <h2>1. Eligibility and Accounts</h2>
          <p>You must be at least 18 years old (or the age of majority in your jurisdiction) and legally capable of entering binding contracts. You are responsible for the accuracy of information you provide, for safeguarding your credentials, and for all activity occurring under your account. You must promptly notify us of any unauthorized access at <a href="mailto:Legal@PawBucks.app">Legal@PawBucks.app</a>.</p>

          <h2>2. Platform Role</h2>
          <p>PawBucks is a technology marketplace that connects pet owners with independent merchants and veterinary professionals. PawBucks is <strong className="text-foreground">not</strong> a veterinary practice, medical provider, healthcare intermediary, retailer, or party to transactions between users and merchants. Merchants and veterinarians are independent third parties solely responsible for their goods, services, advice, conduct, licensing, and outcomes. PawBucks does not endorse, verify (except as expressly stated), or guarantee any merchant, veterinarian, listing, review, or content.</p>

          <h2>3. PawBucks Rewards</h2>
          <p>PawBucks rewards ("PawBucks") are a promotional digital store-credit unit issued at our sole discretion. PawBucks have <strong className="text-foreground">no cash value</strong>, are non-transferable, are not legal tender, are not a stored-value instrument or gift card under applicable law, and may be modified, suspended, expired, forfeited, clawed back, or revoked at any time, including in cases of fraud, abuse, chargebacks, refunds, account closure, or violation of these Terms. Conversion rates, earning multipliers, expiration windows (including the standard 60-day expiration on non-promotional balances), and redemption rules may change without prior notice.</p>

          <h2>4. Payments, Fees, and Taxes</h2>
          <p>Payments are processed by third-party payment processors, including <strong className="text-foreground">Stripe, Inc.</strong>, subject to their terms. By transacting on the Platform, you agree to the applicable Stripe agreements. PawBucks may charge a network/service fee (currently 3% of the transaction amount) and other fees disclosed at the point of purchase. You are responsible for all applicable taxes. All sales are between you and the relevant merchant; refunds, returns, disputes, and chargebacks are handled per the merchant's policies and Section 9.</p>

          <h2>5. Subscriptions (PawPass / PawPass+)</h2>
          <p>Optional subscription tiers (e.g., PawPass, PawPass+) automatically renew at the then-current price until canceled. You may cancel at any time from your account settings; cancellation takes effect at the end of the current billing period and is non-refundable for the current period except as required by law.</p>

          <h2>6. User Content and License</h2>
          <p>You retain ownership of content you submit (e.g., reviews, photos, lost-pet flyers) ("User Content"). You grant PawBucks a worldwide, non-exclusive, royalty-free, sublicensable, transferable, perpetual, and irrevocable license to host, store, reproduce, modify, create derivative works of, publicly display, publicly perform, distribute, and otherwise use User Content in connection with operating, marketing, and improving the Platform. You represent and warrant that you own or have all necessary rights in your User Content and that it does not infringe or violate any third-party rights or applicable law.</p>

          <h2>7. Acceptable Use</h2>
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

          <h2>8. Intellectual Property</h2>
          <p>The Platform, including all software, design, text, graphics, logos, trademarks, and content (excluding User Content), is owned by PawBucks or its licensors and protected by intellectual property laws. We grant you a limited, revocable, non-exclusive, non-transferable license to use the Platform solely for personal, non-commercial purposes in accordance with these Terms. All other rights are reserved.</p>

          <h2>9. Refunds, Disputes, and Chargebacks</h2>
          <p>Refunds and dispute resolution for goods or services purchased from merchants are governed by the merchant's policies. PawBucks may, but is not obligated to, mediate disputes. Initiating a chargeback without first attempting to resolve a dispute with the merchant or PawBucks may result in account suspension, forfeiture of PawBucks balances, and recovery of associated fees.</p>

          <h2>10. Third-Party Services</h2>
          <p>The Platform integrates third-party services (e.g., Stripe, Mapbox, Google authentication, SMS/email providers). PawBucks is not responsible for, and disclaims all liability arising from, third-party services, websites, or content. Your use of third-party services is governed by their terms.</p>

          <h2>11. Beta and Experimental Features</h2>
          <p>Features designated as "beta," "preview," or "experimental" are provided as-is, may be modified or discontinued at any time, and may produce errors. You use them at your own risk.</p>

          <h2>12. Termination and Suspension</h2>
          <p>We may suspend, restrict, or terminate your access to the Platform, in whole or in part, at any time, with or without notice, for any reason, including suspected violation of these Terms, fraud, legal risk, payment processor requirements, or extended inactivity. Upon termination, all licenses granted to you cease, and any outstanding PawBucks balances may be forfeited. Sections that by their nature should survive (including Sections 3, 6, 8, 13–18) will survive termination.</p>

          <h2>13. DISCLAIMERS</h2>
          <p className="uppercase">THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE," WITH ALL FAULTS AND WITHOUT WARRANTY OF ANY KIND, EXPRESS, IMPLIED, OR STATUTORY, INCLUDING ANY IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, ACCURACY, OR THAT THE PLATFORM WILL BE UNINTERRUPTED, SECURE, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS. PAWBUCKS DOES NOT WARRANT THE QUALITY, SAFETY, LEGALITY, OR RESULTS OF ANY GOODS, SERVICES, OR ADVICE PROVIDED BY MERCHANTS OR VETERINARIANS, AND DISCLAIMS ALL LIABILITY RELATING THERETO. NO ADVICE OR INFORMATION OBTAINED FROM PAWBUCKS CREATES ANY WARRANTY NOT EXPRESSLY STATED IN THESE TERMS.</p>

          <h2>14. LIMITATION OF LIABILITY</h2>
          <p className="uppercase">TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT WILL PAWBUCKS, ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, LICENSORS, OR SERVICE PROVIDERS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, DATA, GOODWILL, REPUTATION, BUSINESS, OR LOSS OF OR INJURY TO PETS, ARISING OUT OF OR RELATED TO THE PLATFORM, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. PAWBUCKS' TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS ARISING OUT OF OR RELATED TO THESE TERMS OR THE PLATFORM WILL NOT EXCEED THE GREATER OF (A) THE NETWORK FEES PAID BY YOU TO PAWBUCKS IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS (US$100). THESE LIMITATIONS APPLY REGARDLESS OF THE LEGAL THEORY (CONTRACT, TORT, STATUTE, OR OTHERWISE) AND ARE A FUNDAMENTAL BASIS OF THE BARGAIN BETWEEN THE PARTIES.</p>

          <h2>15. INDEMNIFICATION</h2>
          <p>You will defend, indemnify, and hold harmless PawBucks and its affiliates, officers, directors, employees, agents, licensors, and service providers from and against any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising out of or related to: (a) your use or misuse of the Platform; (b) your User Content; (c) your violation of these Terms or any law or third-party right; (d) your transactions with merchants or veterinarians; or (e) any care, advice, treatment, or product provided to you or your pet by a third party.</p>

          <h2>16. BINDING ARBITRATION; CLASS ACTION WAIVER</h2>
          <p className="uppercase">PLEASE READ CAREFULLY. THIS SECTION AFFECTS YOUR LEGAL RIGHTS.</p>
          <p>Any dispute, claim, or controversy arising out of or relating to these Terms or the Platform ("Dispute") will be resolved exclusively by final and binding individual arbitration administered by JAMS under its Streamlined Arbitration Rules, before a single arbitrator, in Los Angeles County, California (or remotely at the User's election). The arbitrator has exclusive authority to decide all issues, including arbitrability. Judgment on the award may be entered in any court of competent jurisdiction.</p>
          <p className="uppercase">YOU AND PAWBUCKS EACH WAIVE THE RIGHT TO A TRIAL BY JURY AND THE RIGHT TO PARTICIPATE IN ANY CLASS, COLLECTIVE, CONSOLIDATED, OR REPRESENTATIVE ACTION. THE ARBITRATOR MAY NOT CONSOLIDATE CLAIMS AND MAY AWARD RELIEF ONLY ON AN INDIVIDUAL BASIS.</p>
          <p>You may opt out of this arbitration agreement by sending written notice to <a href="mailto:Legal@PawBucks.app">Legal@PawBucks.app</a> within 30 days of first accepting these Terms. Notwithstanding the foregoing, either party may bring an individual action in small claims court or seek injunctive or equitable relief in court for infringement or misuse of intellectual property.</p>

          <h2>17. Governing Law and Venue</h2>
          <p>These Terms are governed by the laws of the State of California, USA, without regard to its conflict-of-laws principles. Subject to Section 16, the exclusive venue for any action not subject to arbitration is the state or federal courts located in Los Angeles County, California, and the parties consent to personal jurisdiction therein.</p>

          <h2>18. Changes to These Terms</h2>
          <p>We may modify these Terms at any time. Material changes will be communicated by updating the "Last Updated" date and, when appropriate, by additional notice. Your continued use of the Platform after changes become effective constitutes acceptance of the revised Terms. If you do not agree, you must stop using the Platform.</p>

          <h2>19. Force Majeure</h2>
          <p>PawBucks will not be liable for any delay or failure to perform resulting from causes beyond its reasonable control, including acts of God, natural disasters, war, terrorism, civil unrest, labor disputes, governmental action, internet or utility failures, or third-party service outages.</p>

          <h2>20. Miscellaneous</h2>
          <p>These Terms (together with our Privacy Policy and any policies or agreements expressly incorporated) constitute the entire agreement between you and PawBucks regarding the Platform and supersede all prior agreements. If any provision is held unenforceable, the remaining provisions will remain in full force and effect, and the unenforceable provision will be reformed to reflect the parties' original intent. Our failure to enforce any provision is not a waiver. You may not assign these Terms without our prior written consent; we may freely assign them. Notices to PawBucks must be sent to <a href="mailto:Legal@PawBucks.app">Legal@PawBucks.app</a>. The relationship between the parties is that of independent contractors; no agency, partnership, joint venture, or employment is created.</p>

          <h2>21. Contact</h2>
          <p>
            PawBucks, Inc.<br />
            12609 Woodgreen St.<br />
            Los Angeles, CA 90066, USA<br />
            Email: <a href="mailto:Legal@PawBucks.app">Legal@PawBucks.app</a>
          </p>
        </article>
      </main>
    </div>
  );
};

export default Terms;