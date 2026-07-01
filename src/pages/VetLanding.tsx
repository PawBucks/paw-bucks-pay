import { useNavigate, Link } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { seoMeta } from "@/lib/seoMeta";
import logo from "@/assets/logo.png";
import {
  Zap,
  ChevronDown,
  UserPlus,
  FileText,
  Sparkles,
  Shield,
  Heart,
  TrendingUp,
  Search,
  Pill,
  Check,
  CheckCircle2,
  DollarSign,
  Clock,
  Users,
  Share2,
  Stethoscope,
  LayoutGrid,
  Twitter,
  Instagram,
  Facebook,
  Linkedin,
} from "lucide-react";

const css = `
.vl *{box-sizing:border-box}
.vl{font-family:'Inter',system-ui,sans-serif;color:#0f172a;font-size:14px;line-height:1.5;background:#fff;
  --teal:#12a8b3;--teal-dark:#0a8f9a;--teal-pale:#e8f9fa;--teal-border:#99f0ea;
  --ink:#0f172a;--muted:#475569;--muted-light:#94a3b8;--border:#e8edf2;
  --bg:#f8f9fa;--dark:#0a1f26;--serif:'Playfair Display',Georgia,serif;}
.vl a{text-decoration:none}
.vl svg{display:block}
.vl .nav{position:sticky;top:0;z-index:50;background:rgba(255,255,255,0.96);backdrop-filter:blur(12px);
  border-bottom:1px solid var(--border);padding:10px 20px;display:flex;align-items:center;justify-content:space-between}
.vl .nav-logo{height:38px;width:auto}
.vl .nav-right{display:flex;align-items:center;gap:10px}
.vl .nav-link{font-size:13px;font-weight:500;color:var(--muted);padding:4px 8px}
.vl .nav-link:hover{color:var(--teal)}
.vl .nav-cta{background:var(--teal);color:#fff;padding:8px 18px;border-radius:8px;font-size:13px;font-weight:600;white-space:nowrap;transition:background .15s}
.vl .nav-cta:hover{background:var(--teal-dark)}
.vl .hero{background:#fff;padding:48px 20px 0;text-align:center;border-bottom:1px solid var(--border);position:relative;overflow:hidden}
.vl .hero::before{content:'';position:absolute;top:-200px;left:50%;transform:translateX(-50%);width:700px;height:500px;
  background:radial-gradient(ellipse at center,rgba(18,168,179,.08) 0%,transparent 70%);pointer-events:none}
.vl .hero-eyebrow{display:inline-flex;align-items:center;gap:6px;background:var(--teal-pale);border:1px solid var(--teal-border);
  color:var(--teal-dark);font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;padding:5px 14px;border-radius:999px;margin-bottom:20px;position:relative}
.vl .hero-h1{font-family:var(--serif);font-size:38px;font-weight:700;color:var(--ink);letter-spacing:-.02em;line-height:1.15;margin-bottom:6px;position:relative}
.vl .hero-h1 span{color:var(--teal)}
.vl .hero-sub{font-size:16px;color:var(--muted);line-height:1.65;max-width:420px;margin:0 auto 8px;position:relative}
.vl .hero-sub2{font-size:14px;color:var(--muted-light);line-height:1.65;max-width:380px;margin:0 auto 28px;position:relative}
.vl .hero-ctas{display:flex;flex-direction:column;gap:10px;max-width:340px;margin:0 auto 32px;position:relative}
.vl .btn-primary{display:flex;align-items:center;justify-content:center;gap:8px;background:var(--teal);color:#fff;
  padding:14px 24px;border-radius:12px;font-size:15px;font-weight:700;border:none;cursor:pointer;font-family:inherit;letter-spacing:-.01em;transition:background .15s}
.vl .btn-primary:hover{background:var(--teal-dark)}
.vl .btn-ghost{display:flex;align-items:center;justify-content:center;gap:6px;background:#fff;color:var(--muted);
  padding:13px 24px;border-radius:12px;font-size:14px;font-weight:500;border:1px solid var(--border);cursor:pointer;font-family:inherit;transition:all .15s}
.vl .btn-ghost:hover{border-color:var(--teal);color:var(--teal-dark);background:var(--teal-pale)}
.vl .hero-trust{font-size:12px;color:var(--muted-light);margin-bottom:32px;position:relative}
.vl .hero-trust strong{color:var(--muted)}
.vl .hero-stats{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--border);margin:0 -20px}
.vl .hero-stat{padding:16px 12px;text-align:center;border-right:1px solid var(--border)}
.vl .hero-stat:last-child{border-right:none}
.vl .hero-stat-val{font-size:22px;font-weight:800;color:var(--teal);letter-spacing:-.02em}
.vl .hero-stat-label{font-size:10px;color:var(--muted-light);font-weight:500;margin-top:3px;line-height:1.4}
.vl .section{padding:52px 20px}
.vl .section-white{background:#fff}
.vl .section-bg{background:var(--bg)}
.vl .section-eyebrow{display:inline-flex;align-items:center;gap:6px;background:var(--teal-pale);border:1px solid var(--teal-border);
  color:var(--teal-dark);font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;padding:4px 12px;border-radius:999px;margin-bottom:14px}
.vl .section-h2{font-family:var(--serif);font-size:28px;font-weight:700;color:var(--ink);letter-spacing:-.02em;line-height:1.25;margin-bottom:10px}
.vl .section-sub{font-size:15px;color:var(--muted);line-height:1.65;margin-bottom:28px}
.vl .feature-card{background:#fff;border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:12px}
.vl .feature-icon{width:44px;height:44px;border-radius:10px;background:var(--teal-pale);border:1px solid var(--teal-border);
  display:flex;align-items:center;justify-content:center;margin-bottom:14px;color:var(--teal)}
.vl .feature-h3{font-size:17px;font-weight:700;color:var(--ink);margin-bottom:6px;letter-spacing:-.01em}
.vl .feature-p{font-size:13px;color:var(--muted);line-height:1.65;margin-bottom:12px}
.vl .feature-check{display:flex;align-items:flex-start;gap:8px;font-size:13px;color:var(--muted);margin-bottom:6px}
.vl .feature-check svg{flex-shrink:0;margin-top:2px;color:var(--teal)}
.vl .example-box{background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-top:14px;font-size:12px;color:var(--muted);line-height:1.65}
.vl .example-box strong{color:var(--ink);display:block;margin-bottom:4px}
.vl .soap-card{background:#fff;border:1px solid var(--border);border-radius:14px;padding:16px;margin-top:16px;box-shadow:0 4px 20px rgba(10,31,38,.08)}
.vl .soap-header{display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border)}
.vl .soap-header-icon{width:38px;height:38px;border-radius:10px;background:#fef9c3;border:1px solid #fde68a;
  display:flex;align-items:center;justify-content:center;color:#d97706}
.vl .soap-header-title{font-size:14px;font-weight:700;color:var(--ink)}
.vl .soap-header-sub{font-size:11px;color:var(--muted-light)}
.vl .soap-section{background:var(--bg);border-radius:8px;padding:10px 12px;margin-bottom:8px}
.vl .soap-section:last-of-type{margin-bottom:14px}
.vl .soap-label{font-size:10px;font-weight:700;color:var(--teal);letter-spacing:.06em;text-transform:uppercase;margin-bottom:3px}
.vl .soap-text{font-size:12px;color:var(--muted);line-height:1.55}
.vl .soap-btn{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:11px;
  background:var(--teal);color:#fff;border:none;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
.vl .why-grid{display:flex;flex-direction:column;gap:10px}
.vl .why-card{background:#fff;border:1px solid var(--border);border-radius:14px;padding:18px;text-align:center}
.vl .why-icon{width:52px;height:52px;border-radius:50%;background:var(--teal-pale);border:1px solid var(--teal-border);
  display:flex;align-items:center;justify-content:center;margin:0 auto 12px;color:var(--teal)}
.vl .why-h3{font-size:16px;font-weight:700;color:var(--ink);margin-bottom:6px}
.vl .why-p{font-size:13px;color:var(--muted);line-height:1.6}
.vl .pricing-card{background:#fff;border:1px solid var(--border);border-radius:16px;padding:22px;margin-bottom:12px}
.vl .pricing-badge{display:inline-flex;align-items:center;gap:4px;background:var(--teal-pale);border:1px solid var(--teal-border);
  color:var(--teal-dark);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:3px 10px;border-radius:999px;margin-bottom:12px}
.vl .pricing-amount{font-size:36px;font-weight:800;color:var(--ink);letter-spacing:-.03em;line-height:1}
.vl .pricing-period{font-size:13px;color:var(--muted-light);margin-left:4px}
.vl .pricing-desc{font-size:13px;color:var(--muted);margin:8px 0 16px;line-height:1.55}
.vl .pricing-row{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted);margin-bottom:7px}
.vl .pricing-row svg{color:var(--teal);flex-shrink:0}
.vl .cta-section{background:var(--dark);padding:52px 20px;text-align:center}
.vl .cta-icon{width:64px;height:64px;border-radius:16px;background:rgba(18,168,179,.15);border:1px solid rgba(18,168,179,.3);
  display:flex;align-items:center;justify-content:center;color:var(--teal);margin:0 auto 14px}
.vl .cta-h2{font-family:var(--serif);font-size:28px;font-weight:700;color:#fff;letter-spacing:-.02em;line-height:1.2;margin-bottom:10px}
.vl .cta-sub{font-size:14px;color:#6ab8c0;line-height:1.65;margin:0 auto 28px;max-width:340px}
.vl .cta-trust{font-size:12px;color:#4a7a80;margin-top:14px}
.vl .photo-wrap{position:relative;border-radius:14px;overflow:hidden;margin-bottom:24px}
.vl .photo-hero{height:220px;background:linear-gradient(135deg,#1a3a42,#0a2830);border-radius:14px;display:flex;align-items:center;justify-content:center;color:var(--teal)}
.vl .photo-caption{font-size:15px;font-weight:600;color:#fff;position:absolute;bottom:0;left:0;right:0;padding:14px 16px;
  background:linear-gradient(0deg,rgba(10,31,38,.8),transparent)}
.vl .testimonial{background:#fff;border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:12px}
.vl .testimonial-stars{color:#f59e0b;font-size:14px;margin-bottom:8px;letter-spacing:2px}
.vl .testimonial-quote{font-size:14px;color:var(--ink);line-height:1.65;margin-bottom:12px;font-style:italic}
.vl .testimonial-author{font-size:12px;color:var(--muted-light)}
.vl .testimonial-author strong{color:var(--muted);font-style:normal}
.vl .footer{background:var(--bg);border-top:1px solid var(--border);padding:28px 20px;text-align:center}
.vl .footer-logo{height:36px;margin:0 auto 10px}
.vl .footer-tagline{font-size:12px;color:var(--muted-light);margin-bottom:16px;line-height:1.6}
.vl .footer-links{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-bottom:16px}
.vl .footer-links a{font-size:12px;color:var(--muted)}
.vl .footer-links a:hover{color:var(--teal)}
.vl .footer-social{display:flex;gap:12px;justify-content:center;margin-bottom:14px}
.vl .footer-social a{width:34px;height:34px;border-radius:8px;border:1px solid var(--border);background:#fff;
  display:flex;align-items:center;justify-content:center;color:var(--muted)}
.vl .footer-social a:hover{color:var(--teal);border-color:var(--teal-border)}
.vl .footer-copy{font-size:11px;color:var(--muted-light)}
.vl .sticky-cta{position:fixed;bottom:0;left:0;right:0;background:rgba(255,255,255,.97);backdrop-filter:blur(8px);
  border-top:1px solid var(--border);padding:12px 16px;z-index:40;display:none}
@media(max-width:640px){.vl .sticky-cta{display:block}}
.vl .divider{height:1px;background:var(--border);margin:0 20px}
@media(min-width:768px){
  .vl .hero-h1{font-size:52px}
  .vl .section-h2{font-size:36px}
  .vl .hero-ctas{flex-direction:row;max-width:520px}
  .vl .why-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
}
@media(min-width:1024px){
  .vl .why-grid{grid-template-columns:repeat(4,1fr)}
  .vl .hero,.vl .section,.vl .cta-section,.vl .footer{padding-left:max(20px,calc((100vw - 1080px)/2));padding-right:max(20px,calc((100vw - 1080px)/2))}
  .vl .hero-stats{margin-left:0;margin-right:0}
}
`;

