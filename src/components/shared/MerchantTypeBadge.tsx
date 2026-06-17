import { Badge } from "@/components/ui/badge";
import { PawBucksLogo } from "@/components/PawBucksLogo";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type MerchantFeeModel = "full_ecosystem" | "acquisition_only" | string | null | undefined;

export const isAcquisitionOnly = (feeModel: MerchantFeeModel): boolean =>
  feeModel === "acquisition_only";

interface MerchantTypeBadgeProps {
  feeModel: MerchantFeeModel;
  size?: "sm" | "md";
  className?: string;
  /** When true, hides the badge for full-ecosystem merchants (reduces visual noise). */
  hideForFullEcosystem?: boolean;
}

/**
 * Visually distinguishes Full Ecosystem merchants (accept + earn PawBucks)
 * from Acquisition-Only merchants (new customer deals only, no PawBucks).
 */
export const MerchantTypeBadge = ({
  feeModel,
  size = "sm",
  className,
  hideForFullEcosystem = false,
}: MerchantTypeBadgeProps) => {
  const acquisition = isAcquisitionOnly(feeModel);
  const sizing =
    size === "sm"
      ? "text-[10px] h-5 px-1.5 gap-0.5"
      : "text-xs h-6 px-2 gap-1";

  if (acquisition) {
    return (
      <Badge
        className={cn(
          "bg-accent/10 text-accent border-accent/30 font-semibold",
          sizing,
          className,
        )}
        title="This merchant offers New Customer deals only. PawBucks are not accepted or earned here."
      >
        <Sparkles className="w-3 h-3" aria-hidden="true" />
        New Customer Deal
      </Badge>
    );
  }

  if (hideForFullEcosystem) return null;

  return (
    <Badge
      className={cn(
        "bg-primary/10 text-primary border-primary/20 font-semibold",
        sizing,
        className,
      )}
      title="Full Ecosystem partner — pay with and earn PawBucks here."
    >
      <PawBucksLogo className="w-3 h-3" />
      PawBucks Partner
    </Badge>
  );
};

export default MerchantTypeBadge;