import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Store, Scissors, Footprints, Home, Stethoscope, Bone } from 'lucide-react';

type Merchant = {
  id: string;
  business_name: string;
  business_type: string;
  latitude?: number;
  longitude?: number;
  cashback_rate: number;
};

interface DiscoverMapProps {
  merchants: Merchant[];
  userLocation: { lat: number; lng: number } | null;
  onMerchantClick: (merchant: Merchant) => void;
}

const getBusinessTypeIcon = (businessType: string): string => {
  const type = businessType.toLowerCase();
  if (type.includes('store') || type.includes('shop')) return 'store';
  if (type.includes('groomer') || type.includes('grooming')) return 'scissors';
  if (type.includes('walker') || type.includes('walking')) return 'shoe';
  if (type.includes('sitter') || type.includes('sitting') || type.includes('boarding')) return 'house';
  if (type.includes('vet') || type.includes('veterinary') || type.includes('clinic')) return 'medical';
  if (type.includes('trainer') || type.includes('training')) return 'treat';
  return 'store';
};

const createMarkerElement = (merchant: Merchant, count: number): HTMLDivElement => {
  const el = document.createElement('div');
  el.className = 'merchant-marker';
  el.style.width = '48px';
  el.style.height = '48px';
  el.style.cursor = 'pointer';
  
  const icon = getBusinessTypeIcon(merchant.business_type);
  const iconSvg = {
    store: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/><path d="M3 9l2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/><path d="M12 3v6"/></svg>',
    scissors: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>',
    shoe: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16s-.5-1-1-2c-.5-.5-.5-1 0-1.5L18.5 2c.5-.5 1-.5 1.5 0l2 2c.5.5.5 1 0 1.5L7.5 20c-.5.5-1 .5-1.5 0-.5-.5-1-.5-1.5-.5L3 20c-.5 0-1-.5-1-1v-2c0-.5.5-1 1-1h1"/></svg>',
    house: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    medical: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>',
    treat: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 22a5 5 0 0 1-2-4"/><path d="M7 16.93c.96.43 1.96.74 2.99.91"/><path d="M3.34 14A6.8 6.8 0 0 1 2 10c0-4.42 4.48-8 10-8s10 3.58 10 8a7.19 7.19 0 0 1-.33 2"/><path d="M5 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>'
  };
  
  el.innerHTML = `
    <div style="
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%);
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      border: 3px solid white;
    ">
      <div style="
        transform: rotate(45deg);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 700;
        font-size: 14px;
      ">
        ${count > 1 ? count : iconSvg[icon as keyof typeof iconSvg] || iconSvg.store}
      </div>
    </div>
  `;
  
  return el;
};

export const DiscoverMap = ({ merchants, userLocation, onMerchantClick }: DiscoverMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);

  // Fetch Mapbox token from edge function
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-mapbox-token`, {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
          }
        }).then(res => res.json());
        
        if (error || !data?.token) {
          console.error('Failed to fetch Mapbox token');
          return;
        }
        
        setMapboxToken(data.token);
      } catch (error) {
        console.error('Error fetching Mapbox token:', error);
      }
    };
    
    fetchToken();
  }, []);

  useEffect(() => {
    if (!mapContainer.current || map.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;
    
    const initialCenter: [number, number] = userLocation 
      ? [userLocation.lng, userLocation.lat]
      : [-118.2437, 34.0522]; // Default to LA

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: initialCenter,
      zoom: 12,
      pitch: 0,
    });

    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: false,
      }),
      'top-right'
    );

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    return () => {
      markers.current.forEach(marker => marker.remove());
      markers.current = [];
      map.current?.remove();
      map.current = null;
    };
  }, [mapboxToken]);

  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clear existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // Group merchants by location
    const locationGroups = new Map<string, Merchant[]>();
    merchants.forEach(merchant => {
      if (merchant.latitude && merchant.longitude) {
        const key = `${merchant.latitude.toFixed(4)},${merchant.longitude.toFixed(4)}`;
        const group = locationGroups.get(key) || [];
        group.push(merchant);
        locationGroups.set(key, group);
      }
    });

    // Add user location marker
    if (userLocation) {
      const userMarker = document.createElement('div');
      userMarker.style.width = '20px';
      userMarker.style.height = '20px';
      userMarker.style.borderRadius = '50%';
      userMarker.style.backgroundColor = '#3B82F6';
      userMarker.style.border = '3px solid white';
      userMarker.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';

      const marker = new mapboxgl.Marker({ element: userMarker })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map.current!);
      
      markers.current.push(marker);
    }

    // Add merchant markers
    locationGroups.forEach((group, key) => {
      const [lat, lng] = key.split(',').map(Number);
      const merchant = group[0];
      
      const el = createMarkerElement(merchant, group.length);
      
      el.addEventListener('click', () => {
        if (group.length === 1) {
          onMerchantClick(group[0]);
        } else {
          // If multiple merchants at same location, zoom in
          map.current?.flyTo({
            center: [lng, lat],
            zoom: Math.min(map.current.getZoom() + 2, 18),
          });
        }
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(map.current!);
      
      markers.current.push(marker);
    });

    // Fit bounds to show all merchants
    if (merchants.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      
      if (userLocation) {
        bounds.extend([userLocation.lng, userLocation.lat]);
      }
      
      merchants.forEach(merchant => {
        if (merchant.latitude && merchant.longitude) {
          bounds.extend([merchant.longitude, merchant.latitude]);
        }
      });

      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 14,
      });
    }
  }, [merchants, userLocation, mapLoaded, onMerchantClick]);

  return (
    <div 
      ref={mapContainer} 
      className="w-full h-full"
      style={{ minHeight: '100%' }}
    />
  );
};
