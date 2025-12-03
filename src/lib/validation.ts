import { z } from "zod";

// Auth validation schemas
export const signUpSchema = z.object({
  email: z.string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  password: z.string()
    .min(6, { message: "Password must be at least 6 characters" })
    .max(128, { message: "Password must be less than 128 characters" }),
  fullName: z.string()
    .trim()
    .min(1, { message: "Name is required" })
    .max(100, { message: "Name must be less than 100 characters" }),
  referralCode: z.string()
    .trim()
    .toUpperCase()
    .length(8, { message: "Referral code must be exactly 8 characters" })
    .optional()
    .or(z.literal("")),
});

export const signInSchema = z.object({
  email: z.string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  password: z.string()
    .min(1, { message: "Password is required" })
    .max(128, { message: "Password must be less than 128 characters" }),
});

// Merchant validation schemas
export const merchantOnboardingSchema = z.object({
  businessName: z.string()
    .trim()
    .min(1, { message: "Business name is required" })
    .max(200, { message: "Business name must be less than 200 characters" }),
  contactPerson: z.string()
    .trim()
    .min(1, { message: "Contact person is required" })
    .max(100, { message: "Contact person name must be less than 100 characters" }),
  businessType: z.enum(["vet", "groomer", "sitter", "pet_store", "walker", "trainer"], {
    errorMap: () => ({ message: "Invalid business type" }),
  }),
  streetAddress: z.string()
    .trim()
    .min(1, { message: "Street address is required" })
    .max(200, { message: "Street address must be less than 200 characters" }),
  city: z.string()
    .trim()
    .min(1, { message: "City is required" })
    .max(100, { message: "City must be less than 100 characters" }),
  state: z.string()
    .trim()
    .min(1, { message: "State is required" })
    .max(50, { message: "State must be less than 50 characters" }),
  zipCode: z.string()
    .trim()
    .min(1, { message: "ZIP code is required" })
    .max(20, { message: "ZIP code must be less than 20 characters" })
    .regex(/^[0-9]{5}(-[0-9]{4})?$/, { message: "Invalid ZIP code format (e.g., 12345 or 12345-6789)" }),
  description: z.string()
    .trim()
    .max(2000, { message: "Description must be less than 2000 characters" })
    .optional()
    .or(z.literal("")),
  cashbackRate: z.number()
    .min(0, { message: "Cashback rate must be at least 0%" })
    .max(100, { message: "Cashback rate cannot exceed 100%" }),
});

// Payment validation schemas
export const paymentIntentSchema = z.object({
  amount: z.number()
    .positive({ message: "Amount must be greater than 0" })
    .max(1000000, { message: "Amount cannot exceed $1,000,000" }),
  merchantId: z.string()
    .uuid({ message: "Invalid merchant ID format" }),
  description: z.string()
    .trim()
    .max(500, { message: "Description must be less than 500 characters" })
    .optional(),
});
