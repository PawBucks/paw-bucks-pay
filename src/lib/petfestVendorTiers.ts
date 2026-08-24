export type PetFestTierId = "tier_1" | "tier_2" | "tier_3";

export interface PetFestVendorTier {
  id: PetFestTierId;
  name: string;
  label: string;
  price: number;
  spaces: number;
  bestFor: string;
  includes: string[];
  featured?: boolean;
}

export const PETFEST_VENDOR_TIERS: PetFestVendorTier[] = [
  {
    id: "tier_1",
    name: 'The "Local Pro" Alley',
    label: "Tier 1",
    price: 250,
    spaces: 14,
    bestFor:
      "Independent dog walkers, pet sitters, mobile groomers and solo dog trainers.",
    includes: [
      "Basic 10x10 outdoor space (bring your own tent/table)",
      "Standard listing on the event's digital map",
    ],
  },
  {
    id: "tier_2",
    name: 'The "Main Street" Marketplace',
    label: "Tier 2",
    price: 450,
    spaces: 20,
    featured: true,
    bestFor:
      "Local brick-and-mortar pet boutiques, raw food brands, specialized pet photographers and artisanal toy makers.",
    includes: [
      "Choice 10x10 space near main foot-traffic paths",
      "One dedicated social media shoutout",
      "Shared access to a standard campus power outlet",
    ],
  },
  {
    id: "tier_3",
    name: 'The "Premium Partner" Pavilion',
    label: "Tier 3",
    price: 1000,
    spaces: 7,
    bestFor:
      "Local veterinary hospitals, regional pet store chains, major dog daycare franchises and pet insurance agencies.",
    includes: [
      "Premium 10x20 double-wide booth at a high-visibility intersection",
      "Prominent logo placement on all physical event signage",
      "Dedicated solo email blast to ticket holders",
      "Guaranteed dedicated power drop hookup",
    ],
  },
];

export const getPetFestTier = (id: string) =>
  PETFEST_VENDOR_TIERS.find((tier) => tier.id === id);
