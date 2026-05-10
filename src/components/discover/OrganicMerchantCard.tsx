import { memo } from"react";
import { Link } from"react-router-dom";
import { motion } from"framer-motion";
import { Card, CardContent } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Button } from"@/components/ui/button";
import { MapPin, Star, ChevronRight } from "lucide-react";
import { PawBucksInfoTooltip } from"@/components/PawBucksInfoTooltip";

import { Formatters } from "@/utils/formatters";
type MerchantWithRating = {
 id: string;
 business_name: string;
 business_type: string;
 business_categories?: string[] | null;
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

interface OrganicMerchantCardProps {
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

const OrganicMerchantCardComponent = ({
 merchant,
 onPayClick,
 onCardClick,
 showDistance = false,
 isVerifiedPro = false,
 index = 0,
 Icon,
}: OrganicMerchantCardProps) => {
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
 <Card className="group hover:shadow-md transition-all duration-200 overflow-hidden border-border/50 hover:border-primary/30 bg-card">
 <CardContent className="p-0">
 <Link to={`/merchant/${merchant.id}`} className="block" onClick={onCardClick}>
 <div className="flex gap-3 sm:gap-4 p-3 sm:p-4">
 {/* Photo/Logo - square, prominent */}
 <div className="flex-shrink-0">
 {merchant.logo_url ? (
 <div className="w-[72px] h-[72px] sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-muted">
 <img
 src={merchant.logo_url}
 alt={merchant.business_name}
 width={80}
 height={80}
 className="w-full h-full object-cover"
 loading="lazy"
 />
 </div>
 ) : (
 <div className="w-[72px] h-[72px] sm:w-20 sm:h-20 rounded-lg bg-muted/60 flex items-center justify-center">
 <FallbackIcon className="w-7 h-7 text-muted-foreground/60" />
 </div>
 )}
 </div>

 {/* Content */}
 <div className="flex-1 min-w-0 py-0.5">
 {/* Row 1: Name + Verified */}
 <div className="flex items-start gap-1.5 mb-0.5">
 <h3 className="font-semibold text-[15px] leading-tight line-clamp-1 group-hover:text-primary transition-colors">
 {merchant.business_name}
 </h3>
 {isVerifiedPro && (
 <span className="w-4 h-4 text-info flex-shrink-0 mt-0.5" aria-hidden="true">✅</span>
 )}
 </div>

 {/* Row 2: Stars + Rating + Reviews + Price */}
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
 <span className="text-xs font-semibold text-foreground">{Formatters.decimal(safeRating, 1)}</span>
 <span className="text-xs text-muted-foreground">({merchant.review_count ?? 0})</span>
 <span className="text-muted-foreground/40">·</span>
 <span className="text-xs text-muted-foreground font-medium">
 {getPriceRange(merchant.price_range)}
 </span>
 </div>

 {/* Row 3: Categories + Cashback */}
 <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
 {(() => {
 const cats = (merchant.business_categories && merchant.business_categories.length > 0)
 ? merchant.business_categories
 : [merchant.business_type];
 const visible = cats.slice(0, 3);
 const extra = cats.length - visible.length;
 return (
 <>
 {visible.map((cat, i) => (
 <span key={`${cat}-${i}`} className="text-xs text-muted-foreground capitalize">
 {(cat ||"").replace(/_/g,"")}
 {i < visible.length - 1 && <span className="text-muted-foreground/40 ml-1.5">·</span>}
 </span>
 ))}
 {extra > 0 && (
 <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
 +{extra}
 </Badge>
 )}
 </>
 );
 })()}
 <span className="text-muted-foreground/40">·</span>
 <span className="text-xs text-success font-medium">
 {Formatters.number(Math.round((merchant.cashback_rate ?? 0)))}x points
 </span>
 {merchant.accepts_pawbucks && (
 <>
 <span className="text-muted-foreground/40">·</span>
 <span className="w-3 h-3 text-primary" aria-hidden="true">🪙</span>
 </>
 )}
 </div>

 {/* Row 4: Address + Distance */}
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

export const OrganicMerchantCard = memo(OrganicMerchantCardComponent);
