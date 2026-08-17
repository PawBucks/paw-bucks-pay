/**
 * Centralized SEO metadata registry for all core public/marketing routes.
 *
 * Conventions:
 * - title: <= 60 chars total once"| PawBucks" is appended (SEO appends it
 * automatically when the raw title is < 50 chars). Aim raw title <= 50.
 * - description: <= 160 chars (SEO truncates over 160).
 * - keywords: 5–10 focused keywords, no stuffing.
 * - canonical: absolute path; SEO will prepend the base URL.
 */

export interface RouteMeta {
 title: string;
 description: string;
 keywords: string[];
 canonical: string;
}

export const seoMeta = {
 home: {
 title:"PawBucks – Pet Rewards & Local Pet Services",
 description:
"Earn PawBucks on every dollar you spend on your pet. Find trusted local pet stores, groomers, trainers, and vets — and get rewarded for everyday care.",
 keywords: [
"pet rewards",
"PawBucks",
"pet wallet",
"local pet services",
"pet stores near me",
"groomers",
"pet cashback",
 ],
 canonical:"/",
 },
 about: {
 title:"About PawBucks – Who We Are & How We Make Money",
 description:
"PawBucks is a transparent pet rewards marketplace operated by PawBucks, Inc. (Los Angeles, CA). Payments are processed by Stripe. Learn how we make money.",
 keywords: [
"About PawBucks",
"PawBucks legit",
"PawBucks business model",
"PawBucks security",
"PawBucks Inc",
 ],
 canonical:"/about",
 },
 auth: {
 title:"Sign In or Sign Up – PawBucks",
 description:
"Create a free PawBucks account or sign in to manage pet expenses, earn rewards on every purchase, and discover trusted local pet services.",
 keywords: [
"PawBucks sign up",
"PawBucks login",
"create pet account",
"free pet rewards account",
 ],
 canonical:"/auth",
 },
 merchants: {
 title:"For Pet Merchants – Grow Your Pet Business with PawBucks",
 description:
"Get new paying customers for your pet business — pay only when PawBucks delivers them. No discounts, no upfront ad spend.",
 keywords: [
"pet merchant platform",
"grow pet business",
"customer acquisition pets",
"pet store rewards program",
"groomer marketing",
 ],
 canonical:"/merchants",
 },
 directory: {
  title:"Pet Merchant Directory – Local Pet Businesses",
 description:
"Browse our complete directory of trusted pet merchants. Find pet stores, groomers, trainers, vets, and boarding near you. Read reviews and earn PawBucks rewards.",
 keywords: [
"pet merchant directory",
"pet stores near me",
"find groomers",
"local vets",
"pet trainers directory",
 ],
 canonical:"/directory",
 },
 discover: {
 title:"Discover Pet Merchants Near You – PawBucks",
 description:
"Find trusted pet stores, groomers, trainers, walkers, and vets near you. Earn PawBucks rewards with every purchase at participating local businesses.",
 keywords: [
"discover pet services",
"pet stores near me",
"local groomers",
"pet trainers",
"vet clinics near me",
 ],
 canonical:"/discover",
 },
 petStore: {
 title:"PawBucks Marketplace – Shop & Earn Rewards",
 description:
"Shop pet food, treats, toys, and supplies in the PawBucks Marketplace. Pay with cash or PawBucks, unlock badge discounts, and earn rewards on every order.",
 keywords: [
"pet store",
"buy pet supplies online",
"pet food",
"pet toys",
"PawBucks pet store",
 ],
 canonical:"/pet-store",
 },
 lostPets: {
 title:"Lost Pets – Create & Share Lost Pet Flyers Free",
 description:
"Create, share, and print lost pet flyers in minutes. Activate your local PawBucks community to help reunite missing pets with their families. Free to use.",
 keywords: [
"lost pet flyer",
"missing pet alert",
"find lost dog",
"find lost cat",
"lost pet community",
 ],
 canonical:"/lost-pets",
 },
 install: {
 title:"Install the PawBucks App",
 description:
"Install PawBucks on your phone or desktop for instant access, offline support, and push notifications. Works on iOS, Android, Mac, and Windows.",
 keywords: [
"install PawBucks",
"PawBucks app",
"PWA pet app",
"PawBucks mobile",
 ],
 canonical:"/install",
 },
 referrals: {
 title:"PawBucks Referrals – Earn Rewards for Sharing",
 description:
"Share your PawBucks referral link and earn rewards when friends sign up and make their first purchase. Help fellow pet owners save while you stack PawBucks.",
 keywords: [
"PawBucks referral",
"refer a friend pet rewards",
"pet rewards referral program",
 ],
 canonical:"/referrals",
 },
 privacy: {
 title:"Privacy Policy – PawBucks",
 description:
"How PawBucks, Inc. collects, uses, stores, and protects your personal and pet data. Read our full privacy policy, your rights, and how to contact us.",
 keywords: [
"PawBucks privacy policy",
"pet data privacy",
"data protection",
"GDPR",
"CCPA",
"privacy rights",
 ],
 canonical:"/privacy",
 },
 terms: {
 title:"Terms of Service – PawBucks",
 description:
"The legal terms governing your use of PawBucks. Covers accounts, payments, PawBucks rewards, disclaimers, liability limits, arbitration, and governing law.",
 keywords: [
"PawBucks terms of service",
"PawBucks terms and conditions",
"user agreement",
"PawBucks legal",
"arbitration",
 ],
 canonical:"/terms",
 },
} as const satisfies Record<string, RouteMeta>;

export type SeoRouteKey = keyof typeof seoMeta;