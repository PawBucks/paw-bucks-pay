import { memo } from"react";
import { Link } from"react-router-dom";
import { motion } from"framer-motion";
import { Card, CardContent } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Button } from"@/components/ui/button";
import { MapPin, Star, ChevronRight, BadgeCheck } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { PawBucksInfoTooltip } from"@/components/PawBucksInfoTooltip";

import { Formatters } from "@/utils/formatters";
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

interface SponsoredMerchantCardProps {
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

const SponsoredMerchantCardComponent = ({
 merchant,
 onPayClick,
 onCardClick,
 showDistance = false,
 isVerifiedPro = false,
 index = 0,
 Icon,
}: SponsoredMerchantCardProps) => {
 const safeRating = merchant.avg_rating ?? 0;
 const fullStars = Math.floor(safeRating);
 const hasHalfStar = safeRating % 1 >= 0.5;
 const FallbackIcon = Icon || MapPin;

 return (
 <motion.div
 initial={{ opacity: 0, y: 12 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: index * 0.04, duration: 0.25, ease:"easeOut" }}
 >
 <Card className="group overflow-hidden border-primary/20 bg-gradient-to-r from-primary/[0.02] to-transparent hover:shadow-lg hover:border-primary/40 transition-all duration-200">
 <CardContent className="p-0">
 <Link to={`/merchant/${merchant.id}`} className="block" onClick={onCardClick}>
 <div className="flex gap-3 sm:gap-4 p-3 sm:p-4">
 {/* Photo/Logo */}
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
 <FallbackIcon className="w-9 h-9 text-primary/60" />
 </div>
 )}
 </div>

 {/* Content */}
 <div className="flex-1 min-w-0 py-0.5">
 {/* Sponsored label */}
 <span className="text-[10px] text-muted-foreground/50 uppercase tracking-widest font-medium">
 Sponsored
 </span>

 {/* Name + Verified */}
 <div className="flex items-start gap-1.5 mb-1">
 <h3 className="font-semibold text-base sm:text-lg leading-tight line-clamp-1 group-hover:text-primary transition-colors">
 {merchant.business_name}
 </h3>
 {isVerifiedPro && (
 <BadgeCheck className="w-4 h-4 text-info flex-shrink-0 mt-0.5" />
 )}
 </div>

 {/* Stars + Rating + Reviews + Price */}
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

 {/* Category + Cashback */}
 <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
 <span className="text-xs text-muted-foreground capitalize">
 {merchant.business_type.replace(/_/g,"")}
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

 {/* Description snippet */}
 {merchant.description && (
 <p className="text-xs text-muted-foreground/80 line-clamp-1 mb-1.5">
 {merchant.description}
 </p>
 )}

 {/* Address + Distance */}
 <div className="flex items-center gap-2">
 {merchant.address && (
 <p className="text-[11px] text-muted-foreground/70 line-clamp-1 flex items-center gap-1">
 <span className="text-[10px] flex-shrink-0">📍</span>
 {merchant.address}
 </p>
 )}
 {showDistance && merchant.distance !== undefined && (
 <span className="text-[11px] text-muted-foreground/70 flex items-center gap-0.5 flex-shrink-0">
 <span className="w-2.5 h-2.5" aria-hidden="true">🧭</span>
 {formatDistance(merchant.distance)}
 </span>
 )}
 </div>
 </div>

 {/* Arrow */}
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

export const SponsoredMerchantCard = memo(SponsoredMerchantCardComponent);
