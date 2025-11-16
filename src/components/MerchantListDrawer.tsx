import { Merchant } from "@/pages/Discover";
import { Badge } from "@/components/ui/badge";
import { MapPin, Store, Scissors, Footprints, Home, Stethoscope, Bone } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MerchantListDrawerProps {
  merchants: Merchant[];
  userLocation: { lat: number; lng: number } | null;
  onMerchantClick: (merchant: Merchant) => void;
  calculateDistance: (lat1: number, lng1: number, lat2: number, lng2: number) => number;
}

const getBusinessTypeIcon = (businessType: string) => {
  const type = businessType.toLowerCase();
  if (type.includes('store') || type.includes('shop')) return Store;
  if (type.includes('groomer') || type.includes('grooming')) return Scissors;
  if (type.includes('walker') || type.includes('walking')) return Footprints;
  if (type.includes('sitter') || type.includes('sitting') || type.includes('boarding')) return Home;
  if (type.includes('vet') || type.includes('veterinary') || type.includes('clinic')) return Stethoscope;
  if (type.includes('trainer') || type.includes('training')) return Bone;
  return Store;
};

export const MerchantListDrawer = ({
  merchants,
  userLocation,
  onMerchantClick,
  calculateDistance,
}: MerchantListDrawerProps) => {
  return (
    <div className="bg-card/95 backdrop-blur-sm rounded-t-3xl shadow-2xl border-t border-border">
      {/* Drag Handle */}
      <div className="flex justify-center py-3">
        <div className="w-12 h-1 bg-muted-foreground/30 rounded-full" />
      </div>

      <ScrollArea className="h-[calc(100%-3rem)]">
        <div className="px-4 pb-6 space-y-3">
          {merchants.map((merchant) => {
            const distance =
              userLocation && merchant.latitude && merchant.longitude
                ? calculateDistance(
                    userLocation.lat,
                    userLocation.lng,
                    merchant.latitude,
                    merchant.longitude
                  )
                : undefined;

            const Icon = getBusinessTypeIcon(merchant.business_type);

            return (
              <div
                key={merchant.id}
                onClick={() => onMerchantClick(merchant)}
                className="flex gap-3 p-3 bg-card rounded-xl border border-border hover:border-primary/50 transition-all cursor-pointer"
              >
                {/* Merchant Icon/Image */}
                <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg flex items-center justify-center">
                  <Icon className="w-8 h-8 text-primary" />
                </div>

                {/* Merchant Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-foreground truncate">
                      {merchant.business_name}
                    </h3>
                    <Badge variant="secondary" className="flex-shrink-0 bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/30">
                      <span className="mr-1">⚡</span>
                      {merchant.cashback_rate}% Back
                    </Badge>
                  </div>

                  <p className="text-sm text-muted-foreground mt-0.5">
                    {merchant.business_type}
                  </p>

                  {merchant.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {merchant.description}
                    </p>
                  )}

                  {(distance || merchant.address) && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      {distance ? (
                        <span>{distance.toFixed(2)} mi from you</span>
                      ) : (
                        <span className="truncate">{merchant.address}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
