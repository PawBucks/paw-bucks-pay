import { Gift } from"lucide-react";
import { Badge } from"@/components/ui/badge";
import {
 Tooltip,
 TooltipContent,
 TooltipProvider,
 TooltipTrigger,
} from"@/components/ui/tooltip";

interface WelcomeCreditBadgeProps {
 className?: string;
 size?:'sm' |'md' |'lg';
 showTooltip?: boolean;
}

export const WelcomeCreditBadge = ({ 
 className ="", 
 size ='md',
 showTooltip = true 
}: WelcomeCreditBadgeProps) => {
 const sizeClasses = {
 sm:'text-xs px-1.5 py-0.5',
 md:'text-sm px-2 py-1',
 lg:'text-base px-3 py-1.5',
 };

 const iconSizes = {
 sm:'w-3 h-3',
 md:'w-4 h-4',
 lg:'w-5 h-5',
 };

 const badge = (
 <Badge 
 className={`bg-gradient-to-r from-warning/20 to-warning/20 text-warning border-warning/30 hover:from-warning/30 hover:to-warning/30 ${sizeClasses[size]} ${className}`}
 >
 <Gift className={`${iconSizes[size]} mr-1`} />
 Welcome Credit Accepted
 </Badge>
 );

 if (!showTooltip) {
 return badge;
 }

 return (
 <TooltipProvider>
 <Tooltip>
 <TooltipTrigger asChild>
 {badge}
 </TooltipTrigger>
 <TooltipContent className="max-w-xs">
 <p className="text-sm">
 New PawBucks members can use their <strong>Welcome Credit (up to $250)</strong> toward bookings here!
 </p>
 </TooltipContent>
 </Tooltip>
 </TooltipProvider>
 );
};
