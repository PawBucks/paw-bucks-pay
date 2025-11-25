import { useSubscription } from "@/hooks/useSubscription";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, X, MapPin, Tag } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { getSubscriptionTier } from "@/lib/constants";

type SponsoredMerchant = {
  id: string;
  business_name: string;
  business_type: string;
  cashback_rate: number;
  description: string | null;
  address: string | null;
};

type AdPlacementProps = {
  position?: 'top' | 'bottom';
};

export const AdPlacement = ({ position = 'top' }: AdPlacementProps) => {
  const { subscription } = useSubscription();
  const [dismissed, setDismissed] = useState(false);
  const [sponsoredMerchant, setSponsoredMerchant] = useState<SponsoredMerchant | null>(null);
  const navigate = useNavigate();
  
  // Determine subscription tier
  const tier = getSubscriptionTier(subscription.product_id);

  useEffect(() => {
    const fetchSponsoredMerchant = async () => {
      const { data, error } = await supabase
        .from('merchants')
        .select('id, business_name, business_type, cashback_rate, description, address')
        .eq('is_sponsored', true)
        .gte('sponsored_until', new Date().toISOString())
        .order('cashback_rate', { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        setSponsoredMerchant(data);
      }
    };

    // Only fetch for non-PawPass+ users
    if (tier !== 'pawpass_plus') {
      fetchSponsoredMerchant();
    }
  }, [tier]);

  // Don't show ads for PawPass+ subscribers or if dismissed
  if (tier === 'pawpass_plus' || dismissed) {
    return null;
  }

  // Show sponsored merchant ad if available
  if (sponsoredMerchant) {
    return (
      <Card className={`relative p-4 bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 border-primary/30 ${position === 'bottom' ? 'mt-8' : 'mb-8'}`}>
        <Badge className="absolute top-2 left-2 bg-primary/20 text-primary border-primary/30">
          Sponsored
        </Badge>
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-background/50 transition-colors"
          aria-label="Dismiss ad"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
        
        <div className="flex flex-col sm:flex-row items-start gap-4 mt-6">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-foreground">{sponsoredMerchant.business_name}</h3>
              <Badge variant="secondary" className="text-xs">
                <Tag className="w-3 h-3 mr-1" />
                {sponsoredMerchant.cashback_rate}% cashback
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground font-medium">{sponsoredMerchant.business_type}</p>
            {sponsoredMerchant.description && (
              <p className="text-sm text-muted-foreground">{sponsoredMerchant.description}</p>
            )}
            {sponsoredMerchant.address && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="w-3 h-3" />
                <span>{sponsoredMerchant.address}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground italic pt-1">
              Upgrade to PawPass+ for 30% cashback and an ad-free experience!
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <Button
              onClick={() => navigate("/discover")}
              className="bg-primary hover:bg-primary/90 whitespace-nowrap"
            >
              Shop Now
            </Button>
            <Button
              onClick={() => navigate("/profile")}
              variant="outline"
              size="sm"
              className="whitespace-nowrap"
            >
              <Crown className="w-3 h-3 mr-1" />
              Remove Ads
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // Fallback ad promoting upgrades when no sponsored merchants
  return (
    <Card className={`relative p-4 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/30 ${position === 'bottom' ? 'mt-8' : 'mb-8'}`}>
      <button
        onClick={() => setDismissed(true)}
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
            Get PawPass for 20% cashback or PawPass+ for 30% cashback, plus an ad-free experience!
          </p>
        </div>
        <Button
          onClick={() => navigate("/profile")}
          className="bg-primary hover:bg-primary/90 whitespace-nowrap"
        >
          <Crown className="w-4 h-4 mr-2" />
          Upgrade Now
        </Button>
      </div>
    </Card>
  );
};