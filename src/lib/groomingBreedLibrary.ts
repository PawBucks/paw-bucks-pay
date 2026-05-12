// Curated reference library of common dog breeds with recommended grooming
// durations and pricing. Used by GroomingBreedManager to suggest defaults
// and seed merchants with a starter set of breed profiles.

export type BreedSize = "small" | "medium" | "large" | "giant";
export type CoatType = "smooth" | "double" | "curly" | "wire" | "long" | "hairless";

export interface BreedReference {
  name: string;
  size: BreedSize;
  coat: CoatType;
  notes?: string;
}

// Base recommendations by size (smooth coat, single dog, full groom)
const BASE_DURATION_MIN: Record<BreedSize, number> = {
  small: 45,
  medium: 60,
  large: 90,
  giant: 120,
};

const BASE_PRICE_USD: Record<BreedSize, number> = {
  small: 50,
  medium: 70,
  large: 95,
  giant: 130,
};

// Coat multipliers — applied to both duration and price
const COAT_MULTIPLIER: Record<CoatType, number> = {
  smooth: 1.0,
  double: 1.3,
  wire: 1.3,
  long: 1.4,
  curly: 1.5,
  hairless: 0.7,
};

export interface RecommendedGrooming {
  durationMinutes: number;
  priceUsd: number;
}

/** Compute recommended duration + price from size + coat. */
export function recommendGrooming(size: BreedSize, coat: CoatType): RecommendedGrooming {
  const mult = COAT_MULTIPLIER[coat];
  const rawDuration = BASE_DURATION_MIN[size] * mult;
  // Round duration to nearest 15 min
  const duration = Math.max(30, Math.round(rawDuration / 15) * 15);
  const price = Math.round(BASE_PRICE_USD[size] * mult);
  return { durationMinutes: duration, priceUsd: price };
}

// 50 of the most common breeds requested at grooming salons
export const BREED_LIBRARY: BreedReference[] = [
  // Small
  { name: "Bichon Frise", size: "small", coat: "curly", notes: "Round head shape, fluffy finish" },
  { name: "Boston Terrier", size: "small", coat: "smooth" },
  { name: "Cavalier King Charles Spaniel", size: "small", coat: "long", notes: "Feathering on ears and legs" },
  { name: "Chihuahua", size: "small", coat: "smooth" },
  { name: "Dachshund", size: "small", coat: "smooth" },
  { name: "Havanese", size: "small", coat: "long", notes: "Soft, silky coat — prone to matting" },
  { name: "Jack Russell Terrier", size: "small", coat: "wire" },
  { name: "Maltese", size: "small", coat: "long", notes: "White coat, frequent face cleaning" },
  { name: "Miniature Poodle", size: "small", coat: "curly", notes: "Continuous hair growth, no shed" },
  { name: "Miniature Schnauzer", size: "small", coat: "wire", notes: "Hand-stripping or clipper cut" },
  { name: "Papillon", size: "small", coat: "long" },
  { name: "Pekingese", size: "small", coat: "long" },
  { name: "Pomeranian", size: "small", coat: "double", notes: "Avoid shaving — undercoat rake recommended" },
  { name: "Pug", size: "small", coat: "smooth", notes: "Wrinkle cleaning required" },
  { name: "Shih Tzu", size: "small", coat: "long", notes: "Top-knot or puppy cut" },
  { name: "Yorkshire Terrier", size: "small", coat: "long" },
  { name: "West Highland White Terrier", size: "small", coat: "wire" },

  // Medium
  { name: "American Cocker Spaniel", size: "medium", coat: "long", notes: "Heavy ear feathering" },
  { name: "Australian Cattle Dog", size: "medium", coat: "double" },
  { name: "Basset Hound", size: "medium", coat: "smooth", notes: "Ear cleaning critical" },
  { name: "Beagle", size: "medium", coat: "smooth" },
  { name: "Border Collie", size: "medium", coat: "double" },
  { name: "Brittany Spaniel", size: "medium", coat: "long" },
  { name: "Bulldog", size: "medium", coat: "smooth", notes: "Wrinkle cleaning required" },
  { name: "Cocker Spaniel", size: "medium", coat: "long" },
  { name: "French Bulldog", size: "medium", coat: "smooth", notes: "Wrinkle cleaning required" },
  { name: "Mini Goldendoodle", size: "medium", coat: "curly", notes: "Dense doodle coat — heavy de-matting" },
  { name: "Mini Labradoodle", size: "medium", coat: "curly" },
  { name: "Shetland Sheepdog", size: "medium", coat: "long" },
  { name: "Springer Spaniel", size: "medium", coat: "long" },
  { name: "Standard Schnauzer", size: "medium", coat: "wire" },
  { name: "Whippet", size: "medium", coat: "smooth" },

  // Large
  { name: "Australian Shepherd", size: "large", coat: "double" },
  { name: "Boxer", size: "large", coat: "smooth" },
  { name: "Chow Chow", size: "large", coat: "double", notes: "Dense double coat — long blow-out time" },
  { name: "Doberman Pinscher", size: "large", coat: "smooth" },
  { name: "German Shepherd", size: "large", coat: "double", notes: "Heavy seasonal shedding" },
  { name: "Golden Retriever", size: "large", coat: "double", notes: "Feathering trims, undercoat rake" },
  { name: "Goldendoodle", size: "large", coat: "curly", notes: "Dense doodle coat — heavy de-matting" },
  { name: "Irish Setter", size: "large", coat: "long" },
  { name: "Labradoodle", size: "large", coat: "curly" },
  { name: "Labrador Retriever", size: "large", coat: "double" },
  { name: "Old English Sheepdog", size: "large", coat: "long", notes: "Extensive de-matting common" },
  { name: "Portuguese Water Dog", size: "large", coat: "curly" },
  { name: "Rottweiler", size: "large", coat: "smooth" },
  { name: "Samoyed", size: "large", coat: "double", notes: "Heavy double coat — long dry time" },
  { name: "Siberian Husky", size: "large", coat: "double", notes: "Heavy double coat — never shave" },
  { name: "Standard Poodle", size: "large", coat: "curly" },
  { name: "Vizsla", size: "large", coat: "smooth" },
  { name: "Weimaraner", size: "large", coat: "smooth" },

  // Giant
  { name: "Bernese Mountain Dog", size: "giant", coat: "long" },
  { name: "Great Dane", size: "giant", coat: "smooth" },
  { name: "Great Pyrenees", size: "giant", coat: "double", notes: "Massive double coat" },
  { name: "Mastiff", size: "giant", coat: "smooth" },
  { name: "Newfoundland", size: "giant", coat: "long", notes: "Dense water-resistant coat" },
  { name: "Saint Bernard", size: "giant", coat: "long" },
];

/** Find a reference breed by name (case-insensitive, fuzzy). */
export function findBreedReference(name: string): BreedReference | undefined {
  const q = name.trim().toLowerCase();
  if (!q) return undefined;
  // Exact match first
  const exact = BREED_LIBRARY.find((b) => b.name.toLowerCase() === q);
  if (exact) return exact;
  // Then contains
  return BREED_LIBRARY.find(
    (b) => b.name.toLowerCase().includes(q) || q.includes(b.name.toLowerCase())
  );
}

/** Search the library for autocomplete suggestions. */
export function searchBreeds(query: string, limit = 8): BreedReference[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return BREED_LIBRARY.filter((b) => b.name.toLowerCase().includes(q)).slice(0, limit);
}