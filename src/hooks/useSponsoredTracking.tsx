import { useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type SourcePage = "discover" | "directory" | "map" | "search";
type EventType = "impression" | "click" | "conversion";

interface TrackingEvent {
  merchantId: string;
  type: EventType;
  source: SourcePage;
  position?: number;
  searchQuery?: string;
}

// Generate a session ID for anonymous tracking
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem("tracking_session_id");
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem("tracking_session_id", sessionId);
  }
  return sessionId;
};

// Detect device type
const getDeviceType = (): string => {
  const width = window.innerWidth;
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
};

export function useSponsoredTracking(source: SourcePage) {
  const trackedImpressions = useRef<Set<string>>(new Set());
  const sessionId = useRef<string>(getSessionId());

  // Reset tracked impressions when source changes
  useEffect(() => {
    trackedImpressions.current.clear();
  }, [source]);

  const trackEvent = useCallback(
    async (event: Omit<TrackingEvent, "source">) => {
      try {
        await supabase.functions.invoke('track-analytics', {
          body: {
            type: 'sponsored',
            events: [{
              merchant_id: event.merchantId,
              event_type: event.type,
              source_page: source,
              session_id: sessionId.current,
              search_query: event.searchQuery || null,
              position: event.position || null,
              device_type: getDeviceType(),
            }]
          }
        });
      } catch (err) {
        console.error("Error tracking sponsored event:", err);
      }
    },
    [source]
  );

  const trackImpression = useCallback(
    (merchantId: string, position?: number, searchQuery?: string) => {
      // Only track each impression once per session
      const key = `${merchantId}_${source}`;
      if (trackedImpressions.current.has(key)) {
        return;
      }
      trackedImpressions.current.add(key);

      trackEvent({
        merchantId,
        type: "impression",
        position,
        searchQuery,
      });
    },
    [source, trackEvent]
  );

  const trackClick = useCallback(
    (merchantId: string, position?: number, searchQuery?: string) => {
      trackEvent({
        merchantId,
        type: "click",
        position,
        searchQuery,
      });
    },
    [trackEvent]
  );

  const trackConversion = useCallback(
    (merchantId: string) => {
      trackEvent({
        merchantId,
        type: "conversion",
      });
    },
    [trackEvent]
  );

  // Track impressions for multiple sponsored merchants at once
  const trackSponsoredImpressions = useCallback(
    (sponsoredMerchantIds: string[], searchQuery?: string) => {
      sponsoredMerchantIds.forEach((merchantId, index) => {
        trackImpression(merchantId, index + 1, searchQuery);
      });
    },
    [trackImpression]
  );

  return {
    trackImpression,
    trackClick,
    trackConversion,
    trackSponsoredImpressions,
  };
}
