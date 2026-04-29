import { memo, useMemo, useCallback, ComponentType, useState, useEffect, useRef } from'react';

/**
 * Higher-order component for memoization with deep comparison
 */
export function withMemo<P extends object>(
 Component: ComponentType<P>,
 propsAreEqual?: (prevProps: Readonly<P>, nextProps: Readonly<P>) => boolean
) {
 return memo(Component, propsAreEqual);
}

/**
 * Custom hook for stable callbacks (useCallback with stable reference)
 */
export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
 const callbackRef = useRef(callback);
 callbackRef.current = callback;
 
 return useCallback((...args: Parameters<T>) => {
 return callbackRef.current(...args);
 }, []) as T;
}

/**
 * Hook for memoizing expensive computations with deep comparison
 */
export function useDeepMemo<T>(factory: () => T, deps: unknown[]): T {
 const prevDepsRef = useRef<unknown[]>();
 const valueRef = useRef<T>();

 const depsChanged = !prevDepsRef.current || deps.some((dep, i) => 
 !Object.is(dep, prevDepsRef.current![i])
 );

 if (depsChanged) {
 valueRef.current = factory();
 prevDepsRef.current = deps;
 }

 return valueRef.current as T;
}

/**
 * Debounced value hook for expensive operations
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
 const [debouncedValue, setDebouncedValue] = useState(value);

 useEffect(() => {
 const timer = setTimeout(() => setDebouncedValue(value), delay);
 return () => clearTimeout(timer);
 }, [value, delay]);

 return debouncedValue;
}

/**
 * Throttled callback hook
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
 callback: T,
 delay: number
): T {
 const lastCallRef = useRef(0);
 const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
 const lastArgsRef = useRef<Parameters<T>>();

 return useCallback((...args: Parameters<T>) => {
 const now = Date.now();
 const timeSinceLastCall = now - lastCallRef.current;

 if (timeSinceLastCall >= delay) {
 lastCallRef.current = now;
 return callback(...args);
 } else {
 lastArgsRef.current = args;
 if (!timeoutRef.current) {
 timeoutRef.current = setTimeout(() => {
 lastCallRef.current = Date.now();
 callback(...lastArgsRef.current!);
 timeoutRef.current = undefined;
 }, delay - timeSinceLastCall);
 }
 }
 }, [callback, delay]) as T;
}

/**
 * Hook for conditional rendering optimization
 */
export function useConditionalRender(condition: boolean, delay = 0): boolean {
 const [shouldRender, setShouldRender] = useState(condition);
 const timerRef = useRef<ReturnType<typeof setTimeout>>();

 useEffect(() => {
 if (condition) {
 setShouldRender(true);
 } else {
 timerRef.current = setTimeout(() => setShouldRender(false), delay);
 }
 return () => {
 if (timerRef.current) clearTimeout(timerRef.current);
 };
 }, [condition, delay]);

 return shouldRender;
}

/**
 * Batch state updates for better performance
 */
export function useBatchedState<T extends Record<string, unknown>>(
 initialState: T
): [T, (updates: Partial<T>) => void] {
 const [state, setState] = useState(initialState);

 const batchUpdate = useCallback((updates: Partial<T>) => {
 setState(prev => ({ ...prev, ...updates }));
 }, []);

 return [state, batchUpdate];
}