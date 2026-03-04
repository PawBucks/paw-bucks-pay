import { memo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Star, Navigation, CreditCard, Coins, BadgeCheck, ChevronRight } from "lucide-react";
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
  if (distance === undefined) return '';
  if (distance < 0.1) return '< 0.1 mi';
  if (distance < 10) return `${distance.toFixed(1)} mi`;
  return `${Math.round(distance)} mi`;
};

const getPriceRange = (range?: number) => '$'.repeat(range || 2);

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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" }}
    >
      <Card className="group hover:shadow-lg transition-all duration-300 overflow-hidden border-border hover:border-primary/50">
        <CardContent className="p-0">
          <Link to={`/merchant/${merchant.id}`} className="block" onClick={onCardClick}>
            <div className="flex gap-4 p-4">
              <div className="flex-shrink-0">
                {merchant.logo_url ? (
                  <div className="w-24 h-24 rounded-lg overflow-hidden bg-background shadow-sm border border-border">
                    <img
                      src={merchant.logo_url}
                      alt={`${merchant.business_name} logo`}
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border border-border/50">
                    <FallbackIcon className="w-10 h-10 text-primary" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="mb-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {isVerifiedPro && (
                      <Badge className="gap-1 bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs">
                        <BadgeCheck className="w-3 h-3" />
                        Verified Pro
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">
                      Sponsored
                    </span>
                  </div>
                  <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-primary transition-colors">
                    {merchant.business_name}
                  </h3>
                </div>

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
                  <span className="text-sm font-medium">{safeRating.toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground">({merchant.review_count ?? 0})</span>
                </div>

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

                {merchant.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {merchant.description}
                  </p>
                )}

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

              <div className="flex-shrink-0 self-center">
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </Link>

          <div className="px-4 pb-4">
            <Button className="w-full" variant="outline" onClick={onPayClick}>
              Pay & Earn Points
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export const SponsoredMerchantCard = memo(SponsoredMerchantCardComponent);
