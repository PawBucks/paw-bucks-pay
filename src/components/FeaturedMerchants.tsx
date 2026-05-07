import { memo, useCallback } from"react";
import { Card } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Star, MapPin, BadgeCheck } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { Skeleton } from"@/components/ui/skeleton";
import { useSponsoredMerchants, merchantHasService, SERVICE_NAMES } from"@/hooks/useMerchantServices";
interface Merchant {
 id: string;
 business_name: string;
 business_type: string;
 cashback_rate: number;
 description?: string | null;
 address?: string | null;
 active_services: string[];
}

const FeaturedMerchantsComponent = ({ onMerchantClick }: { onMerchantClick: (merchant: Merchant) => void }) => {
 // Use sponsored merchants from service assignments
 const { data: sponsoredMerchants = [], isLoading } = useSponsoredMerchants();

 const handleMerchantClick = useCallback((merchant: Merchant) => {
 onMerchantClick(merchant);
 }, [onMerchantClick]);

 if (isLoading) {
 return (
 <div className="space-y-3">
 <div className="flex items-center gap-2">
 <Sparkles className="w-5 h-5 text-primary" />
 <h2 className="text-lg font-semibold">Featured Partners</h2>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 {[1, 2, 3].map((i) => (
 <Skeleton key={i} className="h-32 rounded-lg" />
 ))}
 </div>
 </div>
 );
 }

 // Show up to 3 sponsored merchants
 const displayMerchants = sponsoredMerchants.slice(0, 3);

 if (displayMerchants.length === 0) return null;

 return (
 <div className="space-y-3">
 <div className="flex items-center gap-2">
 <Sparkles className="w-5 h-5 text-primary" />
 <h2 className="text-lg font-semibold">Featured Partners</h2>
 <Badge variant="secondary" className="ml-auto bg-primary/10 text-primary border-primary/20">
 Sponsored
 </Badge>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 {displayMerchants.map((merchant) => {
 const hasVerifiedBadge = merchantHasService(merchant.active_services, SERVICE_NAMES.VERIFIED_PRO_BADGE);
 
 return (
 <Card
 key={merchant.id}
 className="p-4 cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] border-primary/20 bg-primary/5"
 onClick={() => handleMerchantClick(merchant)}
 >
 <div className="space-y-2">
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <div className="flex items-center gap-2 flex-wrap">
 <h3 className="font-semibold text-foreground line-clamp-1">
 {merchant.business_name}
 </h3>
 {hasVerifiedBadge && (
 <Badge className="bg-info/10 text-info border-info/20 gap-1 text-xs">
 <BadgeCheck className="w-3 h-3" />
 Verified
 </Badge>
 )}
 </div>
 <Badge variant="outline" className="mt-1 text-xs">
 {merchant.business_type}
 </Badge>
 </div>
 <div className="text-right ml-2">
 <div className="text-xl font-bold text-primary">
 {merchant.cashback_rate}x
 </div>
 <div className="text-xs text-muted-foreground">points</div>
 </div>
 </div>
 {merchant.description && (
 <p className="text-sm text-muted-foreground line-clamp-2">
 {merchant.description}
 </p>
 )}
 {merchant.address && (
 <div className="flex items-center gap-1 text-xs text-muted-foreground">
 <MapPin className="w-3 h-3" />
 <span className="line-clamp-1">{merchant.address}</span>
 </div>
 )}
 </div>
 </Card>
 );
 })}
 </div>
 </div>
 );
};

export const FeaturedMerchants = memo(FeaturedMerchantsComponent);
