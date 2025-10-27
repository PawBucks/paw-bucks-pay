import { GradientCard } from "@/components/ui/gradient-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Store, MapPin, Percent } from "lucide-react";

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
    <GradientCard className="hover:shadow-[var(--shadow-glow)] transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Store className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-lg mb-1">{merchant.business_name}</h3>
            <Badge variant="outline" className={getTypeColor(merchant.business_type)}>
              {merchant.business_type.replace("_", " ").toUpperCase()}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-accent/10 px-3 py-1.5 rounded-full">
          <Percent className="w-4 h-4 text-accent" />
          <span className="font-bold text-accent">{merchant.cashback_rate}%</span>
        </div>
      </div>

      {merchant.description && (
        <p className="text-sm text-muted-foreground mb-3">{merchant.description}</p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="w-4 h-4" />
          {distance !== undefined ? (
            <span>{distance.toFixed(1)} miles away</span>
          ) : (
            <span>{merchant.address || "Location not available"}</span>
          )}
        </div>
        <Button 
          onClick={() => onPayNow(merchant.id, merchant.business_name, merchant.cashback_rate)}
          size="sm"
        >
          Pay Now
        </Button>
      </div>
    </GradientCard>
  );
};