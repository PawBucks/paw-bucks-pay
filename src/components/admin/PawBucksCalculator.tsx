import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator, Coins, ArrowRightLeft } from 'lucide-react';
import { POINTS_MULTIPLIER, PAWBUCKS_CONVERSION } from '@/lib/constants';

type SubscriptionTier = 'free' | 'pawpass' | 'pawpass_plus';

const TIER_CONFIG: Record<SubscriptionTier, { label: string; multiplier: number; color: string }> = {
  free: { label: 'Free Tier', multiplier: POINTS_MULTIPLIER.FREE, color: 'text-muted-foreground' },
  pawpass: { label: 'PawPass', multiplier: POINTS_MULTIPLIER.PAWPASS, color: 'text-primary' },
  pawpass_plus: { label: 'PawPass+', multiplier: POINTS_MULTIPLIER.PAWPASS_PLUS, color: 'text-amber-500' },
};

export function PawBucksCalculator() {
  // Credit calculator state
  const [dollarAmount, setDollarAmount] = useState<string>('');
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('free');
  
  // Debit calculator state
  const [pawBucksAmount, setPawBucksAmount] = useState<string>('');

  // Credit calculation
  const amount = parseFloat(dollarAmount) || 0;
  const multiplier = TIER_CONFIG[selectedTier].multiplier;
  const pawBucksResult = Math.floor(amount * multiplier);
  
  // Debit calculation (1 PB = $0.001)
  const pbAmount = parseFloat(pawBucksAmount) || 0;
  const usdEquivalent = pbAmount * PAWBUCKS_CONVERSION.PAWBUCKS_USD_VALUE;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          PawBucks Calculator
        </CardTitle>
        <CardDescription>
          Calculate PawBucks to credit or convert PawBucks to USD value
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="credit" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="credit" className="flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Credit (USD → PB)
            </TabsTrigger>
            <TabsTrigger value="debit" className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Debit (PB → USD)
            </TabsTrigger>
          </TabsList>
          
          {/* Credit Calculator Tab */}
          <TabsContent value="credit" className="space-y-6 mt-6">
            <div className="space-y-2">
              <Label htmlFor="dollar-amount">Dollar Amount Spent</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="dollar-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={dollarAmount}
                  onChange={(e) => setDollarAmount(e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Subscription Tier</Label>
              <RadioGroup
                value={selectedTier}
                onValueChange={(value) => setSelectedTier(value as SubscriptionTier)}
                className="grid grid-cols-3 gap-4"
              >
                {(Object.entries(TIER_CONFIG) as [SubscriptionTier, typeof TIER_CONFIG[SubscriptionTier]][]).map(
                  ([tier, config]) => (
                    <div key={tier}>
                      <RadioGroupItem
                        value={tier}
                        id={tier}
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor={tier}
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                      >
                        <span className="font-medium">{config.label}</span>
                        <span className={`text-sm ${config.color}`}>{config.multiplier}x per $1</span>
                      </Label>
                    </div>
                  )
                )}
              </RadioGroup>
            </div>

            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Calculation:</span>
                <span>
                  ${amount.toFixed(2)} × {multiplier} PB/$ = {pawBucksResult.toLocaleString()} PB
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">PawBucks to Credit:</span>
                <span className="flex items-center gap-2 text-2xl font-bold text-primary">
                  <Coins className="h-6 w-6" />
                  {pawBucksResult.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Tier Rates:</strong></p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Free: 10 PB per $1 spent</li>
                <li>PawPass: 20 PB per $1 spent</li>
                <li>PawPass+: 30 PB per $1 spent</li>
              </ul>
            </div>
          </TabsContent>
          
          {/* Debit Calculator Tab */}
          <TabsContent value="debit" className="space-y-6 mt-6">
            <div className="space-y-2">
              <Label htmlFor="pawbucks-amount">PawBucks Amount</Label>
              <div className="relative">
                <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="pawbucks-amount"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={pawBucksAmount}
                  onChange={(e) => setPawBucksAmount(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Calculation:</span>
                <span>
                  {pbAmount.toLocaleString()} PB × $0.001 = ${usdEquivalent.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">USD Equivalent:</span>
                <span className="flex items-center gap-2 text-2xl font-bold text-green-600">
                  ${usdEquivalent.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Debit Rate:</strong></p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>1 PawBuck = $0.001 USD</li>
                <li>1,000 PawBucks = $1.00 USD</li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
