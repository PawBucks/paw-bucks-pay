import { Header } from"@/components/Header";
import { SEO } from"@/components/SEO";
import { seoMeta } from"@/lib/seoMeta";
import { ShieldCheck } from"lucide-react";

const EFFECTIVE_DATE ="April 24, 2026";

const Privacy = () => {
 return (
 <div className="min-h-[100dvh] bg-[var(--gradient-hero)] overflow-x-hidden">
 <SEO
 title={seoMeta.privacy.title}
 description={seoMeta.privacy.description}
 keywords={[...seoMeta.privacy.keywords]}
 canonical={seoMeta.privacy.canonical}
 />
 <Header
 menuItems={[
 { label:"About", path:"/about" },
 { label:"Terms", path:"/terms" },
 { label:"Sign In", path:"/auth?role=pet_owner" },
 ]}
 />

 <main role="main" className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 max-w-3xl">
 <header className="text-center space-y-3 mb-10">
 <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary">
 <ShieldCheck className="w-7 h-7" />
 </div>
 <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
 Privacy Policy
 </h1>
 <p className="text-sm text-muted-foreground">
 Effective Date: {EFFECTIVE_DATE} · Last Updated: {EFFECTIVE_DATE}
 </p>
 </header>

 <article className="prose prose-sm sm:prose-base max-w-none text-foreground space-y-6 [&_h2]:text-foreground [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-foreground [&_h3]:font-semibold [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_a]:text-primary">
 <p>
 This Privacy Policy ("Policy") describes how <strong className="text-foreground">PawBucks, Inc.</strong> ("PawBucks,""we,""us," or"our") collects, uses, discloses, and protects information about you when you access or use the PawBucks website, mobile applications, APIs, and related services (collectively, the"Platform"). By accessing or using the Platform, you agree to this Policy. If you do not agree, do not use the Platform.
 </p>

 <h2>1. Who We Are</h2>
 <p>
 PawBucks, Inc. is a Delaware corporation headquartered at 12609 Woodgreen St., Los Angeles, CA 90066, USA. For any privacy-related inquiries, contact us at <a href="mailto:Legal@PawBucks.app">Legal@PawBucks.app</a>.
 </p>

 <h2>2. Information We Collect</h2>
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

 <h2>3. How We Use Information</h2>
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

 <h2>4. Legal Bases (EEA / UK Users)</h2>
 <p>Where applicable law requires a legal basis, we rely on: (a) performance of a contract; (b) our legitimate interests in operating, securing, and improving the Platform; (c) compliance with legal obligations; and (d) your consent, which you may withdraw at any time.</p>

 <h2>5. How We Share Information</h2>
 <ul>
 <li><strong className="text-foreground">Merchants and veterinarians</strong> you transact with, to facilitate orders, bookings, and care.</li>
 <li><strong className="text-foreground">Service providers</strong> performing services on our behalf (hosting, analytics, email/SMS, payments, customer support) under contractual confidentiality obligations.</li>
 <li><strong className="text-foreground">Payment processors</strong> (including Stripe, Inc.) under their own privacy policies.</li>
 <li><strong className="text-foreground">Legal and safety</strong> recipients when we believe disclosure is required by law, subpoena, court order, or to protect rights, property, safety, or to investigate fraud.</li>
 <li><strong className="text-foreground">Business transfers:</strong> in connection with any merger, acquisition, financing, or sale of assets.</li>
 <li><strong className="text-foreground">With your consent</strong> or at your direction.</li>
 </ul>
 <p>We do <strong className="text-foreground">not</strong> sell your personal information for monetary consideration.</p>

 <h2>6. Pet Health and Medical Data</h2>
 <p>Pet health data you upload (vaccination records, SOAP notes, prescriptions) is treated as sensitive. Access is restricted to you, members of your shared account, and veterinary professionals you explicitly authorize. PawBucks administrators are prohibited from viewing pet medical records, clinical notes, or medical visit details.</p>

 <h2>7. Data Retention</h2>
 <p>We retain personal data for as long as necessary to provide the Platform, comply with legal, tax, accounting, and regulatory obligations, resolve disputes, and enforce agreements. When data is no longer needed, we delete or de-identify it. Backup copies may persist for a limited additional period.</p>

 <h2>8. Cookies and Tracking</h2>
 <p>We use cookies, local storage, pixels, and similar technologies for authentication, preferences, analytics, security, and to measure performance. You may control cookies through your browser settings; disabling cookies may limit functionality.</p>

 <h2>9. Your Choices and Rights</h2>
 <ul>
 <li>Access, correct, or delete account information from your profile.</li>
 <li>Opt out of marketing communications via the unsubscribe link or notification preferences.</li>
 <li>Manage push, SMS, and email preferences in your account settings.</li>
 <li>Request data export or deletion by emailing <a href="mailto:Legal@PawBucks.app">Legal@PawBucks.app</a>.</li>
 </ul>
 <p>Depending on your jurisdiction (e.g., California, EEA, UK), you may have additional rights including the right to access, rectification, erasure, restriction, portability, and to object to certain processing. You also have the right to lodge a complaint with a supervisory authority.</p>

 <h2>10. California Residents (CCPA/CPRA)</h2>
 <p>California residents may request disclosure of categories and specific pieces of personal information collected, sold, or shared (we do not sell personal information). You may also request deletion or correction. We will not discriminate against you for exercising your rights. To exercise these rights, contact <a href="mailto:Legal@PawBucks.app">Legal@PawBucks.app</a>.</p>

 <h2>11. Children's Privacy</h2>
 <p>The Platform is not directed to children under 13 (or under 16 in the EEA). We do not knowingly collect personal information from children. If you believe a child has provided us personal information, contact us so we can delete it.</p>

 <h2>12. International Transfers</h2>
 <p>We are based in the United States and process data there. If you access the Platform from outside the U.S., your information may be transferred to, stored, and processed in the U.S. and other countries that may have different data protection laws than your jurisdiction. We use appropriate safeguards (e.g., Standard Contractual Clauses) where required.</p>

 <h2>13. Security</h2>
 <p>We implement administrative, technical, and physical safeguards designed to protect your information, including encryption in transit (TLS), encryption at rest where applicable, role-based access controls, audit logging, and least-privilege architecture. No system is 100% secure, and we cannot guarantee absolute security.</p>

 <h2>14. Third-Party Links and Services</h2>
 <p>The Platform may contain links to third-party websites or integrations (including Stripe and authentication providers). Their privacy practices are governed by their own policies, and we are not responsible for them.</p>

 <h2>15. Automated Decision-Making</h2>
 <p>We may use automated systems for fraud prevention, recommendations, search ranking, and PawBucks reward calculations. These systems do not produce legal or similarly significant effects without human oversight. You may contact us to request human review of any automated decision affecting you materially.</p>

 <h2>16. Changes to This Policy</h2>
 <p>We may update this Policy from time to time. Material changes will be communicated by updating the"Last Updated" date and, when appropriate, by additional notice (email or in-Platform). Your continued use of the Platform after changes become effective constitutes your acceptance of the revised Policy.</p>

 <h2>17. Contact Us</h2>
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

export default Privacy;