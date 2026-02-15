import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Clock } from "lucide-react";

type PromotionalBadgeProps = {
  discountPercentage: number;
  badgeEmoji?: string;
  badgeName?: string;
  expiresAt?: string;
  variant?: "overlay" | "inline";
};

function useCountdown(expiresAt?: string) {
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  useEffect(() => {
    if (!expiresAt) return;

    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setTimeRemaining("Expired"); return; }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      setTimeRemaining(
        days > 1 ? `${days}d ${hours}h` :
        days === 1 ? `${hours + 24}h ${mins}m` :
        hours > 0 ? `${hours}h ${mins}m` :
        `${mins}m`
      );
    };

    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return timeRemaining;
}

export function PromotionalBadge({
  discountPercentage,
  badgeEmoji,
  badgeName,
  expiresAt,
  variant = "overlay",
}: PromotionalBadgeProps) {
  const timeRemaining = useCountdown(expiresAt);

  if (variant === "overlay") {
    return (
      <div className="absolute top-2 left-2 z-10 space-y-1">
        <Badge className="bg-gradient-to-r from-primary to-accent text-primary-foreground border-0 shadow-lg animate-pulse">
          <Sparkles className="h-3 w-3 mr-1" />
          {discountPercentage}% OFF
        </Badge>
        {badgeEmoji && badgeName && (
          <Badge variant="secondary" className="text-xs block">
            {badgeEmoji} {badgeName}
          </Badge>
        )}
        {timeRemaining && (
          <Badge variant="outline" className="text-xs bg-background/80 backdrop-blur-sm">
            <Clock className="h-3 w-3 mr-1" />
            {timeRemaining} left
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      <Badge className="bg-gradient-to-r from-primary to-accent text-primary-foreground border-0">
        <Sparkles className="h-3 w-3 mr-1" />
        {discountPercentage}% OFF
      </Badge>
      {badgeEmoji && badgeName && (
        <Badge variant="secondary" className="text-xs">
          {badgeEmoji} {badgeName}
        </Badge>
      )}
      {timeRemaining && (
        <Badge variant="outline" className="text-xs">
          <Clock className="h-3 w-3 mr-1" />
          {timeRemaining}
        </Badge>
      )}
    </div>
  );
}
