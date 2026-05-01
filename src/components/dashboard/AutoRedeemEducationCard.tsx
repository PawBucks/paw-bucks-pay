import { useState, useEffect } from"react";
import { useNavigate } from"react-router-dom";
import { supabase } from"@/integrations/supabase/client";
import { GradientCard } from"@/components/ui/gradient-card";
import { Button } from"@/components/ui/button";
import { Sparkles, Settings, ArrowRight, X, Coins } from"lucide-react";
import { motion, AnimatePresence } from"framer-motion";

import { Formatters } from "@/utils/formatters";
interface AutoRedeemEducationCardProps {
 userId: string;
 pawbucksBalance: number;
}

export const AutoRedeemEducationCard = ({ userId, pawbucksBalance }: AutoRedeemEducationCardProps) => {
 const navigate = useNavigate();
 const [dismissed, setDismissed] = useState(false);
 const [autoRedeemEnabled, setAutoRedeemEnabled] = useState<boolean | null>(null);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 const checkAutoRedeemStatus = async () => {
 try {
 const { data, error } = await supabase
 .from("profiles")
 .select("auto_redeem_mode")
 .eq("id", userId)
 .single();

 if (!error && data) {
 setAutoRedeemEnabled(data.auto_redeem_mode !=='off' && data.auto_redeem_mode !== null);
 }
 } catch (error) {
 console.error("Error checking auto-redeem status:", error);
 } finally {
 setLoading(false);
 }
 };

 checkAutoRedeemStatus();
 }, [userId]);

 // Don't show if no PawBucks balance, already enabled, or dismissed
 if (loading || pawbucksBalance === 0 || autoRedeemEnabled || dismissed) {
 return null;
 }

 const pawbucksValue = Formatters.money((pawbucksBalance * 0.001));

 return (
 <AnimatePresence>
 <motion.div
 initial={{ opacity: 0, y: -10 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -10 }}
 transition={{ duration: 0.3 }}
 >
 <GradientCard className="relative overflow-hidden border-primary/30 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5">
 {/* Dismiss button */}
 <button
 onClick={() => setDismissed(true)}
 className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted transition-colors"
 aria-label="Dismiss"
 >
 <X className="w-4 h-4 text-muted-foreground" />
 </button>

 <div className="flex flex-col gap-4">
 <div className="flex items-start gap-3 sm:gap-4">
 {/* Icon with animation */}
 <div className="relative flex-shrink-0">
 <motion.div
 className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center"
 animate={{ 
 boxShadow: [
"0 0 0 0 rgba(var(--primary), 0.2)",
"0 0 0 8px rgba(var(--primary), 0)",
 ]
 }}
 transition={{ duration: 1.5, repeat: Infinity }}
 >
 <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
 </motion.div>
 <motion.div
 className="absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-accent flex items-center justify-center"
 animate={{ scale: [1, 1.1, 1] }}
 transition={{ duration: 2, repeat: Infinity }}
 >
 <Coins className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-accent-foreground" />
 </motion.div>
 </div>

 {/* Content */}
 <div className="flex-1 min-w-0 pr-6">
 <h3 className="font-semibold text-sm sm:text-base md:text-lg mb-1 flex flex-wrap items-center gap-2">
 Save Automatically on Subscriptions!
 <span className="text-xs bg-accent/20 text-accent-foreground px-2 py-0.5 rounded-full font-medium">
 New
 </span>
 </h3>
 <p className="text-xs sm:text-sm text-muted-foreground mb-2">
 You have <span className="font-semibold text-primary">{pawbucksBalance.toLocaleString()} PawBucks</span> (${pawbucksValue} value). 
 Enable <span className="font-medium">Auto-Redeem</span> to automatically apply your PawBucks to subscription purchases!
 </p>
 <div className="flex items-center gap-2 text-xs text-muted-foreground">
 <Settings className="w-3.5 h-3.5 flex-shrink-0" />
 <span>Find this in <strong>Profile Settings</strong></span>
 </div>
 </div>
 </div>

 {/* CTA Button - Full width on mobile */}
 <Button 
 onClick={() => navigate("/profile")}
 className="w-full sm:w-auto sm:self-end gap-2 group"
 size="default"
 >
 Enable Now
 <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
 </Button>
 </div>
 </GradientCard>
 </motion.div>
 </AnimatePresence>
 );
};
