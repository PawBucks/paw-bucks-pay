import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

type MerchantMarker = {
  id: string;
  business_name: string;
  business_type: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  cashback_rate: number;
  avg_rating: number;
  review_count: number;
};

interface MerchantMapProps {
  merchants: MerchantMarker[];
  onMerchantClick?: (merchantId: string) => void;
}

export const MerchantMap = ({ merchants, onMerchantClick }: MerchantMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch Mapbox token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        if (data?.token) {
          setMapboxToken(data.token);
        } else {
          setError('Mapbox token not configured');
        }
      } catch (err) {
        console.error('Failed to fetch Mapbox token:', err);
        setError('Failed to load map configuration');
      }
    };
    fetchToken();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    // Default center (US)
    const defaultCenter: [number, number] = [-98.5795, 39.8283];
    const defaultZoom = 3;

    let timeoutId: ReturnType<typeof setTimeout>;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: defaultCenter,
        zoom: defaultZoom,
        attributionControl: false,
      });

      map.current.addControl(
        new mapboxgl.NavigationControl({ visualizePitch: false }),
        'top-right'
      );

      map.current.addControl(
        new mapboxgl.AttributionControl({ compact: true }),
        'bottom-right'
      );

      const handleMapReady = () => {
        // Ensure the map resizes to fill container
        map.current?.resize();
        setLoading(false);
      };

      map.current.on('load', handleMapReady);

      map.current.on('error', (e) => {
        console.error('Mapbox error:', e);
        setError('Failed to load map');
        setLoading(false);
      });

      // Fallback timeout in case 'load' event doesn't fire
      timeoutId = setTimeout(() => {
        if (map.current && !map.current.loaded()) {
          console.warn('Map load timeout - forcing ready state');
          map.current.resize();
          setLoading(false);
        }
      }, 10000);

      return () => {
        clearTimeout(timeoutId);
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];
        map.current?.remove();
        map.current = null;
      };
    } catch (err) {
      console.error('Failed to initialize map:', err);
      setError('Failed to initialize map');
      setLoading(false);
    }
  }, [mapboxToken]);

  // Add markers when merchants change
  useEffect(() => {
    if (!map.current || loading) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Filter merchants with valid coordinates
    const merchantsWithCoords = merchants.filter(
      m => m.latitude && m.longitude
    );

    if (merchantsWithCoords.length === 0) return;

    // Add markers
    merchantsWithCoords.forEach(merchant => {
      const el = document.createElement('div');
      el.className = 'merchant-marker';
      el.innerHTML = `
        <div class="w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform border-2 border-background">
          <svg class="w-4 h-4 text-primary-foreground" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      `;

      const popup = new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(`
        <div class="p-2 min-w-[180px]">
          <h3 class="font-semibold text-sm mb-1">${merchant.business_name}</h3>
          <p class="text-xs text-muted-foreground capitalize mb-1">${merchant.business_type.replace(/_/g, ' ')}</p>
          <div class="flex items-center gap-1 text-xs mb-1">
            <span class="text-yellow-500">★</span>
            <span>${merchant.avg_rating.toFixed(1)}</span>
            <span class="text-muted-foreground">(${merchant.review_count})</span>
          </div>
          <p class="text-xs text-green-600">${merchant.cashback_rate}x points</p>
          ${merchant.address ? `<p class="text-xs text-muted-foreground mt-1 line-clamp-1">${merchant.address}</p>` : ''}
        </div>
      `);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([merchant.longitude!, merchant.latitude!])
        .setPopup(popup)
        .addTo(map.current!);

      el.addEventListener('click', () => {
        if (onMerchantClick) {
          onMerchantClick(merchant.id);
        }
      });

      markersRef.current.push(marker);
    });

    // Fit bounds to show all markers
    if (merchantsWithCoords.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      merchantsWithCoords.forEach(m => {
        bounds.extend([m.longitude!, m.latitude!]);
      });
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 14,
      });
    }
  }, [merchants, loading, onMerchantClick]);

  if (error) {
    return (
      <div className="w-full h-[500px] rounded-lg bg-muted flex items-center justify-center">
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[500px] rounded-lg overflow-hidden border border-border">
      {(loading || !mapboxToken) && (
        <div className="absolute inset-0 bg-muted flex items-center justify-center z-10">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}
      <div 
        ref={mapContainer} 
        className="absolute inset-0 w-full h-full"
        style={{ minHeight: '500px' }}
      />
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-border z-10">
        <p className="text-xs font-medium mb-2">Merchants on Map</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-3 h-3 bg-primary rounded-full"></div>
          <span>{merchants.filter(m => m.latitude && m.longitude).length} locations</span>
        </div>
      </div>
    </div>
  );
};
