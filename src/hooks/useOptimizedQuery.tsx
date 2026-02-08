import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useCallback } from 'react';

// Optimized data fetching hook with caching and error handling
export const useOptimizedQuery = <T,>(
  key: readonly unknown[],
  queryFn: () => Promise<T>,
  options?: {
    staleTime?: number;
    cacheTime?: number;
    retry?: number;
    enabled?: boolean;
    refetchOnMount?: boolean | 'always';
    refetchOnWindowFocus?: boolean;
    cacheLevel?: 'short' | 'medium' | 'long';
  }
) => {
  // Smart stale times based on data volatility
  const staleTimeMap = {
    short: 1000 * 30, // 30 seconds - real-time data
    medium: 1000 * 60 * 5, // 5 minutes - default
    long: 1000 * 60 * 15, // 15 minutes - static data
  };

  const staleTime = options?.staleTime ?? 
    (options?.cacheLevel ? staleTimeMap[options.cacheLevel] : staleTimeMap.medium);

  return useQuery({
    queryKey: key,
    queryFn,
    staleTime,
    gcTime: options?.cacheTime ?? 1000 * 60 * 30,
    retry: options?.retry ?? 1,
    enabled: options?.enabled ?? true,
    refetchOnMount: options?.refetchOnMount ?? false,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    networkMode: 'offlineFirst',
    structuralSharing: true,
  });
};

// Optimized mutation hook with automatic cache invalidation
export const useOptimizedMutation = <TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: {
    invalidateKeys?: readonly unknown[][];
    onSuccess?: (data: TData) => void;
    onError?: (error: Error) => void;
    successMessage?: string;
    optimisticUpdate?: {
      key: readonly unknown[];
      updater: (old: unknown, variables: TVariables) => unknown;
    };
  }
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: options?.optimisticUpdate ? async (variables) => {
      await queryClient.cancelQueries({ queryKey: options.optimisticUpdate!.key });
      const previousData = queryClient.getQueryData(options.optimisticUpdate!.key);
      queryClient.setQueryData(options.optimisticUpdate!.key, (old: unknown) => 
        options.optimisticUpdate!.updater(old, variables)
      );
      return { previousData };
    } : undefined,
    onError: (error: any, _, context: any) => {
      // Rollback optimistic update on error
      if (options?.optimisticUpdate && context?.previousData) {
        queryClient.setQueryData(options.optimisticUpdate.key, context.previousData);
      }
      console.error('Mutation error:', error);
      if (options?.onError) {
        options.onError(error);
      } else {
        toast.error(error.message || 'Operation failed');
      }
    },
    onSuccess: (data) => {
      if (options?.invalidateKeys) {
        options.invalidateKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }
      
      if (options?.successMessage) {
        toast.success(options.successMessage);
      }
      
      options?.onSuccess?.(data);
    },
  });
};

// Parallel queries hook for dashboard-style data fetching
export const useParallelQueries = <T extends Record<string, { key: readonly unknown[]; fn: () => Promise<unknown> }>>(
  queries: T
) => {
  const queryConfigs = Object.entries(queries).map(([_, { key, fn }]) => ({
    queryKey: key,
    queryFn: fn,
    staleTime: 1000 * 60 * 5,
    refetchOnMount: false,
    networkMode: 'offlineFirst' as const,
  }));

  const results = useQueries({ queries: queryConfigs });
  
  const isLoading = results.some(r => r.isLoading);
  const isError = results.some(r => r.isError);
  const isFetching = results.some(r => r.isFetching);

  // Map results back to original keys
  const data = Object.keys(queries).reduce((acc, key, index) => {
    acc[key] = results[index];
    return acc;
  }, {} as Record<string, typeof results[0]>);

  return {
    ...data,
    isLoading,
    isError,
    isFetching,
    results,
  };
};

// Prefetch hook for route navigation
export const usePrefetch = () => {
  const queryClient = useQueryClient();

  const prefetch = useCallback(
    <TData,>(key: readonly unknown[], fn: () => Promise<TData>, staleTime = 1000 * 60 * 5) => {
      queryClient.prefetchQuery({
        queryKey: key,
        queryFn: fn,
        staleTime,
      });
    },
    [queryClient]
  );

  const prefetchOnHover = useCallback(
    <TData,>(key: readonly unknown[], fn: () => Promise<TData>) => ({
      onMouseEnter: () => prefetch(key, fn),
      onFocus: () => prefetch(key, fn),
    }),
    [prefetch]
  );

  return { prefetch, prefetchOnHover };
};

// Batch query config helper
export const createBatchQueryConfig = (
  queries: Array<{ key: readonly unknown[]; fn: () => Promise<unknown> }>
) => {
  return queries.map(({ key, fn }) => ({
    queryKey: key,
    queryFn: fn,
    staleTime: 1000 * 60 * 5,
    refetchOnMount: false,
  }));
};
