import { memo, useMemo } from 'react';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PawBucksInfoTooltipProps {
  variant?: 'earning' | 'redemption' | 'multiplier';
  className?: string;
}

const PawBucksInfoTooltipComponent = ({ 
  variant = 'earning',
  className = '' 
}: PawBucksInfoTooltipProps) => {
  const content = useMemo(() => {
    switch (variant) {
      case 'earning':
        return (
          <div className="space-y-2 max-w-xs">
            <p className="font-semibold text-foreground">How You Earn PawBucks</p>
            <p className="text-muted-foreground text-sm">
              Earn PawBucks on every purchase! Your multiplier depends on your subscription tier:
            </p>
            <ul className="text-sm space-y-1">
              <li className="flex justify-between">
                <span>Free:</span>
                <span className="font-medium text-foreground">10x ($1 = 10 PawBucks)</span>
              </li>
              <li className="flex justify-between">
                <span>PawPass:</span>
                <span className="font-medium text-primary">20x ($1 = 20 PawBucks)</span>
              </li>
              <li className="flex justify-between">
                <span>PawPass+:</span>
                <span className="font-medium text-accent">30x ($1 = 30 PawBucks)</span>
              </li>
            </ul>
            <p className="text-xs text-muted-foreground mt-2">
              Example: Spend $100 → Earn 1,000-3,000 PawBucks
            </p>
          </div>
        );
      case 'redemption':
        return (
          <div className="space-y-2 max-w-xs">
            <p className="font-semibold text-foreground">Redeeming PawBucks</p>
            <p className="text-muted-foreground text-sm">
              Use your PawBucks for discounts on future purchases or redeem special offers from merchants.
            </p>
            <p className="text-sm">
              <span className="font-medium">Conversion:</span> 1,000 PawBucks = $1.00
            </p>
          </div>
        );
      case 'multiplier':
        return (
          <div className="space-y-2 max-w-xs">
            <p className="font-semibold text-foreground">Points Multiplier</p>
            <p className="text-muted-foreground text-sm">
              Your subscription tier determines your earning power:
            </p>
            <div className="grid grid-cols-3 gap-2 text-center text-sm mt-2">
              <div className="bg-muted/50 rounded p-2">
                <div className="font-bold">10x</div>
                <div className="text-xs text-muted-foreground">Free</div>
              </div>
              <div className="bg-primary/10 rounded p-2">
                <div className="font-bold text-primary">20x</div>
                <div className="text-xs text-muted-foreground">PawPass</div>
              </div>
              <div className="bg-accent/10 rounded p-2">
                <div className="font-bold text-accent">30x</div>
                <div className="text-xs text-muted-foreground">PawPass+</div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  }, [variant]);

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <button 
            type="button"
            className={`inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors ${className}`}
            aria-label="PawBucks information"
          >
            <Info className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="bg-popover border border-border shadow-lg p-3 z-50"
          sideOffset={5}
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const PawBucksInfoTooltip = memo(PawBucksInfoTooltipComponent);
