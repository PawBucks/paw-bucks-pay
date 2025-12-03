import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Optimized data fetching hook with caching and error handling
export const useOptimizedQuery = <T,>(
  key: string[],
  queryFn: () => Promise<T>,
  options?: {
    staleTime?: number;
    cacheTime?: number;
    retry?: number;
  }
) => {
  return useQuery({
    queryKey: key,
    queryFn,
    staleTime: options?.staleTime || 1000 * 60 * 5, // 5 minutes default
    gcTime: options?.cacheTime || 1000 * 60 * 30, // 30 minutes default
    retry: options?.retry ?? 2,
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
