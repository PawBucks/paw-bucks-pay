// Pure fee calculation logic for the two merchant fee models.
// Extracted so it can be unit-tested without Stripe or DB dependencies.

export const DEFAULT_PLATFORM_FEE_PERCENT = 0.03; // 3% — Full Ecosystem

export type FeeModel = "full_ecosystem" | "acquisition_only";

export interface FeeInput {
  amount: number;                  // amount in cents
  feeModel: FeeModel;
  acquisitionFeeRate?: number;     // percent (0-100), used only for acquisition_only
  isReturningCustomer: boolean;    // true if user has a prior completed transaction at this merchant
}

export interface FeeResult {
  applicationFee: number;          // cents
  feePercent: number;              // 0..1
  isAcquisition: boolean;          // true when this charge is the acquisition (first) purchase
}

/**
 * Compute the platform application fee.
 *
 * Rules:
 * - full_ecosystem: 3% on every transaction.
 * - acquisition_only:
 *     - first-ever completed purchase at this merchant => acquisitionFeeRate% (default 10%)
 *     - any subsequent purchase                       => 0%
 */
export function calculateApplicationFee(input: FeeInput): FeeResult {
  const { amount, feeModel, isReturningCustomer } = input;
  const acquisitionFeeRate = Number(input.acquisitionFeeRate ?? 10);

  let feePercent = DEFAULT_PLATFORM_FEE_PERCENT;
  let isAcquisition = false;

  if (feeModel === "acquisition_only") {
    isAcquisition = !isReturningCustomer;
    feePercent = isReturningCustomer ? 0 : acquisitionFeeRate / 100;
  }

  const applicationFee = Math.round(amount * feePercent);
  return { applicationFee, feePercent, isAcquisition };
}

export interface PawBucksInput {
  amount: number;                 // amount in cents
  feeModel: FeeModel;
  isReturningCustomer: boolean;
  tierMultiplier: number;         // PawBucks per $1 (10 / 20 / 30)
}

/**
 * Compute PawBucks earned for a charge.
 *
 * Rules:
 * - full_ecosystem: earn on every purchase = $amount * tierMultiplier.
 * - acquisition_only: earn ONLY on the acquisition (first) purchase.
 *   Repeat purchases at the same merchant earn 0 PawBucks.
 */
export function calculatePawBucksEarned(input: PawBucksInput): number {
  const { amount, feeModel, isReturningCustomer, tierMultiplier } = input;

  if (feeModel === "acquisition_only" && isReturningCustomer) {
    return 0;
  }

  const dollars = amount / 100;
  return Math.round(dollars * tierMultiplier);
}