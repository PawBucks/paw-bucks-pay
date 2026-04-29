import { cn } from"@/lib/utils";

type Props = {
 priceRange?: number | null;
 className?: string;
};

const LABELS: Record<number, string> = {
 1:"Budget-friendly",
 2:"Moderate",
 3:"Upscale",
 4:"Premium",
};

export function PriceRangeDisplay({ priceRange, className }: Props) {
 if (!priceRange) return null;

 return (
 <span className={cn("inline-flex items-center gap-1 text-sm", className)}>
 {[1, 2, 3, 4].map((level) => (
 <span
 key={level}
 className={level <= priceRange ?"text-foreground font-semibold" :"text-muted-foreground/30"}
 >
 $
 </span>
 ))}
 <span className="text-muted-foreground ml-1">· {LABELS[priceRange] ||""}</span>
 </span>
 );
}
