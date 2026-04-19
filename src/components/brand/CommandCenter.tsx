import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  getCommandCenterSummary,
  getBrandDailyStats,
  getBrandMerchantLeaderboard,
  getBrandRecentActivity,
} from "@/services/api/brandCampaigns.service";
import { HeroMetrics } from "./HeroMetrics";
import { SpendChart } from "./SpendChart";
import { MerchantLeaderboard } from "./MerchantLeaderboard";
import { LiveActivityFeed } from "./LiveActivityFeed";
import { ConversionFunnel } from "./ConversionFunnel";

interface CommandCenterProps {
  brandId: string;
}

export function CommandCenter({ brandId }: CommandCenterProps) {
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["brand-cc-summary", brandId],
    queryFn: async () => {
      const { data, error } = await getCommandCenterSummary(brandId);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // refresh every 30s for live feel
  });

  const { data: dailyStats = [] } = useQuery({
    queryKey: ["brand-daily-stats", brandId],
    queryFn: async () => {
      const { data, error } = await getBrandDailyStats(brandId, 30);
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ["brand-leaderboard", brandId],
    queryFn: async () => {
      const { data, error } = await getBrandMerchantLeaderboard(brandId, 5);
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

  const { data: activity = [] } = useQuery({
    queryKey: ["brand-recent-activity", brandId],
    queryFn: async () => {
      const { data, error } = await getBrandRecentActivity(brandId, 25);
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000, // most live
  });

  if (summaryLoading || !summary) {
    return (
      <div className="py-12 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <HeroMetrics summary={summary} />

      <div className="grid lg:grid-cols-2 gap-4">
        <SpendChart stats={dailyStats} />
        <ConversionFunnel summary={summary} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <MerchantLeaderboard entries={leaderboard} />
        <LiveActivityFeed activity={activity} />
      </div>
    </div>
  );
}
