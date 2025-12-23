import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Coins, Clock, CheckCircle, Info, Loader2 } from "lucide-react";
import { Formatters } from "@/utils/formatters";
import { format, formatDistanceToNow } from "date-fns";

interface PendingPawBucks {
  id: string;
  amount: number;
  vest_date: string;
  description: string;
  created_at: string;
}

interface PawBucksBreakdownProps {
  userId: string;
}

export const PawBucksBreakdown = ({ userId }: PawBucksBreakdownProps) => {
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [pendingBalance, setPendingBalance] = useState<number>(0);
  const [pendingItems, setPendingItems] = useState<PendingPawBucks[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBreakdown();
  }, [userId]);

  const loadBreakdown = async () => {
    try {
      // Get wallet balance (available only)
      const { data: wallet } = await supabase
        .from("pawbucks_wallet")
        .select("balance")
        .eq("user_id", userId)
        .single();

      setAvailableBalance(wallet?.balance || 0);

      // Get pending PawBucks
      const { data: pendingData } = await supabase
        .from("pawbucks_activity")
        .select("id, amount, vest_date, description, created_at")
        .eq("user_id", userId)
        .eq("pawbucks_status", "pending")
        .order("vest_date", { ascending: true });

      if (pendingData) {
        setPendingItems(pendingData);
        const totalPending = pendingData.reduce((sum, item) => sum + item.amount, 0);
        setPendingBalance(totalPending);
      }
    } catch (error) {
      console.error("Error loading PawBucks breakdown:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  const totalBalance = availableBalance + pendingBalance;

  return (
    <div className="space-y-4">
      {/* Balance Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 bg-green-500/10 border-green-500/20">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm text-muted-foreground">Available</span>
          </div>
          <p className="text-2xl font-bold text-green-600">
            {Formatters.number(availableBalance)}
          </p>
        </Card>
        
        <Card className="p-4 bg-yellow-500/10 border-yellow-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-yellow-600" />
            <span className="text-sm text-muted-foreground">Pending</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3 h-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>These PawBucks are pending and will become available 30 days after approval.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-2xl font-bold text-yellow-600">
            {Formatters.number(pendingBalance)}
          </p>
        </Card>
      </div>

      {/* Pending Items List */}
      {pendingItems.length > 0 && (
        <Card className="p-4">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-yellow-600" />
            Pending PawBucks
          </h4>
          <div className="space-y-2">
            {pendingItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.description || "Non-partner receipt"}</p>
                  <p className="text-xs text-muted-foreground">
                    Available {formatDistanceToNow(new Date(item.vest_date), { addSuffix: true })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-yellow-600">+{Formatters.number(item.amount)}</p>
                  <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                    Vesting
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          
          {/* Cap info */}
          <div className="mt-3 p-3 bg-muted/30 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                Non-partner PawBucks are capped at 20,000 per month to keep rewards sustainable.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
