/**
 * Custom Vite plugin to generate pre-rendered HTML for key routes.
 * 
 * At build time, this creates route-specific HTML files (e.g. dist/merchants/index.html)
 * with proper meta tags and static content so crawlers/bots see real content
 * instead of an empty <div id="root"></div>.
 */
import type { Plugin } from 'vite';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';

interface RouteContent {
  path: string;
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  canonical: string;
  /** Plain-text content that crawlers will see inside <noscript> + a hidden div */
  staticContent: string;
}

const ROUTES_TO_PRERENDER: RouteContent[] = [
  {
    path: '/merchants',
    title: 'For Pet Merchants - Grow Your Business with PawBucks',
    description: 'Get new paying customers for your pet business — pay only when PawBucks delivers them. No discounts, no ads, no upfront spend. Performance-based customer acquisition.',
    ogTitle: 'For Pet Merchants - Grow Your Business with PawBucks',
    ogDescription: 'Get new paying customers — pay only when PawBucks delivers them. A pet-focused payments and rewards platform for pet stores, groomers, trainers, and vets.',
    canonical: 'https://pawbucks.app/merchants',
    staticContent: `
      <h1>Grow Your Pet Business With Customers Who Arrive Ready to Spend</h1>
      <p>Get new paying customers — pay only when PawBucks delivers them.</p>
      <p>PawBucks is a pet-focused payments and rewards platform that helps pet businesses acquire customers without discounts, ads, or upfront spend.</p>
      <h2>Why PawBucks Is Different</h2>
      <p>Every new PawBucks user joins with $50 in PawBucks, redeemable only on purchases of $75 or more at PawBucks partner businesses. That means customers come in ready to buy, not browse.</p>
      <h2>How a PawBucks Transaction Works</h2>
      <p>A PawBucks customer spends $75. They apply $50 PawBucks. You receive $24.25 USD (withdrawable cash) and $50 PawBucks you can use on Merchant Market services.</p>
      <p>PawBucks earns a 3% performance commission on the cash portion only — and only because we delivered the customer. No customers = no commission.</p>
      <h2>Turn Customer Spend Into Marketing</h2>
      <p>Your earned PawBucks are prepaid marketing dollars you can use on any of our 16 Merchant Market services, including featured placement, sponsored visibility, premium analytics, and customer acquisition tools.</p>
      <h2>Transparent, Performance-Based Pricing</h2>
      <p>2.9% + $0.30 — Stripe processing. 3% performance commission charged only when PawBucks delivers a paying customer, applied only to the cash portion. No contracts. No subscriptions. No hidden fees.</p>
      <h2>Built for Pet Businesses</h2>
      <ul>
        <li>Veterinarians</li>
        <li>Groomers</li>
        <li>Trainers</li>
        <li>Pet retailers</li>
        <li>Boarding &amp; daycare providers</li>
      </ul>
      <p><a href="/auth?role=merchant">Get Started</a></p>
    `,
  },
  {
    path: '/vet-landing',
    title: 'For Veterinarians - Complete Practice Management with PawBucks',
    description: 'PawBucks for Vets: EMR system, AI clinical assistant, insurance claim-splicing, wellness plans, invoicing, and more. Modernize your veterinary practice.',
    ogTitle: 'For Veterinarians - Complete Practice Management with PawBucks',
    ogDescription: 'Complete EMR, AI-assisted SOAP notes, insurance claim-splicing, and wellness plan management for modern veterinary practices.',
    canonical: 'https://pawbucks.app/vet-landing',
    staticContent: `
      <h1>The Modern Veterinary Platform</h1>
      <p>Complete EMR, AI-powered clinical tools, insurance claim management, and payment processing — built for veterinary practices.</p>
      <h2>Features for Veterinarians</h2>
      <ul>
        <li><strong>Complete EMR System</strong> — Digital patient records, SOAP notes with vitals tracking, lab &amp; imaging management, and surgical documentation.</li>
        <li><strong>AI Clinical Assistant</strong> — Voice-to-SOAP transcription, symptom triage scoring, and diagnostic imaging overlays powered by AI.</li>
        <li><strong>Insurance Claim-Splicing</strong> — Automatically split invoices between insurance coverage and owner co-pays.</li>
        <li><strong>Wellness Plan Architect</strong> — Build recurring revenue plans. Owners earn 10x-30x PawBucks rewards.</li>
        <li><strong>Compliance Reminders</strong> — Automated vaccination and wellness check reminders for pet owners.</li>
        <li><strong>Lab Integration</strong> — Connect with external lab providers for seamless result management.</li>
      </ul>
      <p><a href="/auth?role=vet">Sign Up as a Veterinarian</a></p>
    `,
  },
  {
    path: '/discover',
    title: 'Discover Pet Services Near You - PawBucks',
    description: 'Find trusted local pet stores, groomers, trainers, vets, and more. Earn PawBucks rewards on every purchase. Browse the PawBucks merchant directory.',
    ogTitle: 'Discover Pet Services Near You - PawBucks',
    ogDescription: 'Find trusted local pet businesses and earn rewards on every purchase.',
    canonical: 'https://pawbucks.app/discover',
    staticContent: `
      <h1>Discover Pet Services Near You</h1>
      <p>Find trusted local pet stores, groomers, trainers, veterinarians, and more. Earn PawBucks rewards on every purchase.</p>
      <h2>Browse by Category</h2>
      <ul>
        <li>Pet Stores</li>
        <li>Groomers</li>
        <li>Trainers</li>
        <li>Veterinarians</li>
        <li>Boarding &amp; Daycare</li>
        <li>Pet Sitters &amp; Walkers</li>
      </ul>
      <p>Search our directory of verified pet businesses and support local merchants while earning cashback rewards.</p>
      <p><a href="/auth">Sign Up to Start Earning</a></p>
    `,
  },
  {
    path: '/lost-pets',
    title: 'Lost & Found Pets - PawBucks Community',
    description: 'Report a lost pet or help reunite found pets with their owners. Community-powered lost pet alerts with location tracking and instant notifications.',
    ogTitle: 'Lost & Found Pets - PawBucks Community',
    ogDescription: 'Report lost pets, browse found pets, and help reunite pets with their families.',
    canonical: 'https://pawbucks.app/lost-pets',
    staticContent: `
      <h1>Lost &amp; Found Pets</h1>
      <p>Report a lost pet or help reunite found pets with their owners. Community-powered lost pet alerts with location tracking and instant notifications.</p>
      <h2>How It Works</h2>
      <ul>
        <li>Report your lost pet with photos and last known location</li>
        <li>Community members receive alerts for pets spotted in their area</li>
        <li>Browse found pets to help reunite them with their families</li>
        <li>Generate and share lost pet flyers instantly</li>
      </ul>
      <p><a href="/auth">Sign Up to Report or Help</a></p>
    `,
  },
  {
    path: '/pet-store',
    title: 'PawBucks Pet Store - Shop Pet Supplies & Earn Rewards',
    description: 'Shop pet food, toys, accessories, and more at the PawBucks Pet Store. Earn PawBucks rewards on every purchase.',
    ogTitle: 'PawBucks Pet Store - Shop & Earn Rewards',
    ogDescription: 'Shop pet supplies and earn PawBucks rewards on every purchase.',
    canonical: 'https://pawbucks.app/pet-store',
    staticContent: `
      <h1>PawBucks Pet Store</h1>
      <p>Shop pet food, toys, accessories, and more. Earn PawBucks rewards on every purchase.</p>
      <h2>Categories</h2>
      <ul>
        <li>Food &amp; Treats</li>
        <li>Toys &amp; Enrichment</li>
        <li>Health &amp; Wellness</li>
        <li>Accessories &amp; Apparel</li>
        <li>Grooming Supplies</li>
      </ul>
      <p><a href="/auth">Sign Up to Start Shopping</a></p>
    `,
  },
  {
    path: '/referrals',
    title: 'Refer Friends & Earn PawBucks Rewards',
    description: 'Share PawBucks with friends and earn bonus PawBucks for every successful referral. Both you and your friend get rewarded.',
    ogTitle: 'Refer Friends & Earn PawBucks',
    ogDescription: 'Earn bonus PawBucks for every friend you refer to the platform.',
    canonical: 'https://pawbucks.app/referrals',
    staticContent: `
      <h1>Refer Friends &amp; Earn PawBucks</h1>
      <p>Share PawBucks with friends and earn bonus rewards for every successful referral. Both you and your friend get rewarded.</p>
      <p><a href="/auth">Sign Up to Start Referring</a></p>
    `,
  },
];

