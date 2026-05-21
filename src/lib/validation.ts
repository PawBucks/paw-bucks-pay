import { z } from"zod";

// ==========================================
// Auth Validation Schemas
// ==========================================

export const signUpSchema = z.object({
 email: z.string()
 .trim()
 .email({ message:"Invalid email address" })
 .max(255, { message:"Email must be less than 255 characters" }),
 password: z.string()
 .min(6, { message:"Password must be at least 6 characters" })
 .max(128, { message:"Password must be less than 128 characters" }),
 fullName: z.string()
 .trim()
 .min(1, { message:"Name is required" })
 .max(100, { message:"Name must be less than 100 characters" }),
  phone: z.string()
    .trim()
    .min(1, { message:"Phone number is required" })
    .max(20, { message:"Phone number must be less than 20 characters" })
    .regex(/^[\d\s\-\(\)\+\.]+$/, { message:"Invalid phone number format" })
    .refine((val) => (val.match(/\d/g) || []).length >= 10, {
      message:"Phone number must contain at least 10 digits",
    }),
 referralCode: z.string()
 .trim()
 .toUpperCase()
 .length(8, { message:"Referral code must be exactly 8 characters" })
 .optional()
 .or(z.literal("")),
});

export const signInSchema = z.object({
 email: z.string()
 .trim()
 .email({ message:"Invalid email address" })
 .max(255, { message:"Email must be less than 255 characters" }),
 password: z.string()
 .min(1, { message:"Password is required" })
 .max(128, { message:"Password must be less than 128 characters" }),
});

// ==========================================
// Merchant Validation Schemas
// ==========================================

// Pet business-specific types for smart onboarding
export const PET_BUSINESS_TYPES = [
"veterinary","grooming","mobile_groomer","training", 
"walker","runner","hiker","sitter","daycare","boarding",
"pet_store","food","breeder","rescue_nonprofit",
"photography","insurance","delivery","masseuse","behaviorist","pet_waste_removal","other"
] as const;

export const ENTITY_TYPES = [
"sole_proprietor","llc","s_corp","c_corp","partnership","nonprofit"
] as const;

export const WORKING_STYLES = [
"home_based","storefront","mobile","mixed"
] as const;

export const merchantOnboardingSchema = z.object({
 businessName: z.string()
 .trim()
 .min(1, { message:"Business name is required" })
 .max(200, { message:"Business name must be less than 200 characters" }),
 contactPerson: z.string()
 .trim()
 .min(1, { message:"Contact person is required" })
 .max(100, { message:"Contact person name must be less than 100 characters" }),
 phone: z.string()
 .trim()
 .min(1, { message:"Phone number is required" })
 .max(20, { message:"Phone number must be less than 20 characters" })
 .regex(/^[\d\s\-\(\)\+]+$/, { message:"Invalid phone number format" }),
 businessType: z.enum(PET_BUSINESS_TYPES, {
 errorMap: () => ({ message:"Please select a business type" }),
 }),
 businessCategories: z.array(z.enum(PET_BUSINESS_TYPES))
 .min(1, { message:"Please select at least one business category" })
 .max(10, { message:"You can select up to 10 categories" })
 .optional(),
 entityType: z.enum(ENTITY_TYPES, {
 errorMap: () => ({ message:"Please select an entity type" }),
 }).optional(),
 country: z.string().default("US"),
 stateOfIncorporation: z.string().optional(),
 workingStyle: z.enum(WORKING_STYLES, {
 errorMap: () => ({ message:"Please select your working style" }),
 }).optional(),
 streetAddress: z.string()
 .trim()
 .min(1, { message:"Street address is required" })
 .max(200, { message:"Street address must be less than 200 characters" }),
 city: z.string()
 .trim()
 .min(1, { message:"City is required" })
 .max(100, { message:"City must be less than 100 characters" }),
 state: z.string()
 .trim()
 .min(1, { message:"State is required" })
 .max(50, { message:"State must be less than 50 characters" }),
 zipCode: z.string()
 .trim()
 .min(1, { message:"ZIP code is required" })
 .max(20, { message:"ZIP code must be less than 20 characters" })
 .regex(/^[0-9]{5}(-[0-9]{4})?$/, { message:"Invalid ZIP code format (e.g., 12345 or 12345-6789)" }),
 description: z.string()
 .trim()
 .max(2000, { message:"Description must be less than 2000 characters" })
 .optional()
 .or(z.literal("")),
 cashbackRate: z.number()
 .min(0, { message:"Points multiplier must be at least 0x" })
 .max(100, { message:"Points multiplier cannot exceed 100x" }),
});

// Simplified merchant schema for profile updates
export const merchantSchema = z.object({
 businessName: z.string()
 .min(2,"Business name must be at least 2 characters")
 .max(100,"Business name is too long"),
 contactPerson: z.string()
 .min(2,"Contact person name is required")
 .max(100),
 businessType: z.enum(PET_BUSINESS_TYPES),
 entityType: z.enum(ENTITY_TYPES).optional(),
 workingStyle: z.enum(WORKING_STYLES).optional(),
 address: z.string().optional(),
 description: z.string().max(500,"Description is too long").optional(),
 cashbackRate: z.number()
 .min(0,"Points multiplier cannot be negative")
 .max(20,"Points multiplier cannot exceed 20x"),
});

// ==========================================
// Payment Validation Schemas
// ==========================================

export const paymentSchema = z.object({
 amount: z.number()
 .positive("Amount must be greater than 0")
 .max(10000,"Amount cannot exceed $10,000 per transaction"),
 description: z.string().max(200,"Description too long").optional(),
});

export const paymentIntentSchema = z.object({
 amount: z.number()
 .positive({ message:"Amount must be greater than 0" })
 .max(1000000, { message:"Amount cannot exceed $1,000,000" }),
 merchantId: z.string()
 .uuid({ message:"Invalid merchant ID format" }),
 description: z.string()
 .trim()
 .max(500, { message:"Description must be less than 500 characters" })
 .optional(),
});

// ==========================================
// Pet Profile Validation Schema
// ==========================================

export const petProfileSchema = z.object({
 name: z.string()
 .min(1,"Pet name is required")
 .max(50,"Name is too long"),
 type: z.enum(["dog","cat","other"]),
 breed: z.string().max(50).optional(),
 birthday: z.string().optional(),
});

// ==========================================
// Funding Request Validation Schema
// ==========================================

export const fundingRequestSchema = z.object({
 requestedAmount: z.number()
 .positive("Amount must be greater than 0")
 .max(1000000,"Amount cannot exceed $1,000,000"),
 reason: z.string()
 .min(10,"Please provide a detailed reason (at least 10 characters)")
 .max(1000,"Reason is too long"),
 estimatedMonthlySales: z.number()
 .positive("Estimated monthly sales must be greater than 0"),
});

// ==========================================
// Utility Functions
// ==========================================

export const formatZodErrors = (error: z.ZodError) => {
 return error.errors.map((err) => err.message).join(",");
};
