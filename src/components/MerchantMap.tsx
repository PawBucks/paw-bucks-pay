import { useEffect, useRef, useState } from'react';
import mapboxgl from'mapbox-gl';
import'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from'@/integrations/supabase/client';
import { Loader2 } from'lucide-react';

import { Formatters } from "@/utils/formatters";
export type MerchantTier ='featured' |'premium' |'sponsored' |'boosted' |'organic';

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
 tier?: MerchantTier;
};

interface MerchantMapProps {
 merchants: MerchantMarker[];
 onMerchantClick?: (merchantId: string) => void;
 /** Set of Featured Partner merchant IDs */
 featuredIds?: Set<string>;
 /** Set of Premium Ad merchant IDs */
 premiumIds?: Set<string>;
 /** Set of Sponsored merchant IDs */
 sponsoredIds?: Set<string>;
 /** Optional user location to center the map on initial load. */
 userLocation?: { latitude: number; longitude: number } | null;
}

const TIER_CONFIG: Record<MerchantTier, { size: number; color: string; borderColor: string; zIndex: number }> = {
 featured: { size: 44, color:'#d97706', borderColor:'#fbbf24', zIndex: 50 }, // amber
 premium: { size: 36, color:'hsl(var(--primary))', borderColor:'hsl(var(--primary))', zIndex: 40 },
 sponsored: { size: 32, color:'hsl(var(--primary))', borderColor:'hsl(var(--border))', zIndex: 30 },
 boosted: { size: 28, color:'hsl(var(--muted-foreground))', borderColor:'hsl(var(--border))', zIndex: 20 },
 organic: { size: 24, color:'hsl(var(--muted-foreground))', borderColor:'hsl(var(--border))', zIndex: 10 },
};

