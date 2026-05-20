import { useState } from"react";
import { useNavigate } from"react-router-dom";
import { SEO } from"@/components/SEO";
import { seoMeta } from"@/lib/seoMeta";
import logo from"@/assets/logo.png";
import { PremiumMerchantsBanner } from"@/components/PremiumMerchantsBanner";
import { CreditCard, Gift, BarChart3, Calendar, Mail, ShoppingBag, Scissors, Store, Bone, type LucideIcon } from "lucide-react";

const styles = `
 .ml-root {
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
 font-family:'DM Sans', system-ui, sans-serif;
 background: var(--white);
 color: var(--ink);
 line-height: 1.6;
 overflow-x: hidden;
 }
 .ml-root * { box-sizing: border-box; }
 .ml-root h1, .ml-root h2, .ml-root h3 { font-family:'Playfair Display', serif; }

 .ml-nav {
 position: fixed; top: 0; left: 0; right: 0; z-index: 100;
 display: flex; justify-content: space-between; align-items: center;
 padding: 0.75rem 2.5rem;
 background: rgba(255,255,255,0.96);
 backdrop-filter: blur(12px);
 border-bottom: 1px solid var(--border);
 }
 .ml-nav-logo img { height: 48px; width: auto; display: block; }
 .ml-nav-cta {
 background: var(--teal); color: #fff;
 padding: 0.6rem 1.4rem; border-radius: 3px;
 text-decoration: none; font-size: 0.85rem;
 font-weight: 500; letter-spacing: 0.03em;
 border: none; cursor: pointer;
 transition: background 0.2s;
 }
 .ml-nav-cta:hover { background: var(--ink); }

 .ml-hero {
 min-height: 100vh;
 display: grid; grid-template-columns: 1fr 1fr;
 padding-top: 5rem; background: var(--white);
 position: relative; overflow: hidden;
 }
 .ml-hero::before {
 content:''; position: absolute;
 top: -150px; right: -150px;
 width: 600px; height: 600px; border-radius: 50%;
 background: radial-gradient(circle, #1ec8d415 0%, transparent 70%);
 pointer-events: none;
 }
 .ml-hero-left {
 display: flex; flex-direction: column; justify-content: center;
 padding: 5rem 3rem 5rem 5rem;
 }
 .ml-eyebrow {
 font-size: 0.75rem; font-weight: 500; letter-spacing: 0.15em;
 text-transform: uppercase; color: var(--teal); margin-bottom: 1.5rem;
 }
 .ml-hero-title {
 font-size: clamp(2.8rem, 5vw, 4.2rem);
 font-weight: 900; line-height: 1.05;
 letter-spacing: -0.03em; color: var(--ink); margin-bottom: 1.75rem;
 }
 .ml-hero-title em { font-style: italic; color: var(--teal); }
 .ml-hero-sub {
 font-size: 1.1rem; color: var(--muted);
 max-width: 420px; line-height: 1.75; margin-bottom: 2.5rem;
 }
 .ml-actions { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
 .ml-btn-primary {
 background: var(--teal); color: #fff;
 padding: 0.9rem 2rem; border-radius: 3px;
 text-decoration: none; font-weight: 500; font-size: 0.95rem;
 letter-spacing: 0.02em; border: none; cursor: pointer;
 transition: all 0.2s; display: inline-block;
 }
 .ml-btn-primary:hover { background: var(--ink); transform: translateY(-1px); }
 .ml-btn-ghost {
 color: var(--ink); text-decoration: none;
 font-size: 0.9rem; font-weight: 500;
 border-bottom: 1px solid var(--border); padding-bottom: 2px;
 background: none; cursor: pointer;
 transition: border-color 0.2s, color 0.2s;
 }
 .ml-btn-ghost:hover { border-color: var(--teal); color: var(--teal); }

 .ml-hero-right {
 display: flex; align-items: center; justify-content: center;
 padding: 5rem 4rem 5rem 2rem;
 }
 .ml-pricing-card {
 background: var(--white); border: 1px solid var(--border);
 border-radius: 6px; padding: 2.5rem; width: 100%; max-width: 400px;
 box-shadow: 0 20px 60px rgba(10,31,38,0.09); position: relative;
 }
 .ml-pricing-card::before {
 content:'Simple Pricing';
 position: absolute; top: -12px; left: 1.5rem;
 background: var(--teal); color: white;
 font-size: 0.7rem; font-weight: 500; letter-spacing: 0.1em;
 text-transform: uppercase; padding: 0.25rem 0.75rem; border-radius: 2px;
 }
 .ml-price-row {
 display: flex; justify-content: space-between; align-items: center;
 padding: 1rem 0; border-bottom: 1px solid var(--border);
 }
 .ml-price-row:last-child { border-bottom: none; padding-bottom: 0; }
 .ml-price-row:first-child { padding-top: 0; }
 .ml-price-label { font-size: 0.9rem; color: var(--muted); }
 .ml-price-sub { font-size: 0.75rem; color: var(--muted-light); margin-top: 0.25rem; }
 .ml-price-value {
 font-family:'Playfair Display', serif;
 font-size: 1.6rem; font-weight: 700; color: var(--ink);
 }
 .ml-price-value.free { color: var(--teal-dark); }
 .ml-price-value.pct { color: var(--teal); }
 .ml-price-example {
 margin-top: 1.5rem; background: var(--teal-pale);
 border-radius: 3px; padding: 1rem 1.25rem;
 font-size: 0.85rem; color: var(--ink); line-height: 1.6;
 }
 .ml-price-example strong { color: var(--teal-dark); }

 .ml-section { padding: 6rem 5rem; }
 .ml-section-title {
 font-size: clamp(2rem, 3.5vw, 2.8rem); font-weight: 900;
 line-height: 1.1; letter-spacing: -0.02em;
 color: var(--ink); margin-bottom: 1.25rem;
 }
 .ml-section-sub {
 font-size: 1rem; color: var(--muted);
 max-width: 520px; line-height: 1.8;
 }

 .ml-how { background: var(--dark-bg); }
 .ml-how .ml-section-title { color: #fff; }
 .ml-how .ml-section-sub { color: #6ab8c0; }
 .ml-steps {
 display: grid; grid-template-columns: repeat(4, 1fr);
 gap: 2rem; margin-top: 3.5rem;
 }
 .ml-step { position: relative; padding-top: 1rem; }
 .ml-step-num {
 font-family:'Playfair Display', serif;
 font-size: 3.5rem; font-weight: 900;
 color: #1a5a66; line-height: 1; margin-bottom: 1rem;
 }
 .ml-step-title {
 font-size: 1rem; font-weight: 500;
 color: var(--teal-light); margin-bottom: 0.5rem;
 }
 .ml-step-body {
 font-size: 0.9rem; color: #6ab8c0;
 line-height: 1.7; font-weight: 300;
 }

 .ml-features-grid {
 display: grid; grid-template-columns: 1fr 1fr;
 gap: 1.5rem; margin-top: 3rem;
 }
 .ml-feature-card {
 background: var(--white); border: 1px solid var(--border);
 border-radius: 4px; padding: 1.75rem 2rem;
 transition: box-shadow 0.2s, transform 0.2s;
 }
 .ml-feature-card:hover {
 box-shadow: 0 8px 30px rgba(10,31,38,0.08);
 transform: translateY(-2px);
 }
 .ml-feature-icon { font-size: 1.5rem; margin-bottom: 0.75rem; }
 .ml-feature-name { font-size: 1rem; font-weight: 500; margin-bottom: 0.4rem; color: var(--ink); }
 .ml-feature-desc { font-size: 0.875rem; color: var(--muted); line-height: 1.7; }

 .ml-who { background: var(--section-alt); }
 .ml-who-grid {
 display: grid; grid-template-columns: repeat(3, 1fr);
 gap: 1.5rem; margin-top: 3rem;
 }
 .ml-who-card {
 background: var(--white); border: 1px solid var(--border);
 border-radius: 4px; padding: 2rem;
 position: relative; overflow: hidden;
 transition: border-color 0.2s;
 }
 .ml-who-card:hover { border-color: var(--teal); }
 .ml-who-emoji { font-size: 2rem; margin-bottom: 1rem; display: block; }
 .ml-who-type {
 font-size: 0.8rem; font-weight: 500; letter-spacing: 0.08em;
 text-transform: uppercase; color: var(--teal); margin-bottom: 0.5rem;
 }
 .ml-who-title {
 font-family:'Playfair Display', serif;
 font-size: 1.2rem; font-weight: 700; margin-bottom: 0.75rem; color: var(--ink);
 }
 .ml-who-desc { font-size: 0.875rem; color: var(--muted); line-height: 1.7; }

 .ml-math { background: var(--teal-pale); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
 .ml-math-inner { display: grid; grid-template-columns: 1fr 1fr; gap: 5rem; align-items: center; }
 .ml-math-table { width: 100%; border-collapse: collapse; margin-top: 1.5rem; }
 .ml-math-table tr { border-bottom: 1px solid var(--border); }
 .ml-math-table tr:last-child { border-bottom: none; }
 .ml-math-table td { padding: 0.9rem 0; font-size: 0.9rem; }
 .ml-math-table td:first-child { color: var(--muted); }
 .ml-math-table td:last-child { text-align: right; font-weight: 500; color: var(--ink); }
 .ml-math-table tr.total td {
 font-family:'Playfair Display', serif;
 font-size: 1.1rem; font-weight: 700; color: var(--teal-dark); padding-top: 1.25rem;
 }
 .ml-math-callout {
 background: var(--white); border: 1px solid var(--border);
 border-radius: 4px; padding: 2.5rem;
 }
 .ml-math-callout-label {
 font-size: 0.7rem; font-weight: 500; letter-spacing: 0.15em;
 text-transform: uppercase; color: var(--muted-light); margin-bottom: 0.75rem;
 }
 .ml-math-big {
 font-family:'Playfair Display', serif;
 font-size: 3.5rem; font-weight: 900;
 color: var(--teal-dark); line-height: 1; margin-bottom: 0.5rem;
 }
 .ml-math-caption { font-size: 0.875rem; color: var(--muted); line-height: 1.6; margin-bottom: 1.5rem; }
 .ml-math-divider { height: 1px; background: var(--border); margin: 1.5rem 0; }

 .ml-cta-section {
 background: var(--dark-bg); color: #fff; text-align: center;
 padding: 7rem 5rem; position: relative; overflow: hidden;
 }
 .ml-cta-section .ml-eyebrow { color: var(--teal-light); }
 .ml-cta-section .ml-section-title { color: #fff; max-width: 600px; margin: 0 auto 1rem; }
 .ml-cta-section .ml-section-sub { color: #6ab8c0; max-width: 460px; margin: 0 auto 2.5rem; }
 .ml-cta-note { font-size: 0.8rem; color: #4a9aa4; margin-top: 1rem; }

 .ml-faq-list { max-width: 680px; margin-top: 3rem; }
 .ml-faq-item { border-bottom: 1px solid var(--border); padding: 1.5rem 0; cursor: pointer; }
 .ml-faq-q {
 font-size: 0.95rem; font-weight: 500; color: var(--ink);
 display: flex; justify-content: space-between; align-items: center; gap: 1rem;
 }
 .ml-faq-arrow { color: var(--teal); font-size: 1.1rem; transition: transform 0.2s; }
 .ml-faq-item.open .ml-faq-arrow { transform: rotate(45deg); }
 .ml-faq-a {
 font-size: 0.875rem; color: var(--muted); line-height: 1.75;
 max-height: 0; overflow: hidden;
 transition: max-height 0.3s ease, padding 0.3s;
 }
 .ml-faq-item.open .ml-faq-a { max-height: 300px; padding-top: 0.75rem; }

 .ml-footer {
 background: var(--dark-bg); color: #3d8a94;
 padding: 2rem 5rem;
 display: flex; justify-content: space-between; align-items: center;
 font-size: 0.8rem;
 }
 .ml-footer a { color: #3d8a94; text-decoration: none; }
 .ml-footer a:hover { color: var(--teal-light); }

 @media (max-width: 900px) {
 .ml-nav { padding: 0.75rem 1.5rem; }
 .ml-section, .ml-cta-section { padding: 4rem 1.5rem; }
 .ml-hero { grid-template-columns: 1fr; min-height: auto; }
 .ml-hero-left { padding: 6rem 1.5rem 2rem; }
 .ml-hero-right { padding: 0 1.5rem 4rem; }
 .ml-steps { grid-template-columns: 1fr 1fr; }
 .ml-features-grid { grid-template-columns: 1fr; }
 .ml-who-grid { grid-template-columns: 1fr; }
 .ml-math-inner { grid-template-columns: 1fr; gap: 2rem; }
 .ml-footer { flex-direction: column; gap: 0.75rem; text-align: center; }
 }
`;

