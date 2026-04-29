import { useState, useEffect, useMemo, memo, useCallback } from"react";
import { useNavigate } from"react-router-dom";
import { useAdMerchants, useVerifiedProMerchants, merchantHasService, SERVICE_NAMES } from"@/hooks/useMerchantServices";
import { Card } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Button } from"@/components/ui/button";
import { MapPin, BadgeCheck, ArrowRight, Sparkles } from"lucide-react";
import { Skeleton } from"@/components/ui/skeleton";
import { useSubscription } from"@/hooks/useSubscription";
import { getSubscriptionTier } from"@/lib/constants";

interface PremiumMerchantsBannerProps {
 title?: string;
 rotationInterval?: number; // in milliseconds
 showMultiple?: boolean; // show multiple merchants at once
}

const PremiumMerchantsBannerComponent = ({ 
 title ="Featured Premium Merchants",
 rotationInterval = 15000,
 showMultiple = true
}: PremiumMerchantsBannerProps) => {
 const navigate = useNavigate();
 const { subscription } = useSubscription();
 const { data: adMerchants, isLoading } = useAdMerchants();
 const { data: verifiedProIds } = useVerifiedProMerchants();
 const [currentIndex, setCurrentIndex] = useState(0);
 
 // Check if user has PawPass+ (ad-free experience)
 const tier = useMemo(
 () => getSubscriptionTier(subscription.product_id, subscription.subscription_tier),
 [subscription.product_id, subscription.subscription_tier]
 );
 
 // Shuffle merchants on initial load
 const shuffledMerchants = useMemo(() => {
 if (!adMerchants || adMerchants.length === 0) return [];
 // Fisher-Yates shuffle
 const shuffled = [...adMerchants];
 for (let i = shuffled.length - 1; i > 0; i--) {
 const j = Math.floor(Math.random() * (i + 1));
 [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
 }
 return shuffled;
 }, [adMerchants]);

 // Rotate through merchants
 useEffect(() => {
 if (shuffledMerchants.length <= (showMultiple ? 3 : 1)) return;

 const interval = setInterval(() => {
 setCurrentIndex((prev) => {
 const maxIndex = showMultiple 
 ? Math.max(0, shuffledMerchants.length - 3)
 : shuffledMerchants.length - 1;
 return (prev + 1) % (maxIndex + 1);
 });
 }, rotationInterval);

 return () => clearInterval(interval);
 }, [shuffledMerchants.length, rotationInterval, showMultiple]);

 const handleMerchantClick = useCallback((merchantId: string) => {
 navigate(`/merchant/${merchantId}`);
 }, [navigate]);

 const handlePageClick = useCallback((pageIndex: number) => {
 setCurrentIndex(pageIndex * 3);
 }, []);

 // PawPass+ users don't see sponsored content; PawPass sees max 1
 const isPawPass = tier ==='pawpass';
 if (tier ==='pawpass_plus') {
 return null;
 }

 if (isLoading) {
 return (
 <div className="space-y-4">
 <div className="flex items-center gap-2">
 <Sparkles className="w-5 h-5 text-accent" />
 <h3 className="text-lg font-semibold">{title}</h3>
 <Badge variant="secondary" className="ml-auto">Premium</Badge>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 {[1, 2, 3].map((i) => (
 <Skeleton key={i} className="h-40 rounded-md" />
 ))}
 </div>
 </div>
 );
 }

 if (!shuffledMerchants || shuffledMerchants.length === 0) {
 return null;
 }

 // PawPass subscribers see only 1 merchant at a time instead of 3
 const maxVisible = isPawPass ? 1 : (showMultiple ? 3 : 1);
 
 // Get visible merchants based on current index
 const visibleMerchants = showMultiple && !isPawPass
 ? shuffledMerchants.slice(currentIndex, currentIndex + maxVisible)
 : [shuffledMerchants[currentIndex]];

 // If we're at the end and don't have enough, wrap around
 if (showMultiple && !isPawPass && visibleMerchants.length < maxVisible && shuffledMerchants.length >= maxVisible) {
 const remaining = maxVisible - visibleMerchants.length;
 visibleMerchants.push(...shuffledMerchants.slice(0, remaining));
 }

 return (
 <div className="space-y-4 animate-fade-in">
 <div className="flex items-center gap-2 flex-wrap">
 <Sparkles className="w-5 h-5 text-accent" />
 <h3 className="text-lg font-semibold">{title}</h3>
 <Badge className="bg-gradient-to-r from-accent to-primary text-white border-0">
 Premium Partners
 </Badge>
 {shuffledMerchants.length > 3 && (
 <div className="ml-auto flex gap-1">
 {Array.from({ length: Math.ceil(shuffledMerchants.length / 3) }).map((_, i) => (
 <button
 key={i}
 className={`w-2 h-2 rounded-full transition-all ${
 Math.floor(currentIndex / 3) === i 
 ?'bg-accent w-4' 
 :'bg-muted-foreground/30 hover:bg-muted-foreground/50'
 }`}
 onClick={() => handlePageClick(i)}
 aria-label={`Go to page ${i + 1}`}
 />
 ))}
 </div>
 )}
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 {visibleMerchants.map((merchant, index) => {
 const isVerifiedPro = verifiedProIds?.includes(merchant.id);
 
 return (
 <Card
 key={`${merchant.id}-${index}`}
 className="group p-5 cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.02] border-2 border-accent/20 hover:border-accent/40 bg-gradient-to-br from-card to-accent/5 overflow-hidden relative"
 onClick={() => handleMerchantClick(merchant.id)}
 >
 {/* Premium glow effect */}
 <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
 
 <div className="relative space-y-3">
 <div className="flex items-start justify-between gap-2">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <h4 className="font-bold text-foreground line-clamp-1 group-hover:text-accent transition-colors">
 {merchant.business_name}
 </h4>
 {isVerifiedPro && (
                              <BadgeCheck className="w-4 h-4 text-info flex-shrink-0" />
 )}
 </div>
 <Badge variant="outline" className="mt-1.5 text-xs">
 {merchant.business_type}
 </Badge>
 </div>
 <div className="text-right flex-shrink-0">
 <div className="text-xl font-bold text-accent">
 {merchant.cashback_rate || 10}x
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
 <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
 <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
 <span className="line-clamp-1">{merchant.address}</span>
 </div>
 )}

 <Button 
 size="sm" 
 variant="ghost" 
 className="w-full mt-2 group-hover:bg-accent/10 group-hover:text-accent"
 >
 Visit Store
 <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
 </Button>
 </div>
 </Card>
 );
 })}
 </div>
 </div>
 );
};

export const PremiumMerchantsBanner = memo(PremiumMerchantsBannerComponent);
