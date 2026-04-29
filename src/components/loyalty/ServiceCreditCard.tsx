import { motion } from"framer-motion";
import { CreditCard, Store, Clock, CheckCircle } from"lucide-react";
import { cn } from"@/lib/utils";
import type { ServiceCredit } from"@/services/api/loyalty.service";
import { formatDistanceToNow, isPast } from"date-fns";

interface ServiceCreditCardProps {
 credit: ServiceCredit;
 onClick?: () => void;
 compact?: boolean;
}

export const ServiceCreditCard = ({ credit, onClick, compact = false }: ServiceCreditCardProps) => {
 const isExpired = isPast(new Date(credit.expires_at));
 const isUsed = credit.status ==='used';
 const isPartiallyUsed = credit.status ==='partially_used';
 const expiresAt = new Date(credit.expires_at);
 const isExpiringSoon = !isExpired && expiresAt.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000; // 7 days

 const merchantName = credit.merchants?.business_name ||'Any Partner';

 if (compact) {
 return (
 <motion.div
 whileHover={{ scale: 1.02 }}
 onClick={onClick}
 className={cn(
"p-3 rounded-lg border cursor-pointer transition-all",
 isUsed || isExpired 
 ?"opacity-50 bg-muted/30 border-border" 
 :"bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20 hover:border-primary/40"
 )}
 >
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <CreditCard className="w-4 h-4 text-primary" />
 <span className="font-semibold">${credit.remaining_value.toFixed(0)}</span>
 </div>
 {!isUsed && !isExpired && (
 <div className="flex items-center gap-1 text-xs text-muted-foreground">
 <Clock className="w-3 h-3" />
 <span className={isExpiringSoon ?"text-warning" :""}>
 {formatDistanceToNow(expiresAt, { addSuffix: true })}
 </span>
 </div>
 )}
 </div>
 <p className="text-xs text-muted-foreground mt-1 truncate">{credit.description}</p>
 </motion.div>
 );
 }

 return (
 <motion.div
 whileHover={{ scale: 1.01, y: -2 }}
 onClick={onClick}
 className={cn(
"p-4 rounded-xl border cursor-pointer transition-all",
 isUsed || isExpired 
 ?"opacity-60 bg-muted/30 border-border" 
 :"bg-gradient-to-br from-primary/5 via-accent/5 to-secondary/5 border-primary/20 hover:shadow-lg"
 )}
 >
 <div className="flex items-start gap-3">
 {/* Credit Icon/Value */}
 <div className={cn(
"w-14 h-14 rounded-xl flex flex-col items-center justify-center",
 isUsed || isExpired
 ?"bg-muted"
 :"bg-gradient-to-br from-primary/20 to-accent/20"
 )}>
 <span className="text-lg font-bold">${credit.remaining_value.toFixed(0)}</span>
 {isPartiallyUsed && (
 <span className="text-[10px] text-muted-foreground">left</span>
 )}
 </div>

 {/* Content */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between mb-1">
 <h4 className="font-semibold text-sm">{credit.description}</h4>
 {isUsed && (
 <span className="flex items-center gap-1 text-xs text-primary">
 <CheckCircle className="w-3 h-3" /> Used
 </span>
 )}
 </div>

 {/* Merchant */}
 <div className="flex items-center gap-2 mb-2">
 {credit.merchants?.logo_url ? (
 <img 
 src={credit.merchants.logo_url} 
 alt={merchantName}
 className="w-4 h-4 rounded-full object-cover"
 />
 ) : (
 <Store className="w-4 h-4 text-muted-foreground" />
 )}
 <span className="text-xs text-muted-foreground">{merchantName}</span>
 </div>

 {/* Expiry */}
 {!isUsed && (
 <div className="flex items-center gap-1 text-xs">
 <Clock className="w-3 h-3" />
 {isExpired ? (
 <span className="text-destructive">Expired</span>
 ) : isExpiringSoon ? (
 <span className="text-warning font-medium">
 Expires {formatDistanceToNow(expiresAt, { addSuffix: true })}!
 </span>
 ) : (
 <span className="text-muted-foreground">
 Valid until {expiresAt.toLocaleDateString()}
 </span>
 )}
 </div>
 )}
 </div>
 </div>
 </motion.div>
 );
};
