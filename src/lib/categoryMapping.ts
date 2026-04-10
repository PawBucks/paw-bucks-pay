import { 
  Stethoscope, 
  Scissors, 
  ShoppingBag, 
  Bone, 
  Home,
  Sparkles,
  MoreHorizontal,
  Dog,
  Sun,
  Truck,
  Camera,
  Shield,
  Mountain,
  Zap,
  Hand,
  Brain,
  LucideIcon
} from "lucide-react";

export type CategoryConfig = {
  icon: LucideIcon;
  color: string;
  label: string;
};

// Comprehensive category configuration with icons, colors, and labels
export const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  veterinary: { icon: Stethoscope, color: "hsl(0, 70%, 55%)", label: "Veterinary" },
  grooming: { icon: Scissors, color: "hsl(320, 70%, 55%)", label: "Grooming" },
  mobile_groomer: { icon: Scissors, color: "hsl(320, 60%, 50%)", label: "Mobile Groomer" },
  pet_store: { icon: ShoppingBag, color: "hsl(150, 70%, 45%)", label: "Pet Store" },
  food: { icon: Bone, color: "hsl(25, 80%, 55%)", label: "Food & Treats" },
  boarding: { icon: Home, color: "hsl(180, 60%, 45%)", label: "Boarding" },
  training: { icon: Sparkles, color: "hsl(var(--primary))", label: "Training" },
  walker: { icon: Dog, color: "hsl(210, 80%, 55%)", label: "Walker" },
  daycare: { icon: Sun, color: "hsl(45, 90%, 50%)", label: "Daycare" },
  sitter: { icon: Home, color: "hsl(180, 50%, 50%)", label: "Pet Sitter" },
  photography: { icon: Camera, color: "hsl(270, 60%, 55%)", label: "Photography" },
  insurance: { icon: Shield, color: "hsl(220, 60%, 50%)", label: "Insurance" },
  delivery: { icon: Truck, color: "hsl(30, 70%, 50%)", label: "Delivery" },
  hiker: { icon: Mountain, color: "hsl(140, 60%, 45%)", label: "Hiker" },
  runner: { icon: Zap, color: "hsl(50, 85%, 50%)", label: "Runner" },
  masseuse: { icon: Hand, color: "hsl(340, 65%, 55%)", label: "Masseuse" },
  behaviorist: { icon: Brain, color: "hsl(280, 60%, 50%)", label: "Behaviorist" },
  breeder: { icon: Dog, color: "hsl(10, 70%, 55%)", label: "Breeder" },
  rescue_nonprofit: { icon: Shield, color: "hsl(200, 70%, 50%)", label: "Rescue / Nonprofit" },
  other: { icon: MoreHorizontal, color: "hsl(var(--muted-foreground))", label: "Other" },
};

