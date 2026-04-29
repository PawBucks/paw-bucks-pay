import { useState, useEffect } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Label } from"@/components/ui/label";
import { GradientCard } from"@/components/ui/gradient-card";
import { Coins, Info, Loader2, Sparkles, Zap, RotateCcw, Settings2 } from"lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from"@/components/ui/tooltip";
import { toast } from"sonner";
import { RadioGroup, RadioGroupItem } from"@/components/ui/radio-group";
import { Slider } from"@/components/ui/slider";
import { Badge } from"@/components/ui/badge";
import { Separator } from"@/components/ui/separator";
import { motion, AnimatePresence } from"framer-motion";

interface AutoRedeemToggleProps {
 userId: string;
}

type AutoRedeemMode ="off" |"subscriptions_only" |"smart" |"always";

const MODE_CONFIG = {
 off: {
 label:"Off",
 description:"Manually apply PawBucks at checkout",
 icon: RotateCcw,
 color:"text-muted-foreground",
 },
 subscriptions_only: {
 label:"Subscriptions Only",
 description:"Auto-apply PawBucks to recurring subscription payments",
 icon: Coins,
 color:"text-primary",
 },
 smart: {
 label:"Smart Auto-Redeem",
 description:"Intelligently apply PawBucks when they meaningfully reduce a purchase",
 icon: Sparkles,
 color:"text-accent-foreground",
 recommended: true,
 },
 always: {
 label:"Always Auto-Redeem",
 description:"Apply maximum PawBucks to every eligible purchase",
 icon: Zap,
 color:"text-primary",
 },
} as const;

