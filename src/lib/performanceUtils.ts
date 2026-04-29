// Performance optimization utilities - centralized exports

// Query optimization
export { queryKeys, invalidationPatterns } from'./queryKeys';

// Memoization and performance hooks
export {
 withMemo,
 useStableCallback,
 useDeepMemo,
 useDebouncedValue,
 useThrottledCallback,
 useConditionalRender,
 useBatchedState,
} from'./memoization';

// Image optimization
export {
 getSupportedImageFormat,
 optimizeImage,
 generateSrcSet,
 lazyLoadImage,
 preloadCriticalResources,
 isLowEndDevice,
 shouldReduceData,
 getOptimalQuality,
 loadProgressiveImage,
} from'./performance';

// Route prefetching
export {
 prefetchRoute,
 prefetchCriticalRoutes,
 prefetchModule,
 createPrefetchOnHover,
 preloadImage,
 preloadImages,
} from'./prefetch';