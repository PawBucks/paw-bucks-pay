import { memo } from "react";
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
  subscriptionTier?: 'free' | 'pawpass' | 'pawpass_plus';
  onPayClick: (merchant: MerchantWithRating) => void;
  onSponsoredClick: (merchant: MerchantWithRating, position: number) => void;
  onCardClick: (merchantId: string, position: number) => void;
}

const generateHeadline = (merchant: MerchantWithRating, category: string): string => {
  const type = merchant.business_type.replace(/_/g, ' ');
  const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
  const addressParts = merchant.address?.split(',').map(s => s.trim()) || [];
  const city = addressParts.length >= 2 ? addressParts[addressParts.length - 2] : null;
  if (city) return `Top-Rated ${capitalizedType} in ${city}`;
  return `Top-Rated ${capitalizedType}`;
};

const AttentionLadderFeedComponent = ({
  featuredPartners,
  premiumAds,
  interspersedResults,
  verifiedProSet,
  showDistance,
  selectedCategory,
  subscriptionTier = 'free',
  onPayClick,
  onSponsoredClick,
  onCardClick,
}: AttentionLadderFeedProps) => {
  let positionCounter = 0;
  const isPawPass = subscriptionTier === 'pawpass';

  const visiblePremiumAds = isPawPass ? premiumAds.slice(0, 1) : premiumAds;
  const visibleInterspersed = isPawPass
    ? (() => {
        let sponsoredCount = 0;
        return interspersedResults.filter((m) => {
          if ((m as any)._isSponsored) {
            sponsoredCount++;
            return sponsoredCount <= 2;
          }
          return true;
        });
      })()
    : interspersedResults;

  return (
    <div className="space-y-3">
      {/* Featured Partner */}
      {featuredPartners.length > 0 && (
        <div className="space-y-3">
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

      {/* Premium Ads */}
      {visiblePremiumAds.length > 0 && (
        <div className="space-y-3">
          {visiblePremiumAds.map((merchant, index) => {
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

      {/* All Results — Sponsored interspersed + Boosted + Organic */}
      {visibleInterspersed.length > 0 && (
        <div className="space-y-2">
          {visibleInterspersed.map((merchant, index) => {
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
      )}
    </div>
  );
};

export const AttentionLadderFeed = memo(AttentionLadderFeedComponent);