export const AutoRedeemToggle = ({ userId }: AutoRedeemToggleProps) => {
 const [mode, setMode] = useState<AutoRedeemMode>("off");
 const [minCoverage, setMinCoverage] = useState(20);
 const [maxApply, setMaxApply] = useState(50);
 const [loading, setLoading] = useState(true);
 const [updating, setUpdating] = useState(false);

 useEffect(() => {
 loadPreference();
 }, [userId]);

 const loadPreference = async () => {
 try {
 const { data, error } = await supabase
 .from("profiles")
 .select("auto_redeem_mode, auto_redeem_min_coverage_pct, auto_redeem_max_apply_pct")
 .eq("id", userId)
 .single();

 if (error) throw error;
 setMode((data?.auto_redeem_mode as AutoRedeemMode) ||"off");
 setMinCoverage(data?.auto_redeem_min_coverage_pct ?? 20);
 setMaxApply(data?.auto_redeem_max_apply_pct ?? 50);
 } catch (error) {
 console.error("Error loading auto-redeem preference:", error);
 } finally {
 setLoading(false);
 }
 };

 const handleModeChange = async (newMode: AutoRedeemMode) => {
 setUpdating(true);
 try {
 const { error } = await supabase
 .from("profiles")
 .update({
 auto_redeem_mode: newMode,
 auto_redeem_pawbucks: newMode !=="off",
 })
 .eq("id", userId);

 if (error) throw error;
 setMode(newMode);
 toast.success(`Auto-redeem set to: ${MODE_CONFIG[newMode].label}`);
 } catch (error) {
 console.error("Error updating auto-redeem mode:", error);
 toast.error("Failed to update preference");
 } finally {
 setUpdating(false);
 }
 };

 const handleSmartParamsChange = async (field:"min_coverage" |"max_apply", value: number) => {
 if (field ==="min_coverage") setMinCoverage(value);
 else setMaxApply(value);

 try {
 const update = field ==="min_coverage"
 ? { auto_redeem_min_coverage_pct: value }
 : { auto_redeem_max_apply_pct: value };

 const { error } = await supabase
 .from("profiles")
 .update(update)
 .eq("id", userId);

 if (error) throw error;
 } catch (error) {
 console.error("Error updating smart params:", error);
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
 <div className="flex items-center gap-3 mb-4">
 <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
 <Coins className="w-5 h-5 text-primary" />
 </div>
 <div>
 <div className="flex items-center gap-2">
 <h3 className="text-sm font-semibold">Auto-Redeem PawBucks</h3>
 <TooltipProvider>
 <Tooltip>
 <TooltipTrigger asChild>
 <Info className="w-4 h-4 text-muted-foreground cursor-help" />
 </TooltipTrigger>
 <TooltipContent className="max-w-xs p-3">
 <p className="font-semibold mb-1">How it works</p>
 <p className="text-xs text-muted-foreground">
 Choose how your PawBucks are automatically applied to purchases.
 Smart mode balances savings with reward perception.
 </p>
 </TooltipContent>
 </Tooltip>
 </TooltipProvider>
 </div>
 <p className="text-xs text-muted-foreground">Choose how PawBucks apply to your purchases</p>
 </div>
 </div>

 <RadioGroup
 value={mode}
 onValueChange={(v) => handleModeChange(v as AutoRedeemMode)}
 disabled={updating}
 className="space-y-2"
 >
 {(Object.entries(MODE_CONFIG) as [AutoRedeemMode, typeof MODE_CONFIG[AutoRedeemMode]][]).map(
 ([key, config]) => {
 const Icon = config.icon;
 const isSelected = mode === key;
 const isRecommended ="recommended" in config && config.recommended;

 return (
 <label
 key={key}
 className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
 isSelected
 ?"border-primary/40 bg-primary/5"
 :"border-border hover:border-primary/20 hover:bg-muted/30"
 } ${updating ?"opacity-60 pointer-events-none" :""}`}
 >
 <RadioGroupItem value={key} className="mt-0.5 flex-shrink-0" />
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <Icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? config.color :"text-muted-foreground"}`} />
 <span className="text-sm font-medium">{config.label}</span>
 {isRecommended && (
 <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-accent/20 text-accent-foreground">
 Recommended
 </Badge>
 )}
 </div>
 <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
 </div>
 </label>
 );
 }
 )}
 </RadioGroup>

 {/* Smart mode parameters */}
 <AnimatePresence>
 {mode ==="smart" && (
 <motion.div
 initial={{ opacity: 0, height: 0 }}
 animate={{ opacity: 1, height:"auto" }}
 exit={{ opacity: 0, height: 0 }}
 transition={{ duration: 0.2 }}
 className="overflow-hidden"
 >
 <Separator className="my-4" />
 <div className="space-y-4">
 <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
 <Settings2 className="w-3.5 h-3.5" />
 Smart Redeem Parameters
 </div>

 {/* Min coverage slider */}
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <Label className="text-xs">Minimum coverage to trigger</Label>
 <span className="text-xs font-semibold text-primary">{minCoverage}%</span>
 </div>
 <Slider
 value={[minCoverage]}
 onValueChange={([v]) => setMinCoverage(v)}
 onValueCommit={([v]) => handleSmartParamsChange("min_coverage", v)}
 min={5}
 max={50}
 step={5}
 className="w-full"
 />
 <p className="text-[10px] text-muted-foreground">
 Only apply PawBucks if they cover at least {minCoverage}% of the purchase
 </p>
 </div>

 {/* Max apply slider */}
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <Label className="text-xs">Maximum to apply per purchase</Label>
 <span className="text-xs font-semibold text-primary">{maxApply}%</span>
 </div>
 <Slider
 value={[maxApply]}
 onValueChange={([v]) => setMaxApply(v)}
 onValueCommit={([v]) => handleSmartParamsChange("max_apply", v)}
 min={10}
 max={100}
 step={5}
 className="w-full"
 />
 <p className="text-[10px] text-muted-foreground">
 Cap PawBucks at {maxApply}% of the purchase value
 </p>
 </div>

 {/* Example */}
 <div className="p-2.5 bg-muted rounded-md border border-border">
 <p className="text-[11px] text-muted-foreground">
 <span className="font-semibold text-foreground">Example:</span> On a $100 purchase, PawBucks will auto-apply
 only if you have at least {(100 * minCoverage / 100).toFixed(0)}k PB (${(100 * minCoverage / 100).toFixed(0)}),
 and at most {(100 * maxApply / 100).toFixed(0)}k PB (${(100 * maxApply / 100).toFixed(0)}) will be used.
 </p>
 </div>
 </div>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Active status indicator */}
 {mode !=="off" && (
 <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/10">
 <p className="text-xs text-muted-foreground">
 <span className="text-primary font-medium">Active:</span>{""}
 {mode ==="subscriptions_only" &&"PawBucks will auto-apply to recurring subscriptions."}
 {mode ==="smart" && `Smart redeem active — triggers at ${minCoverage}% coverage, caps at ${maxApply}%.`}
 {mode ==="always" &&"PawBucks will auto-apply to every eligible purchase."}
 </p>
 </div>
 )}
 </GradientCard>
 );
};