const features: { Icon: LucideIcon; name: string; desc: string }[] = [
 { Icon: CreditCard, name:"Payment Processing", desc:"Accept payments online and in-person. Direct Stripe integration with transparent fees." },
 { Icon: Gift, name:"Customer Rewards", desc:"PawBucks loyalty built-in. Customers earn on every purchase, come back more often." },
 { Icon: BarChart3, name:"Real-Time Analytics", desc:"Track sales, customers, and rewards performance in your merchant dashboard." },
 { Icon: Calendar, name:"Booking & Scheduling", desc:"Manage appointments, grooming, training. Online booking with calendar sync." },
 { Icon: Mail, name:"Invoicing & Subscriptions", desc:"Send invoices, run recurring subscriptions, accept tips — all in one place." },
 { Icon: ShoppingBag, name:"Storefront & Catalog", desc:"Sell products online with a built-in cart, inventory, and your own merchant page." },
];

const audiences: { Icon: LucideIcon; type: string; title: string; desc: string }[] = [
 { Icon: Scissors, type:"Groomers", title:"Build a loyal book", desc:"Bookings, reminders, and rewards that keep clients on schedule and coming back." },
 { Icon: Store, type:"Pet Stores", title:"Sell more, retain more", desc:"Storefront, POS, and rewards in one. Customers earn PawBucks on every basket." },
 { Icon: Bone, type:"Trainers, Sitters & Walkers", title:"Run your service business", desc:"Schedule, invoice, and grow with rewards your clients actually use." },
];

