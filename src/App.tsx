/**
 * Main App component with routing and providers
 * Cache bust: 2026-03-30T17:00:00Z
 */
import { Suspense, useEffect } from "react";
...
const queryClient = createQueryClient();

const App = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <NetworkStatus />
            <UpdatePrompt />
            <PWAInstallBanner />
            
            <AppContent />
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;