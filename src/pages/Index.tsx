import { useEffect, useState } from"react";
import { useNavigate } from"react-router-dom";
import { useAuth } from"@/hooks/useAuth";
import { supabase } from"@/integrations/supabase/client";
import { SEO } from"@/components/SEO";
import { seoMeta } from"@/lib/seoMeta";
import { PremiumMerchantsBanner } from "@/components/PremiumMerchantsBanner";
import logo from"@/assets/logo.png";

const styles = `
 .pl-root {
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
 .pl-root * { box-sizing: border-box; }
 .pl-root h1, .pl-root h2, .pl-root h3, .pl-root .pl-display { font-family:'Playfair Display', serif; }

 /* NAV */
 .pl-nav {
 position: fixed; top: 0; left: 0; right: 0; z-index: 100;
 display: flex; justify-content: space-between; align-items: center;
 padding: 0.75rem 2.5rem;
 background: rgba(255,255,255,0.96);
 backdrop-filter: blur(12px);
 border-bottom: 1px solid var(--border);
 }
 .pl-nav-logo img { height: 44px; width: auto; display: block; }
 .pl-nav-links { display: flex; gap: 2rem; align-items: center; }
 .pl-nav-links a {
 color: var(--muted); text-decoration: none;
 font-size: 0.875rem; font-weight: 400;
 transition: color 0.2s; background: none; border: none; cursor: pointer;
 }
 .pl-nav-links a:hover { color: var(--teal); }
 .pl-nav-cta {
 background: var(--teal); color: #fff !important;
 padding: 0.6rem 1.4rem; border-radius: 3px;
 text-decoration: none; font-size: 0.85rem;
 font-weight: 500; letter-spacing: 0.03em;
 border: none; cursor: pointer;
 transition: background 0.2s;
 }
 .pl-nav-cta:hover { background: var(--ink); }
 .pl-nav-mobile-cta { display: none; }

 /* HERO */
 .pl-hero {
 min-height: 100vh;
 display: grid; grid-template-columns: 1fr 1fr;
 padding-top: 5rem; background: var(--white);
 position: relative; overflow: hidden;
 }
 .pl-hero::before {
 content:''; position: absolute;
 top: -200px; right: -200px;
 width: 700px; height: 700px; border-radius: 50%;
 background: radial-gradient(circle, #1ec8d418 0%, transparent 70%);
 pointer-events: none;
 }
 .pl-hero-left {
 display: flex; flex-direction: column; justify-content: center;
 padding: 5rem 3rem 5rem 5rem;
 }
 .pl-eyebrow {
 font-size: 0.75rem; font-weight: 500;
 letter-spacing: 0.15em; text-transform: uppercase;
 color: var(--teal); margin-bottom: 1.5rem;
 }
 .pl-hero-title {
 font-size: clamp(2.8rem, 5vw, 4.2rem);
 font-weight: 900; line-height: 1.05;
 letter-spacing: -0.03em; color: var(--ink);
 margin-bottom: 1.75rem;
 }
 .pl-hero-title em { font-style: italic; color: var(--teal); }
 .pl-hero-sub {
 font-size: 1.1rem; color: var(--muted);
 font-weight: 400; max-width: 440px;
 line-height: 1.75; margin-bottom: 2.5rem;
 }
 .pl-actions { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; margin-bottom: 2.5rem; }
 .pl-btn-primary {
 background: var(--teal); color: #fff !important;
 padding: 0.9rem 2rem; border-radius: 3px;
 text-decoration: none; font-weight: 500; font-size: 0.95rem;
 letter-spacing: 0.02em; border: none; cursor: pointer;
 transition: all 0.2s; display: inline-block;
 }
 .pl-btn-primary:hover { background: var(--ink); transform: translateY(-1px); }
 .pl-btn-ghost {
 color: var(--ink); text-decoration: none;
 font-size: 0.9rem; font-weight: 500;
 border: none; background: none; cursor: pointer;
 border-bottom: 1px solid var(--border); padding-bottom: 2px;
 transition: border-color 0.2s, color 0.2s;
 }
 .pl-btn-ghost:hover { border-color: var(--teal); color: var(--teal); }
 .pl-btn-link {
 color: var(--ink); font-size: 0.9rem; font-weight: 500;
 cursor: pointer; border-bottom: 1px solid var(--teal);
 padding-bottom: 2px; align-self: flex-start;
 }

 .pl-hero-stats { display: flex; gap: 2rem; flex-wrap: wrap; align-items: center; }
 .pl-stat { display: flex; flex-direction: column; }
 .pl-stat-num {
 font-family:'Playfair Display', serif;
 font-size: 1.6rem; font-weight: 900;
 color: var(--ink); line-height: 1;
 }
 .pl-stat-label { font-size: 0.75rem; color: var(--muted-light); margin-top: 0.2rem; }
 .pl-stat-divider { width: 1px; align-self: stretch; background: var(--border); }

 .pl-hero-right {
 display: flex; align-items: center; justify-content: center;
 padding: 5rem 4rem 5rem 2rem;
 }

 /* EARN CARD */
 .pl-earn-card {
 background: var(--white); border: 1px solid var(--border);
 border-radius: 6px; padding: 2.5rem;
 width: 100%; max-width: 400px;
 box-shadow: 0 20px 60px rgba(10,31,38,0.09);
 position: relative;
 }
 .pl-earn-card::before {
 content:'1,000 PawBucks = $1';
 position: absolute; top: -12px; left: 1.5rem;
 background: var(--teal); color: #fff;
 font-size: 0.7rem; font-weight: 500;
 letter-spacing: 0.08em; text-transform: uppercase;
 padding: 0.25rem 0.75rem; border-radius: 2px;
 }
 .pl-earn-title {
 font-size: 1.1rem; font-weight: 700;
 color: var(--ink); margin-bottom: 1.25rem;
 }
 .pl-tier-row {
 display: grid; grid-template-columns: minmax(110px, auto) 1fr;
 gap: 1rem; align-items: center;
 padding: 1.25rem 1.5rem; border-radius: 8px;
 margin-bottom: 0.9rem; border: 1px solid var(--teal);
 }
 .pl-tier-row:last-child { margin-bottom: 0; }
 .pl-tier-row.featured {
 background: var(--teal-pale); border-color: var(--teal);
 }
 .pl-tier-name { font-size: 1.15rem; font-weight: 700; color: var(--ink); line-height: 1.2; }
 .pl-tier-price { font-size: 0.95rem; color: var(--muted-light); margin-top: 0.35rem; line-height: 1.3; }
 .pl-tier-price.free-tag { color: var(--teal-dark); font-weight: 500; }
 .pl-tier-earn {
 font-family:'Playfair Display', serif;
 color: var(--teal-dark);
 display: flex; flex-direction: column; align-items: flex-end;
 line-height: 0.95;
 }
 .pl-tier-earn b {
 font-size: 1.6rem; font-weight: 700; display: block;
 }
 .pl-tier-earn em {
 font-size: 1.5rem; font-weight: 700; font-style: normal;
 display: block; margin-top: 0.1rem; white-space: nowrap;
 }
 .pl-tier-earn span {
 font-family:'DM Sans', sans-serif;
 font-size: 0.8rem; color: var(--muted-light);
 font-weight: 400; display: block; margin-top: 0.4rem;
 }
 .pl-earn-example {
 margin-top: 1.25rem; background: var(--teal-pale);
 border-radius: 6px; padding: 1.1rem 1.4rem;
 font-size: 0.95rem; color: var(--ink); line-height: 1.55;
 }
 .pl-earn-example strong { color: var(--teal-dark); }

 /* SECTIONS */
 .pl-section { padding: 6rem 5rem; }
 .pl-section-title {
 font-size: clamp(2.8rem, 5vw, 4.2rem);
 font-weight: 900; line-height: 1.05;
 letter-spacing: -0.03em; color: var(--ink);
 margin-bottom: 1.5rem;
 }
 .pl-section-sub {
 font-size: 1rem; color: var(--muted);
 max-width: 520px; line-height: 1.8;
 }

 /* HOW IT WORKS */
 .pl-how { background: var(--dark-bg); }
 .pl-how .pl-section-title { color: #fff; }
 .pl-how .pl-section-sub { color: #6ab8c0; }
 .pl-steps {
 display: grid; grid-template-columns: repeat(4, 1fr);
 gap: 2rem; margin-top: 3.5rem;
 }
 .pl-step { position: relative; padding-top: 1rem; }
 .pl-step-num {
 font-family:'Playfair Display', serif;
 font-size: 3.5rem; font-weight: 900;
 color: #1a5a66; line-height: 1;
 margin-bottom: 1rem; user-select: none;
 }
 .pl-step-title {
 font-size: 1rem; font-weight: 500;
 color: var(--teal-light); margin-bottom: 0.5rem;
 }
 .pl-step-body {
 font-size: 0.9rem; color: #6ab8c0;
 line-height: 1.7; font-weight: 300;
 }

 /* FEATURES */
 .pl-features { background: var(--white); }
 .pl-features-grid {
 display: grid; grid-template-columns: repeat(3, 1fr);
 gap: 1.5rem; margin-top: 3rem;
 }
 .pl-feature-card {
 background: var(--white); border: 1px solid var(--border);
 border-radius: 4px; padding: 1.75rem 2rem;
 transition: box-shadow 0.2s, transform 0.2s;
 position: relative; overflow: hidden;
 }
 .pl-feature-card::after {
 content:''; position: absolute;
 top: 0; left: 0; width: 100%; height: 3px;
 background: var(--teal);
 transform: scaleX(0); transform-origin: left;
 transition: transform 0.3s;
 }
 .pl-feature-card:hover { box-shadow: 0 8px 30px rgba(10,31,38,0.08); transform: translateY(-2px); }
 .pl-feature-card:hover::after { transform: scaleX(1); }
 .pl-feature-icon { font-size: 1.75rem; margin-bottom: 0.75rem; }
 .pl-feature-name { font-size: 1rem; font-weight: 500; margin-bottom: 0.4rem; color: var(--ink); }
 .pl-feature-desc { font-size: 0.875rem; color: var(--muted); line-height: 1.7; }

 /* LOST PET */
 .pl-lostpet { background: var(--section-alt); }
 .pl-lostpet-inner {
 display: grid; grid-template-columns: 1fr 1fr;
 gap: 5rem; align-items: center;
 }
 .pl-channels { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-top: 1.5rem; }
 .pl-pill {
 background: var(--white); border: 1px solid var(--border);
 border-radius: 20px; padding: 0.35rem 0.9rem;
 font-size: 0.8rem; color: var(--muted);
 }
 .pl-flyer {
 background: var(--white); border: 1px solid var(--border);
 border-radius: 6px; padding: 2rem;
 box-shadow: 0 12px 40px rgba(10,31,38,0.07);
 }
 .pl-flyer-header {
 display: flex; align-items: center; gap: 0.75rem;
 padding-bottom: 1rem; border-bottom: 1px solid var(--border);
 margin-bottom: 1rem;
 }
 .pl-flyer-avatar {
 width: 52px; height: 52px; border-radius: 50%;
 background: var(--teal-pale);
 display: flex; align-items: center; justify-content: center;
 font-size: 1.5rem; flex-shrink: 0;
 }
 .pl-flyer-name { font-family:'Playfair Display', serif; font-size: 1.1rem; font-weight: 700; color: var(--ink); }
 .pl-flyer-tag { font-size: 0.75rem; color: var(--muted-light); }
 .pl-flyer-alert {
 background: #fff4e5; border: 1px solid #ffd99a;
 border-radius: 3px; padding: 0.6rem 0.9rem;
 font-size: 0.8rem; color: #8a5a00;
 margin-bottom: 1rem; font-weight: 500;
 }
 .pl-flyer-details { font-size: 0.8rem; color: var(--muted); line-height: 1.8; margin-bottom: 1rem; }
 .pl-flyer-share-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted-light); margin-bottom: 0.5rem; }
 .pl-share-icons { display: flex; gap: 0.5rem; flex-wrap: wrap; }
 .pl-share-icon {
 background: var(--teal-pale); border: 1px solid var(--border);
 border-radius: 3px; padding: 0.3rem 0.6rem;
 font-size: 0.72rem; color: var(--teal-dark);
 font-weight: 500;
 }

 /* TIERS */
 .pl-tiers { background: var(--white); }
 .pl-tiers-grid {
 display: grid; grid-template-columns: repeat(3, 1fr);
 gap: 1.5rem; margin-top: 3rem;
 }
 .pl-tier-card {
 border: 1px solid var(--border); border-radius: 6px;
 padding: 2.25rem 2rem; position: relative;
 transition: box-shadow 0.2s; background: var(--white);
 }
 .pl-tier-card:hover { box-shadow: 0 12px 40px rgba(10,31,38,0.09); }
 .pl-tier-card.popular {
 border-color: var(--teal);
 box-shadow: 0 12px 40px rgba(18,168,179,0.15);
 }
 .pl-popular-badge {
 position: absolute; top: -12px; left: 50%;
 transform: translateX(-50%);
 background: var(--teal); color: #fff;
 font-size: 0.68rem; font-weight: 500;
 letter-spacing: 0.1em; text-transform: uppercase;
 padding: 0.25rem 0.9rem; border-radius: 2px; white-space: nowrap;
 }
 .pl-tier-card-name {
 font-size: 0.8rem; font-weight: 500;
 letter-spacing: 0.1em; text-transform: uppercase;
 color: var(--teal); margin-bottom: 0.5rem;
 }
 .pl-tier-card-price {
 font-family:'Playfair Display', serif;
 font-size: 2.5rem; font-weight: 900;
 color: var(--ink); line-height: 1; margin-bottom: 0.25rem;
 }
 .pl-tier-card-price span {
 font-family:'DM Sans', sans-serif;
 font-size: 0.9rem; color: var(--muted); font-weight: 400;
 }
 .pl-tier-card-earn {
 font-size: 0.875rem; color: var(--muted);
 margin-bottom: 1.5rem; padding-bottom: 1.5rem;
 border-bottom: 1px solid var(--border);
 }
 .pl-tier-card-earn strong { color: var(--teal-dark); }
 .pl-perks { list-style: none; padding: 0; margin: 0 0 1.75rem; display: flex; flex-direction: column; gap: 0.6rem; }
 .pl-perks li { font-size: 0.875rem; color: var(--muted); display: flex; gap: 0.6rem; align-items: flex-start; line-height: 1.5; }
 .pl-check { color: var(--teal); font-weight: 700; flex-shrink: 0; }
 .pl-tier-cta {
 display: block; text-align: center; padding: 0.75rem;
 border-radius: 3px; font-size: 0.875rem; font-weight: 500;
 text-decoration: none; transition: all 0.2s;
 border: 1px solid var(--border); color: var(--ink);
 background: none; cursor: pointer; width: 100%;
 }
 .pl-tier-cta:hover { background: var(--teal-pale); border-color: var(--teal); }
 .pl-tier-cta.featured { background: var(--teal); color: #fff; border-color: var(--teal); }
 .pl-tier-cta.featured:hover { background: var(--ink); border-color: var(--ink); }

 /* REFERRAL */
 .pl-referral { background: var(--section-alt); }
 .pl-referral-inner {
 display: grid; grid-template-columns: 1fr 1fr;
 gap: 5rem; align-items: center;
 }
 .pl-ref-steps { display: flex; flex-direction: column; gap: 1.25rem; margin-top: 1.5rem; }
 .pl-ref-step { display: flex; gap: 1rem; align-items: flex-start; }
 .pl-ref-num {
 width: 32px; height: 32px;
 background: var(--teal); color: #fff;
 border-radius: 50%;
 display: flex; align-items: center; justify-content: center;
 font-size: 0.8rem; font-weight: 700; flex-shrink: 0;
 }
 .pl-ref-text { font-size: 0.9rem; color: var(--muted); line-height: 1.6; padding-top: 0.35rem; }
 .pl-ref-text strong { color: var(--ink); }
 .pl-referral-card {
 background: var(--dark-bg); border-radius: 6px;
 padding: 2.5rem; color: #fff; text-align: center;
 }
 .pl-referral-label { font-size: 0.7rem; letter-spacing: 0.15em; text-transform: uppercase; color: #6ab8c0; margin-bottom: 0.5rem; }
 .pl-referral-big {
 font-family:'Playfair Display', serif;
 font-size: 3rem; font-weight: 900;
 color: var(--teal-light); line-height: 1; margin-bottom: 0.5rem;
 }
 .pl-referral-sub { font-size: 0.875rem; color: #6ab8c0; line-height: 1.6; margin-bottom: 1.5rem; }
 .pl-referral-note { font-size: 0.75rem; color: #3d8a94; }

 /* CTA */
 .pl-cta {
 background: var(--dark-bg); color: #fff;
 text-align: center; padding: 7rem 5rem;
 position: relative; overflow: hidden;
 }
 .pl-cta::before {
 content:''; position: absolute;
 top: 50%; left: 50%; transform: translate(-50%,-50%);
 width: 800px; height: 400px;
 background: radial-gradient(ellipse, #1ec8d412 0%, transparent 70%);
 pointer-events: none;
 }
 .pl-cta .pl-eyebrow { color: var(--teal-light); }
 .pl-cta .pl-section-title { color: #fff; max-width: 600px; margin: 0 auto 1rem; }
 .pl-cta .pl-section-sub { color: #6ab8c0; max-width: 500px; margin: 0 auto 2.5rem; }
 .pl-cta-note { font-size: 0.8rem; color: #4a9aa4; margin-top: 1rem; }

 /* FOOTER */
 .pl-footer {
 background: var(--dark-bg); color: #3d8a94;
 padding: 2rem 5rem;
 display: flex; justify-content: space-between; align-items: center;
 font-size: 0.8rem;
 }
 .pl-footer a { color: #3d8a94; text-decoration: none; }
 .pl-footer a:hover { color: var(--teal-light); }

 /* RESPONSIVE */
 @media (max-width: 1024px) {
 .pl-features-grid { grid-template-columns: 1fr 1fr; }
 }
 @media (max-width: 900px) {
 .pl-nav { padding: 0.75rem 1.5rem; }
 .pl-nav-links { display: none; }
 .pl-nav-mobile-cta { display: inline-block; }
 .pl-section { padding: 4rem 1.5rem; }
 .pl-cta { padding: 4rem 1.5rem; }
 .pl-footer { flex-direction: column; gap: 0.75rem; text-align: center; padding: 2rem 1.5rem; }
 .pl-hero { grid-template-columns: 1fr; min-height: auto; }
 .pl-hero-left { padding: 6rem 1.5rem 2rem; max-width: 100%; min-width: 0; }
 .pl-hero-right { padding: 0 1rem 4rem; justify-content: flex-start; max-width: 100%; min-width: 0; }
 .pl-hero-title { font-size: clamp(2.2rem, 9vw, 3rem); overflow-wrap: break-word; }
 .pl-hero-sub { font-size: 0.95rem; line-height: 1.6; margin-bottom: 2rem; max-width: 100%; }
 .pl-actions { flex-direction: column; align-items: stretch; gap: 1rem; }
 .pl-actions .pl-btn-primary { width: 100%; text-align: center; }
 .pl-actions .pl-btn-ghost { align-self: flex-start; }
 .pl-hero-stats { display: none; }
 .pl-steps { grid-template-columns: 1fr 1fr; }
 .pl-features-grid { grid-template-columns: 1fr; }
 .pl-lostpet-inner { grid-template-columns: 1fr; gap: 2rem; }
 .pl-tiers-grid { grid-template-columns: 1fr; }
 .pl-referral-inner { grid-template-columns: 1fr; gap: 2rem; }
 }
`;

