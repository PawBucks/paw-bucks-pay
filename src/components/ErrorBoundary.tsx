import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { GradientCard } from '@/components/ui/gradient-card';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { isChunkLoadError } from '@/lib/lazyWithRetry';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  isChunkError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    const isChunkError = isChunkLoadError(error);
    return { hasError: true, error, isChunkError };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    
    // For chunk load errors, attempt automatic recovery
    if (isChunkLoadError(error)) {
      const reloadAttempted = sessionStorage.getItem("error_boundary_reload");
      
      if (!reloadAttempted) {
        sessionStorage.setItem("error_boundary_reload", "true");
        console.log("Chunk load error detected. Attempting automatic reload...");
        // Small delay to ensure the flag is set before reload
        setTimeout(() => window.location.reload(), 100);
        return;
      }
      
      // Already tried, clear the flag for next time
      sessionStorage.removeItem("error_boundary_reload");
    }
  }

  handleReset = () => {
    // Clear any reload flags
    sessionStorage.removeItem("error_boundary_reload");
    sessionStorage.removeItem("chunk_reload_attempted");
    
    this.setState({ hasError: false, error: undefined, isChunkError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { isChunkError, error } = this.state;
      
      // Custom message for chunk loading errors
      const title = isChunkError ? "Connection Issue" : "Something went wrong";
      const message = isChunkError 
        ? "A new version of the app is available, or there was a network issue. Please reload the page."
        : (error?.message || 'An unexpected error occurred');

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <GradientCard className="max-w-md w-full text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">{title}</h2>
              <p className="text-muted-foreground mb-4">
                {message}
              </p>
            </div>
            <Button onClick={this.handleReset} className="w-full">
              <RefreshCcw className="w-4 h-4 mr-2" />
              Reload Page
            </Button>
          </GradientCard>
        </div>
      );
    }

    return this.props.children;
  }
}
