import { memo } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Founding50BadgeProps {
  entityType: "merchant" | "vet";
  entityId: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-6 text-[10px] px-2.5 gap-1",
  md: "h-8 text-xs px-3.5 gap-1.5",
  lg: "h-10 text-sm px-4 gap-2",
};

const iconSizes = {
  sm: 12,
  md: 14,
  lg: 16,
};

const Founding50BadgeComponent = ({ entityType, entityId, size = "md" }: Founding50BadgeProps) => {
  const { data: badge } = useQuery({
    queryKey: ["founding-50", entityType, entityId],
    queryFn: async () => {
      const { data } = await supabase
        .from("founding_50_badges")
        .select("badge_number, awarded_at")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .maybeSingle();
      return data;
    },
    staleTime: 1000 * 60 * 30,
  });

  if (!badge) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            whileHover={{ scale: 1.05, y: -1 }}
            className={`
              relative inline-flex items-center font-bold rounded-full cursor-default select-none
              text-warning-foreground overflow-hidden
              bg-[linear-gradient(135deg,hsl(45_95%_58%)_0%,hsl(38_92%_50%)_45%,hsl(32_88%_44%)_100%)]
              border border-white/30
              shadow-[0_2px_8px_-1px_hsl(38_92%_42%/0.5),0_0_0_1px_hsl(38_92%_38%/0.25),inset_0_1px_0_0_hsl(48_100%_78%/0.65)]
              ${sizeClasses[size]}
            `}
          >
            {/* Shimmer sweep */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,transparent_30%,hsl(0_0%_100%/0.45)_50%,transparent_70%)]"
              style={{ backgroundSize: "200% 100%" }}
            />
            <span
              className="relative text-warning-foreground drop-shadow-[0_1px_1px_hsl(32_88%_28%/0.55)]"
              style={{ fontSize: iconSizes[size] }}
              aria-hidden="true"
            >⭐</span>
            <span className="relative whitespace-nowrap tracking-[0.08em] drop-shadow-[0_1px_1px_hsl(32_88%_28%/0.45)]">
              FOUNDING 50
            </span>
            <span className="relative font-extrabold opacity-90 tabular-nums">
              #{badge.badge_number}
            </span>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs p-3 text-center">
          <p className="font-bold text-sm mb-1">🏆 Founding 50 Member</p>
          <p className="text-xs text-muted-foreground">
            Among the first 50 {entityType === "merchant" ? "merchants" : "veterinarians"} to join PawBucks.
            Badge #{badge.badge_number} of 50.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const Founding50Badge = memo(Founding50BadgeComponent);
