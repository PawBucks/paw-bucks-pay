import { Card, CardContent, CardDescription, CardHeader, CardTitle } from'@/components/ui/card';
import { Input } from'@/components/ui/input';
import { Label } from'@/components/ui/label';
import { DollarSign, Loader2 } from'lucide-react';

interface PlatformFeesCardProps {
 platformFee: string;
 cashbackRate: string;
 pawbucksEarnRate: string;
 pawbucksConversion: string;
 onPlatformFeeChange: (val: string) => void;
 onCashbackRateChange: (val: string) => void;
 onPawbucksEarnRateChange: (val: string) => void;
 onPawbucksConversionChange: (val: string) => void;
 saving: boolean;
 loading: boolean;
}

export function PlatformFeesCard({
 platformFee, cashbackRate, pawbucksEarnRate, pawbucksConversion,
 onPlatformFeeChange, onCashbackRateChange, onPawbucksEarnRateChange, onPawbucksConversionChange,
 saving, loading,
}: PlatformFeesCardProps) {
 return (
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <DollarSign className="w-5 h-5 text-primary" />
 Success Fees & Rates
 </CardTitle>
 <CardDescription>
 Configure transaction fees, cashback rates, and PawBucks economics
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-5">
 {loading ? (
 <div className="flex items-center justify-center py-8">
 <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
 </div>
 ) : (
 <>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="platform-fee">Success Fee (%)</Label>
 <Input
 id="platform-fee"
 type="number"
 min="0"
 max="100"
 step="0.1"
 value={platformFee}
 onChange={(e) => onPlatformFeeChange(e.target.value)}
 disabled={saving}
 />
 <p className="text-xs text-muted-foreground">
 Percentage charged on each transaction as application fee
 </p>
 </div>
 <div className="space-y-2">
 <Label htmlFor="cashback-rate">Default Cashback Rate (%)</Label>
 <Input
 id="cashback-rate"
 type="number"
 min="0"
 max="100"
 step="0.1"
 value={cashbackRate}
 onChange={(e) => onCashbackRateChange(e.target.value)}
 disabled={saving}
 />
 <p className="text-xs text-muted-foreground">
 Default cashback percentage for merchants without custom rates
 </p>
 </div>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="earn-rate">PawBucks Earn Rate</Label>
 <Input
 id="earn-rate"
 type="number"
 min="0"
 step="1"
 value={pawbucksEarnRate}
 onChange={(e) => onPawbucksEarnRateChange(e.target.value)}
 disabled={saving}
 />
 <p className="text-xs text-muted-foreground">
 PawBucks earned per $1 spent
 </p>
 </div>
 <div className="space-y-2">
 <Label htmlFor="conversion-rate">PawBucks Conversion Rate</Label>
 <Input
 id="conversion-rate"
 type="number"
 min="1"
 step="1"
 value={pawbucksConversion}
 onChange={(e) => onPawbucksConversionChange(e.target.value)}
 disabled={saving}
 />
 <p className="text-xs text-muted-foreground">
 PawBucks needed for $1 credit (e.g. 1000 = 1000 PB per $1)
 </p>
 </div>
 </div>
 </>
 )}
 </CardContent>
 </Card>
 );
}
