import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Optimized data fetching hook with caching and error handling
export const useOptimizedQuery = <T,>(
  key: string[],
  queryFn: () => Promise<T>,
  options?: {
    staleTime?: number;
    cacheTime?: number;
    retry?: number;
    enabled?: boolean;
    refetchOnMount?: boolean | 'always';
    refetchOnWindowFocus?: boolean;
  }
) => {
  return useQuery({
    queryKey: key,
    queryFn,
    staleTime: options?.staleTime ?? 1000 * 60 * 5, // 5 minutes default
    gcTime: options?.cacheTime ?? 1000 * 60 * 30, // 30 minutes default
    retry: options?.retry ?? 1, // Reduced retries for faster failure
    enabled: options?.enabled ?? true,
    refetchOnMount: options?.refetchOnMount ?? false, // Don't refetch if data is fresh
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    // Optimize network requests - use cached data first
    networkMode: 'offlineFirst',
    // Structural sharing for better re-render optimization
    structuralSharing: true,
  });
};

// Optimized mutation hook with automatic cache invalidation
export const useOptimizedMutation = <TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: {
    invalidateKeys?: string[][];
    onSuccess?: (data: TData) => void;
    onError?: (error: Error) => void;
    successMessage?: string;
  }
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      // Invalidate related queries
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
    onError: (error: any) => {
      console.error('Mutation error:', error);
      if (options?.onError) {
        options.onError(error);
      } else {
        toast.error(error.message || 'Operation failed');
      }
    },
  });
};

// Batch query fetcher - fetches multiple queries in parallel
// Note: This is a wrapper that should be used at component level with separate hooks
export const createBatchQueryConfig = (
  queries: Array<{ key: string[]; fn: () => Promise<any> }>
) => {
  return queries.map(({ key, fn }) => ({
    queryKey: key,
    queryFn: fn,
    staleTime: 1000 * 60 * 5,
  }));
};
