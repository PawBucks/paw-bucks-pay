import { memo, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { GradientCard } from "@/components/ui/gradient-card";

export const DashboardSkeleton = memo(() => (
  <div className="space-y-8 animate-pulse">
    <div className="grid gap-6 md:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <GradientCard key={i}>
          <div className="flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
        </GradientCard>
      ))}
    </div>
    <div className="space-y-4">
      <Skeleton className="h-8 w-32" />
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map((i) => (
          <GradientCard key={i}>
            <Skeleton className="h-32" />
          </GradientCard>
        ))}
      </div>
    </div>
  </div>
));

DashboardSkeleton.displayName = "DashboardSkeleton";

export const CardListSkeleton = memo(({ count = 3 }: { count?: number }) => {
  const items = useMemo(() => Array.from({ length: count }), [count]);
  
  return (
    <div className="grid gap-4 md:grid-cols-2 animate-pulse">
      {items.map((_, i) => (
        <GradientCard key={i}>
          <div className="space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-9 flex-1" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
        </GradientCard>
      ))}
    </div>
  );
});

CardListSkeleton.displayName = "CardListSkeleton";

export const TableSkeleton = memo(({ rows = 5 }: { rows?: number }) => {
  const items = useMemo(() => Array.from({ length: rows }), [rows]);
  
  return (
    <div className="space-y-3 animate-pulse">
      {items.map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-lg border">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
});

TableSkeleton.displayName = "TableSkeleton";

export const MerchantCardSkeleton = memo(() => (
  <div className="border rounded-xl p-4 space-y-4 animate-pulse">
    <div className="flex gap-4">
      <Skeleton className="w-24 h-24 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
    <Skeleton className="h-10 w-full rounded-lg" />
  </div>
));

MerchantCardSkeleton.displayName = "MerchantCardSkeleton";