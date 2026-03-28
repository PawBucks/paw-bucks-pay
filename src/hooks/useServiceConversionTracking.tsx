import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type ConversionEvent = {
  merchant_id: string;
  service_name: string;
  event_type: 'impression' | 'click' | 'profile_view' | 'transaction' | 'review' | 'booking';
  source_page?: string;
  metadata?: Record<string, any>;
};

const SESSION_KEY = 'service_tracking_session';

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/**
 * Hook for tracking conversion events attributed to merchant market services.
 * Uses batching and session-based deduplication for impressions.
 */
export function useServiceConversionTracking() {
  const batchRef = useRef<ConversionEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackedImpressions = useRef<Set<string>>(new Set());

  const flush = useCallback(async () => {
    if (batchRef.current.length === 0) return;
    const events = [...batchRef.current];
    batchRef.current = [];

    const sessionId = getSessionId();
    const payload = events.map(e => ({ ...e, session_id: sessionId }));

    try {
      await supabase.functions.invoke('track-service-conversion', {
        body: { events: payload },
      });
    } catch (err) {
      console.error('Failed to track service conversions:', err);
    }
  }, []);

  const enqueue = useCallback((event: ConversionEvent) => {
    batchRef.current.push(event);
    if (timerRef.current) clearTimeout(timerRef.current);
    // Flush after 2 seconds or when batch hits 20
    if (batchRef.current.length >= 20) {
      flush();
    } else {
      timerRef.current = setTimeout(flush, 2000);
    }
  }, [flush]);

  const trackImpression = useCallback((merchantId: string, serviceName: string, sourcePage: string) => {
    const key = `${merchantId}:${serviceName}:${sourcePage}`;
    if (trackedImpressions.current.has(key)) return;
    trackedImpressions.current.add(key);
    enqueue({
      merchant_id: merchantId,
      service_name: serviceName,
      event_type: 'impression',
      source_page: sourcePage,
    });
  }, [enqueue]);

  const trackClick = useCallback((merchantId: string, serviceName: string, sourcePage: string) => {
    enqueue({
      merchant_id: merchantId,
      service_name: serviceName,
      event_type: 'click',
      source_page: sourcePage,
    });
  }, [enqueue]);

  const trackProfileView = useCallback((merchantId: string, serviceName: string, sourcePage: string) => {
    enqueue({
      merchant_id: merchantId,
      service_name: serviceName,
      event_type: 'profile_view',
      source_page: sourcePage,
    });
  }, [enqueue]);

  const trackTransaction = useCallback((merchantId: string, serviceName: string, amount: number) => {
    enqueue({
      merchant_id: merchantId,
      service_name: serviceName,
      event_type: 'transaction',
      metadata: { amount },
    });
  }, [enqueue]);

  return {
    trackImpression,
    trackClick,
    trackProfileView,
    trackTransaction,
  };
}
