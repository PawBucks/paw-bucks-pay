import { memo } from"react";
import { Link } from"react-router-dom";
import { motion } from"framer-motion";
import { Card, CardContent } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import {
 Star,
 MapPin,
 CreditCard,
 Coins,
 BadgeCheck,
 Sparkles,
 ChevronRight,
 Store,
} from"lucide-react";
import { OpenStatusBadge } from"@/components/merchant/OpenStatusBadge";

type DirectoryMerchant = {
 id: string;
 business_name: string;
 business_type: string;
 description?: string;
 address?: string;
 cashback_rate: number;
 logo_url?: string;
 accepts_pawbucks?: boolean;
 average_rating: number;
 review_count: number;
 price_range?: number;
};

interface DirectoryMerchantCardProps {
 merchant: DirectoryMerchant;
 index: number;
 isVerified?: boolean;
 isSponsored?: boolean;
 isBoosted?: boolean;
 onClick?: () => void;
 Icon?: React.ComponentType<{ className?: string }>;
}

const getPriceRange = (range?: number) =>"$".repeat(range || 0);

const DirectoryMerchantCardComponent = ({
 merchant,
 index,
 isVerified,
 isSponsored: sponsored,
 isBoosted,
 onClick,
 Icon,
}: DirectoryMerchantCardProps) => {
 const rating = merchant.average_rating ?? 0;
 const fullStars = Math.floor(rating);
 const hasHalf = rating % 1 >= 0.5;
 const FallbackIcon = Icon || Store;

 return (
 <motion.div
 initial={{ opacity: 0, y: 16 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.3, ease:"easeOut" }}
 >
 <Link to={`/merchant/${merchant.id}`} onClick={onClick} className="block">
 <Card
 className={`group hover:shadow-lg transition-all duration-300 overflow-hidden ${
 sponsored
 ?"border-primary/30 ring-1 ring-primary/10 bg-primary/[0.02]"
 :"border-border/60 hover:border-primary/40"
 }`}
 >
 <CardContent className="p-0">
 <div className="flex gap-4 p-4">
 {/* Logo */}
 <div className="flex-shrink-0">
 {merchant.logo_url ? (
 <div className="w-[88px] h-[88px] rounded-xl overflow-hidden bg-background shadow-sm border border-border/50 group-hover:shadow-md transition-shadow">
 <img
 src={merchant.logo_url}
 alt={`${merchant.business_name} logo`}
 width={88}
 height={88}
 className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
 loading="lazy"
 />
 </div>
 ) : (
 <div className="w-[88px] h-[88px] rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center border border-border/30 group-hover:shadow-md transition-shadow">
 <FallbackIcon className="w-9 h-9 text-primary/70" />
 </div>
 )}
 </div>

 {/* Content */}
 <div className="flex-1 min-w-0">
 {/* Row 1: Name + badges */}
 <div className="flex items-start justify-between gap-2 mb-1">
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-1.5 flex-wrap">
 {sponsored && (
 <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] gap-0.5 px-1.5 py-0">
 <Sparkles className="w-2.5 h-2.5" />
 Ad
 </Badge>
 )}
 <h3 className="font-bold text-[15px] leading-tight line-clamp-1 group-hover:text-primary transition-colors">
 {merchant.business_name}
 </h3>
 {isVerified && (
 <BadgeCheck className="w-4 h-4 text-info flex-shrink-0" />
 )}
 </div>
 </div>
 <ChevronRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-0.5" />
 </div>

 {/* Row 2: Rating + reviews + price */}
 <div className="flex items-center gap-2 mb-1.5 flex-wrap">
 <div className="flex items-center gap-0.5">
 {[...Array(5)].map((_, i) => (
 <Star
 key={i}
 className={`w-3.5 h-3.5 ${
 i < fullStars
 ?"text-gold fill-gold"
 : i === fullStars && hasHalf
 ?"text-gold fill-gold/50"
 :"text-muted-foreground/20"
 }`}
 />
 ))}
 </div>
 <span className="text-sm font-semibold">
 {rating > 0 ? rating.toFixed(1) :"New"}
 </span>
 <span className="text-xs text-muted-foreground">
 ({merchant.review_count ?? 0})
 </span>
 {merchant.price_range && merchant.price_range > 0 && (
 <>
 <span className="text-muted-foreground/30">·</span>
 <span className="text-xs">
 {[1, 2, 3, 4].map((level) => (
 <span
 key={level}
 className={
 level <= (merchant.price_range || 0)
 ?"text-foreground font-semibold"
 :"text-muted-foreground/25"
 }
 >
 $
 </span>
 ))}
 </span>
 </>
 )}
 </div>

 {/* Row 3: Category + Status + Rewards */}
 <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
 <Badge variant="outline" className="text-[11px] capitalize h-5 px-1.5">
 {merchant.business_type.replace(/_/g,"")}
 </Badge>
 <OpenStatusBadge merchantId={merchant.id} />
 <Badge className="bg-success/10 text-success border-success/20 text-[10px] h-5 px-1.5 gap-0.5">
 {merchant.cashback_rate}x pts
 </Badge>
 {merchant.accepts_pawbucks && (
 <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-0.5 text-primary border-primary/20">
 <Coins className="w-3 h-3" />
 PawBucks
 </Badge>
 )}
 </div>

 {/* Row 4: Description */}
 {merchant.description && (
 <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5 leading-relaxed">
 {merchant.description}
 </p>
 )}

 {/* Row 5: Address */}
 {merchant.address && (
 <div className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
 <MapPin className="w-3 h-3 flex-shrink-0" />
 <span className="line-clamp-1">{merchant.address}</span>
 </div>
 )}
 </div>
 </div>
 </CardContent>
 </Card>
 </Link>
 </motion.div>
 );
};

export const DirectoryMerchantCard = memo(DirectoryMerchantCardComponent);
