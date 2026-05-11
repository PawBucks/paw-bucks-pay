import { useOptimizedQuery } from"@/hooks/useOptimizedQuery";
import { supabase } from"@/integrations/supabase/client";
import { Card } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";

import { Skeleton } from"@/components/ui/skeleton";
import { PawBucksLogo } from "@/components/PawBucksLogo";

interface PartnerOffer {
 id: string;
 title: string;
 description: string;
 coins_required: number;
 merchants: {
 business_name: string;
 business_type: string;
 };
}

export const PartnerOffers = () => {
 const { data: offers, isLoading } = useOptimizedQuery<PartnerOffer[]>(
 ["partner-offers"],
 async () => {
 const { data, error } = await supabase.functions.invoke("get-partner-offers");

 if (error) throw error;
 return data.offers as PartnerOffer[];
 }
 );

 if (isLoading) {
 return (
 <div className="space-y-3">
 <div className="flex items-center gap-2">
 <span className="w-5 h-5 text-primary" aria-hidden="true">🎁</span>
 <h2 className="text-lg font-semibold">Exclusive Offers</h2>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
 {[1, 2, 3, 4].map((i) => (
 <Skeleton key={i} className="h-40 rounded-lg" />
 ))}
 </div>
 </div>
 );
 }

 if (!offers || offers.length === 0) return null;

 return (
 <div className="space-y-3">
 <div className="flex items-center gap-2">
 <span className="w-5 h-5 text-primary" aria-hidden="true">🎁</span>
 <h2 className="text-lg font-semibold">Exclusive Offers</h2>
 <Badge variant="secondary" className="ml-auto">Limited Time</Badge>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
 {offers.slice(0, 4).map((offer) => (
 <Card
 key={offer.id}
 className="p-4 hover:shadow-lg transition-all duration-200 hover:scale-[1.02] bg-gradient-to-br from-primary/5 to-primary/10 border-primary/30"
 >
 <div className="space-y-3">
 <div className="flex items-start justify-between">
 <Badge variant="default" className="text-xs">
 {offer.merchants.business_type}
 </Badge>
 <div className="flex items-center gap-1 text-primary font-semibold">
 <PawBucksLogo className="w-4 h-4" />
 <span className="text-sm">{offer.coins_required}</span>
 </div>
 </div>
 <div>
 <h3 className="font-semibold text-foreground mb-1 line-clamp-2">
 {offer.title}
 </h3>
 <p className="text-xs text-muted-foreground mb-2">
 at {offer.merchants.business_name}
 </p>
 {offer.description && (
 <p className="text-xs text-muted-foreground line-clamp-2">
 {offer.description}
 </p>
 )}
 </div>
 </div>
 </Card>
 ))}
 </div>
 </div>
 );
};
