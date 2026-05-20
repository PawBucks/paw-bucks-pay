import { cn } from"@/lib/utils";
import { motion } from"framer-motion";
import { Medal, Trophy, Gem, type LucideIcon } from "lucide-react";

interface TierBadgeProps {
 tier:'silver' |'gold' |'platinum';
 size?:'sm' |'md' |'lg';
 showLabel?: boolean;
 className?: string;
}

const TIER_CONFIG: Record<'silver'|'gold'|'platinum', { Icon: LucideIcon; label: string; gradient: string; border: string; text: string; glow: string }> = {
 silver: {
  Icon: Medal,
 label:'Silver',
 gradient:'from-muted via-muted to-muted',
 border:'border-border',
 text:'text-foreground',
 glow:'shadow-gray-300/50',
 },
 gold: {
  Icon: Trophy,
 label:'Gold',
 gradient:'from-warning via-warning to-warning',
 border:'border-warning/30',
 text:'text-warning',
 glow:'shadow-yellow-400/50',
 },
 platinum: {
  Icon: Gem,
 label:'Platinum',
 gradient:'from-accent via-info to-info',
 border:'border-accent/30',
 text:'text-accent',
 glow:'shadow-purple-400/50',
 },
};

const SIZE_CLASSES = {
 sm:'w-8 h-8',
 md:'w-12 h-12',
 lg:'w-16 h-16',
};

const ICON_SIZE = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' } as const;

export const TierBadge = ({ tier, size ='md', showLabel = false, className }: TierBadgeProps) => {
 const config = TIER_CONFIG[tier];

 return (
 <div className={cn("flex items-center gap-2", className)}>
 <motion.div
 initial={{ scale: 0.8, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 className={cn(
"rounded-full flex items-center justify-center bg-gradient-to-br",
 config.gradient,
 config.border,
 config.glow,
"border-2 shadow-lg",
 SIZE_CLASSES[size]
 )}
 >
  <config.Icon className={cn(ICON_SIZE[size], config.text)} aria-hidden />
 </motion.div>
 {showLabel && (
 <span className={cn("font-semibold", config.text)}>
 {config.label}
 </span>
 )}
 </div>
 );
};
