import { motion, AnimatePresence } from"framer-motion";
import { AlertTriangle, X, ChevronRight, Clock } from"lucide-react";
import { cn } from"@/lib/utils";
import { Button } from"@/components/ui/button";
import type { LoyaltyWarning } from"@/services/api/loyalty.service";
import { formatDistanceToNow } from"date-fns";

interface LoyaltyWarningBannerProps {
 warnings: LoyaltyWarning[];
 onDismiss: (id: string) => void;
 onAction?: (warning: LoyaltyWarning) => void;
}

const URGENCY_STYLES = {
 critical: {
 bg:'bg-destructive/10',
 border:'border-destructive/30',
 icon:'text-destructive',
 text:'text-destructive',
 },
 high: {
 bg:'bg-warning/10',
 border:'border-warning/30',
 icon:'text-warning',
 text:'text-warning',
 },
 medium: {
 bg:'bg-primary/10',
 border:'border-primary/30',
 icon:'text-primary',
 text:'text-foreground',
 },
 low: {
 bg:'bg-muted',
 border:'border-border',
 icon:'text-muted-foreground',
 text:'text-muted-foreground',
 },
};

export const LoyaltyWarningBanner = ({ warnings, onDismiss, onAction }: LoyaltyWarningBannerProps) => {
 if (warnings.length === 0) return null;

 // Show most urgent warning first
 const sortedWarnings = [...warnings].sort((a, b) => {
 const order = ['critical','high','medium','low'];
 return order.indexOf(a.urgency) - order.indexOf(b.urgency);
 });

 return (
 <div className="space-y-2">
 <AnimatePresence>
 {sortedWarnings.slice(0, 2).map((warning) => {
 const styles = URGENCY_STYLES[warning.urgency as keyof typeof URGENCY_STYLES] || URGENCY_STYLES.medium;
 
 return (
 <motion.div
 key={warning.id}
 initial={{ opacity: 0, y: -10, height: 0 }}
 animate={{ opacity: 1, y: 0, height:'auto' }}
 exit={{ opacity: 0, y: -10, height: 0 }}
 className={cn(
"p-3 rounded-xl border flex items-start gap-3",
 styles.bg,
 styles.border
 )}
 >
 <AlertTriangle className={cn("w-5 h-5 flex-shrink-0 mt-0.5", styles.icon)} />
 
 <div className="flex-1 min-w-0">
 <p className={cn("text-sm font-medium", styles.text)}>
 {warning.message}
 </p>
 {warning.action_deadline && (
 <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
 <Clock className="w-3 h-3" />
 <span>
 Act {formatDistanceToNow(new Date(warning.action_deadline), { addSuffix: true })}
 </span>
 </div>
 )}
 </div>

 <div className="flex items-center gap-1">
 {onAction && (
 <Button 
 variant="ghost" 
 size="sm" 
 className="h-7 px-2"
 onClick={() => onAction(warning)}
 >
 <ChevronRight className="w-4 h-4" />
 </Button>
 )}
 <Button
 variant="ghost"
 size="sm"
 className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
 onClick={() => onDismiss(warning.id)}
 >
 <X className="w-4 h-4" />
 </Button>
 </div>
 </motion.div>
 );
 })}
 </AnimatePresence>
 
 {sortedWarnings.length > 2 && (
 <p className="text-xs text-muted-foreground text-center">
 + {sortedWarnings.length - 2} more notification{sortedWarnings.length > 3 ?'s' :''}
 </p>
 )}
 </div>
 );
};