function injectMetaAndContent(html: string, route: RouteContent): string {
  // Replace <title>
  html = html.replace(
    /<title>[^<]*<\/title>/,
    `<title>${route.title}</title>`
  );

  // Replace og:title
  html = html.replace(
    /<meta property="og:title" content="[^"]*">/,
    `<meta property="og:title" content="${route.ogTitle}">`
  );

  // Replace twitter:title
  html = html.replace(
    /<meta name="twitter:title" content="[^"]*">/,
    `<meta name="twitter:title" content="${route.ogTitle}">`
  );

  // Replace meta description
  html = html.replace(
    /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${route.description}">`
  );

  // Replace og:description
  html = html.replace(
    /<meta property="og:description" content="[^"]*">/,
    `<meta property="og:description" content="${route.ogDescription}">`
  );

  // Replace twitter:description
  html = html.replace(
    /<meta name="twitter:description" content="[^"]*">/,
    `<meta name="twitter:description" content="${route.ogDescription}">`
  );

  // Replace canonical
  html = html.replace(
    /<link rel="canonical" href="[^"]*" \/>/,
    `<link rel="canonical" href="${route.canonical}" />`
  );

  // Replace og:url
  html = html.replace(
    /<meta property="og:url" content="[^"]*" \/>/,
    `<meta property="og:url" content="${route.canonical}" />`
  );

  // Replace twitter:url
  html = html.replace(
    /<meta name="twitter:url" content="[^"]*" \/>/,
    `<meta name="twitter:url" content="${route.canonical}" />`
  );

  // Inject static content before the closing </body> tag
  // This content is visible to crawlers and hidden once React mounts
  const staticHtml = `
    <noscript>
      <div style="max-width:800px;margin:0 auto;padding:40px 20px;font-family:system-ui,sans-serif;">
        ${route.staticContent}
      </div>
    </noscript>
    <div id="prerender-content" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;" aria-hidden="true">
      ${route.staticContent}
    </div>
  `;

  html = html.replace('</body>', `${staticHtml}\n</body>`);

  return html;
}

export function prerenderRoutes(): Plugin {
  return {
    name: 'vite-prerender-routes',
    apply: 'build',
    closeBundle() {
      const outDir = resolve(process.cwd(), 'dist');
      let baseHtml: string;

      try {
        baseHtml = readFileSync(resolve(outDir, 'index.html'), 'utf-8');
      } catch {
        console.warn('[prerender-routes] Could not read dist/index.html, skipping pre-rendering.');
        return;
      }

      for (const route of ROUTES_TO_PRERENDER) {
        const routePath = route.path.replace(/^\//, '');
        const outputDir = resolve(outDir, routePath);
        const outputFile = resolve(outputDir, 'index.html');

        try {
          mkdirSync(outputDir, { recursive: true });
          const html = injectMetaAndContent(baseHtml, route);
          writeFileSync(outputFile, html, 'utf-8');
          console.log(`[prerender-routes] Generated ${routePath}/index.html`);
        } catch (err) {
          console.warn(`[prerender-routes] Failed to generate ${routePath}/index.html:`, err);
        }
      }
    },
  };
}
