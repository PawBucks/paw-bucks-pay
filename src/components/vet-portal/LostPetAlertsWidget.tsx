import { useState, useEffect } from"react";
import { useQuery, useMutation, useQueryClient } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { Card } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { Textarea } from"@/components/ui/textarea";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
} from"@/components/ui/dialog";
import { toast } from"sonner";
import {
 AlertTriangle,
 MapPin,
 Phone,
 Calendar,
 CheckCircle,
 X,
 Bell,
 Dog,
 Cat,
 Eye,
} from"lucide-react";
import { format } from"date-fns";

interface LostPetAlertsWidgetProps {
 vetId: string;
}

export function LostPetAlertsWidget({ vetId }: LostPetAlertsWidgetProps) {
 const queryClient = useQueryClient();
 const [selectedAlert, setSelectedAlert] = useState<any>(null);
 const [acknowledgementNotes, setAcknowledgementNotes] = useState("");

 // Fetch all active lost pet posts and check if any match our patients
 const { data: lostPetAlerts, isLoading } = useQuery({
 queryKey: ["vet-lost-pet-alerts", vetId],
 queryFn: async () => {
 // First get all our patients' user_ids (owners)
 const { data: patientData } = await supabase
 .from("vet_messages")
 .select("user_id")
 .eq("vet_id", vetId);

 const patientUserIds = [...new Set(patientData?.map(p => p.user_id) || [])];

 // Now get lost pet posts
 const { data: lostPets, error } = await supabase
 .from("lost_pet_posts")
 .select("*")
 .eq("is_active", true)
 .in("status", ["lost","searching"]);

 if (error) throw error;

 // Get existing alerts to track acknowledged status
 const { data: existingAlerts } = await supabase
 .from("vet_lost_pet_alerts")
 .select("*")
 .eq("vet_id", vetId);

 const alertMap = new Map(existingAlerts?.map(a => [a.lost_pet_post_id, a]) || []);

 // Enhance lost pets with patient matching and alert status
 return lostPets?.map(post => ({
 ...post,
 isPatient: patientUserIds.includes(post.user_id),
 existingAlert: alertMap.get(post.id),
 })) || [];
 },
 refetchInterval: 30000, // Check every 30 seconds for new alerts
 });

 // Create/acknowledge alert mutation
 const acknowledgeAlert = useMutation({
 mutationFn: async ({ lostPetPostId, petId, notes }: { 
 lostPetPostId: string; 
 petId: string | null;
 notes: string;
 }) => {
 // First check if alert exists
 const { data: existing } = await supabase
 .from("vet_lost_pet_alerts")
 .select("id")
 .eq("vet_id", vetId)
 .eq("lost_pet_post_id", lostPetPostId)
 .single();

 if (existing) {
 // Update existing
 const { error } = await supabase
 .from("vet_lost_pet_alerts")
 .update({
 is_acknowledged: true,
 acknowledged_at: new Date().toISOString(),
 notes,
 })
 .eq("id", existing.id);
 if (error) throw error;
 } else {
 // Create new
 const { error } = await supabase
 .from("vet_lost_pet_alerts")
 .insert({
 vet_id: vetId,
 lost_pet_post_id: lostPetPostId,
 pet_id: petId,
 is_acknowledged: true,
 acknowledged_at: new Date().toISOString(),
 notes,
 });
 if (error) throw error;
 }
 },
 onSuccess: () => {
 toast.success("Alert acknowledged");
 queryClient.invalidateQueries({ queryKey: ["vet-lost-pet-alerts"] });
 setSelectedAlert(null);
 setAcknowledgementNotes("");
 },
 onError: (error: Error) => {
 toast.error(error.message);
 },
 });

 // Filter alerts
 const patientAlerts = lostPetAlerts?.filter(a => a.isPatient && !a.existingAlert?.is_acknowledged) || [];
 const otherAlerts = lostPetAlerts?.filter(a => !a.isPatient && !a.existingAlert?.is_acknowledged) || [];
 const acknowledgedAlerts = lostPetAlerts?.filter(a => a.existingAlert?.is_acknowledged) || [];

 const PetIcon = (type: string) => {
 if (type?.toLowerCase().includes('dog')) return Dog;
 if (type?.toLowerCase().includes('cat')) return Cat;
 return Dog;
 };

 if (isLoading) {
 return (
 <Card className="p-4">
 <div className="text-center text-muted-foreground">Loading lost pet alerts...</div>
 </Card>
 );
 }

 return (
 <div className="space-y-4">
 {/* Critical Patient Alerts */}
 {patientAlerts.length > 0 && (
 <Card className="border-destructive/40 bg-destructive/10 /30">
 <div className="p-4 border-b border-destructive/20">
 <div className="flex items-center gap-2">
 <AlertTriangle className="h-5 w-5 text-destructive animate-pulse" />
 <h3 className="font-semibold text-destructive">
 ⚠️ YOUR PATIENT IS LOST!
 </h3>
 <Badge className="bg-destructive text-white ml-auto">
 {patientAlerts.length} Alert{patientAlerts.length > 1 ?'s' :''}
 </Badge>
 </div>
 </div>
 <div className="p-4 space-y-3">
 {patientAlerts.map((alert) => {
 const Icon = PetIcon(alert.pet_type ||'');
 const photos = alert.photo_urls || (alert.photo_url ? [alert.photo_url] : []);
 return (
 <div 
 key={alert.id}
 className="flex items-start gap-4 p-3 bg-white /20 rounded-lg border border-destructive/20"
 >
 {photos[0] ? (
 <img 
 src={photos[0]} 
 alt={alert.pet_name ||'Pet'}
 className="w-16 h-16 rounded-lg object-cover"
 />
 ) : (
 <div className="w-16 h-16 rounded-lg bg-destructive/10 flex items-center justify-center">
 <Icon className="h-8 w-8 text-destructive" />
 </div>
 )}
 <div className="flex-1">
 <div className="flex items-center gap-2">
 <h4 className="font-bold text-lg">{alert.pet_name}</h4>
 <Badge variant="outline" className="border-destructive/40 text-destructive">
 {alert.pet_type} • {alert.breed}
 </Badge>
 </div>
 <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
 <MapPin className="h-3 w-3" />
 {alert.last_seen_location}
 </div>
 <div className="flex items-center gap-2 text-sm text-muted-foreground">
 <Calendar className="h-3 w-3" />
 Last seen: {format(new Date(alert.last_seen_date),"MMM d, yyyy")}
 </div>
 {alert.contact_phone && (
 <div className="flex items-center gap-2 text-sm mt-1">
 <Phone className="h-3 w-3" />
 <a href={`tel:${alert.contact_phone}`} className="text-info hover:underline">
 {alert.contact_phone}
 </a>
 </div>
 )}
 </div>
 <Button 
 size="sm"
 onClick={() => setSelectedAlert(alert)}
 className="bg-destructive hover:bg-destructive"
 >
 <Eye className="h-4 w-4 mr-1" />
 Review
 </Button>
 </div>
 );
 })}
 </div>
 </Card>
 )}

 {/* Other Lost Pet Alerts in Area */}
 {otherAlerts.length > 0 && (
 <Card>
 <div className="p-4 border-b">
 <div className="flex items-center gap-2">
 <Bell className="h-5 w-5 text-warning" />
 <h3 className="font-semibold">Lost Pets in Your Area</h3>
 <Badge variant="outline" className="ml-auto">
 {otherAlerts.length}
 </Badge>
 </div>
 <p className="text-xs text-muted-foreground mt-1">
 Alert staff if any of these pets are brought in
 </p>
 </div>
 <div className="divide-y">
 {otherAlerts.slice(0, 5).map((alert) => {
 const Icon = PetIcon(alert.pet_type ||'');
 const photos = alert.photo_urls || (alert.photo_url ? [alert.photo_url] : []);
 return (
 <div key={alert.id} className="p-3 flex items-center gap-3 hover:bg-muted">
 {photos[0] ? (
 <img 
 src={photos[0]} 
 alt={alert.pet_name ||'Pet'}
 className="w-10 h-10 rounded-full object-cover"
 />
 ) : (
 <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
 <Icon className="h-5 w-5 text-muted-foreground" />
 </div>
 )}
 <div className="flex-1 min-w-0">
 <div className="font-medium truncate">{alert.pet_name}</div>
 <div className="text-xs text-muted-foreground truncate">
 {alert.pet_type} • {alert.last_seen_location}
 </div>
 </div>
 <Button 
 variant="outline" 
 size="sm"
 onClick={() => setSelectedAlert(alert)}
 >
 Details
 </Button>
 </div>
 );
 })}
 </div>
 </Card>
 )}

 {/* No Alerts State */}
 {patientAlerts.length === 0 && otherAlerts.length === 0 && (
 <Card className="p-6 text-center text-muted-foreground">
 <CheckCircle className="h-10 w-10 mx-auto mb-2 text-success opacity-50" />
 <p className="font-medium">No Lost Pet Alerts</p>
 <p className="text-sm">All clear! No patients are currently reported as lost.</p>
 </Card>
 )}

 {/* Alert Detail Dialog */}
 <Dialog open={!!selectedAlert} onOpenChange={(open) => !open && setSelectedAlert(null)}>
 <DialogContent className="max-w-md">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <AlertTriangle className="h-5 w-5 text-destructive" />
 Lost Pet Alert
 </DialogTitle>
 </DialogHeader>
 {selectedAlert && (
 <div className="space-y-4">
 <div className="flex gap-4">
 {(selectedAlert.photo_urls?.[0] || selectedAlert.photo_url) && (
 <img 
 src={selectedAlert.photo_urls?.[0] || selectedAlert.photo_url}
 alt={selectedAlert.pet_name ||'Pet'}
 className="w-24 h-24 rounded-lg object-cover"
 />
 )}
 <div>
 <h3 className="text-xl font-bold">{selectedAlert.pet_name}</h3>
 <p className="text-muted-foreground">
 {selectedAlert.pet_type} • {selectedAlert.breed}
 </p>
 {selectedAlert.color_markings && (
 <p className="text-sm">Color: {selectedAlert.color_markings}</p>
 )}
 {selectedAlert.microchip_number && (
 <Badge variant="outline" className="mt-1">
 Chip: {selectedAlert.microchip_number}
 </Badge>
 )}
 </div>
 </div>

 <div className="space-y-2 text-sm">
 <div className="flex items-center gap-2">
 <MapPin className="h-4 w-4 text-muted-foreground" />
 <span>{selectedAlert.last_seen_location}</span>
 </div>
 <div className="flex items-center gap-2">
 <Calendar className="h-4 w-4 text-muted-foreground" />
 <span>Last seen: {format(new Date(selectedAlert.last_seen_date),"MMMM d, yyyy")}</span>
 </div>
 {selectedAlert.contact_phone && (
 <div className="flex items-center gap-2">
 <Phone className="h-4 w-4 text-muted-foreground" />
 <a href={`tel:${selectedAlert.contact_phone}`} className="text-info hover:underline">
 {selectedAlert.contact_phone}
 </a>
 </div>
 )}
 </div>

 {selectedAlert.additional_notes && (
 <div className="p-3 bg-muted rounded-lg text-sm">
 <p className="font-medium mb-1">Additional Notes:</p>
 <p>{selectedAlert.additional_notes}</p>
 </div>
 )}

 {selectedAlert.isPatient && (
 <div className="p-3 bg-warning/10 /30 rounded-lg border border-warning/20">
 <p className="text-sm text-warning font-medium">
 ⚠️ This is one of your patients! If they are brought in, 
 immediately contact the owner.
 </p>
 </div>
 )}

 <div className="space-y-2">
 <Textarea
 placeholder="Add acknowledgement notes (optional)..."
 value={acknowledgementNotes}
 onChange={(e) => setAcknowledgementNotes(e.target.value)}
 rows={2}
 />
 <div className="flex gap-2">
 <Button
 variant="outline"
 className="flex-1"
 onClick={() => setSelectedAlert(null)}
 >
 <X className="h-4 w-4 mr-1" />
 Close
 </Button>
 <Button
 className="flex-1"
 onClick={() => acknowledgeAlert.mutate({
 lostPetPostId: selectedAlert.id,
 petId: null,
 notes: acknowledgementNotes,
 })}
 disabled={acknowledgeAlert.isPending}
 >
 <CheckCircle className="h-4 w-4 mr-1" />
 {acknowledgeAlert.isPending ?"..." :"Acknowledge"}
 </Button>
 </div>
 </div>
 </div>
 )}
 </DialogContent>
 </Dialog>
 </div>
 );
}
