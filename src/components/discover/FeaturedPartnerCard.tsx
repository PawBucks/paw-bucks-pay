import { memo } from"react";
import { Link } from"react-router-dom";
import { motion } from"framer-motion";
import { Card, CardContent } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Button } from"@/components/ui/button";
import { Star, BadgeCheck } from "lucide-react";
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

interface FeaturedPartnerCardProps {
 merchant: MerchantWithRating;
 onPayClick: () => void;
 onCardClick?: () => void;
 showDistance?: boolean;
 isVerifiedPro?: boolean;
 headline?: string;
}

const formatDistance = (distance?: number): string => {
 if (distance === undefined) return'';
 if (distance < 0.1) return'< 0.1 mi';
 if (distance < 10) return `${Formatters.decimal(distance, 1)} mi`;
 return `${Math.round(distance)} mi`;
};

const getPriceRange = (range?: number) =>'$'.repeat(range || 2);

const FeaturedPartnerCardComponent = ({
 merchant,
 onPayClick,
 onCardClick,
 showDistance = false,
 isVerifiedPro = false,
 headline,
}: FeaturedPartnerCardProps) => {
 const safeRating = merchant.avg_rating ?? 0;
 const fullStars = Math.floor(safeRating);
 const hasHalfStar = safeRating % 1 >= 0.5;

 return (
 <motion.div
 initial={{ opacity: 0, y: 16 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.4, ease:"easeOut" }}
 >
 <Card className="relative overflow-hidden border-2 border-warning/30 bg-gradient-to-br from-warning/[0.04] via-warning/[0.02] to-transparent shadow-lg hover:shadow-xl transition-all duration-300">
 {/* Gold accent */}
 <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-warning via-warning to-warning" />
 
 <CardContent className="p-0">
 <Link to={`/merchant/${merchant.id}`} className="block" onClick={onCardClick}>
 <div className="p-4 sm:p-5">
 {/* Top badges row */}
 <div className="flex items-center gap-2 mb-3">
 <Badge className="gap-1 bg-gradient-to-r from-warning/15 to-warning/15 text-warning border-warning/25 text-[10px] font-semibold uppercase tracking-wider">
 <span className="text-xs">👑</span>
 Featured Partner
 </Badge>
 {isVerifiedPro && (
 <BadgeCheck className="w-4 h-4 text-info" />
 )}
 </div>

 <div className="flex gap-4">
 {/* Large photo */}
 <div className="flex-shrink-0">
 {merchant.logo_url ? (
 <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-md overflow-hidden bg-muted shadow-md border border-warning/20">
 <img
 src={merchant.logo_url}
 alt={merchant.business_name}
 width={112}
 height={112}
 className="w-full h-full object-cover"
 />
 </div>
 ) : (
 <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-md bg-gradient-to-br from-warning/10 to-warning/5 flex items-center justify-center border border-warning/20">
 <span className="text-4xl opacity-60">👑</span>
 </div>
 )}
 </div>

 {/* Info */}
 <div className="flex-1 min-w-0">
 {headline && (
 <p className="text-[10px] font-medium text-warning/80 mb-0.5 uppercase tracking-wider">
 {headline}
 </p>
 )}

 <h3 className="font-bold text-lg sm:text-xl leading-tight line-clamp-1 mb-1.5">
 {merchant.business_name}
 </h3>

 {/* Rating row */}
 <div className="flex items-center gap-1.5 mb-2">
 <div className="flex items-center gap-px">
 {[...Array(5)].map((_, i) => (
 <Star
 key={i}
 className={`w-4 h-4 ${
 i < fullStars
 ?"text-gold fill-gold"
 : i === fullStars && hasHalfStar
 ?"text-gold fill-gold/50"
 :"text-muted-foreground/20"
 }`}
 />
 ))}
 </div>
 <span className="text-sm font-semibold">{Formatters.decimal(safeRating, 1)}</span>
 <span className="text-sm text-muted-foreground">({merchant.review_count ?? 0})</span>
 </div>

 {/* Meta row */}
 <div className="flex items-center gap-1.5 flex-wrap mb-2">
 <span className="text-xs text-muted-foreground capitalize">
 {merchant.business_type.replace(/_/g,"")}
 </span>
 <span className="text-muted-foreground/40">·</span>
 <span className="text-xs text-muted-foreground font-medium">
 {getPriceRange(merchant.price_range)}
 </span>
 <span className="text-muted-foreground/40">·</span>
 <span className="text-xs text-success font-semibold">
 {Formatters.number(Math.round((merchant.cashback_rate ?? 0)))}x points
 </span>
 {merchant.accepts_pawbucks && (
 <>
 <span className="text-muted-foreground/40">·</span>
 <span className="w-3 h-3 text-primary" aria-hidden="true">🐾</span>
 </>
 )}
 </div>

 {merchant.description && (
 <p className="text-xs text-muted-foreground/80 line-clamp-2 mb-2">
 {merchant.description}
 </p>
 )}

 {/* Address */}
 <div className="flex items-center gap-2">
 {merchant.address && (
 <p className="text-[11px] text-muted-foreground/60 line-clamp-1 flex items-center gap-1">
 <span className="text-[10px] flex-shrink-0">📍</span>
 {merchant.address}
 </p>
 )}
 {showDistance && merchant.distance !== undefined && (
 <span className="text-[11px] text-muted-foreground/60 flex items-center gap-0.5 flex-shrink-0">
 <span className="w-2.5 h-2.5" aria-hidden="true">🧭</span>
 {formatDistance(merchant.distance)}
 </span>
 )}
 </div>
 </div>
 </div>
 </div>
 </Link>

 {/* CTA */}
 <div className="px-4 pb-4 sm:px-5 sm:pb-5">
 <Button
 className="w-full bg-gradient-to-r from-warning to-warning hover:from-warning hover:to-warning text-white shadow-sm"
 onClick={onPayClick}
 >
 <span className="text-base mr-2">👑</span>
 Pay & Earn Points
 </Button>
 </div>
 </CardContent>
 </Card>
 </motion.div>
 );
};

export const FeaturedPartnerCard = memo(FeaturedPartnerCardComponent);
