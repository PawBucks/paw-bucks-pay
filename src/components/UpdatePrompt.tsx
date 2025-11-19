import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { checkForUpdates } from '@/lib/pwa-utils';

/**
 * Prompts user to update when new version is available
 */
export const UpdatePrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    checkForUpdates(() => {
      setShowPrompt(true);
    });
  }, []);

  const handleUpdate = () => {
    window.location.reload();
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-lg bg-card border shadow-lg backdrop-blur-sm max-w-sm animate-scale-in">
      <div className="flex items-center gap-3">
        <RefreshCw className="w-5 h-5 text-accent flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium">Update available</p>
          <p className="text-xs text-muted-foreground">A new version is ready</p>
        </div>
        <Button size="sm" onClick={handleUpdate} className="flex-shrink-0">
          Update
        </Button>
      </div>
    </div>
  );
};
