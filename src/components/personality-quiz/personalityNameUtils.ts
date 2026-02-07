/**
 * Utility to transform personality names based on pet type.
 * 
 * The database stores generic names like "Guard Dog" but we need to
 * display "Guard Cat" for cats, "Guard Bird" for birds, etc.
 */

// Map of pet types to their display labels
const PET_TYPE_LABELS: Record<string, string> = {
  dog: "Dog",
  cat: "Cat",
  bird: "Bird",
  reptile: "Reptile",
  rabbit: "Rabbit",
  hamster: "Hamster",
  fish: "Fish",
  other: "Pet",
};

// Base personality names (without pet type) and their patterns
const PERSONALITY_PATTERNS: Record<string, { prefix: string; hasDog: boolean }> = {
  guard_dog: { prefix: "Guard", hasDog: true },
  couch_potato: { prefix: "Couch Potato", hasDog: false },
  chaotic_neutral: { prefix: "Chaotic Neutral", hasDog: false },
  social_butterfly: { prefix: "Social Butterfly", hasDog: false },
  adventurer: { prefix: "Adventurer", hasDog: false },
};

/**
 * Transforms a personality name to match the pet type.
 * 
 * Examples:
 * - transformPersonalityName("Guard Dog", "cat") → "Guard Cat"
 * - transformPersonalityName("Guard Dog", "bird") → "Guard Bird"
 * - transformPersonalityName("Couch Potato", "cat") → "Couch Potato" (unchanged)
 */
export function transformPersonalityName(name: string, petType: string): string {
  if (!name || !petType) return name;
  
  const petLabel = PET_TYPE_LABELS[petType.toLowerCase()] || "Pet";
  
  // Check if the name contains "Dog" that should be replaced
  // This handles variations like "Guard Dog", "The Guard Dog", etc.
  if (name.toLowerCase().includes("dog")) {
    return name.replace(/\bDog\b/gi, petLabel);
  }
  
  return name;
}

/**
 * Transforms a badge text to match the pet type.
 * 
 * Examples:
 * - transformBadgeText("Official Guard Dog Parent 🛡️", "cat") → "Official Guard Cat Parent 🛡️"
 */
export function transformBadgeText(badgeText: string, petType: string): string {
  if (!badgeText || !petType) return badgeText;
  
  const petLabel = PET_TYPE_LABELS[petType.toLowerCase()] || "Pet";
  
  // Replace "Dog" with the appropriate pet type
  if (badgeText.toLowerCase().includes("dog")) {
    return badgeText.replace(/\bDog\b/gi, petLabel);
  }
  
  return badgeText;
}

/**
 * Transforms all personality-related text fields to match the pet type.
 * Returns a new object with transformed name, tagline, badge_text, and description.
 */
export function transformPersonalityData<T extends {
  name?: string;
  tagline?: string;
  badge_text?: string;
  description?: string;
}>(data: T, petType: string): T {
  if (!data || !petType) return data;
  
  const petLabel = PET_TYPE_LABELS[petType.toLowerCase()] || "Pet";
  
  const transformText = (text: string | undefined): string | undefined => {
    if (!text) return text;
    if (text.toLowerCase().includes("dog")) {
      return text.replace(/\bDog\b/gi, petLabel);
    }
    return text;
  };
  
  return {
    ...data,
    name: transformText(data.name),
    tagline: transformText(data.tagline),
    badge_text: transformText(data.badge_text),
    description: transformText(data.description),
  };
}

/**
 * Get the display label for a pet type.
 */
export function getPetTypeLabel(petType: string): string {
  return PET_TYPE_LABELS[petType.toLowerCase()] || "Pet";
}