// Map business_type values to category keys (handles variations)
export const BUSINESS_TYPE_MAP: Record<string, string> = {
  // Veterinary
  vet: 'veterinary',
  vets: 'veterinary',
  veterinarian: 'veterinary',
  veterinarians: 'veterinary',
  veterinary: 'veterinary',
  'vet clinic': 'veterinary',
  'vet clinics': 'veterinary',
  'animal hospital': 'veterinary',
  'animal hospitals': 'veterinary',
  // Grooming
  groom: 'grooming',
  groomer: 'grooming',
  groomers: 'grooming',
  grooming: 'grooming',
  'pet groomer': 'grooming',
  'pet groomers': 'grooming',
  'dog groomer': 'grooming',
  'dog groomers': 'grooming',
  'dog grooming': 'grooming',
  'pet grooming': 'grooming',
  // Pet Store
  pet_store: 'pet_store',
  'pet store': 'pet_store',
  'pet stores': 'pet_store',
  'pet shop': 'pet_store',
  'pet shops': 'pet_store',
  retail: 'pet_store',
  // Food
  food: 'food',
  'pet food': 'food',
  treats: 'food',
  bakery: 'food',
  'pet bakery': 'food',
  'dog bakery': 'food',
  // Boarding
  boarding: 'boarding',
  kennel: 'boarding',
  kennels: 'boarding',
  'pet hotel': 'boarding',
  'pet hotels': 'boarding',
  'pet boarding': 'boarding',
  'dog boarding': 'boarding',
  // Training
  training: 'training',
  trainer: 'training',
  trainers: 'training',
  'dog trainer': 'training',
  'dog trainers': 'training',
  'pet trainer': 'training',
  'pet trainers': 'training',
  'dog training': 'training',
  'pet training': 'training',
  obedience: 'training',
  // Walker
  walker: 'walker',
  walkers: 'walker',
  walking: 'walker',
  'dog walker': 'walker',
  'dog walkers': 'walker',
  'pet walker': 'walker',
  'pet walkers': 'walker',
  'dog walking': 'walker',
  'pet walking': 'walker',
  // Daycare (includes pet sitting)
  daycare: 'daycare',
  'pet daycare': 'daycare',
  'dog daycare': 'daycare',
  // Pet Sitting → merged into Daycare
  pet_sitting: 'daycare',
  'pet sitting': 'daycare',
  sitter: 'daycare',
  sitters: 'daycare',
  'pet sitter': 'daycare',
  'pet sitters': 'daycare',
  'dog sitter': 'daycare',
  'dog sitters': 'daycare',
  // Spa → merged into Grooming
  spa: 'grooming',
  'pet spa': 'grooming',
  'dog spa': 'grooming',
  // Photography
  photography: 'photography',
  photographer: 'photography',
  photographers: 'photography',
  'pet photography': 'photography',
  'pet photographer': 'photography',
  'pet photographers': 'photography',
  // Insurance
  insurance: 'insurance',
  'pet insurance': 'insurance',
  // Pharmacy → merged into Veterinary
  pharmacy: 'veterinary',
  'pet pharmacy': 'veterinary',
  medication: 'veterinary',
  // Delivery
  delivery: 'delivery',
  'pet delivery': 'delivery',
  // Hiker
  hiker: 'hiker',
  hikers: 'hiker',
  'pet hiker': 'hiker',
  'pet hikers': 'hiker',
  'dog hiker': 'hiker',
  'dog hikers': 'hiker',
  hiking: 'hiker',
  'pet hiking': 'hiker',
  'dog hiking': 'hiker',
  // Runner
  runner: 'runner',
  runners: 'runner',
  'pet runner': 'runner',
  'pet runners': 'runner',
  'dog runner': 'runner',
  'dog runners': 'runner',
  running: 'runner',
  'pet running': 'runner',
  'dog running': 'runner',
  jogger: 'runner',
  joggers: 'runner',
  'dog jogger': 'runner',
  'dog joggers': 'runner',
  // Masseuse
  masseuse: 'masseuse',
  masseuses: 'masseuse',
  'pet masseuse': 'masseuse',
  'dog masseuse': 'masseuse',
  massage: 'masseuse',
  'pet massage': 'masseuse',
  'animal massage': 'masseuse',
  'pet massage therapist': 'masseuse',
  'dog massage': 'masseuse',
  // Behaviorist
  behaviorist: 'behaviorist',
  behaviorists: 'behaviorist',
  'pet behaviorist': 'behaviorist',
  'pet behaviorists': 'behaviorist',
  'dog behaviorist': 'behaviorist',
  'dog behaviorists': 'behaviorist',
  'animal behaviorist': 'behaviorist',
  'behavior specialist': 'behaviorist',
  'pet behavior': 'behaviorist',
  // Mobile Groomer
  mobile_groomer: 'mobile_groomer',
  'mobile groomer': 'mobile_groomer',
  'mobile groomers': 'mobile_groomer',
  'mobile grooming': 'mobile_groomer',
  'mobile pet groomer': 'mobile_groomer',
  'mobile pet groomers': 'mobile_groomer',
  // Breeder
  breeder: 'breeder',
  breeders: 'breeder',
  'dog breeder': 'breeder',
  'dog breeders': 'breeder',
  'cat breeder': 'breeder',
  'cat breeders': 'breeder',
  'pet breeder': 'breeder',
  'pet breeders': 'breeder',
  breeding: 'breeder',
  // Rescue / Nonprofit
  rescue_nonprofit: 'rescue_nonprofit',
  rescue: 'rescue_nonprofit',
  rescues: 'rescue_nonprofit',
  nonprofit: 'rescue_nonprofit',
  nonprofits: 'rescue_nonprofit',
  'non-profit': 'rescue_nonprofit',
  'animal rescue': 'rescue_nonprofit',
  'animal rescues': 'rescue_nonprofit',
  shelter: 'rescue_nonprofit',
  shelters: 'rescue_nonprofit',
  'animal shelter': 'rescue_nonprofit',
  'animal shelters': 'rescue_nonprofit',
  charity: 'rescue_nonprofit',
  charities: 'rescue_nonprofit',
};

