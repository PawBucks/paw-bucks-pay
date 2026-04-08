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
  sm: "h-6 text-[10px] px-2 gap-1",
  md: "h-8 text-xs px-3 gap-1.5",
  lg: "h-10 text-sm px-4 gap-2",
};

const iconSizes = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
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
            className={`
              inline-flex items-center font-bold rounded-full cursor-default select-none
              bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500
              text-amber-950 shadow-[0_0_12px_rgba(245,158,11,0.4)]
              border border-amber-300/60
              ${sizeClasses[size]}
            `}
          >
            <span className={iconSizes[size]}>⭐</span>
            <span className="whitespace-nowrap tracking-wide">FOUNDING 50</span>
            <span className="opacity-70">#{badge.badge_number}</span>
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
