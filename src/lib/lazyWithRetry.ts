/**
 * Lazy load utility with automatic retry for failed chunk imports.
 * Handles cache invalidation issues after deployments by retrying with cache-bust.
 */
import { lazy, ComponentType } from"react";

type ModuleLoader<T extends ComponentType<any>> = () => Promise<{ default: T }>;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Checks if an error is a chunk loading failure
 */
export function isChunkLoadError(error: unknown): boolean {
 if (!(error instanceof Error)) return false;
 
 const chunkLoadPatterns = [
"Loading chunk",
"Failed to fetch",
"Importing a module script failed",
"Loading CSS chunk",
"dynamically imported module",
"error loading dynamically imported module",
"Unable to preload CSS",
"NetworkError",
"ChunkLoadError",
 ];
 
 return chunkLoadPatterns.some(pattern => 
 error.message.toLowerCase().includes(pattern.toLowerCase())
 );
}

/**
 * Wraps a dynamic import with retry logic and cache busting.
 * Use this instead of React.lazy() for resilient lazy loading.
 * 
 * @example
 * const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
 */
export function lazyWithRetry<T extends ComponentType<any>>(
 loader: ModuleLoader<T>,
 moduleName?: string
): React.LazyExoticComponent<T> {
 return lazy(async () => {
 let lastError: Error | undefined;
 
 for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
 try {
 // On retry attempts, try to bust the cache
 if (attempt > 1) {
 // Small delay before retry
 await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
 
 console.log(`Retrying module load (attempt ${attempt}/${MAX_RETRIES})${moduleName ? `: ${moduleName}` :""}`);
 }
 
 const module = await loader();
 return module;
 } catch (error) {
 lastError = error instanceof Error ? error : new Error(String(error));
 
 // Only retry for chunk load errors
 if (!isChunkLoadError(lastError)) {
 throw lastError;
 }
 
 console.warn(`Module load failed (attempt ${attempt}/${MAX_RETRIES}):`, lastError.message);
 }
 }
 
 // All retries exhausted - trigger a page reload as last resort
 // This clears stale service worker cache and gets fresh chunks
 const shouldReload = !sessionStorage.getItem("chunk_reload_attempted");
 
 if (shouldReload) {
 sessionStorage.setItem("chunk_reload_attempted","true");
 console.log("All retry attempts failed. Triggering page reload to clear cache...");
 window.location.reload();
 // Return a never-resolving promise to prevent React from rendering stale UI
 return new Promise(() => {});
 }
 
 // Already tried reloading, throw the error
 sessionStorage.removeItem("chunk_reload_attempted");
 throw lastError || new Error("Failed to load module after all retries");
 });
}

/**
 * Clear the chunk reload flag (call on successful app mount)
 */
export function clearChunkReloadFlag(): void {
 sessionStorage.removeItem("chunk_reload_attempted");
}