// Get normalized category key from business_type
export const getNormalizedCategory = (businessType: string | undefined | null): string => {
  if (!businessType) return 'other';
  const normalizedType = businessType.toLowerCase().trim();
  
  // Direct match in map
  if (BUSINESS_TYPE_MAP[normalizedType]) {
    return BUSINESS_TYPE_MAP[normalizedType];
  }
  
  // Check if business type contains a known category key
  for (const [key, category] of Object.entries(BUSINESS_TYPE_MAP)) {
    if (normalizedType.includes(key) || key.includes(normalizedType)) {
      return category;
    }
  }
  
  // Check if it matches a category config key directly
  if (CATEGORY_CONFIG[normalizedType]) {
    return normalizedType;
  }
  
  return 'other';
};

// Get the display label for a business_type
export const getCategoryLabel = (businessType: string | undefined | null): string => {
  const category = getNormalizedCategory(businessType);
  return CATEGORY_CONFIG[category]?.label || businessType?.charAt(0).toUpperCase() + businessType?.slice(1) || 'Other';
};

// Get the color for a business_type
export const getCategoryColor = (businessType: string | undefined | null): string => {
  const category = getNormalizedCategory(businessType);
  return CATEGORY_CONFIG[category]?.color || CATEGORY_CONFIG.other.color;
};

// Get the icon for a business_type
export const getCategoryIcon = (businessType: string | undefined | null): LucideIcon => {
  const category = getNormalizedCategory(businessType);
  return CATEGORY_CONFIG[category]?.icon || CATEGORY_CONFIG.other.icon;
};

/**
 * Check if a search term matches a merchant's category.
 * e.g. searching "groomers" will match a merchant with business_type "grooming"
 */
export const searchMatchesCategory = (searchTerm: string, businessType: string | undefined | null): boolean => {
  if (!searchTerm || !businessType) return false;
  const searchLower = searchTerm.toLowerCase().trim();
  const businessLower = businessType.toLowerCase().trim();
  
  // Direct text match
  if (businessLower.includes(searchLower) || searchLower.includes(businessLower)) return true;
  
  // Both resolve to the same normalized category
  const searchCategory = BUSINESS_TYPE_MAP[searchLower];
  const merchantCategory = getNormalizedCategory(businessType);
  
  if (searchCategory && searchCategory === merchantCategory) return true;
  
  // Check if any key that maps to the merchant's category contains the search term
  for (const [key, category] of Object.entries(BUSINESS_TYPE_MAP)) {
    if (category === merchantCategory) {
      if (key.includes(searchLower) || searchLower.includes(key)) return true;
    }
  }
  
  // Check if the category label matches
  const label = CATEGORY_CONFIG[merchantCategory]?.label?.toLowerCase();
  if (label && (label.includes(searchLower) || searchLower.includes(label))) return true;
  
  return false;
};
