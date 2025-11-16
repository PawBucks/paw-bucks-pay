import { z } from 'zod';

// Payment validation
export const paymentSchema = z.object({
  amount: z
    .number()
    .positive('Amount must be greater than 0')
    .max(10000, 'Amount cannot exceed $10,000 per transaction'),
  description: z.string().max(200, 'Description too long').optional(),
});

// Pet profile validation
export const petProfileSchema = z.object({
  name: z
    .string()
    .min(1, 'Pet name is required')
    .max(50, 'Name is too long'),
  type: z.enum(['dog', 'cat', 'other']),
  breed: z.string().max(50).optional(),
  birthday: z.string().optional(),
});

// Merchant onboarding validation
export const merchantSchema = z.object({
  businessName: z
    .string()
    .min(2, 'Business name must be at least 2 characters')
    .max(100, 'Business name is too long'),
  contactPerson: z
    .string()
    .min(2, 'Contact person name is required')
    .max(100),
  businessType: z.enum(['vet', 'groomer', 'sitter', 'pet_store', 'walker', 'trainer']),
  address: z.string().optional(),
  description: z.string().max(500, 'Description is too long').optional(),
  cashbackRate: z
    .number()
    .min(0, 'Cashback rate cannot be negative')
    .max(20, 'Cashback rate cannot exceed 20%'),
});

// Funding request validation
export const fundingRequestSchema = z.object({
  requestedAmount: z
    .number()
    .positive('Amount must be greater than 0')
    .max(1000000, 'Amount cannot exceed $1,000,000'),
  reason: z
    .string()
    .min(10, 'Please provide a detailed reason (at least 10 characters)')
    .max(1000, 'Reason is too long'),
  estimatedMonthlySales: z
    .number()
    .positive('Estimated monthly sales must be greater than 0'),
});

// Helper to format validation errors
export const formatZodErrors = (error: z.ZodError) => {
  return error.errors.map((err) => err.message).join(', ');
};
