import { motion } from "framer-motion";
import { Sparkles, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Formatters } from "@/utils/formatters";

interface SavingsHeroProps {
  /** Total $ available to spend automatically (auto-applied savings). */
  availableUsd: number;
  /** Lifetime $ saved through PawBucks. */
  lifetimeUsd?: number;
  /** Optional next reward / next save countdown line. */
  helperText?: string;
  onClick?: () => void;
}

/**
 * The single emotional anchor of the Pet Owner experience.
 * Shows ONLY dollars saved — never PawBucks, never points.
 */
export const SavingsHero = ({
  availableUsd,
  lifetimeUsd = 0,
  helperText,
  onClick,
}: SavingsHeroProps) => {
  const navigate = useNavigate();
  const handle = onClick ?? (() => navigate("/savings"));

  return (
    <motion.button
      type="button"
      onClick={handle}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      whileTap={{ scale: 0.99 }}
      className="group relative w-full overflow-hidden rounded-2xl text-left p-6 sm:p-8
                 bg-[image:var(--gradient-primary)] text-primary-foreground
                 shadow-[var(--shadow-glow-primary)] focus-visible:outline-none
                 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label="View your savings"
    >
      {/* Decorative orb */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full
                   bg-white/15 blur-2xl"
      />
      <div className="relative flex flex-col gap-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] opacity-90">
          <Sparkles className="h-3.5 w-3.5" />
          You're saving on pet care
        </div>
        <div>
          <div className="text-5xl sm:text-6xl font-semibold tabular-nums leading-none">
            {Formatters.currency(availableUsd)}
          </div>
          <div className="mt-2 text-sm opacity-90">
            ready to use automatically at checkout
          </div>
        </div>
        <div className="flex items-end justify-between pt-2 border-t border-white/15">
          <div className="text-xs opacity-90">
            {helperText ?? `Lifetime saved · ${Formatters.currency(lifetimeUsd)}`}
          </div>
          <div className="inline-flex items-center gap-1 text-sm font-medium opacity-95 group-hover:opacity-100">
            See details <ArrowUpRight className="h-4 w-4" />
          </div>
        </div>
      </div>
    </motion.button>
  );
};