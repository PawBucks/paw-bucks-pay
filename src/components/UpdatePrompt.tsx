import { useEffect } from 'react';
import { checkForUpdates } from '@/lib/pwa-utils';

/**
 * Auto-updates app when new version is available
 * No UI shown - updates happen automatically
 */
export const UpdatePrompt = () => {
  useEffect(() => {
    // checkForUpdates now auto-reloads when update is detected
    checkForUpdates(() => {});
  }, []);

  return null;
};
