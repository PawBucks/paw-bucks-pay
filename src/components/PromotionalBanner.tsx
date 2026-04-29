import { Card } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Sparkles } from"lucide-react";

export const PromotionalBanner = () => {
 return (
 <Card className="p-6 bg-gradient-to-r from-primary/20 via-primary/10 to-accent/20 border-primary/30">
 <div className="flex flex-col md:flex-row items-center justify-between gap-4">
 <div className="flex items-center gap-3 flex-1">
 <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
 <Sparkles className="w-6 h-6 text-primary" />
 </div>
 <div>
 <h3 className="font-semibold text-lg text-foreground">
 Earn More PawBucks Today!
 </h3>
 <p className="text-sm text-muted-foreground">
 Shop at featured partners and earn up to 30x points on every purchase
 </p>
 </div>
 </div>
 <Button size="lg" className="whitespace-nowrap">
 Browse Merchants
 </Button>
 </div>
 </Card>
 );
};