const Tick = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
);

const VetLanding = () => {
  const navigate = useNavigate();
  const goSignup = () => navigate("/auth?role=vet");

  return (
    <>
      <SEO {...seoMeta.vets} />
      <style>{css}</style>
      <div className="vl">
        {/* NAV */}
        <nav className="nav">
          <Link to="/">
            <img src={logo} alt="PawBucks logo" className="nav-logo" />
          </Link>
          <div className="nav-right">
            <Link to="/merchants" className="nav-link">For Merchants</Link>
            <button onClick={goSignup} className="nav-cta">Sign Up Free →</button>
          </div>
        </nav>

        {/* HERO */}
        <div className="hero">
          <div className="hero-eyebrow"><Zap size={13} /> Built for Veterinary Practices</div>
          <h1 className="hero-h1">Practice Smarter,<br /><span>Not Harder.</span></h1>
          <p className="hero-sub">EMR, AI clinical tools, insurance automation, and practice growth — all in one platform with PawBucks rewards built in.</p>
          <p className="hero-sub2">Stop losing revenue to missed appointments and online pharmacies. Retain patients, streamline workflows, and build recurring revenue — while your clients earn rewards they love.</p>
          <div className="hero-ctas">
            <button onClick={goSignup} className="btn-primary"><UserPlus size={16} /> Sign Up as a Veterinarian</button>
            <a href="#features" className="btn-ghost">See Features <ChevronDown size={14} /></a>
          </div>
          <p className="hero-trust"><strong>$0 setup fee</strong> · No long-term contracts · Cancel anytime · 3% success fee only on completed transactions</p>
          <div className="hero-stats">
            <div className="hero-stat"><div className="hero-stat-val">10x–30x</div><div className="hero-stat-label">PawBucks<br />Rewards</div></div>
            <div className="hero-stat"><div className="hero-stat-val">AI</div><div className="hero-stat-label">Clinical<br />Assistant</div></div>
            <div className="hero-stat"><div className="hero-stat-val">Auto</div><div className="hero-stat-label">Insurance<br />Claims</div></div>
            <div className="hero-stat"><div className="hero-stat-val">$0</div><div className="hero-stat-label">Setup<br />Fee</div></div>
          </div>
        </div>

        {/* PHOTO */}
        <div className="section section-white" style={{ paddingBottom: 0 }}>
          <div className="photo-wrap">
            <div className="photo-hero"><Stethoscope size={60} /></div>
            <div className="photo-caption">Trusted by veterinary practices delivering exceptional pet care.</div>
          </div>
        </div>

        {/* FEATURES */}
        <div className="section section-white" id="features">
          <div className="section-eyebrow"><LayoutGrid size={11} /> Everything Your Practice Needs</div>
          <h2 className="section-h2">From clinical workflows to revenue optimization.</h2>
          <p className="section-sub">One integrated platform replaces your EMR, scheduling tool, insurance portal, and client communication system.</p>

          <div className="feature-card">
            <div className="feature-icon"><FileText size={20} /></div>
            <h3 className="feature-h3">Complete EMR System</h3>
            <p className="feature-p">Digital patient records, SOAP notes with vitals tracking, lab & imaging management, and surgical documentation.</p>
            <div className="feature-check"><Tick />Full patient history & records</div>
            <div className="feature-check"><Tick />Lab & imaging management</div>
            <div className="feature-check"><Tick />Surgical documentation</div>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ background: "#fef9c3", borderColor: "#fde68a", color: "#d97706" }}><Sparkles size={20} /></div>
            <h3 className="feature-h3">AI Clinical Assistant</h3>
            <p className="feature-p">Reduce documentation time by up to 50% with AI that understands veterinary medicine.</p>
            <div className="feature-check"><Tick />Voice-to-SOAP notes — dictate naturally, AI structures it</div>
            <div className="feature-check"><Tick />Symptom triage scoring</div>
            <div className="feature-check"><Tick />Diagnostic overlays for X-rays & ultrasounds</div>

            <div className="soap-card">
              <div className="soap-header">
                <div className="soap-header-icon"><Sparkles size={18} /></div>
                <div>
                  <div className="soap-header-title">AI SOAP Draft</div>
                  <div className="soap-header-sub">Generated in 3.2 seconds</div>
                </div>
              </div>
              <div className="soap-section"><div className="soap-label">Subjective</div><div className="soap-text">Owner reports decreased appetite ×3 days, lethargy, occasional vomiting…</div></div>
              <div className="soap-section"><div className="soap-label">Objective</div><div className="soap-text">T: 102.8°F, HR: 120, RR: 24, BCS: 5/9. Abdominal palpation — mild discomfort cranial abdomen…</div></div>
              <div className="soap-section"><div className="soap-label">Assessment</div><div className="soap-text">R/O gastroenteritis, pancreatitis, dietary indiscretion. Further diagnostics recommended…</div></div>
              <button className="soap-btn"><CheckCircle2 size={14} /> Apply to Record</button>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon"><Shield size={20} /></div>
            <h3 className="feature-h3">Insurance Claim-Splicing</h3>
            <p className="feature-p">When an owner pays via PawBucks, we automatically calculate coverage based on their policy. The claim goes to insurance, and the owner only pays their co-pay at checkout.</p>
            <div className="feature-check"><Tick />Automatic deductible calculation</div>
            <div className="feature-check"><Tick />Real-time coverage estimation</div>
            <div className="feature-check"><Tick />Major insurers supported</div>
          </div>

          <div className="feature-card">
            <div className="feature-icon"><Heart size={20} /></div>
            <h3 className="feature-h3">Wellness Plan Architect</h3>
            <p className="feature-p">Build custom subscription plans for preventive care. Owners pay monthly, earn 10x–30x PawBucks rewards, and you get predictable recurring revenue.</p>
            <div className="feature-check"><Tick />Customize included services</div>
            <div className="feature-check"><Tick />Automated billing via Stripe</div>
            <div className="feature-check"><Tick />Owners earn PawBucks on every plan</div>
            <div className="example-box">
              <strong>Example Plan:</strong>
              $50/month → Annual wellness exam + 3 vaccines + monthly heartworm prevention. Owner earns 1,500 PawBucks/year ($15 back).
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon"><TrendingUp size={20} /></div>
            <h3 className="feature-h3">The "Gap Filler" Tool</h3>
            <p className="feature-p">Identify overdue patients — pets due for vaccines, exams, or dental cleanings — and send targeted PawBucks bonus offers to bring them back.</p>
            <div className="feature-check"><Tick />Auto-detect overdue care</div>
            <div className="feature-check"><Tick />One-click bonus PawBucks campaigns</div>
            <div className="feature-check"><Tick />Track conversion in real time</div>
          </div>

          <div className="feature-card">
            <div className="feature-icon"><Pill size={20} /></div>
            <h3 className="feature-h3">Prescription Fulfillment Engine</h3>
            <p className="feature-p">Stop losing pharmacy revenue to Chewy. Approve prescriptions in the portal that ship from the PawBucks Store — you keep 10–25% margin.</p>
            <div className="example-box" style={{ background: "#fff", borderColor: "#fde68a" }}>
              <strong style={{ color: "#92400e" }}>Your Revenue Share:</strong>
              Apoquel 16mg (30ct) @ $85.99 → You earn $12.90 (15% margin)
            </div>
          </div>
        </div>

        <div className="divider" />

        {/* CLIENT CARE */}
        <div className="section section-white">
          <div className="section-eyebrow"><Heart size={11} /> Client Care</div>
          <h2 className="section-h2">Build lasting client relationships.</h2>
          <p className="section-sub">Empower pet owners with transparent care plans and seamless communication — creating trust that keeps families coming back for generations.</p>

          <div className="feature-check" style={{ marginBottom: 12 }}><Tick />Clear treatment explanations and cost breakdowns</div>
          <div className="feature-check" style={{ marginBottom: 12 }}><Tick />Automated follow-up reminders and care instructions</div>
          <div className="feature-check" style={{ marginBottom: 12 }}><Tick />PawBucks rewards that incentivize preventive care</div>
          <div className="feature-check" style={{ marginBottom: 24 }}><Tick />Share medical notes with groomers, trainers & other PawBucks partners</div>

          <div className="testimonial">
            <div className="testimonial-stars">★★★★★</div>
            <p className="testimonial-quote">"The AI SOAP notes alone save me 45 minutes a day. I can actually spend that time with my patients instead of typing."</p>
            <div className="testimonial-author"><strong>Dr. Sarah Chen</strong> — Solo practice owner, Santa Monica CA</div>
          </div>
          <div className="testimonial">
            <div className="testimonial-stars">★★★★★</div>
            <p className="testimonial-quote">"We launched a $65/month wellness plan and enrolled 40 clients in the first month. That's $2,600 in predictable monthly revenue we never had before."</p>
            <div className="testimonial-author"><strong>Dr. Marcus Webb</strong> — Paw & Claw Animal Hospital</div>
          </div>
        </div>

        <div className="divider" />

        {/* WHY CHOOSE */}
        <div className="section section-bg">
          <h2 className="section-h2" style={{ textAlign: "center", marginBottom: 6 }}>Why Vets Choose PawBucks</h2>
          <p className="section-sub" style={{ textAlign: "center" }}>Three outcomes, one platform.</p>
          <div className="why-grid">
            <div className="why-card"><div className="why-icon"><DollarSign size={22} /></div><h3 className="why-h3">Increase Revenue</h3><p className="why-p">Wellness plans, prescription margins, and reduced no-shows through automated reminders and PawBucks incentives.</p></div>
            <div className="why-card"><div className="why-icon"><Clock size={22} /></div><h3 className="why-h3">Save Time</h3><p className="why-p">AI-powered SOAP notes, automated insurance processing, and streamlined workflows cut documentation time by up to 50%.</p></div>
            <div className="why-card"><div className="why-icon"><Users size={22} /></div><h3 className="why-h3">Retain Patients</h3><p className="why-p">PawBucks rewards keep pet owners coming back. Gap analysis ensures no patient falls through the cracks.</p></div>
            <div className="why-card"><div className="why-icon"><Share2 size={22} /></div><h3 className="why-h3">Care Network</h3><p className="why-p">Share relevant medical notes with trainers, groomers, and other pet merchants in the PawBucks ecosystem.</p></div>
          </div>
        </div>

        <div className="divider" />

        {/* PRICING */}
        <div className="section section-white">
          <div className="section-eyebrow"><DollarSign size={11} /> Simple Pricing</div>
          <h2 className="section-h2">Pay only when you get paid.</h2>
          <p className="section-sub">No monthly fees. No setup costs. A small success fee on completed transactions only — meaning PawBucks only earns when you do.</p>

          <div className="pricing-card">
            <div className="pricing-badge"><Check size={10} /> Vet Partner Plan</div>
            <div><span className="pricing-amount">$0</span><span className="pricing-period">/ month</span></div>
            <p className="pricing-desc">Pay nothing upfront. We take a 3% success fee on the USD portion of each completed transaction only. No fee on PawBucks redemptions.</p>
            <div className="pricing-row"><Tick />Full EMR + AI clinical tools</div>
            <div className="pricing-row"><Tick />Insurance claim automation</div>
            <div className="pricing-row"><Tick />Wellness plan builder</div>
            <div className="pricing-row"><Tick />Gap Filler patient analytics</div>
            <div className="pricing-row"><Tick />PawBucks directory listing</div>
            <div className="pricing-row"><Tick />Client rewards program</div>
            <button onClick={goSignup} className="btn-primary" style={{ marginTop: 18, width: "100%" }}>Get Started Free →</button>
            <p style={{ textAlign: "center", fontSize: 11, color: "var(--muted-light)", marginTop: 10 }}>No credit card required · Cancel anytime</p>
          </div>
        </div>

        {/* CTA */}
        <div className="cta-section">
          <div className="cta-icon"><Stethoscope size={32} /></div>
          <h2 className="cta-h2">Ready to transform your practice?</h2>
          <p className="cta-sub">Join forward-thinking veterinarians using PawBucks to grow their practice and delight their clients.</p>
          <button onClick={goSignup} className="btn-primary" style={{ maxWidth: 320, margin: "0 auto" }}>Sign Up as a Veterinarian →</button>
          <p className="cta-trust">No setup fees · No long-term contracts · Cancel anytime</p>
        </div>

        {/* FOOTER */}
        <div className="footer">
          <img src={logo} alt="PawBucks logo" className="footer-logo" />
          <p className="footer-tagline">Empowering veterinary practices with smart payments,<br />rewards, and growth tools.</p>
          <div className="footer-links">
            <Link to="/merchants">For Merchants</Link>
            <Link to="/directory">Directory</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/about">About</Link>
            <a href="mailto:support@pawbucks.app">Support</a>
          </div>
          <div className="footer-social">
            <a href="https://twitter.com/PawBucks" aria-label="Twitter" target="_blank" rel="noopener noreferrer"><Twitter size={16} /></a>
            <a href="https://instagram.com/PawBucks" aria-label="Instagram" target="_blank" rel="noopener noreferrer"><Instagram size={16} /></a>
            <a href="https://facebook.com/PawBucks" aria-label="Facebook" target="_blank" rel="noopener noreferrer"><Facebook size={16} /></a>
            <a href="https://linkedin.com/company/pawbucks" aria-label="LinkedIn" target="_blank" rel="noopener noreferrer"><Linkedin size={16} /></a>
          </div>
          <p className="footer-copy">© {new Date().getFullYear()} PawBucks, Inc. All rights reserved.</p>
        </div>

        {/* STICKY MOBILE CTA */}
        <div className="sticky-cta">
          <button onClick={goSignup} className="btn-primary" style={{ fontSize: 14, width: "100%" }}>Sign Up as a Veterinarian — Free →</button>
        </div>
      </div>
    </>
  );
};

export default VetLanding;