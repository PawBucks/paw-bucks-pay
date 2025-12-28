import { memo, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { GradientCard } from "@/components/ui/gradient-card";
import { cn } from "@/lib/utils";

export const DashboardSkeleton = memo(() => (
  <div className="space-y-8" role="status" aria-label="Loading dashboard">
    <span className="sr-only">Loading dashboard content...</span>
    <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <GradientCard key={i}>
          <div className="flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-full skeleton-pulse" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-20 skeleton-pulse" />
              <Skeleton className="h-6 w-24 skeleton-pulse" />
            </div>
          </div>
        </GradientCard>
      ))}
    </div>
    <div className="space-y-4">
      <Skeleton className="h-8 w-32 skeleton-pulse" />
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map((i) => (
          <GradientCard key={i}>
            <Skeleton className="h-32 skeleton-pulse" />
          </GradientCard>
        ))}
      </div>
    </div>
  </div>
));

DashboardSkeleton.displayName = "DashboardSkeleton";

export const CardListSkeleton = memo(({ count = 3, className }: { count?: number; className?: string }) => {
  const items = useMemo(() => Array.from({ length: count }), [count]);
  
  return (
    <div className={cn("grid gap-4 md:grid-cols-2", className)} role="status" aria-label="Loading content">
      <span className="sr-only">Loading content...</span>
      {items.map((_, i) => (
        <GradientCard key={i}>
          <div className="space-y-3">
            <Skeleton className="h-6 w-3/4 skeleton-pulse" />
            <Skeleton className="h-4 w-full skeleton-pulse" />
            <Skeleton className="h-4 w-2/3 skeleton-pulse" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-9 flex-1 skeleton-pulse" />
              <Skeleton className="h-9 w-24 skeleton-pulse" />
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
    <div className="space-y-3" role="status" aria-label="Loading table">
      <span className="sr-only">Loading table data...</span>
      {items.map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-lg border">
          <Skeleton className="w-10 h-10 rounded-full skeleton-pulse" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3 skeleton-pulse" />
            <Skeleton className="h-3 w-1/4 skeleton-pulse" />
          </div>
          <Skeleton className="h-8 w-20 skeleton-pulse" />
        </div>
      ))}
    </div>
  );
});

TableSkeleton.displayName = "TableSkeleton";

export const MerchantCardSkeleton = memo(() => (
  <div className="border rounded-xl p-4 space-y-4" role="status" aria-label="Loading merchant">
    <span className="sr-only">Loading merchant information...</span>
    <div className="flex gap-4">
      <Skeleton className="w-24 h-24 rounded-lg skeleton-pulse" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-6 w-2/3 skeleton-pulse" />
        <Skeleton className="h-4 w-1/3 skeleton-pulse" />
        <Skeleton className="h-4 w-1/2 skeleton-pulse" />
      </div>
    </div>
    <Skeleton className="h-10 w-full rounded-lg skeleton-pulse" />
  </div>
));

MerchantCardSkeleton.displayName = "MerchantCardSkeleton";

export const PageSkeleton = memo(() => (
  <div className="min-h-screen bg-background" role="status" aria-label="Loading page">
    <span className="sr-only">Loading page content...</span>
    <div className="border-b p-4">
      <div className="container mx-auto flex items-center justify-between">
        <Skeleton className="h-12 w-32 skeleton-pulse" />
        <Skeleton className="h-10 w-24 skeleton-pulse" />
      </div>
    </div>
    <div className="container mx-auto px-4 py-8">
      <DashboardSkeleton />
    </div>
  </div>
));

PageSkeleton.displayName = "PageSkeleton";