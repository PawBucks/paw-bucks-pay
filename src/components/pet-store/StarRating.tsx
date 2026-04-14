import { memo } from "react";
import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number;
  count?: number;
  size?: "sm" | "md";
  showCount?: boolean;
}

export const StarRating = memo(({ rating, count, size = "sm", showCount = true }: StarRatingProps) => {
  const starSize = size === "sm" ? "h-3.5 w-3.5" : "h-4.5 w-4.5";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = rating >= star;
          const halfFilled = rating >= star - 0.5 && rating < star;
          return (
            <Star
              key={star}
              className={`${starSize} ${
                filled
                  ? "fill-amber-400 text-amber-400"
                  : halfFilled
                  ? "fill-amber-400/50 text-amber-400"
                  : "fill-muted text-muted-foreground/30"
              }`}
            />
          );
        })}
      </div>
      {showCount && count !== undefined && count > 0 && (
        <span className={`${textSize} text-primary hover:text-primary/80 cursor-default`}>
          ({count.toLocaleString()})
        </span>
      )}
    </div>
  );
});
StarRating.displayName = "StarRating";
