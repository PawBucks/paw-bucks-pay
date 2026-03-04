import { memo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Crown, MapPin, Star, Navigation, CreditCard, Coins, BadgeCheck } from "lucide-react";
import { PawBucksInfoTooltip } from "@/components/PawBucksInfoTooltip";

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
  if (distance === undefined) return '';
  if (distance < 0.1) return '< 0.1 mi';
  if (distance < 10) return `${distance.toFixed(1)} mi`;
  return `${Math.round(distance)} mi`;
};

const getPriceRange = (range?: number) => '$'.repeat(range || 2);

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
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Card className="relative overflow-hidden border-2 border-yellow-500/40 bg-gradient-to-br from-yellow-500/5 via-amber-500/5 to-background shadow-[0_4px_24px_-4px_hsl(var(--primary)/0.15)] hover:shadow-[0_8px_32px_-4px_hsl(var(--primary)/0.25)] transition-all duration-300">
        {/* Gold accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400" />
        
        <CardContent className="p-0">
          <Link to={`/merchant/${merchant.id}`} className="block" onClick={onCardClick}>
            <div className="flex gap-5 p-5 sm:p-6">
              {/* Larger logo for Featured Partner */}
              <div className="flex-shrink-0">
                {merchant.logo_url ? (
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl overflow-hidden bg-background shadow-md border-2 border-yellow-500/20">
                    <img
                      src={merchant.logo_url}
                      alt={`${merchant.business_name} logo`}
                      width={128}
                      height={128}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl bg-gradient-to-br from-yellow-500/15 to-amber-500/10 flex items-center justify-center border-2 border-yellow-500/20">
                    <Crown className="w-12 h-12 text-yellow-600" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Badges row */}
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <Badge className="gap-1 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30 text-xs font-semibold">
                    <Crown className="w-3 h-3" />
                    Featured Partner
                  </Badge>
                  {isVerifiedPro && (
                    <Badge className="gap-1 bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs">
                      <BadgeCheck className="w-3 h-3" />
                      Verified Pro
                    </Badge>
                  )}
                </div>

                {/* Headline */}
                {headline && (
                  <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400 mb-1 tracking-wide uppercase">
                    {headline}
                  </p>
                )}

                {/* Name */}
                <h3 className="font-bold text-xl sm:text-2xl line-clamp-1 mb-2">
                  {merchant.business_name}
                </h3>

                {/* Rating */}
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < fullStars
                            ? "text-yellow-500 fill-yellow-500"
                            : i === fullStars && hasHalfStar
                            ? "text-yellow-500 fill-yellow-500/50"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-semibold">{safeRating.toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground">({merchant.review_count ?? 0})</span>
                </div>

                {/* Type + Price + Cashback */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge variant="outline" className="text-xs capitalize">
                    {merchant.business_type.replace(/_/g, " ")}
                  </Badge>
                  <span className="text-sm font-medium text-muted-foreground">
                    {getPriceRange(merchant.price_range)}
                  </span>
                  <span className="text-muted-foreground/50">•</span>
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs gap-1">
                    {(merchant.cashback_rate ?? 0).toFixed(0)}x points
                    <PawBucksInfoTooltip variant="multiplier" className="ml-0.5" />
                  </Badge>
                </div>

                {/* Description */}
                {merchant.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {merchant.description}
                  </p>
                )}

                {/* Address + Distance */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {merchant.address && (
                      <p className="text-xs text-muted-foreground line-clamp-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        {merchant.address}
                      </p>
                    )}
                    {showDistance && merchant.distance !== undefined && (
                      <Badge variant="outline" className="text-xs flex-shrink-0 gap-1">
                        <Navigation className="w-3 h-3" />
                        {formatDistance(merchant.distance)}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                    {merchant.accepts_pawbucks && (
                      <Coins className="w-3.5 h-3.5 text-primary" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Link>

          {/* Pay Button */}
          <div className="px-5 pb-5 sm:px-6 sm:pb-6">
            <Button className="w-full bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-700 hover:to-amber-700 text-white shadow-md" onClick={onPayClick}>
              <Crown className="w-4 h-4 mr-2" />
              Pay & Earn Points
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export const FeaturedPartnerCard = memo(FeaturedPartnerCardComponent);