const faqs = [
 { q:"How much does it cost to join?", a:"Free. No monthly fees, no setup costs, no hidden charges. You only pay a 3% success fee on the USD portion of platform-processed transactions." },
 { q:"What is the 3% fee on?", a:"It applies only to the USD/credit-card portion of a transaction processed through PawBucks. PawBucks (loyalty currency) redemptions never carry a success fee." },
 { q:"How do customers earn PawBucks at my store?", a:"Customers automatically earn PawBucks on every USD purchase. You set the multiplier; they redeem on future visits." },
 { q:"Do I need new hardware?", a:"No. Use your phone, tablet, or laptop. Optional Clover POS integration is available." },
 { q:"When do I get paid?", a:"Payouts go directly to your bank via Stripe on a daily rolling schedule." },
];

const MerchantLanding = () => {
 const navigate = useNavigate();
 const [openFaq, setOpenFaq] = useState<number | null>(0);

 const goSignup = () => navigate("/auth?role=merchant");
 const goSignin = () => navigate("/auth?role=merchant");

 return (
 <>
 <SEO
 title={seoMeta.merchants.title}
 description={seoMeta.merchants.description}
 keywords={[...seoMeta.merchants.keywords]}
 canonical={seoMeta.merchants.canonical}
 />
 <link rel="preconnect" href="https://fonts.googleapis.com" />
 <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
 <style>{styles}</style>

 <div className="ml-root">
 <nav className="ml-nav">
 <button className="ml-nav-logo" onClick={() => navigate("/")} style={{ background:"none", border:"none", cursor:"pointer", padding: 0 }}>
 <img src={logo} alt="PawBucks" />
 </button>
 <button className="ml-nav-cta" onClick={goSignin}>Sign In</button>
 </nav>

 {/* HERO */}
 <section className="ml-hero">
 <div className="ml-hero-left">
 <div className="ml-eyebrow">For Pet Businesses</div>
 <h1 className="ml-hero-title">
 Grow your pet business with <em>rewards that work.</em>
 </h1>
 <p className="ml-hero-sub">
 Join PawBucks free. Accept payments, run loyalty, manage bookings, and keep customers coming back — all from one platform built for pet professionals.
 </p>
 <div className="ml-actions">
 <button className="ml-btn-primary" onClick={goSignup}>Get Started Free</button>
 <button className="ml-btn-ghost" onClick={() => document.getElementById("how")?.scrollIntoView({ behavior:"smooth" })}>
 See how it works →
 </button>
 </div>
 </div>
 <div className="ml-hero-right">
 <div className="ml-pricing-card">
 <div className="ml-price-row">
 <div>
 <div className="ml-price-label">Setup fee</div>
 <div className="ml-price-sub">One-time onboarding</div>
 </div>
 <div className="ml-price-value free">$0</div>
 </div>
 <div className="ml-price-row">
 <div>
 <div className="ml-price-label">Monthly fee</div>
 <div className="ml-price-sub">No subscription required</div>
 </div>
 <div className="ml-price-value free">$0</div>
 </div>
 <div className="ml-price-row">
 <div>
 <div className="ml-price-label">Success fee</div>
 <div className="ml-price-sub">USD portion only</div>
 </div>
 <div className="ml-price-value pct">3%</div>
 </div>
 <div className="ml-price-example">
 <strong>Example:</strong> A $100 USD sale → $3 success fee.
 PawBucks redemptions carry <strong>0% fee</strong>.
 </div>
 </div>
 </div>
 </section>

 {/* HOW */}
 <section className="ml-section ml-how" id="how">
 <div className="ml-eyebrow" style={{ color:"var(--teal-light)" }}>How It Works</div>
 <h2 className="ml-section-title">Four steps to launch.</h2>
 <p className="ml-section-sub">From signup to first sale in under an hour.</p>
 <div className="ml-steps">
 {[
 { n:"01", t:"Sign Up Free", b:"Create your merchant account in minutes. No credit card required." },
 { n:"02", t:"Set Up Your Store", b:"Add your services, products, hours, and rewards multiplier." },
 { n:"03", t:"Start Accepting Payments", b:"Take payments online, in-store, or on the go. Customers earn PawBucks automatically." },
 { n:"04", t:"Grow & Retain", b:"Track performance, run campaigns, and watch customers come back." },
 ].map((s) => (
 <div className="ml-step" key={s.n}>
 <div className="ml-step-num">{s.n}</div>
 <div className="ml-step-title">{s.t}</div>
 <div className="ml-step-body">{s.b}</div>
 </div>
 ))}
 </div>
 </section>

 {/* FEATURES */}
 <section className="ml-section">
 <div className="ml-eyebrow">Everything Built In</div>
 <h2 className="ml-section-title">Tools that pay for themselves.</h2>
 <p className="ml-section-sub">No add-ons, no upsells. Every feature included from day one.</p>
 <div className="ml-features-grid">
 {features.map((f) => (
            <div className="ml-feature-card" key={f.name}>
 <div className="ml-feature-icon"><f.Icon className="w-8 h-8" /></div>
 <div className="ml-feature-name">{f.name}</div>
 <div className="ml-feature-desc">{f.desc}</div>
 </div>
 ))}
 </div>
 </section>

 {/* WHO */}
 <section className="ml-section ml-who">
 <div className="ml-eyebrow">Who It&apos;s For</div>
 <h2 className="ml-section-title">Built for every kind of pet business.</h2>
 <div className="ml-who-grid">
 {audiences.map((a) => (
            <div className="ml-who-card" key={a.type}>
 <span className="ml-who-emoji"><a.Icon className="w-8 h-8" /></span>
 <div className="ml-who-type">{a.type}</div>
 <div className="ml-who-title">{a.title}</div>
 <div className="ml-who-desc">{a.desc}</div>
 </div>
 ))}
 </div>
 </section>

 {/* MATH */}
 <section className="ml-section ml-math">
 <div className="ml-math-inner">
 <div>
 <div className="ml-eyebrow">The Math</div>
 <h2 className="ml-section-title">3% on USD revenue.<br/>100% transparent.</h2>
 <p className="ml-section-sub">Compare PawBucks to what you&rsquo;re probably already paying to acquire clients.</p>
 <table className="ml-math-table">
 <tbody>
 <tr><td>Google Ads (avg. pet industry CPC)</td><td>$2&ndash;$6 per click</td></tr>
 <tr><td>Yelp advertising</td><td>$300&ndash;$1,000/mo</td></tr>
 <tr><td>Groupon / deal sites</td><td>30&ndash;50% of revenue</td></tr>
 <tr><td>Instagram / Facebook ads</td><td>Pay upfront, no guarantee</td></tr>
 <tr className="total"><td>PawBucks success fee</td><td>3% of USD — always</td></tr>
 </tbody>
 </table>
 </div>
 <div className="ml-math-callout">
 <div className="ml-math-callout-label">If you process</div>
 <div className="ml-math-big">$50k</div>
 <div className="ml-math-caption">
 in USD revenue through PawBucks over a year, your total success fee is{""}
 <strong style={{ color:"var(--teal-dark)" }}>$1,500</strong>. Clients who offset
 with PawBucks rewards reduce your fee further.
 </div>
 <div className="ml-math-divider" />
 <div className="ml-math-callout-label">Compare that to</div>
 <div style={{ fontSize:"0.875rem", color:"var(--muted)", lineHeight: 1.7 }}>
 A $500/mo Yelp ad budget ={""}
 <strong style={{ color:"var(--ink)" }}>$6,000/year</strong> — regardless of results.
 </div>
 </div>
 </div>
 </section>

 {/* PREMIUM MERCHANTS SHOWCASE */}
 <section className="ml-section" style={{ background:"var(--section-alt)" }}>
 <div className="ml-eyebrow">Premium Spotlight</div>
 <h2 className="ml-section-title">See where premium merchants get featured.</h2>
 <p className="ml-section-sub">
 Upgraded merchants rotate through our Premium Spotlight across the app — placed in front of pet owners actively looking to spend.
 </p>
 <div style={{ marginTop:"2.5rem" }}>
 <PremiumMerchantsBanner title="Featured Premium Merchants" />
 </div>
 </section>

 {/* FAQ */}
 <section className="ml-section">
 <div className="ml-eyebrow">FAQ</div>
 <h2 className="ml-section-title">Questions, answered.</h2>
 <div className="ml-faq-list">
 {faqs.map((f, i) => (
 <div
 key={i}
 className={`ml-faq-item ${openFaq === i ?"open" :""}`}
 onClick={() => setOpenFaq(openFaq === i ? null : i)}
 >
 <div className="ml-faq-q">
 <span>{f.q}</span>
 <span className="ml-faq-arrow">+</span>
 </div>
 <div className="ml-faq-a">{f.a}</div>
 </div>
 ))}
 </div>
 </section>

 {/* CTA */}
 <section className="ml-cta-section">
 <div className="ml-eyebrow">Ready When You Are</div>
 <h2 className="ml-section-title">Start growing your pet business today.</h2>
 <p className="ml-section-sub">Free to join. Setup in minutes. Cancel anytime.</p>
 <button className="ml-btn-primary" onClick={goSignup}>Create Your Merchant Account</button>
 <div className="ml-cta-note">No credit card required • Free forever plan</div>
 </section>

 <footer className="ml-footer">
 <div>© {new Date().getFullYear()} PawBucks. All rights reserved.</div>
 <div style={{ display:"flex", gap:"1.5rem" }}>
 <a href="/privacy">Privacy</a>
 <a href="/terms">Terms</a>
 <a href="/about">About</a>
 </div>
 </footer>
 </div>
 </>
 );
};

export default MerchantLanding;
