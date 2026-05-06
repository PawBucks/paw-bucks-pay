import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Store, Lock } from "lucide-react";
import { Formatters } from "@/utils/formatters";
import { useStoreLockedPawBucks } from "@/hooks/useStoreLockedPawBucks";

interface Props {
  userId: string | undefined;
}

export function StoreLockedPawBucksList({ userId }: Props) {
  const { data: balances = [], isLoading } = useStoreLockedPawBucks(userId);

  if (isLoading || balances.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Store className="h-4 w-4 text-primary" />
          In-Store Rewards
          <Badge variant="secondary" className="ml-auto text-xs">
            <Lock className="h-3 w-3 mr-1" />
            Store-locked
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          PawBucks earned at these merchants. Each balance can only be redeemed at the
          store where it was earned.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {balances.map((b) => {
          const usd = (b.balance * 0.001).toFixed(2);
          return (
            <div
              key={b.merchant_id}
              className="flex items-center justify-between rounded-lg border bg-muted/30 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-sm">
                  {b.merchant?.business_name ?? "Merchant"}
                </p>
                {b.merchant?.address && (
                  <p className="truncate text-xs text-muted-foreground">
                    {b.merchant.address}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-primary">
                  {Formatters.number(b.balance)} PB
                </p>
                <p className="text-xs text-muted-foreground">${usd} USD</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}