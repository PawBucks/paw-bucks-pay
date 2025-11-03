import { Skeleton } from "@/components/ui/skeleton";
import { GradientCard } from "@/components/ui/gradient-card";

export const DashboardSkeleton = () => (
  <div className="space-y-8">
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
);

export const CardListSkeleton = ({ count = 3 }: { count?: number }) => (
  <div className="grid gap-4 md:grid-cols-2">
    {Array.from({ length: count }).map((_, i) => (
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

export const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
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
