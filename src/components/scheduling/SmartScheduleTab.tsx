import { useState, useEffect, useCallback, useRef } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { Calendar } from"@/components/ui/calendar";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from"@/components/ui/popover";
import { Separator } from"@/components/ui/separator";
import { toast } from"sonner";
import { format, startOfDay, isSameDay } from"date-fns";
import { 
 MapPin, 
 Navigation, 
 Clock, 
 Route as RouteIcon, 
 Loader2, 
 CalendarIcon, 
 Fuel, 
 TrendingDown, 
 CheckCircle2, 
 Car,
 Play,
 SkipForward,
 ArrowRight,
 Users
} from"lucide-react";
import mapboxgl from"mapbox-gl";
import"mapbox-gl/dist/mapbox-gl.css";

interface RouteStop {
 id: string;
 stop_order: number;
 address: string;
 latitude: number;
 longitude: number;
 drive_duration_minutes: number | null;
 drive_distance_miles: number | null;
 status: string;
 customer_name: string | null;
 service_name: string | null;
 booking_id: string | null;
 estimated_arrival: string | null;
}

interface RoutePlan {
 id: string;
 route_date: string;
 status: string;
 total_distance_miles: number | null;
 total_duration_minutes: number | null;
 estimated_savings_minutes: number | null;
 mapbox_route_geometry: string | null;
 start_address: string | null;
 start_latitude: number | null;
 start_longitude: number | null;
}

interface Props {
 merchantId: string;
}

