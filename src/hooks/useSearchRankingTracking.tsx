import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

type SearchRankingEvent = {
  merchantId: string;
  eventType: 'impression' | 'click' | 'conversion';
  searchTerm?: string;
  position?: number;
  sourcePage: 'discover' | 'directory' | 'map' | 'search';
  isBoosted?: boolean;
  categoryMatch?: boolean;
  localMatch?: boolean;
};

export function useSearchRankingTracking() {
  const sessionId = useRef<string>(
    typeof window !== 'undefined' 
      ? sessionStorage.getItem('search_session_id') || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      : ''
  );
  const trackedImpressions = useRef<Set<string>>(new Set());

  // Store session ID
  if (typeof window !== 'undefined' && !sessionStorage.getItem('search_session_id')) {
    sessionStorage.setItem('search_session_id', sessionId.current);
  }

  const getDeviceType = (): string => {
    if (typeof window === 'undefined') return 'unknown';
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  };

  const trackSearchImpression = useCallback(async (
    merchantId: string,
    position: number,
    sourcePage: SearchRankingEvent['sourcePage'],
    options: {
      searchTerm?: string;
      isBoosted?: boolean;
      categoryMatch?: boolean;
      localMatch?: boolean;
    } = {}
  ) => {
    // Prevent duplicate impressions in same session
    const impressionKey = `${merchantId}_${sourcePage}_${sessionId.current}`;
    if (trackedImpressions.current.has(impressionKey)) return;
    trackedImpressions.current.add(impressionKey);

    try {
      await supabase.functions.invoke('track-analytics', {
        body: {
          type: 'search_ranking',
          events: [{
            merchant_id: merchantId,
            event_type: 'impression',
            search_term: options.searchTerm || null,
            position,
            source_page: sourcePage,
            session_id: sessionId.current,
            device_type: getDeviceType(),
            is_boosted: options.isBoosted || false,
            category_match: options.categoryMatch || false,
            local_match: options.localMatch || false,
          }]
        }
      });
    } catch (error) {
      console.error('Error tracking search impression:', error);
    }
  }, []);

  const trackSearchClick = useCallback(async (
    merchantId: string,
    position: number | undefined,
    sourcePage: SearchRankingEvent['sourcePage'],
    options: {
      searchTerm?: string;
      isBoosted?: boolean;
    } = {}
  ) => {
    try {
      await supabase.functions.invoke('track-analytics', {
        body: {
          type: 'search_ranking',
          events: [{
            merchant_id: merchantId,
            event_type: 'click',
            search_term: options.searchTerm || null,
            position: position || null,
            source_page: sourcePage,
            session_id: sessionId.current,
            device_type: getDeviceType(),
            is_boosted: options.isBoosted || false,
          }]
        }
      });
    } catch (error) {
      console.error('Error tracking search click:', error);
    }
  }, []);

  const trackSearchConversion = useCallback(async (
    merchantId: string,
    sourcePage: SearchRankingEvent['sourcePage'],
    options: {
      searchTerm?: string;
    } = {}
  ) => {
    try {
      await supabase.functions.invoke('track-analytics', {
        body: {
          type: 'search_ranking',
          events: [{
            merchant_id: merchantId,
            event_type: 'conversion',
            search_term: options.searchTerm || null,
            source_page: sourcePage,
            session_id: sessionId.current,
            device_type: getDeviceType(),
          }]
        }
      });
    } catch (error) {
      console.error('Error tracking search conversion:', error);
    }
  }, []);

  const trackBatchImpressions = useCallback(async (
    merchants: Array<{
      id: string;
      position: number;
      isBoosted?: boolean;
      categoryMatch?: boolean;
      localMatch?: boolean;
    }>,
    sourcePage: SearchRankingEvent['sourcePage'],
    searchTerm?: string
  ) => {
    const newImpressions = merchants.filter(m => {
      const key = `${m.id}_${sourcePage}_${sessionId.current}`;
      if (trackedImpressions.current.has(key)) return false;
      trackedImpressions.current.add(key);
      return true;
    });

    if (newImpressions.length === 0) return;

    try {
      const deviceType = getDeviceType();
      
      const events = newImpressions.map(m => ({
        merchant_id: m.id,
        event_type: 'impression',
        search_term: searchTerm || null,
        position: m.position,
        source_page: sourcePage,
        session_id: sessionId.current,
        device_type: deviceType,
        is_boosted: m.isBoosted || false,
        category_match: m.categoryMatch || false,
        local_match: m.localMatch || false,
      }));

      await supabase.functions.invoke('track-analytics', {
        body: {
          type: 'search_ranking',
          events
        }
      });
    } catch (error) {
      console.error('Error tracking batch impressions:', error);
    }
  }, []);

  return {
    trackSearchImpression,
    trackSearchClick,
    trackSearchConversion,
    trackBatchImpressions,
  };
}
