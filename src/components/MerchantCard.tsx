import { GradientCard } from "@/components/ui/gradient-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Store, MapPin, Percent, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Merchant = {
  id: string;
  business_name: string;
  business_type: string;
  description?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  cashback_rate: number;
};

type MerchantCardProps = {
  merchant: Merchant;
  distance?: number;
  onPayNow: (merchantId: string, merchantName: string, cashbackRate: number) => void;
};

export const MerchantCard = ({ merchant, distance, onPayNow }: MerchantCardProps) => {
  const businessTypeColors: Record<string, string> = {
    "pet_store": "bg-blue-500/10 text-blue-700 border-blue-500/20",
    "groomer": "bg-purple-500/10 text-purple-700 border-purple-500/20",
    "trainer": "bg-green-500/10 text-green-700 border-green-500/20",
    "veterinarian": "bg-red-500/10 text-red-700 border-red-500/20",
  };

  const getTypeColor = (type: string) => {
    return businessTypeColors[type] || "bg-gray-500/10 text-gray-700 border-gray-500/20";
  };

  return (
    <GradientCard className="hover:shadow-[var(--shadow-medium)] transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3 flex-1">
          <div 
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center flex-shrink-0 shadow-sm"
            aria-hidden="true"
          >
            <Store className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base sm:text-lg mb-1 truncate">{merchant.business_name}</h3>
            <Badge variant="outline" className={`${getTypeColor(merchant.business_type)} text-xs`}>
              {merchant.business_type.replace("_", " ").toUpperCase()}
            </Badge>
          </div>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 sm:gap-2 bg-accent/10 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full flex-shrink-0 ml-2 cursor-help">
                <Percent className="w-3 h-3 sm:w-4 sm:h-4 text-accent" aria-hidden="true" />
                <span className="font-bold text-accent text-sm sm:text-base">{merchant.cashback_rate}x</span>
                <Info className="w-3 h-3 text-accent/70" />
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs p-3">
              <p className="font-semibold mb-1">{merchant.cashback_rate}x Points Multiplier</p>
              <p className="text-xs text-muted-foreground">
                Earn {merchant.cashback_rate} PawBucks for every $1 spent at this merchant.
                Example: $100 purchase = {100 * merchant.cashback_rate} PawBucks earned!
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {merchant.description && (
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{merchant.description}</p>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
          <MapPin className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          {distance !== undefined ? (
            <span>{distance.toFixed(1)} miles away</span>
          ) : (
            <span className="truncate">{merchant.address || "Location not available"}</span>
          )}
        </div>
        <Button 
          onClick={() => onPayNow(merchant.id, merchant.business_name, merchant.cashback_rate)}
          size="sm"
          className="w-full sm:w-auto"
          aria-label={`Pay at ${merchant.business_name} and earn ${merchant.cashback_rate}x points in PawBucks`}
        >
          Pay Now
        </Button>
      </div>
    </GradientCard>
  );
};