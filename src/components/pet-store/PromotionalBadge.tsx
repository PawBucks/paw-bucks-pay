import { Badge } from "@/components/ui/badge";
import { Sparkles, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type PromotionalBadgeProps = {
  discountPercentage: number;
  badgeEmoji?: string;
  badgeName?: string;
  expiresAt?: string;
  variant?: "overlay" | "inline";
};

export function PromotionalBadge({
  discountPercentage,
  badgeEmoji,
  badgeName,
  expiresAt,
  variant = "overlay",
}: PromotionalBadgeProps) {
  const timeRemaining = expiresAt
    ? formatDistanceToNow(new Date(expiresAt), { addSuffix: false })
    : null;

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
