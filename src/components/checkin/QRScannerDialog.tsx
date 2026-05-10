import { useState, useEffect, useRef, useCallback } from"react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from"@/components/ui/dialog";
import { Button } from"@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from"@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { supabase } from"@/integrations/supabase/client";
import { useAuth } from"@/hooks/useAuth";
import { Html5Qrcode } from"html5-qrcode";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from"sonner";

import { Formatters } from "@/utils/formatters";
type QRScannerDialogProps = {
 open: boolean;
 onOpenChange: (open: boolean) => void;
};

type ScanResult = {
 success: boolean;
 entityName: string | null;
 message: string;
};

type NearbyEntity = {
 id: string;
 name: string;
 type:"merchant" |"vet";
 distance: number | null;
 checkin_qr_token: string;
};

export function QRScannerDialog({ open, onOpenChange }: QRScannerDialogProps) {
 const { user } = useAuth();
 const [scanning, setScanning] = useState(false);
 const [processing, setProcessing] = useState(false);
 const [result, setResult] = useState<ScanResult | null>(null);
 const scannerRef = useRef<Html5Qrcode | null>(null);
 const mountedRef = useRef(true);

 // Location-based state
 const [nearbyEntities, setNearbyEntities] = useState<NearbyEntity[]>([]);
 const [allEntities, setAllEntities] = useState<NearbyEntity[]>([]);
 const [locationLoading, setLocationLoading] = useState(false);
 const [locationError, setLocationError] = useState<string | null>(null);
 const [selectedEntityToken, setSelectedEntityToken] = useState<string>("");
 const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
 const [entitiesLoaded, setEntitiesLoaded] = useState(false);

 const stopScanner = useCallback(async () => {
 if (scannerRef.current) {
 try {
 const state = scannerRef.current.getState();
 if (state === 2) {
 await scannerRef.current.stop();
 }
 } catch {
 // ignore
 }
 scannerRef.current = null;
 }
 setScanning(false);
 }, []);

 const processToken = useCallback(async (token: string) => {
 if (!user || processing) return;
 setProcessing(true);

 try {
 await stopScanner();

 const { data, error } = await supabase.rpc("process_checkin", {
 p_token: token,
 p_user_id: user.id,
 });

 if (error) throw error;

 const row = Array.isArray(data) ? data[0] : data;
 if (row) {
 setResult({
 success: row.success,
 entityName: row.entity_name,
 message: row.message,
 });
 if (row.success) {
 toast.success(`Checked in at ${row.entity_name}!`);
 } else {
 toast.info(row.message);
 }
 }
 } catch (error) {
 console.error("Check-in error:", error);
 setResult({ success: false, entityName: null, message:"Failed to process check-in" });
 toast.error("Failed to check in");
 } finally {
 setProcessing(false);
 }
 }, [user, processing, stopScanner]);

 const startScanner = useCallback(async () => {
 setResult(null);
 setScanning(true);

 await new Promise(r => setTimeout(r, 300));

 try {
 const scanner = new Html5Qrcode("qr-reader");
 scannerRef.current = scanner;

 await scanner.start(
 { facingMode:"environment" },
 { fps: 10, qrbox: { width: 250, height: 250 } },
 (decodedText) => {
 let token = decodedText;
 try {
 const url = new URL(decodedText);
 const t = url.searchParams.get("token");
 if (t) token = t;
 } catch {
 // not a URL
 }
 processToken(token);
 },
 () => {}
 );
 } catch {
 toast.error("Could not access camera. Please allow camera permissions.");
 setScanning(false);
 }
 }, [processToken]);

 // Haversine distance in miles
 const getDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
 const R = 3959;
 const dLat = ((lat2 - lat1) * Math.PI) / 180;
 const dLng = ((lng2 - lng1) * Math.PI) / 180;
 const a =
 Math.sin(dLat / 2) ** 2 +
 Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
 return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
 };

 const loadEntities = useCallback(async (lat?: number, lng?: number) => {
 setLocationLoading(true);
 setLocationError(null);

 try {
 // Fetch merchants and vets with QR tokens in parallel
 const [merchantsRes, vetsRes] = await Promise.all([
 supabase
 .from("merchants")
 .select("id, business_name, latitude, longitude, checkin_qr_token")
 .eq("approval_status","approved")
 .eq("is_paused", false)
 .not("checkin_qr_token","is", null)
 .order("business_name"),
 supabase
 .from("partner_vets")
 .select("id, clinic_name, checkin_qr_token")
 .eq("is_verified", true)
 .not("checkin_qr_token","is", null)
 .order("clinic_name"),
 ]);

 const entities: NearbyEntity[] = [];

 for (const m of merchantsRes.data || []) {
 const dist =
 lat != null && lng != null && m.latitude && m.longitude
 ? getDistance(lat, lng, m.latitude, m.longitude)
 : null;
 entities.push({
 id: m.id,
 name: m.business_name,
 type:"merchant",
 distance: dist,
 checkin_qr_token: m.checkin_qr_token!,
 });
 }

 for (const v of vetsRes.data || []) {
 entities.push({
 id: v.id,
 name: v.clinic_name ||"Veterinary Clinic",
 type:"vet",
 distance: null,
 checkin_qr_token: v.checkin_qr_token!,
 });
 }

 // Sort by distance if available, otherwise alphabetical
 if (lat != null && lng != null) {
 const withDist = entities.filter(e => e.distance != null).sort((a, b) => a.distance! - b.distance!);
 const withoutDist = entities.filter(e => e.distance == null).sort((a, b) => a.name.localeCompare(b.name));
 setNearbyEntities(withDist.slice(0, 10));
 setAllEntities([...withDist, ...withoutDist]);
 } else {
 entities.sort((a, b) => a.name.localeCompare(b.name));
 setNearbyEntities([]);
 setAllEntities(entities);
 }

 setEntitiesLoaded(true);
 } catch {
 setLocationError("Failed to load locations");
 } finally {
 setLocationLoading(false);
 }
 }, []);

 const requestLocation = useCallback(() => {
 if (!navigator.geolocation) {
 setLocationError("Geolocation not supported");
 loadEntities();
 return;
 }

 setLocationLoading(true);
 navigator.geolocation.getCurrentPosition(
 (pos) => {
 const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
 setUserLocation(loc);
 loadEntities(loc.lat, loc.lng);
 },
 () => {
 setLocationError("Location access denied");
 loadEntities();
 },
 { enableHighAccuracy: true, timeout: 10000 }
 );
 }, [loadEntities]);

 // Load entities when the location tab is selected
 const handleTabChange = (tab: string) => {
 if (tab ==="location" && !entitiesLoaded) {
 requestLocation();
 }
 if (tab ==="scan") {
 // Stop scanner if switching away was done earlier
 }
 };

 const handleLocationCheckin = () => {
 if (!selectedEntityToken) {
 toast.error("Please select a location");
 return;
 }
 processToken(selectedEntityToken);
 };

 useEffect(() => {
 mountedRef.current = true;
 return () => {
 mountedRef.current = false;
 stopScanner();
 };
 }, [stopScanner]);

 useEffect(() => {
 if (!open) {
 stopScanner();
 setTimeout(() => {
 if (!mountedRef.current) return;
 setResult(null);
 setProcessing(false);
 setSelectedEntityToken("");
 setEntitiesLoaded(false);
 setNearbyEntities([]);
 setAllEntities([]);
 setUserLocation(null);
 setLocationError(null);
 }, 300);
 }
 }, [open, stopScanner]);

 const formatDistance = (miles: number) => {
 if (miles < 0.1) return"< 0.1 mi";
 return `${Formatters.decimal(miles, 1)} mi`;
 };

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="sm:max-w-md">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <span className="w-5 h-5" aria-hidden="true">📸</span>
 Check In
 </DialogTitle>
 </DialogHeader>

 {result ? (
 <div className="text-center py-6 space-y-4">
 {result.success ? (
 <>
 <CheckCircle2 className="w-16 h-16 mx-auto text-success" />
 <div>
 <h3 className="text-lg font-semibold">Checked In!</h3>
 <p className="text-muted-foreground">Welcome to {result.entityName}</p>
 </div>
 </>
 ) : (
 <>
 <XCircle className="w-16 h-16 mx-auto text-destructive" />
 <div>
 <h3 className="text-lg font-semibold">{result.entityName ||"Check-In Failed"}</h3>
 <p className="text-muted-foreground">{result.message}</p>
 </div>
 </>
 )}
 <div className="flex gap-2 justify-center">
 <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
 <Button onClick={() => setResult(null)}>Try Again</Button>
 </div>
 </div>
 ) : processing ? (
 <div className="text-center py-8">
 <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary mb-3" />
 <p className="text-muted-foreground">Processing check-in...</p>
 </div>
 ) : (
 <Tabs defaultValue="scan" onValueChange={handleTabChange}>
 <TabsList className="grid w-full grid-cols-2">
 <TabsTrigger value="scan" className="gap-1.5">
 <span className="w-4 h-4" aria-hidden="true">📸</span>
 Scan QR
 </TabsTrigger>
 <TabsTrigger value="location" className="gap-1.5">
 <span className="w-4 h-4" aria-hidden="true">📍</span>
 Find Location
 </TabsTrigger>
 </TabsList>

 {/* QR Scanner Tab */}
 <TabsContent value="scan" className="space-y-4 mt-4">
 {scanning ? (
 <div>
 <div id="qr-reader" className="w-full rounded-lg overflow-hidden" />
 <p className="text-center text-xs text-muted-foreground mt-3">
 Point your camera at the QR code displayed at the location
 </p>
 <Button variant="outline" onClick={stopScanner} className="w-full mt-3">Cancel</Button>
 </div>
 ) : (
 <div className="text-center py-6 space-y-4">
 <span className="w-16 h-16 mx-auto text-muted-foreground" aria-hidden="true">📸</span>
 <p className="text-muted-foreground">Scan a merchant or vet's QR code to check in</p>
 <Button onClick={startScanner} className="w-full">
 <span className="w-4 h-4 mr-2" aria-hidden="true">📸</span>
 Start Scanner
 </Button>
 </div>
 )}
 </TabsContent>

 {/* Location-based Tab */}
 <TabsContent value="location" className="space-y-4 mt-4">
 {locationLoading ? (
 <div className="text-center py-8">
 <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary mb-3" />
 <p className="text-sm text-muted-foreground">Finding nearby locations...</p>
 </div>
 ) : (
 <>
 {/* Nearby locations */}
 {nearbyEntities.length > 0 && (
 <div className="space-y-2">
 <p className="text-sm font-medium flex items-center gap-1.5">
 <span className="w-4 h-4 text-primary" aria-hidden="true">🧭</span>
 Nearby Locations
 </p>
 <div className="space-y-1.5 max-h-48 overflow-y-auto">
 {nearbyEntities.map((entity) => (
 <button
 key={`${entity.type}-${entity.id}`}
 onClick={() => setSelectedEntityToken(entity.checkin_qr_token)}
 className={`w-full flex items-center justify-between gap-2 p-3 rounded-lg border text-left text-sm transition-colors ${
 selectedEntityToken === entity.checkin_qr_token
 ?"border-primary bg-primary/5"
 :"border-border hover:bg-muted"
 }`}
 >
 <div className="flex items-center gap-2 min-w-0">
 <span className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true">🏪</span>
 <span className="truncate font-medium">{entity.name}</span>
 </div>
 {entity.distance != null && (
 <span className="text-xs text-muted-foreground shrink-0">
 {formatDistance(entity.distance)}
 </span>
 )}
 </button>
 ))}
 </div>
 </div>
 )}

 {/* Location error or no location */}
 {locationError && (
 <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
 <span className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true">📍</span>
 <div className="text-xs text-muted-foreground">
 <p>{locationError}. You can select from the list below instead.</p>
 </div>
 {!userLocation && (
 <Button variant="ghost" size="sm" onClick={requestLocation} className="shrink-0 text-xs">
 Retry
 </Button>
 )}
 </div>
 )}

 {/* Full dropdown */}
 <div className="space-y-2">
 <p className="text-sm font-medium">
 {nearbyEntities.length > 0 ?"Or select from all locations" :"Select a location"}
 </p>
 <Select value={selectedEntityToken} onValueChange={setSelectedEntityToken}>
 <SelectTrigger>
 <SelectValue placeholder="Choose a merchant or vet..." />
 </SelectTrigger>
 <SelectContent className="max-h-60">
 {allEntities.map((entity) => (
 <SelectItem key={`${entity.type}-${entity.id}`} value={entity.checkin_qr_token}>
 {entity.name}
 {entity.distance != null ? ` (${formatDistance(entity.distance)})` :""}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <Button
 onClick={handleLocationCheckin}
 disabled={!selectedEntityToken}
 className="w-full"
 >
 <span className="w-4 h-4 mr-2" aria-hidden="true">📍</span>
 Check In
 </Button>
 </>
 )}
 </TabsContent>
 </Tabs>
 )}
 </DialogContent>
 </Dialog>
 );
}
