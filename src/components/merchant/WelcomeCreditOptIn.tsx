import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Gift, Users, AlertTriangle, Check, X, Info } from "lucide-react";
import { GradientCard } from "@/components/ui/gradient-card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WelcomeCreditOptInProps {
  merchantId: string;
  initialStatus?: boolean;
  onStatusChange?: (accepting: boolean) => void;
}

export const WelcomeCreditOptIn = ({ 
  merchantId, 
  initialStatus = false,
  onStatusChange 
}: WelcomeCreditOptInProps) => {
  const [accepting, setAccepting] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<boolean | null>(null);
  const [redemptionStats, setRedemptionStats] = useState<{
    total: number;
    thisMonth: number;
  }>({ total: 0, thisMonth: 0 });

  // Fetch current status and stats
  useEffect(() => {
    const fetchStatus = async () => {
      const { data, error } = await supabase
        .from('merchants')
        .select('accepts_welcome_credit')
        .eq('id', merchantId)
        .single();

      if (!error && data) {
        setAccepting(data.accepts_welcome_credit || false);
      }

      // Fetch redemption stats
      const { data: analyticsData } = await supabase
        .from('welcome_credit_analytics')
        .select('created_at')
        .eq('merchant_id', merchantId)
        .eq('event_type', 'credit_used');

      if (analyticsData) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        setRedemptionStats({
          total: analyticsData.length,
          thisMonth: analyticsData.filter(a => new Date(a.created_at) >= startOfMonth).length,
        });
      }
    };

    fetchStatus();
  }, [merchantId]);

  const handleToggle = (checked: boolean) => {
    if (checked) {
      // Opting in requires confirmation
      setPendingStatus(true);
      setShowConfirmDialog(true);
    } else {
      // Opting out is simpler
      setPendingStatus(false);
      setShowConfirmDialog(true);
    }
  };

  const confirmToggle = async () => {
    if (pendingStatus === null) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('merchant-welcome-credit-toggle', {
        body: { 
          merchantId,
          acceptsWelcomeCredit: pendingStatus,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      setAccepting(pendingStatus);
      onStatusChange?.(pendingStatus);
      
      toast.success(
        pendingStatus 
          ? "You're now accepting Welcome Credit! New customers can use their $50 credit with you."
          : "You've opted out of the Welcome Credit program."
      );
    } catch (err) {
      console.error('Error toggling welcome credit:', err);
      toast.error('Failed to update welcome credit setting');
    } finally {
      setLoading(false);
      setShowConfirmDialog(false);
      setPendingStatus(null);
    }
  };

  return (
    <>
      <GradientCard className={`relative overflow-hidden ${
        accepting 
          ? 'bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-yellow-500/10 border-amber-500/20' 
          : 'bg-card'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
            accepting 
              ? 'bg-gradient-to-br from-amber-500 to-orange-500' 
              : 'bg-muted'
          }`}>
            <Gift className={`w-6 h-6 ${accepting ? 'text-white' : 'text-muted-foreground'}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-4 mb-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">
                  Welcome Credit Program
                </h3>
                <Badge variant={accepting ? "default" : "secondary"}>
                  {accepting ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              
              <Switch
                checked={accepting}
                onCheckedChange={handleToggle}
                disabled={loading}
              />
            </div>
            
            <p className="text-sm text-muted-foreground mb-3">
              {accepting 
                ? "You're accepting new customer Welcome Credit. This helps attract first-time customers to your business."
                : "Enable to accept 50,000 PawBucks ($50) Welcome Credit from new PawBucks customers."
              }
            </p>

            {accepting && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-3"
              >
                {/* Stats */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground font-medium">{redemptionStats.total}</span>
                    <span className="text-muted-foreground">new customers acquired</span>
                  </div>
                  {redemptionStats.thisMonth > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {redemptionStats.thisMonth} this month
                    </Badge>
                  )}
                </div>

                {/* Important Notice */}
                <Alert className="bg-amber-500/10 border-amber-500/20">
                  <Info className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-700 dark:text-amber-300 text-sm">
                    Understanding Welcome Credit
                  </AlertTitle>
                  <AlertDescription className="text-xs text-muted-foreground">
                    Welcome Credit is a promotional incentive. You accept the $50 discount as your customer acquisition cost — 
                    no cash reimbursement is provided by PawBucks. This helps you attract verified new customers to your business.
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}
          </div>
        </div>
      </GradientCard>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {pendingStatus ? (
                <>
                  <Gift className="w-5 h-5 text-amber-500" />
                  Enable Welcome Credit Program
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  Disable Welcome Credit Program
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {pendingStatus ? (
                <div className="space-y-4 pt-2">
                  <p>
                    By enabling the Welcome Credit Program, you agree to:
                  </p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Accept 50,000 PawBucks ($50) Welcome Credit from new customers as a promotional discount</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Treat this as your customer acquisition cost — no reimbursement is provided</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Require a minimum $75 transaction for Welcome Credit usage</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Be featured as a "Welcome Credit Accepted" partner in our app</span>
                    </li>
                  </ul>
                  <Alert className="bg-amber-500/10 border-amber-500/20">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-sm">
                      <strong>This is a marketing promotion.</strong> The $50 credit helps you acquire new, verified customers 
                      at no platform fee — you only pay the promotional discount amount.
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <p className="pt-2">
                  You will no longer appear in the "Welcome Credit Accepted" merchant list, 
                  and new customers won't be able to use their Welcome Credit with you.
                </p>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} disabled={loading}>
              Cancel
            </Button>
            <Button 
              onClick={confirmToggle} 
              disabled={loading}
              className={pendingStatus ? 'bg-amber-500 hover:bg-amber-600' : ''}
            >
              {loading ? 'Saving...' : pendingStatus ? 'Enable Program' : 'Disable Program'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
