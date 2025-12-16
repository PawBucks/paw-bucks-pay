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
  pet_store: { icon: ShoppingBag, color: "hsl(150, 70%, 45%)", label: "Pet Store" },
  food: { icon: Bone, color: "hsl(25, 80%, 55%)", label: "Food & Treats" },
  boarding: { icon: Home, color: "hsl(180, 60%, 45%)", label: "Boarding" },
  training: { icon: Sparkles, color: "hsl(var(--primary))", label: "Training" },
  walker: { icon: Dog, color: "hsl(210, 80%, 55%)", label: "Walker" },
  daycare: { icon: Sun, color: "hsl(45, 90%, 50%)", label: "Daycare" },
  photography: { icon: Camera, color: "hsl(270, 60%, 55%)", label: "Photography" },
  insurance: { icon: Shield, color: "hsl(220, 60%, 50%)", label: "Insurance" },
  delivery: { icon: Truck, color: "hsl(30, 70%, 50%)", label: "Delivery" },
  other: { icon: MoreHorizontal, color: "hsl(var(--muted-foreground))", label: "Other" },
};

// Map business_type values to category keys (handles variations)
export const BUSINESS_TYPE_MAP: Record<string, string> = {
  // Veterinary
  vet: 'veterinary',
  veterinarian: 'veterinary',
  veterinary: 'veterinary',
  'vet clinic': 'veterinary',
  'animal hospital': 'veterinary',
  // Grooming
  groomer: 'grooming',
  grooming: 'grooming',
  'pet groomer': 'grooming',
  'dog groomer': 'grooming',
  // Pet Store
  pet_store: 'pet_store',
  'pet store': 'pet_store',
  'pet shop': 'pet_store',
  retail: 'pet_store',
  // Food
  food: 'food',
  'pet food': 'food',
  treats: 'food',
  bakery: 'food',
  // Boarding
  boarding: 'boarding',
  kennel: 'boarding',
  'pet hotel': 'boarding',
  // Training
  training: 'training',
  trainer: 'training',
  'dog trainer': 'training',
  'pet trainer': 'training',
  obedience: 'training',
  // Walker
  walker: 'walker',
  walking: 'walker',
  'dog walker': 'walker',
  'pet walker': 'walker',
  // Daycare (includes pet sitting)
  daycare: 'daycare',
  'pet daycare': 'daycare',
  'dog daycare': 'daycare',
  // Pet Sitting → merged into Daycare
  pet_sitting: 'daycare',
  'pet sitting': 'daycare',
  sitter: 'daycare',
  'pet sitter': 'daycare',
  // Spa → merged into Grooming
  spa: 'grooming',
  'pet spa': 'grooming',
  // Photography
  photography: 'photography',
  photographer: 'photography',
  'pet photography': 'photography',
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
