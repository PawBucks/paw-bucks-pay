import { useSubscription } from "@/hooks/useSubscription";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export const AdPlacement = () => {
  const { subscription } = useSubscription();
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  // Don't show ads for subscribers or if dismissed
  if (subscription.subscribed || dismissed) {
    return null;
  }

  return (
    <Card className="relative p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30">
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
            <Crown className="w-5 h-5 text-yellow-600" />
            <h4 className="font-semibold text-foreground">Upgrade to Remove Ads</h4>
          </div>
          <p className="text-sm text-muted-foreground">
            Get PawPass or PawPass+ for an ad-free experience plus higher cashback rates!
          </p>
        </div>
        <Button
          onClick={() => navigate("/profile")}
          className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 whitespace-nowrap"
        >
          <Crown className="w-4 h-4 mr-2" />
          Upgrade Now
        </Button>
      </div>
    </Card>
  );
};