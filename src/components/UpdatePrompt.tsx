import { useEffect } from 'react';
import { checkForUpdates, startBuildVersionPolling } from '@/lib/pwa-utils';

/**
 * Auto-updates app when new version is available
 * No UI shown - updates happen automatically
 */
export const UpdatePrompt = () => {
 useEffect(() => {
    // 1) Service worker path: poll for new SW, auto-reload when one activates.
    const cleanupSW = checkForUpdates(() => {});
    // 2) Fallback path (browsers without SW, or before it installs): poll
    //    /index.html and reload when its hash changes.
    const cleanupVersion = startBuildVersionPolling();
    return () => {
      // checkForUpdates returns Promise<void | cleanup>, normalize.
      Promise.resolve(cleanupSW).then((fn) => typeof fn === 'function' && fn());
      if (typeof cleanupVersion === 'function') cleanupVersion();
    };
 }, []);

 return null;
};
