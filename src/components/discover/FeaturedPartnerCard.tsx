import { memo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Crown, MapPin, Star, Navigation, Coins, BadgeCheck } from "lucide-react";
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
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Card className="relative overflow-hidden border-2 border-yellow-500/30 bg-gradient-to-br from-yellow-500/[0.04] via-amber-500/[0.02] to-transparent shadow-lg hover:shadow-xl transition-all duration-300">
        {/* Gold accent */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400" />
        
        <CardContent className="p-0">
          <Link to={`/merchant/${merchant.id}`} className="block" onClick={onCardClick}>
            <div className="p-4 sm:p-5">
              {/* Top badges row */}
              <div className="flex items-center gap-2 mb-3">
                <Badge className="gap-1 bg-gradient-to-r from-yellow-500/15 to-amber-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/25 text-[10px] font-semibold uppercase tracking-wider">
                  <Crown className="w-3 h-3" />
                  Featured Partner
                </Badge>
                {isVerifiedPro && (
                  <BadgeCheck className="w-4 h-4 text-blue-500" />
                )}
              </div>

              <div className="flex gap-4">
                {/* Large photo */}
                <div className="flex-shrink-0">
                  {merchant.logo_url ? (
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-muted shadow-md border border-yellow-500/20">
                      <img
                        src={merchant.logo_url}
                        alt={merchant.business_name}
                        width={112}
                        height={112}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-gradient-to-br from-yellow-500/10 to-amber-500/5 flex items-center justify-center border border-yellow-500/20">
                      <Crown className="w-10 h-10 text-yellow-600/60" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  {headline && (
                    <p className="text-[10px] font-medium text-yellow-700/80 dark:text-yellow-400/80 mb-0.5 uppercase tracking-wider">
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
                              ? "text-yellow-500 fill-yellow-500"
                              : i === fullStars && hasHalfStar
                              ? "text-yellow-500 fill-yellow-500/50"
                              : "text-muted-foreground/20"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-semibold">{safeRating.toFixed(1)}</span>
                    <span className="text-sm text-muted-foreground">({merchant.review_count ?? 0})</span>
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-2">
                    <span className="text-xs text-muted-foreground capitalize">
                      {merchant.business_type.replace(/_/g, " ")}
                    </span>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-xs text-muted-foreground font-medium">
                      {getPriceRange(merchant.price_range)}
                    </span>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-xs text-green-600 font-semibold">
                      {(merchant.cashback_rate ?? 0).toFixed(0)}x points
                    </span>
                    {merchant.accepts_pawbucks && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <Coins className="w-3 h-3 text-primary" />
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
                        <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                        {merchant.address}
                      </p>
                    )}
                    {showDistance && merchant.distance !== undefined && (
                      <span className="text-[11px] text-muted-foreground/60 flex items-center gap-0.5 flex-shrink-0">
                        <Navigation className="w-2.5 h-2.5" />
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
              className="w-full bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-700 hover:to-amber-700 text-white shadow-sm"
              onClick={onPayClick}
            >
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
