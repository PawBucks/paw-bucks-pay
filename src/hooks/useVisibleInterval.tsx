import { useEffect } from"react";

/**
 * setInterval that only runs while the tab is visible.
 * Background timers kept forcing re-render churn (and battery drain) on
 * pages left open, which made the app feel sluggish when returning to it.
 */
export const useVisibleInterval = (
 callback: () => void,
 delayMs: number | null
) => {
 useEffect(() => {
 if (delayMs === null) return;

 let id: ReturnType<typeof setInterval> | null = null;

 const start = () => {
 if (id === null) id = setInterval(callback, delayMs);
 };
 const stop = () => {
 if (id !== null) {
 clearInterval(id);
 id = null;
 }
 };

 const onVisibility = () => {
 if (document.visibilityState ==="visible") start();
 else stop();
 };

 onVisibility();
 document.addEventListener("visibilitychange", onVisibility);
 return () => {
 stop();
 document.removeEventListener("visibilitychange", onVisibility);
 };
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [delayMs]);
};