import { useState, useEffect } from"react";
import { Badge } from"@/components/ui/badge";
import { Timer, Zap } from "lucide-react";
import { 
 type MerchantService,
 calculateRegularPawbucksPrice,
 calculateFlashSaleSavings,
 isFlashSaleActive
} from"@/services/api/scheduling.service";

interface FlashSalePriceDisplayProps {
 service: MerchantService;
 showCountdown?: boolean;
 compact?: boolean;
}

export function FlashSalePriceDisplay({ 
 service, 
 showCountdown = true,
 compact = false 
}: FlashSalePriceDisplayProps) {
 const [timeRemaining, setTimeRemaining] = useState<string>("");
 const isActive = isFlashSaleActive(service);
 
 const regularPawbucksPrice = calculateRegularPawbucksPrice(service.price);
 const savingsPercent = calculateFlashSaleSavings(service);
 
 useEffect(() => {
 if (!isActive || !service.flash_sale_end_at) return;
 
 const updateCountdown = () => {
 const now = new Date();
 const end = new Date(service.flash_sale_end_at!);
 const diff = end.getTime() - now.getTime();
 
 if (diff <= 0) {
 setTimeRemaining("Ended");
 return;
 }
 
 const hours = Math.floor(diff / (1000 * 60 * 60));
 const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
 const seconds = Math.floor((diff % (1000 * 60)) / 1000);
 
 if (hours > 24) {
 const days = Math.floor(hours / 24);
 setTimeRemaining(`${days}d ${hours % 24}h`);
 } else if (hours > 0) {
 setTimeRemaining(`${hours}h ${minutes}m`);
 } else {
 setTimeRemaining(`${minutes}m ${seconds}s`);
 }
 };
 
 updateCountdown();
 const interval = setInterval(updateCountdown, 1000);
 
 return () => clearInterval(interval);
 }, [isActive, service.flash_sale_end_at]);
 
 if (!isActive || !service.flash_sale_pawbucks_price) {
 // Show regular PawBucks price
 return (
 <div className={compact ?"text-sm" :""}>
 <span className="text-muted-foreground">
 {regularPawbucksPrice.toLocaleString()} PB
 </span>
 </div>
 );
 }
 
 return (
 <div className={`space-y-1 ${compact ?"text-sm" :""}`}>
 {/* Flash Sale Badge */}
 <Badge 
 className="bg-gradient-to-r from-warning to-warning text-white border-0 gap-1"
 variant="outline"
 >
 <Zap className="w-3 h-3" />
 Flash Sale
 </Badge>
 
 {/* Price Display */}
 <div className="flex items-baseline gap-2 flex-wrap">
 {/* Original price - strikethrough */}
 <span className="text-muted-foreground line-through text-sm">
 {regularPawbucksPrice.toLocaleString()} PB
 </span>
 
 {/* Sale price - bold green */}
 <span className="font-bold text-success text-lg">
 {service.flash_sale_pawbucks_price.toLocaleString()} PB
 </span>
 </div>
 
 {/* Savings percentage */}
 {savingsPercent > 0 && (
 <div className="text-success font-semibold text-sm">
 {savingsPercent}% Off with PawBucks!
 </div>
 )}
 
 {/* Countdown timer */}
 {showCountdown && timeRemaining && timeRemaining !=="Ended" && (
 <div className="flex items-center gap-1 text-warning text-xs">
 <Timer className="w-3 h-3" />
 <span>Ends in {timeRemaining}</span>
 </div>
 )}
 </div>
 );
}