const Index = () => {
 const navigate = useNavigate();
 const { user, loading } = useAuth();
 const [welcomeCreditEnabled, setWelcomeCreditEnabled] = useState(false);

 useEffect(() => {
 supabase
 .from("platform_settings")
 .select("value")
 .eq("key","welcome_credit_enabled")
 .maybeSingle()
 .then(({ data }) => {
 setWelcomeCreditEnabled(!data ? false : data.value === true || data.value ==="true");
 });
 }, []);

 useEffect(() => {
 if (!loading && user) {
 navigate("/home", { replace: true });
 supabase.rpc("has_role", { _user_id: user.id, _role:"admin" }).then(({ data: isAdmin }) => {
 if (isAdmin) navigate("/admin", { replace: true });
 });
 }
 }, [user, loading, navigate]);

 if (loading) {
 return (
 <div className="min-h-screen flex items-center justify-center bg-white" role="status" aria-label="Loading">
 <div className="w-12 h-12 border-4 border-[#12a8b3] border-t-transparent rounded-full animate-spin" />
 </div>
 );
 }

 const goSignup = () => navigate("/auth?role=pet_owner");
 const goSignin = () => navigate("/auth?role=pet_owner&mode=signin");
 const goDirectory = () => navigate("/directory");
 const goLostPets = () => navigate("/lost-pets");
 const goMerchants = () => navigate("/merchants");
 

 return (
 <div className="pl-root">
 <SEO
 title={seoMeta.home.title}
 description={seoMeta.home.description}
 keywords={[...seoMeta.home.keywords]}
 canonical={seoMeta.home.canonical}
 />
 <style>{styles}</style>

 {/* NAV */}
 <nav className="pl-nav">
 <a href="/" className="pl-nav-logo" aria-label="PawBucks home">
 <img src={logo} alt="PawBucks logo" width="176" height="44" fetchPriority="high" />
 </a>
 <div className="pl-nav-links">
 <a onClick={goDirectory} role="button" tabIndex={0}>Discover</a>
 <a onClick={goMerchants} role="button" tabIndex={0}>For Merchants</a>
 
 <a onClick={goLostPets} role="button" tabIndex={0}>Lost Pets</a>
 <a onClick={goSignin} role="button" tabIndex={0}>Sign In</a>
 <button className="pl-nav-cta" onClick={goSignup}>Get Started</button>
 </div>
 <button className="pl-nav-cta pl-nav-mobile-cta" onClick={goSignup}>Sign Up</button>
 </nav>

 {/* HERO */}
  <main>
  <section className="pl-hero">
 <div className="pl-hero-left">
 <p className="pl-eyebrow">For Pet Parents</p>
 <h1 className="pl-hero-title">
              Find. Try. <em>Trust.</em><br />Local pet care, simplified.
 </h1>
 <p className="pl-hero-sub">
 Discover trusted local pet care providers near you, scan their QR code to
 unlock exclusive new customer offers, and earn PawBucks automatically every
 time you pay using the PawBucks platform. Free forever.
 </p>
 <div className="pl-actions">
 <button className="pl-btn-primary" onClick={goSignup}>Start Earning Free</button>
 <button className="pl-btn-ghost" onClick={goDirectory}>Browse Pet Services →</button>
 <a className="pl-btn-link" onClick={() => document.querySelector('.pl-earn-card')?.scrollIntoView({behavior:'smooth'})}>See how it works</a>
 </div>
 <div className="pl-hero-stats">
 <div className="pl-stat">
 <span className="pl-stat-num">$0</span>
 <span className="pl-stat-label">to join</span>
 </div>
 <div className="pl-stat-divider" />
 <div className="pl-stat">
 <span className="pl-stat-num">Instant</span>
 <span className="pl-stat-label">savings</span>
 </div>
 <div className="pl-stat-divider" />
 <div className="pl-stat">
 <span className="pl-stat-num">Local</span>
 <span className="pl-stat-label">pet businesses</span>
 </div>
 </div>
 </div>

 <div className="pl-hero-right">
 <div className="pl-earn-card">
 <h2 className="pl-earn-title">How it works</h2>
 <div className="pl-tier-row">
 <div>
 <div className="pl-tier-name">Free</div>
 <div className="pl-tier-price free-tag">Always free</div>
 </div>
 <div className="pl-tier-earn">
 <b>10</b>
 <em>PawBucks</em>
 <span>per $1 at partners</span>
 </div>
 </div>
 <div className="pl-tier-row featured">
 <div>
 <div className="pl-tier-name">PawPass</div>
 <div className="pl-tier-price free-tag">$10 / month</div>
 <div className="pl-tier-perks">+ Free deliveries on $30+ orders at partner merchants &amp; PawBucks Marketplace</div>
 </div>
 <div className="pl-tier-earn">
 <b>20</b>
 <em>PawBucks</em>
 <span>per $1 at partners</span>
 </div>
 </div>
 <div className="pl-tier-row">
 <div>
 <div className="pl-tier-name">PawPass+</div>
 <div className="pl-tier-price free-tag">$20 / month</div>
 <div className="pl-tier-perks">+ Free deliveries on $30+ orders at partner merchants &amp; PawBucks Marketplace, plus 1 round trip Pet Transport (10 miles total) to &amp; from partner merchants</div>
 </div>
 <div className="pl-tier-earn">
 <b>30</b>
 <em>PawBucks</em>
 <span>per $1 at partners</span>
 </div>
 </div>
 <div className="pl-earn-example">
 <strong>Example:</strong> Spend $200 at a partner on PawPass+ → earn <strong>6,000 PawBucks ($6 value)</strong> redeemable at any partner merchant.
 </div>
 </div>
 </div>
 </section>

 {/* HOW IT WORKS */}
 <section className="pl-section pl-how">
 <p className="pl-eyebrow">How It Works</p>
 <h2 className="pl-section-title">Five simple steps.</h2>
 <p className="pl-section-sub">Save automatically on the pet care you already pay for.</p>
 <div className="pl-steps">
 <div className="pl-step">
 <div className="pl-step-num">01</div>
 <div className="pl-step-title">Create free account</div>
 <div className="pl-step-body">Sign up in under a minute. No credit card required.</div>
 </div>
 <div className="pl-step">
 <div className="pl-step-num">02</div>
 <div className="pl-step-title">Find</div>
 <div className="pl-step-body">Browse trusted groomers, vets, trainers, boarders, and pet stores near you — all verified PawBucks partners.</div>
 </div>
 <div className="pl-step">
 <div className="pl-step-num">03</div>
 <div className="pl-step-title">Scan & Unlock</div>
 <div className="pl-step-body">Walk in and scan the merchant's QR code to instantly unlock exclusive new customer deals. No searching, no clipping coupons.</div>
 </div>
 <div className="pl-step">
 <div className="pl-step-num">04</div>
 <div className="pl-step-title">Pay & Save</div>
 <div className="pl-step-body">Pay through PawBucks and save automatically. PawBucks are applied at checkout — your card is charged less.</div>
 </div>
 <div className="pl-step">
 <div className="pl-step-num">05</div>
 <div className="pl-step-title">Earn for next visit</div>
 <div className="pl-step-body">Every payment grows your savings for the next time you care for your pet. 1,000 PawBucks = $1 off. Rewards keep building.</div>
 </div>
 </div>
  </section>

  {/* PREMIUM MERCHANTS */}
  <section className="pl-section" style={{ background:"var(--section-alt)" }}>
  <h2 className="pl-section-title">Featured premium partners near you.</h2>
  <PremiumMerchantsBanner />
  </section>

  {/* CTA */}
  <section className="pl-cta">
 <p className="pl-eyebrow">Ready when you are</p>
 <h2 className="pl-section-title">Start earning on the spending you'd do anyway.</h2>
 <p className="pl-section-sub">Free forever. No credit card required to sign up. Cancel any paid tier anytime.</p>
 <button className="pl-btn-primary" onClick={goSignup}>Create your free account</button>
 {welcomeCreditEnabled && (
 <p className="pl-cta-note">New members get a welcome credit on signup.</p>
 )}
 </section>
  </main>

 {/* FOOTER */}
 <footer className="pl-footer">
 <div>© {new Date().getFullYear()} PawBucks. All rights reserved.</div>
 <div style={{ display:"flex", gap:"1.5rem" }}>
 <a href="/about">About</a>
 <a href="/privacy">Privacy</a>
 <a href="/terms">Terms</a>
 <a href="/merchants">For Merchants</a>
 
 </div>
 </footer>
 </div>
 );
};

export default Index;
