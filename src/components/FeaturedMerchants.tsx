import { useOptimizedQuery } from "@/hooks/useOptimizedQuery";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Merchant {
  id: string;
  business_name: string;
  business_type: string;
  cashback_rate: number;
  description?: string;
  address?: string;
}

export const FeaturedMerchants = ({ onMerchantClick }: { onMerchantClick: (merchant: Merchant) => void }) => {
  const { data: merchants, isLoading } = useOptimizedQuery<Merchant[]>(
    ["featured-merchants"],
    async () => {
      // Use public view (excludes sensitive contact info)
      const { data, error } = await supabase
        .from("merchants_public")
        .select("*")
        .gte("cashback_rate", 15)
        .limit(3);

      if (error) throw error;
      return data as Merchant[];
    }
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-primary" />
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

  if (!merchants || merchants.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Star className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Featured Partners</h2>
        <Badge variant="secondary" className="ml-auto">Sponsored</Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {merchants.map((merchant) => (
          <Card
            key={merchant.id}
            className="p-4 cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] border-primary/20"
            onClick={() => onMerchantClick(merchant)}
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground line-clamp-1">
                    {merchant.business_name}
                  </h3>
                  <Badge variant="outline" className="mt-1 text-xs">
                    {merchant.business_type}
                  </Badge>
                </div>
                <div className="text-right ml-2">
                  <div className="text-xl font-bold text-primary">
                    {merchant.cashback_rate}%
                  </div>
                  <div className="text-xs text-muted-foreground">cashback</div>
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
        ))}
      </div>
    </div>
  );
};
