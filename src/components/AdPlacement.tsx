import { memo, useCallback, useMemo, useState, useEffect } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, X, MapPin, Tag, BadgeCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { getSubscriptionTier } from "@/lib/constants";
import { useAdMerchants, SERVICE_NAMES, merchantHasService } from "@/hooks/useMerchantServices";

type AdPlacementProps = {
  position?: 'top' | 'bottom';
};

const AdPlacementComponent = ({ position = 'top' }: AdPlacementProps) => {
  const { subscription } = useSubscription();
  const [dismissed, setDismissed] = useState(false);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const navigate = useNavigate();
  
  // Fetch merchants with Premium Ad Placement service
  const { data: adMerchants = [] } = useAdMerchants();
  
  // Memoize tier calculation - pass both product_id and subscription_tier for accurate detection
  const tier = useMemo(
    () => getSubscriptionTier(subscription.product_id, subscription.subscription_tier), 
    [subscription.product_id, subscription.subscription_tier]
  );

  // Get current merchant to display
  const currentMerchant = adMerchants[currentAdIndex];

  // Rotate ads every 30 seconds if multiple merchants
  useEffect(() => {
    if (adMerchants.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentAdIndex(prev => (prev + 1) % adMerchants.length);
    }, 30000);

    return () => clearInterval(interval);
  }, [adMerchants.length]);

  // Memoize handlers
  const handleDismiss = useCallback(() => setDismissed(true), []);
  const handleNavigateToMerchant = useCallback(() => {
    if (currentMerchant) navigate(`/merchant/${currentMerchant.id}`);
  }, [currentMerchant, navigate]);
  const handleNavigateToProfile = useCallback(() => navigate("/profile"), [navigate]);

  // Memoize verified badge check
  const hasVerifiedBadge = useMemo(() => 
    currentMerchant 
      ? merchantHasService(currentMerchant.active_services, SERVICE_NAMES.VERIFIED_PRO_BADGE)
      : false,
    [currentMerchant]
  );

  // Don't show ads for PawPass+ subscribers or if dismissed
  if (tier === 'pawpass_plus' || dismissed) {
    return null;
  }

  // PawPass subscribers: show sponsored merchant ads only (no fallback upgrade ads)
  const isPawPass = tier === 'pawpass';

  // Show sponsored merchant ad if available
  if (currentMerchant) {
    return (
      <Card className={`relative p-4 sm:p-6 bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 border-primary/30 ${position === 'bottom' ? 'mt-8' : 'mb-8'}`}>
        <Badge className="absolute top-2 left-2 bg-primary/20 text-primary border-primary/30">
          Sponsored
        </Badge>
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-background/50 transition-colors"
          aria-label="Dismiss ad"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
        
        <div className="flex flex-col sm:flex-row items-start gap-4 mt-6">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-foreground">{currentMerchant.business_name}</h3>
              {hasVerifiedBadge && (
                <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 gap-1">
                  <BadgeCheck className="w-3 h-3" />
                  Verified Pro
                </Badge>
              )}
              <Badge variant="secondary" className="text-xs">
                <Tag className="w-3 h-3 mr-1" />
                {currentMerchant.cashback_rate}x points
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground font-medium">{currentMerchant.business_type}</p>
            {currentMerchant.description && (
              <p className="text-sm text-muted-foreground">{currentMerchant.description}</p>
            )}
            {currentMerchant.address && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="w-3 h-3" />
                <span>{currentMerchant.address}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground italic pt-1">
              Upgrade to PawPass+ for 30x points and an ad-free experience!
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <Button
              onClick={handleNavigateToMerchant}
              className="bg-primary hover:bg-primary/90 whitespace-nowrap"
            >
              Shop Now
            </Button>
            <Button
              onClick={handleNavigateToProfile}
              variant="outline"
              size="sm"
              className="whitespace-nowrap"
            >
              <Crown className="w-3 h-3 mr-1" />
              Remove Ads
            </Button>
          </div>
        </div>
        
        {/* Ad rotation indicator */}
        {adMerchants.length > 1 && (
          <div className="flex justify-center gap-1 mt-4">
            {adMerchants.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentAdIndex(idx)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  idx === currentAdIndex ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
                aria-label={`View ad ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </Card>
    );
  }

  // Fallback ad promoting upgrades when no ad merchants
  return (
    <Card className={`relative p-4 sm:p-6 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/30 ${position === 'bottom' ? 'mt-8' : 'mb-8'}`}>
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-background/50 transition-colors"
        aria-label="Dismiss ad"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pr-8">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Crown className="w-5 h-5 text-primary" />
            <h4 className="font-semibold text-foreground">Upgrade to Remove Ads</h4>
          </div>
          <p className="text-sm text-muted-foreground">
            Get PawPass for 20x points or PawPass+ for 30x points, plus an ad-free experience!
          </p>
        </div>
        <Button
          onClick={handleNavigateToProfile}
          className="bg-primary hover:bg-primary/90 whitespace-nowrap"
        >
          <Crown className="w-4 h-4 mr-2" />
          Upgrade Now
        </Button>
      </div>
    </Card>
  );
};

export const AdPlacement = memo(AdPlacementComponent);