export const MerchantMap = ({ merchants, onMerchantClick, featuredIds, premiumIds, sponsoredIds, userLocation }: MerchantMapProps) => {
 const mapContainer = useRef<HTMLDivElement>(null);
 const map = useRef<mapboxgl.Map | null>(null);
 const markersRef = useRef<mapboxgl.Marker[]>([]);
 const userInteractedRef = useRef(false);
 const hasFitInitialRef = useRef(false);
 const userLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
 userLocationRef.current = userLocation ?? null;
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

  const defaultCenter: [number, number] = userLocation
    ? [userLocation.longitude, userLocation.latitude]
    : [-118.4695, 33.9850]; // LA area for launch zones
  const defaultZoom = userLocation ? 12 : 11;

 let timeoutId: ReturnType<typeof setTimeout>;

 try {
 map.current = new mapboxgl.Map({
 container: mapContainer.current,
 style:'mapbox://styles/mapbox/light-v11',
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
 map.current?.resize();
 setLoading(false);
 };

 map.current.on('load', handleMapReady);

  // Detect user-initiated interaction so we stop auto-fitting bounds.
  const markInteracted = (e: any) => {
   if (e?.originalEvent) userInteractedRef.current = true;
  };
  map.current.on('dragstart', markInteracted);
  map.current.on('zoomstart', markInteracted);
  map.current.on('rotatestart', markInteracted);

 map.current.on('error', (e) => {
 console.error('Mapbox error:', e);
 setError('Failed to load map');
 setLoading(false);
 });

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

 // Determine merchant tier
 const getMerchantTier = (merchant: MerchantMarker): MerchantTier => {
 if (merchant.tier) return merchant.tier;
 if (featuredIds?.has(merchant.id)) return'featured';
 if (premiumIds?.has(merchant.id)) return'premium';
 if (sponsoredIds?.has(merchant.id)) return'sponsored';
 return'organic';
 };

 // Add markers when merchants change
 useEffect(() => {
 if (!map.current || loading) return;

 markersRef.current.forEach(marker => marker.remove());
 markersRef.current = [];

 const merchantsWithCoords = merchants.filter(
 m => m.latitude && m.longitude
 );

 if (merchantsWithCoords.length === 0) return;

 const escapeHtml = (text: string): string => {
 const div = document.createElement('div');
 div.textContent = text;
 return div.innerHTML;
 };

 // At wider zoom, filter to only featured + top organic
 const currentZoom = map.current.getZoom();
 let visibleMerchants = merchantsWithCoords;
 
 // Sort by tier priority, then by rating for filtering at wide zoom
 const tierPriority: Record<MerchantTier, number> = { featured: 0, premium: 1, sponsored: 2, boosted: 3, organic: 4 };
 
 visibleMerchants = [...merchantsWithCoords].sort((a, b) => {
 const tierA = tierPriority[getMerchantTier(a)];
 const tierB = tierPriority[getMerchantTier(b)];
 if (tierA !== tierB) return tierA - tierB;
 return b.avg_rating - a.avg_rating;
 });

 // At wide zoom (<10), only show Featured + top 3 organic by rating
 if (currentZoom < 10) {
 const featured = visibleMerchants.filter(m => getMerchantTier(m) ==='featured');
 const topOrganic = visibleMerchants
 .filter(m => getMerchantTier(m) !=='featured')
 .sort((a, b) => b.avg_rating - a.avg_rating)
 .slice(0, 3);
 visibleMerchants = [...featured, ...topOrganic];
 }

  visibleMerchants.forEach(merchant => {
 const tier = getMerchantTier(merchant);
 const config = TIER_CONFIG[tier];

 const el = document.createElement('div');
 el.className ='merchant-marker';
 el.style.zIndex = String(config.zIndex);

 const markerWrapper = document.createElement('div');
 markerWrapper.style.width = `${config.size}px`;
 markerWrapper.style.height = `${config.size}px`;
 markerWrapper.style.borderRadius ='50%';
 markerWrapper.style.display ='flex';
 markerWrapper.style.alignItems ='center';
 markerWrapper.style.justifyContent ='center';
 markerWrapper.style.cursor ='pointer';
 markerWrapper.style.transition ='transform 0.2s ease';
 markerWrapper.style.boxShadow = tier ==='featured' 
 ?'0 4px 16px -2px rgba(217, 119, 6, 0.4)' 
 : tier ==='premium'
 ?'0 3px 12px -2px rgba(0,0,0,0.15)'
 :'0 2px 8px -2px rgba(0,0,0,0.1)';
 
 // Apply tier-specific colors
 if (tier ==='featured') {
 markerWrapper.style.background ='linear-gradient(135deg, #d97706, #f59e0b)';
 markerWrapper.style.border ='3px solid #fbbf24';
 } else if (tier ==='premium') {
 markerWrapper.style.background ='hsl(var(--primary))';
 markerWrapper.style.border ='2px solid hsl(var(--background))';
 } else if (tier ==='sponsored') {
 markerWrapper.style.background ='hsl(var(--primary))';
 markerWrapper.style.border ='2px solid hsl(var(--border))';
 markerWrapper.style.opacity ='0.85';
 } else {
 markerWrapper.style.background ='hsl(var(--muted-foreground))';
 markerWrapper.style.border ='1.5px solid hsl(var(--border))';
 markerWrapper.style.opacity ='0.7';
 }

 markerWrapper.addEventListener('mouseenter', () => {
 markerWrapper.style.transform ='scale(1.15)';
 });
 markerWrapper.addEventListener('mouseleave', () => {
 markerWrapper.style.transform ='scale(1)';
 });

 const iconSize = Math.max(config.size * 0.45, 12);
 const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('width', String(iconSize));
 svg.setAttribute('height', String(iconSize));
 svg.setAttribute('fill','white');
 svg.setAttribute('viewBox','0 0 24 24');

 const path = document.createElementNS('http://www.w3.org/2000/svg','path');
 if (tier ==='featured') {
 // Crown icon for featured
 path.setAttribute('d','M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z');
 } else {
 // Location pin for others
 path.setAttribute('d','M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z');
 }

 svg.appendChild(path);
 markerWrapper.appendChild(svg);
 el.appendChild(markerWrapper);

 const safeName = escapeHtml(merchant.business_name);
 const safeType = escapeHtml(merchant.business_type.replace(/_/g, ' '));
 const safeAddress = merchant.address ? escapeHtml(merchant.address) :'';

 const tierLabel = tier ==='featured' ?'<span style="color:#d97706;font-weight:600;font-size:10px;">★ Featured Partner</span><br/>' :
 tier ==='premium' ?'<span style="color:hsl(var(--primary));font-size:10px;">◆ Premium</span><br/>' :
 tier ==='sponsored' ?'<span style="font-size:10px;color:#888;">Sponsored</span><br/>' :'';

 const popup = new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(`
 <div class="p-2 min-w-[180px]">
 ${tierLabel}
 <h3 class="font-semibold text-sm mb-1">${safeName}</h3>
 <p class="text-xs text-muted-foreground capitalize mb-1">${safeType}</p>
 <div class="flex items-center gap-1 text-xs mb-1">
 <span class="text-warning">★</span>
 <span>${Formatters.decimal((merchant.avg_rating ?? 0), 1)}</span>
 <span class="text-muted-foreground">(${merchant.review_count ?? 0})</span>
 </div>
 <p class="text-xs text-success">${merchant.cashback_rate}x points</p>
 ${safeAddress ? `<p class="text-xs text-muted-foreground mt-1 line-clamp-1">${safeAddress}</p>` :''}
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

  // Fit bounds ONLY on the initial render and only if the user hasn't
  // interacted with the map yet. Subsequent merchant/filter changes must
  // not yank the camera away from where the user is looking.
  if (
   visibleMerchants.length > 0 &&
   !hasFitInitialRef.current &&
   !userInteractedRef.current
  ) {
   if (userLocationRef.current) {
    // Keep the user-centered view; do not auto-fit to all merchants.
    map.current.easeTo({
     center: [userLocationRef.current.longitude, userLocationRef.current.latitude],
     zoom: 12,
     duration: 0,
    });
   } else {
    const bounds = new mapboxgl.LngLatBounds();
    visibleMerchants.forEach(m => {
     bounds.extend([m.longitude!, m.latitude!]);
    });
    map.current.fitBounds(bounds, {
     padding: 50,
     maxZoom: 14,
    });
   }
   hasFitInitialRef.current = true;
  }

 // Re-filter on zoom change
 const handleZoom = () => {
 // Trigger re-render of markers on significant zoom change
 };
 map.current.on('zoomend', handleZoom);

 return () => {
 map.current?.off('zoomend', handleZoom);
 };
 }, [merchants, loading, onMerchantClick, featuredIds, premiumIds, sponsoredIds]);

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
 style={{ minHeight:'500px' }}
 />
 
 {/* Legend */}
 <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-border z-10">
 <p className="text-xs font-medium mb-2">Map Legend</p>
 <div className="space-y-1.5">
 <div className="flex items-center gap-2 text-xs text-muted-foreground">
 <div className="w-4 h-4 rounded-full bg-gradient-to-br from-warning to-warning border-2 border-warning/30 flex-shrink-0" />
 <span>Featured Partner</span>
 </div>
 <div className="flex items-center gap-2 text-xs text-muted-foreground">
 <div className="w-3.5 h-3.5 rounded-full bg-primary border-2 border-background flex-shrink-0" />
 <span>Premium</span>
 </div>
 <div className="flex items-center gap-2 text-xs text-muted-foreground">
 <div className="w-3 h-3 rounded-full bg-primary/85 border border-border flex-shrink-0" />
 <span>Sponsored</span>
 </div>
 <div className="flex items-center gap-2 text-xs text-muted-foreground">
 <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/70 border border-border flex-shrink-0" />
 <span>{merchants.filter(m => m.latitude && m.longitude).length} locations</span>
 </div>
 </div>
 </div>
 </div>
 );
};