export function SmartScheduleTab({ merchantId }: Props) {
 const [selectedDate, setSelectedDate] = useState<Date>(new Date());
 const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null);
 const [stops, setStops] = useState<RouteStop[]>([]);
 const [loading, setLoading] = useState(false);
 const [optimizing, setOptimizing] = useState(false);
 const [startAddress, setStartAddress] = useState("");
 const [mapboxToken, setMapboxToken] = useState<string | null>(null);
 const mapContainerRef = useRef<HTMLDivElement>(null);
 const mapRef = useRef<mapboxgl.Map | null>(null);

 // Fetch mapbox token
 useEffect(() => {
 supabase.functions.invoke("get-mapbox-token").then(({ data }) => {
 if (data?.token) setMapboxToken(data.token);
 });
 }, []);

 // Load existing route plan for selected date
 const loadRoutePlan = useCallback(async () => {
 setLoading(true);
 try {
 const dateStr = format(selectedDate,"yyyy-MM-dd");

 // Load route plan
 const { data: plan } = await supabase
 .from("merchant_route_plans")
 .select("*")
 .eq("merchant_id", merchantId)
 .eq("route_date", dateStr)
 .maybeSingle();

 setRoutePlan(plan);

 if (plan) {
 const { data: routeStops } = await supabase
 .from("route_stops")
 .select("*")
 .eq("route_plan_id", plan.id)
 .order("stop_order");
 setStops(routeStops || []);
 } else {
 // Load mobile bookings for this date that could become stops
 const { data: bookings } = await supabase
 .from("service_bookings")
 .select("id, service_address, service_latitude, service_longitude, customer_name, start_time, end_time, merchant_services(name)")
 .eq("merchant_id", merchantId)
 .eq("booking_date", dateStr)
 .not("status","eq","cancelled")
 .not("service_latitude","is", null);

 if (bookings && bookings.length > 0) {
 const autoStops: RouteStop[] = bookings.map((b: any, i: number) => ({
 id: b.id,
 stop_order: i + 1,
 address: b.service_address ||"Client location",
 latitude: b.service_latitude,
 longitude: b.service_longitude,
 drive_duration_minutes: null,
 drive_distance_miles: null,
 status:"pending",
 customer_name: b.customer_name,
 service_name: b.merchant_services?.name ||"Service",
 booking_id: b.id,
 estimated_arrival: null,
 }));
 setStops(autoStops);
 } else {
 setStops([]);
 }
 }
 } catch (error) {
 console.error("Error loading route:", error);
 } finally {
 setLoading(false);
 }
 }, [merchantId, selectedDate]);

 useEffect(() => {
 loadRoutePlan();
 }, [loadRoutePlan]);

 // Render map when we have stops and token
 useEffect(() => {
 if (!mapboxToken || !mapContainerRef.current || stops.length === 0) return;

 // Clean up previous map
 if (mapRef.current) {
 mapRef.current.remove();
 mapRef.current = null;
 }

 mapboxgl.accessToken = mapboxToken;
 const map = new mapboxgl.Map({
 container: mapContainerRef.current,
 style:"mapbox://styles/mapbox/streets-v12",
 center: [stops[0].longitude, stops[0].latitude],
 zoom: 11,
 });

 mapRef.current = map;

 map.on("load", () => {
 // Add markers for each stop
 const bounds = new mapboxgl.LngLatBounds();

 // Start marker
 if (routePlan?.start_latitude && routePlan?.start_longitude) {
 new mapboxgl.Marker({ color:"#22c55e" })
 .setLngLat([routePlan.start_longitude, routePlan.start_latitude])
 .setPopup(new mapboxgl.Popup().setHTML("<b>🏠 Start</b><br/>" + (routePlan.start_address ||"Home base")))
 .addTo(map);
 bounds.extend([routePlan.start_longitude, routePlan.start_latitude]);
 }

 stops.forEach((stop, i) => {
 const el = document.createElement("div");
 el.className ="flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold shadow-lg";
 el.style.backgroundColor = stop.status ==="completed" ?"#22c55e" : stop.status ==="arrived" ?"#3b82f6" :"#f59e0b";
 el.textContent = String(i + 1);

 new mapboxgl.Marker(el)
 .setLngLat([stop.longitude, stop.latitude])
 .setPopup(
 new mapboxgl.Popup().setHTML(
 `<b>${stop.customer_name ||"Client"}</b><br/>${stop.service_name ||""}<br/><small>${stop.address}</small>`
 )
 )
 .addTo(map);

 bounds.extend([stop.longitude, stop.latitude]);
 });

 map.fitBounds(bounds, { padding: 60 });

 // Draw route line if we have geometry
 if (routePlan?.mapbox_route_geometry) {
 try {
 const geometry = JSON.parse(routePlan.mapbox_route_geometry);
 map.addSource("route", {
 type:"geojson",
 data: {
 type:"Feature",
 properties: {},
 geometry,
 },
 });
 map.addLayer({
 id:"route-line",
 type:"line",
 source:"route",
 layout: {"line-join":"round","line-cap":"round" },
 paint: {
"line-color":"#3b82f6",
"line-width": 4,
"line-opacity": 0.7,
 },
 });
 } catch (e) {
 console.error("Failed to render route:", e);
 }
 }
 });

 return () => {
 if (mapRef.current) {
 mapRef.current.remove();
 mapRef.current = null;
 }
 };
 }, [mapboxToken, stops, routePlan]);

 const handleOptimize = async () => {
 if (stops.length < 2) {
 toast.error("Need at least 2 stops to optimize a route");
 return;
 }

 setOptimizing(true);
 try {
 // Get start location - use merchant address or geocode provided address
 let startLocation = null;
 if (startAddress) {
 const { data: geocode } = await supabase.functions.invoke("geocode-address", {
 body: { address: startAddress },
 });
 if (geocode?.latitude) {
 startLocation = { latitude: geocode.latitude, longitude: geocode.longitude, address: startAddress };
 }
 }

 if (!startLocation) {
 // Use merchant's own coordinates
 const { data: merchant } = await supabase
 .from("merchants")
 .select("latitude, longitude, address")
 .eq("id", merchantId)
 .single();

 if (merchant?.latitude) {
 startLocation = { latitude: merchant.latitude, longitude: merchant.longitude, address: merchant.address };
 setStartAddress(merchant.address ||"");
 }
 }

 const { data, error } = await supabase.functions.invoke("optimize-route", {
 body: {
 merchant_id: merchantId,
 route_date: format(selectedDate,"yyyy-MM-dd"),
 start_location: startLocation,
 stops: stops.map((s) => ({
 booking_id: s.booking_id,
 address: s.address,
 latitude: s.latitude,
 longitude: s.longitude,
 customer_name: s.customer_name,
 service_name: s.service_name,
 })),
 },
 });

 if (error) throw error;

 toast.success(
 data.optimized
 ? `Route optimized! Saving ~${data.estimated_savings_minutes || 0} min of drive time.`
 :"Route calculated!"
 );
 loadRoutePlan();
 } catch (error) {
 console.error("Optimization error:", error);
 toast.error("Failed to optimize route");
 } finally {
 setOptimizing(false);
 }
 };

 const handleUpdateStopStatus = async (stopId: string, status: string) => {
 try {
 await supabase
 .from("route_stops")
 .update({ status })
 .eq("id", stopId);
 
 setStops((prev) =>
 prev.map((s) => (s.id === stopId ? { ...s, status } : s))
 );
 toast.success(`Stop marked as ${status}`);
 } catch (error) {
 toast.error("Failed to update stop status");
 }
 };

 const dateStr = format(selectedDate,"EEEE, MMM d");

 return (
 <div className="space-y-6">
 {/* Header with date picker */}
 <Card>
 <CardHeader className="pb-3">
 <div className="flex items-center justify-between flex-wrap gap-3">
 <div>
 <CardTitle className="flex items-center gap-2">
 <Navigation className="w-5 h-5 text-primary" />
 Smart Schedule
 </CardTitle>
 <CardDescription>
 Optimize your driving route for {dateStr}
 </CardDescription>
 </div>
 <Popover>
 <PopoverTrigger asChild>
 <Button variant="outline" size="sm">
 <CalendarIcon className="w-4 h-4 mr-2" />
 {format(selectedDate,"MMM d, yyyy")}
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-auto p-0" align="end">
 <Calendar
 mode="single"
 selected={selectedDate}
 onSelect={(d) => d && setSelectedDate(d)}
 />
 </PopoverContent>
 </Popover>
 </div>
 </CardHeader>
 </Card>

 {loading ? (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="w-6 h-6 animate-spin text-primary" />
 </div>
 ) : stops.length === 0 ? (
 <Card>
 <CardContent className="py-12 text-center">
 <MapPin className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
 <h3 className="font-semibold text-lg mb-1">No mobile appointments</h3>
 <p className="text-muted-foreground text-sm">
 No confirmed mobile service bookings with client addresses for this date.
 </p>
 </CardContent>
 </Card>
 ) : (
 <>
 {/* Route Stats */}
 {routePlan && (
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 <Card className="p-4">
 <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
 <RouteIcon className="w-4 h-4" />
 Total Distance
 </div>
 <p className="text-xl font-bold">{routePlan.total_distance_miles?.toFixed(1) ||"—"} mi</p>
 </Card>
 <Card className="p-4">
 <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
 <Car className="w-4 h-4" />
 Drive Time
 </div>
 <p className="text-xl font-bold">{routePlan.total_duration_minutes ||"—"} min</p>
 </Card>
 <Card className="p-4">
 <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
 <TrendingDown className="w-4 h-4 text-success0" />
 Time Saved
 </div>
 <p className="text-xl font-bold text-success">
 {routePlan.estimated_savings_minutes || 0} min
 </p>
 </Card>
 <Card className="p-4">
 <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
 <Users className="w-4 h-4" />
 Stops
 </div>
 <p className="text-xl font-bold">{stops.length}</p>
 </Card>
 </div>
 )}

 {/* Map */}
 <Card className="overflow-hidden">
 <div ref={mapContainerRef} className="h-[300px] md:h-[400px] w-full" />
 </Card>

 {/* Optimization Controls */}
 <Card>
 <CardContent className="pt-6 space-y-4">
 <div>
 <Label className="text-sm font-medium">Start Location (home base)</Label>
 <div className="flex gap-2 mt-1.5">
 <Input
 placeholder="Enter your starting address..."
 value={startAddress}
 onChange={(e) => setStartAddress(e.target.value)}
 className="flex-1"
 />
 <Button onClick={handleOptimize} disabled={optimizing} className="shrink-0">
 {optimizing ? (
 <Loader2 className="w-4 h-4 animate-spin mr-2" />
 ) : (
 <Navigation className="w-4 h-4 mr-2" />
 )}
 {optimizing ?"Optimizing..." :"Optimize Route"}
 </Button>
 </div>
 <p className="text-xs text-muted-foreground mt-1">
 We'll calculate the most fuel-efficient order for your stops
 </p>
 </div>
 </CardContent>
 </Card>

 {/* Stop List */}
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base">Route Stops</CardTitle>
 </CardHeader>
 <CardContent className="space-y-0">
 {stops.map((stop, i) => (
 <div key={stop.id}>
 {i > 0 && (
 <div className="flex items-center gap-2 py-2 pl-4 text-xs text-muted-foreground">
 <ArrowRight className="w-3 h-3" />
 {stop.drive_duration_minutes != null && (
 <span>{stop.drive_duration_minutes} min drive</span>
 )}
 {stop.drive_distance_miles != null && (
 <span>• {stop.drive_distance_miles.toFixed(1)} mi</span>
 )}
 </div>
 )}
 <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
 <div
 className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${
 stop.status ==="completed"
 ?"bg-success/100"
 : stop.status ==="arrived"
 ?"bg-info/100"
 : stop.status ==="en_route"
 ?"bg-warning/100"
 :"bg-muted-foreground"
 }`}
 >
 {stop.status ==="completed" ? (
 <CheckCircle2 className="w-4 h-4" />
 ) : (
 i + 1
 )}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <p className="font-medium text-sm truncate">{stop.customer_name ||"Client"}</p>
 {stop.service_name && (
 <Badge variant="secondary" className="text-xs shrink-0">
 {stop.service_name}
 </Badge>
 )}
 </div>
 <p className="text-xs text-muted-foreground truncate mt-0.5">{stop.address}</p>
 </div>
 <div className="flex gap-1 shrink-0">
 {stop.status ==="pending" && (
 <Button
 variant="ghost"
 size="icon"
 className="h-7 w-7"
 onClick={() => handleUpdateStopStatus(stop.id,"en_route")}
 title="Start driving"
 >
 <Play className="w-3.5 h-3.5" />
 </Button>
 )}
 {stop.status ==="en_route" && (
 <Button
 variant="ghost"
 size="icon"
 className="h-7 w-7"
 onClick={() => handleUpdateStopStatus(stop.id,"arrived")}
 title="Arrived"
 >
 <MapPin className="w-3.5 h-3.5" />
 </Button>
 )}
 {stop.status ==="arrived" && (
 <Button
 variant="ghost"
 size="icon"
 className="h-7 w-7 text-success"
 onClick={() => handleUpdateStopStatus(stop.id,"completed")}
 title="Complete"
 >
 <CheckCircle2 className="w-3.5 h-3.5" />
 </Button>
 )}
 {stop.status !=="completed" && stop.status !=="skipped" && (
 <Button
 variant="ghost"
 size="icon"
 className="h-7 w-7 text-muted-foreground"
 onClick={() => handleUpdateStopStatus(stop.id,"skipped")}
 title="Skip"
 >
 <SkipForward className="w-3.5 h-3.5" />
 </Button>
 )}
 </div>
 </div>
 </div>
 ))}
 </CardContent>
 </Card>
 </>
 )}
 </div>
 );
}
