import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * Hook to prefetch data on hover for improved perceived performance
 */
export const usePrefetchOnHover = () => {
  const queryClient = useQueryClient();

  const prefetchQuery = useCallback(
    (queryKey: string[], queryFn: () => Promise<any>) => {
      return () => {
        queryClient.prefetchQuery({
          queryKey,
          queryFn,
          staleTime: 1000 * 60 * 5, // 5 minutes
        });
      };
    },
    [queryClient]
  );

  return { prefetchQuery };
};
