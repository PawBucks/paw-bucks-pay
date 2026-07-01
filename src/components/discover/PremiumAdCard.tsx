import { memo } from"react";
import { Link } from"react-router-dom";
import { motion } from"framer-motion";
import { Card, CardContent } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Button } from"@/components/ui/button";
import { Star, Gem, ChevronRight, BadgeCheck } from "lucide-react";
import { PawBucksInfoTooltip } from"@/components/PawBucksInfoTooltip";

import { Formatters } from "@/utils/formatters";
import { PawBucksLogo } from "@/components/PawBucksLogo";
type MerchantWithRating = {
 id: string;
 business_name: string;
 business_type: string;
 description?: string;
 address?: string;
 latitude?: number;
 longitude?: number;
 cashback_rate: number;
 logo_url?: string;
 accepts_pawbucks?: boolean;
 price_range?: number;
 avg_rating: number;
 review_count: number;
 distance?: number;
};

interface PremiumAdCardProps {
 merchant: MerchantWithRating;
 onPayClick: () => void;
 onCardClick?: () => void;
 showDistance?: boolean;
 isVerifiedPro?: boolean;
 index?: number;
 Icon?: React.ComponentType<{ className?: string }>;
}

const formatDistance = (distance?: number): string => {
 if (distance === undefined) return'';
 if (distance < 0.1) return'< 0.1 mi';
 if (distance < 10) return `${Formatters.decimal(distance, 1)} mi`;
 return `${Math.round(distance)} mi`;
};

const getPriceRange = (range?: number) =>'$'.repeat(range || 2);

const PremiumAdCardComponent = ({
 merchant,
 onPayClick,
 onCardClick,
 showDistance = false,
 isVerifiedPro = false,
 index = 0,
 Icon,
}: PremiumAdCardProps) => {
 const safeRating = merchant.avg_rating ?? 0;
 const fullStars = Math.floor(safeRating);
 const hasHalfStar = safeRating % 1 >= 0.5;
 const FallbackIcon = Icon || Gem;

 return (
 <motion.div
 initial={{ opacity: 0, y: 12 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: index * 0.05, duration: 0.3, ease:"easeOut" }}
 >
 <Card className="group overflow-hidden border-border/60 bg-card shadow-[0_2px_12px_-4px_hsl(var(--primary)/0.08)] hover:shadow-[0_8px_24px_-6px_hsl(var(--primary)/0.15)] transition-all duration-200 hover:border-primary/30">
 <CardContent className="p-0">
 <Link to={`/merchant/${merchant.id}`} className="block" onClick={onCardClick}>
 <div className="flex gap-3 sm:gap-4 p-3 sm:p-4">
 {/* Logo */}
 <div className="flex-shrink-0">
 {merchant.logo_url ? (
 <div className="w-[88px] h-[88px] sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-muted shadow-sm">
 <img
 src={merchant.logo_url}
 alt={merchant.business_name}
 width={96}
 height={96}
 className="w-full h-full object-cover"
 loading="lazy"
 />
 </div>
 ) : (
 <div className="w-[88px] h-[88px] sm:w-24 sm:h-24 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
 <FallbackIcon className="w-9 h-9 text-primary" />
 </div>
 )}
 </div>

 {/* Content */}
 <div className="flex-1 min-w-0 py-0.5">
 {/* Premium label */}
 <div className="flex items-center gap-1.5 mb-0.5">
 <Gem className="w-3 h-3 text-primary/60" />
 <span className="text-[10px] text-primary/60 uppercase tracking-widest font-medium">Premium</span>
 </div>

 {/* Name + Verified */}
 <div className="flex items-start gap-1.5 mb-1">
 <h3 className="font-semibold text-base sm:text-lg leading-tight line-clamp-1 group-hover:text-primary transition-colors">
 {merchant.business_name}
 </h3>
 {isVerifiedPro && (
 <BadgeCheck className="w-4 h-4 text-info flex-shrink-0 mt-0.5" />
 )}
 </div>

 {/* Rating */}
 <div className="flex items-center gap-1.5 mb-1.5">
 <div className="flex items-center gap-px">
 {[...Array(5)].map((_, i) => (
 <Star
 key={i}
 className={`w-3.5 h-3.5 ${
 i < fullStars
 ?"text-gold fill-gold"
 : i === fullStars && hasHalfStar
 ?"text-gold fill-gold/50"
 :"text-muted-foreground/20"
 }`}
 />
 ))}
 </div>
 <span className="text-xs font-semibold">{Formatters.decimal(safeRating, 1)}</span>
 <span className="text-xs text-muted-foreground">({merchant.review_count ?? 0})</span>
 <span className="text-muted-foreground/40">·</span>
 <span className="text-xs text-muted-foreground font-medium">
 {getPriceRange(merchant.price_range)}
 </span>
 </div>

 {/* Meta */}
 <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
 <span className="text-xs text-muted-foreground capitalize">
 {merchant.business_type.replace(/_/g," ")}
 </span>
 <span className="text-muted-foreground/40">·</span>
 <span className="text-xs text-success font-medium">
 {Formatters.number(Math.round((merchant.cashback_rate ?? 0)))}x points
 </span>
 {merchant.accepts_pawbucks && (
 <>
 <span className="text-muted-foreground/40">·</span>
 <PawBucksLogo className="w-3 h-3 text-primary" />
 </>
 )}
 </div>

 {merchant.description && (
 <p className="text-xs text-muted-foreground line-clamp-1 mb-1.5">
 {merchant.description}
 </p>
 )}

 {/* Address */}
 <div className="flex items-center gap-2">
 {merchant.address && (
 <p className="text-[11px] text-muted-foreground line-clamp-1 flex items-center gap-1">
 <span className="w-2.5 h-2.5 flex-shrink-0" aria-hidden="true">📍</span>
 {merchant.address}
 </p>
 )}
 {showDistance && merchant.distance !== undefined && (
 <span className="text-[11px] text-muted-foreground flex items-center gap-0.5 flex-shrink-0">
 <span className="w-2.5 h-2.5" aria-hidden="true">🧭</span>
 {formatDistance(merchant.distance)}
 </span>
 )}
 </div>
 </div>

 <div className="flex-shrink-0 self-center">
 <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
 </div>
 </div>
 </Link>
 </CardContent>
 </Card>
 </motion.div>
 );
};

export const PremiumAdCard = memo(PremiumAdCardComponent);
