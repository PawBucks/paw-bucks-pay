import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { BrandedPawbucksActivity } from "@/services/api/brandCampaigns.service";

interface LiveActivityFeedProps {
  activity: BrandedPawbucksActivity[];
}

export function LiveActivityFeed({ activity }: LiveActivityFeedProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Live Activity Feed
          <span className="relative flex h-2 w-2 ml-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        </CardTitle>
        <CardDescription>Branded PawBucks earned & redeemed in real-time</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {activity.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground px-4">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Activity will appear here as pet owners check in
          </div>
        ) : (
          <ScrollArea className="h-[280px]">
            <div className="px-4 pb-4 space-y-1">
              {activity.map((a) => {
                const isEarn = a.type === "earn";
                const merchantName = a.merchants?.business_name || "Unknown merchant";
                return (
                  <div
                    key={a.id}
                    className="flex items-start gap-3 py-2 border-b last:border-b-0"
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isEarn
                          ? "bg-emerald-500/15 text-emerald-600"
                          : "bg-info/15 text-info"
                      }`}
                    >
                      {isEarn ? (
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDownRight className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-semibold tabular-nums">
                          {Math.abs(a.amount).toLocaleString()} PB
                        </span>{" "}
                        <span className="text-muted-foreground">
                          {isEarn ? "distributed at" : "redeemed at"}
                        </span>{" "}
                        <span className="font-medium">{merchantName}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
