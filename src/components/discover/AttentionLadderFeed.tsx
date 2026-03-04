import { memo, useMemo } from "react";
import { Crown, Gem } from "lucide-react";
import { FeaturedPartnerCard } from "./FeaturedPartnerCard";
import { PremiumAdCard } from "./PremiumAdCard";
import { SponsoredMerchantCard } from "./SponsoredMerchantCard";
import { OrganicMerchantCard } from "./OrganicMerchantCard";

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
  _isSponsored?: boolean;
};

interface AttentionLadderFeedProps {
  featuredPartners: MerchantWithRating[];
  premiumAds: MerchantWithRating[];
  interspersedResults: MerchantWithRating[];
  verifiedProSet: Set<string>;
  showDistance: boolean;
  selectedCategory: string;
  onPayClick: (merchant: MerchantWithRating) => void;
  onSponsoredClick: (merchant: MerchantWithRating, position: number) => void;
  onCardClick: (merchantId: string, position: number) => void;
}

/** Generates a human-friendly headline like "Top-Rated Groomer in Venice" */
const generateHeadline = (merchant: MerchantWithRating, category: string): string => {
  const type = merchant.business_type.replace(/_/g, ' ');
  const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
  
  // Try to extract city from address
  const addressParts = merchant.address?.split(',').map(s => s.trim()) || [];
  const city = addressParts.length >= 2 ? addressParts[addressParts.length - 2] : null;
  
  if (city) {
    return `Top-Rated ${capitalizedType} in ${city}`;
  }
  return `Top-Rated ${capitalizedType}`;
};

const AttentionLadderFeedComponent = ({
  featuredPartners,
  premiumAds,
  interspersedResults,
  verifiedProSet,
  showDistance,
  selectedCategory,
  onPayClick,
  onSponsoredClick,
  onCardClick,
}: AttentionLadderFeedProps) => {
  let positionCounter = 0;

  return (
    <div className="space-y-6">
      {/* 🥇 Level 1 — Featured Partner (full-width, gold, ultra rare) */}
      {featuredPartners.length > 0 && (
        <div className="space-y-4">
          {featuredPartners.map((merchant) => {
            positionCounter++;
            const pos = positionCounter;
            return (
              <FeaturedPartnerCard
                key={merchant.id}
                merchant={merchant}
                onPayClick={() => onPayClick(merchant)}
                onCardClick={() => onCardClick(merchant.id, pos)}
                showDistance={showDistance}
                isVerifiedPro={verifiedProSet.has(merchant.id)}
                headline={generateHeadline(merchant, selectedCategory)}
              />
            );
          })}
        </div>
      )}

      {/* 🥈 Level 2 — Premium Ad Placement (elevated shadow, "Premium" tag) */}
      {premiumAds.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Gem className="w-4 h-4 text-primary/60" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Premium</span>
          </div>
          {premiumAds.map((merchant, index) => {
            positionCounter++;
            const pos = positionCounter;
            return (
              <PremiumAdCard
                key={merchant.id}
                merchant={merchant}
                onPayClick={() => onPayClick(merchant)}
                onCardClick={() => onCardClick(merchant.id, pos)}
                showDistance={showDistance}
                isVerifiedPro={verifiedProSet.has(merchant.id)}
                index={index}
              />
            );
          })}
        </div>
      )}

      {/* 🥉 Level 3+4+5 — Sponsored (interspersed) + Boosted + Organic */}
      {interspersedResults.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">
            {(featuredPartners.length > 0 || premiumAds.length > 0) ? "All Results" : "Results"}
          </h2>
          <div className="space-y-4">
            {interspersedResults.map((merchant, index) => {
              positionCounter++;
              const pos = positionCounter;
              const isSponsored = !!(merchant as any)._isSponsored;

              if (isSponsored) {
                return (
                  <SponsoredMerchantCard
                    key={`sponsored-${merchant.id}`}
                    merchant={merchant}
                    onPayClick={() => onSponsoredClick(merchant, pos)}
                    onCardClick={() => onCardClick(merchant.id, pos)}
                    showDistance={showDistance}
                    isVerifiedPro={verifiedProSet.has(merchant.id)}
                    index={index}
                  />
                );
              }

              return (
                <OrganicMerchantCard
                  key={merchant.id}
                  merchant={merchant}
                  onPayClick={() => onPayClick(merchant)}
                  onCardClick={() => onCardClick(merchant.id, pos)}
                  showDistance={showDistance}
                  isVerifiedPro={verifiedProSet.has(merchant.id)}
                  index={index}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const AttentionLadderFeed = memo(AttentionLadderFeedComponent);
