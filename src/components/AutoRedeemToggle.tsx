import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { GradientCard } from "@/components/ui/gradient-card";
import { Coins, Info, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

interface AutoRedeemToggleProps {
  userId: string;
}

export const AutoRedeemToggle = ({ userId }: AutoRedeemToggleProps) => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadPreference();
  }, [userId]);

  const loadPreference = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("auto_redeem_pawbucks")
        .eq("id", userId)
        .single();

      if (error) throw error;
      setEnabled(data?.auto_redeem_pawbucks || false);
    } catch (error) {
      console.error("Error loading auto-redeem preference:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (newValue: boolean) => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ auto_redeem_pawbucks: newValue })
        .eq("id", userId);

      if (error) throw error;
      
      setEnabled(newValue);
      toast.success(
        newValue 
          ? "Auto-redeem enabled! PawBucks will automatically apply to subscriptions." 
          : "Auto-redeem disabled."
      );
    } catch (error) {
      console.error("Error updating auto-redeem preference:", error);
      toast.error("Failed to update preference");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <GradientCard>
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </GradientCard>
    );
  }

  return (
    <GradientCard>
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Coins className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Label htmlFor="auto-redeem" className="text-sm font-medium cursor-pointer">
              Auto-Redeem PawBucks
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs p-3">
                  <p className="font-semibold mb-1">How it works</p>
                  <p className="text-xs text-muted-foreground">
                    When enabled, your available PawBucks balance will automatically 
                    be applied to reduce the cost of recurring subscriptions at 
                    merchants that accept PawBucks.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    <strong>Example:</strong> A $400/month subscription with 200,000 
                    PawBucks ($200 value) will only charge $200 to your card.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-xs text-muted-foreground">
            Automatically apply PawBucks to subscription purchases
          </p>
        </div>
        <Switch
          id="auto-redeem"
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={updating}
          className="flex-shrink-0"
        />
      </div>
      
      {enabled && (
        <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/10">
          <p className="text-xs text-muted-foreground">
            <span className="text-primary font-medium">Active:</span> Your PawBucks will 
            automatically apply to recurring subscriptions at participating merchants.
          </p>
        </div>
      )}
    </GradientCard>
  );
};