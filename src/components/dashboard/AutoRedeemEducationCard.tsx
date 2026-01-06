import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { GradientCard } from "@/components/ui/gradient-card";
import { Button } from "@/components/ui/button";
import { Sparkles, Settings, ArrowRight, X, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
          .select("auto_redeem_pawbucks")
          .eq("id", userId)
          .single();

        if (!error && data) {
          setAutoRedeemEnabled(data.auto_redeem_pawbucks || false);
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

  const pawbucksValue = (pawbucksBalance * 0.001).toFixed(2);

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
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted/50 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Icon with animation */}
            <div className="relative flex-shrink-0">
              <motion.div
                className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center"
                animate={{ 
                  boxShadow: [
                    "0 0 0 0 rgba(var(--primary), 0.2)",
                    "0 0 0 8px rgba(var(--primary), 0)",
                  ]
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Sparkles className="w-7 h-7 text-primary" />
              </motion.div>
              <motion.div
                className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-accent flex items-center justify-center"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Coins className="w-3 h-3 text-accent-foreground" />
              </motion.div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pr-6">
              <h3 className="font-semibold text-base sm:text-lg mb-1 flex items-center gap-2">
                Save Automatically on Subscriptions!
                <span className="text-xs bg-accent/20 text-accent-foreground px-2 py-0.5 rounded-full font-medium">
                  New
                </span>
              </h3>
              <p className="text-sm text-muted-foreground mb-2">
                You have <span className="font-semibold text-primary">{pawbucksBalance.toLocaleString()} PawBucks</span> (${pawbucksValue} value). 
                Enable <span className="font-medium">Auto-Redeem</span> to automatically apply your PawBucks to subscription purchases and save money!
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Settings className="w-3.5 h-3.5" />
                <span>Find this option in your <strong>Profile Settings</strong></span>
              </div>
            </div>

            {/* CTA Button */}
            <Button 
              onClick={() => navigate("/profile")}
              className="flex-shrink-0 gap-2 group"
              size="sm"
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
