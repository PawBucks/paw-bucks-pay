import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

const TIP_PRESETS = [
  { label: "10%", multiplier: 0.10 },
  { label: "15%", multiplier: 0.15 },
  { label: "20%", multiplier: 0.20 },
];

interface TipSelectorProps {
  baseAmount: number; // The subtotal in USD to calculate percentage tips from
  tipAmount: number; // Current tip in USD
  onTipChange: (tip: number) => void;
  className?: string;
}

export const TipSelector = ({
  baseAmount,
  tipAmount,
  onTipChange,
  className,
}: TipSelectorProps) => {
  const [showCustom, setShowCustom] = useState(false);
  const [customValue, setCustomValue] = useState("");

  // Determine which preset is active
  const activePreset = TIP_PRESETS.find(
    (p) => baseAmount > 0 && Math.abs(tipAmount - baseAmount * p.multiplier) < 0.01
  );

  const handlePresetClick = (multiplier: number) => {
    setShowCustom(false);
    setCustomValue("");
    const tip = Math.round(baseAmount * multiplier * 100) / 100;
    onTipChange(tip);
  };

  const handleCustomClick = () => {
    setShowCustom(true);
    onTipChange(parseFloat(customValue) || 0);
  };

  const handleNoTip = () => {
    setShowCustom(false);
    setCustomValue("");
    onTipChange(0);
  };

  const handleCustomChange = (val: string) => {
    setCustomValue(val);
    onTipChange(parseFloat(val) || 0);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="flex items-center gap-2 text-sm font-medium">
        <Heart className="w-4 h-4 text-pink-500" />
        Add a Tip (USD only)
      </Label>
      <p className="text-xs text-muted-foreground">
        Tips are always charged to your card and cannot be paid with PawBucks.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={tipAmount === 0 && !showCustom ? "default" : "outline"}
          onClick={handleNoTip}
          className="text-xs"
        >
          No tip
        </Button>
        {TIP_PRESETS.map((preset) => (
          <Button
            key={preset.label}
            type="button"
            size="sm"
            variant={activePreset?.label === preset.label ? "default" : "outline"}
            onClick={() => handlePresetClick(preset.multiplier)}
            className="text-xs"
            disabled={baseAmount <= 0}
          >
            {preset.label}
            {baseAmount > 0 && (
              <span className="ml-1 opacity-70">
                (${(baseAmount * preset.multiplier).toFixed(2)})
              </span>
            )}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={showCustom ? "default" : "outline"}
          onClick={handleCustomClick}
          className="text-xs"
        >
          Custom
        </Button>
      </div>
      {showCustom && (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={customValue}
            onChange={(e) => handleCustomChange(e.target.value)}
            className="pl-7"
            autoFocus
          />
        </div>
      )}
    </div>
  );
};
