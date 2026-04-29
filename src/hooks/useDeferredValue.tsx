import { useDeferredValue as useReactDeferredValue, useTransition, useCallback } from'react';

/**
 * Performance hook for deferring expensive renders.
 * Wraps React's useDeferredValue + useTransition for non-blocking UI updates.
 * 
 * Use for:
 * - Search/filter inputs with large result lists
 * - Expensive computations triggered by user input
 */
export const useDeferredFilter = <T,>(value: T) => {
 const deferredValue = useReactDeferredValue(value);
 const isStale = value !== deferredValue;

 return { deferredValue, isStale };
};

/**
 * Hook for wrapping state updates in transitions (non-blocking).
 * The UI stays responsive while the transition runs in the background.
 */
export const useNonBlockingUpdate = () => {
 const [isPending, startTransition] = useTransition();

 const update = useCallback((fn: () => void) => {
 startTransition(fn);
 }, [startTransition]);

 return { isPending, update };
};
