import { useState, useEffect } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { AlertCircle, ChevronRight, Shield, Loader2 } from"lucide-react";
import { Dialog, DialogContent } from"@/components/ui/dialog";
import { ClaimResolutionScreen } from"@/components/ClaimResolutionScreen";

interface ActionSlice {
 id: string;
 gap_amount: number;
 recovery_status: string;
 claim?: {
 claim_number: string;
 policy?: {
 pet?: { name: string };
 vet_insurance_providers?: { name: string };
 };
 };
}

interface ActionRequiredSlicesProps {
 userId: string;
}

export function ActionRequiredSlices({ userId }: ActionRequiredSlicesProps) {
 const [slices, setSlices] = useState<ActionSlice[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [selectedSliceId, setSelectedSliceId] = useState<string | null>(null);

 useEffect(() => {
 loadActionRequiredSlices();
 }, [userId]);

 const loadActionRequiredSlices = async () => {
 try {
 // Get pet IDs owned by this user
 const { data: pets } = await supabase
 .from("pet_profiles")
 .select("id")
 .eq("user_id", userId);

 if (!pets || pets.length === 0) {
 setSlices([]);
 setIsLoading(false);
 return;
 }

 const petIds = pets.map((p) => p.id);

 // Get policies for these pets
 const { data: policies } = await supabase
 .from("pet_insurance_policies")
 .select("id")
 .in("pet_id", petIds);

 if (!policies || policies.length === 0) {
 setSlices([]);
 setIsLoading(false);
 return;
 }

 const policyIds = policies.map((p) => p.id);

 // Get claims for these policies
 const { data: claims } = await supabase
 .from("insurance_claims")
 .select("id")
 .in("policy_id", policyIds);

 if (!claims || claims.length === 0) {
 setSlices([]);
 setIsLoading(false);
 return;
 }

 const claimIds = claims.map((c) => c.id);

 // Get action_required slices
 const { data: actionSlices, error } = await supabase
 .from("invoice_slices")
 .select(`
 id,
 gap_amount,
 recovery_status,
 claim:insurance_claims(
 claim_number,
 policy:pet_insurance_policies(
 pet:pet_profiles(name),
 vet_insurance_providers(name)
 )
 )
 `)
 .in("claim_id", claimIds)
 .eq("recovery_status","action_required")
 .order("created_at", { ascending: false });

 if (error) throw error;
 setSlices((actionSlices as ActionSlice[]) || []);
 } catch (error) {
 console.error("Error loading action required slices:", error);
 } finally {
 setIsLoading(false);
 }
 };

 const handleResolutionComplete = () => {
 setSelectedSliceId(null);
 loadActionRequiredSlices();
 };

 if (isLoading) {
 return (
 <Card className="border-warning/20 bg-gradient-to-r from-warning to-warning">
 <CardContent className="p-6 flex items-center justify-center">
 <Loader2 className="h-6 w-6 animate-spin text-warning" />
 </CardContent>
 </Card>
 );
 }

 if (slices.length === 0) {
 return null; // Don't show anything if no action required
 }

 return (
 <>
 <Card className="border-warning/30 bg-gradient-to-r from-warning to-warning shadow-md">
 <CardHeader className="pb-2">
 <CardTitle className="flex items-center gap-2 text-warning">
 <AlertCircle className="h-5 w-5 text-warning" />
 Action Required
 <Badge className="bg-warning text-white ml-2">{slices.length}</Badge>
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 {slices.map((slice) => (
 <div
 key={slice.id}
 className="flex items-center justify-between p-3 bg-white rounded-lg border border-warning/20 hover:border-warning/30 transition-colors cursor-pointer"
 onClick={() => setSelectedSliceId(slice.id)}
 >
 <div className="flex items-center gap-3">
 <div className="p-2 rounded-full bg-warning/10">
 <Shield className="h-4 w-4 text-warning" />
 </div>
 <div>
 <p className="font-medium text-warning">
 {slice.claim?.policy?.pet?.name ||"Pet"} - Insurance Claim
 </p>
 <p className="text-sm text-warning">
 {slice.claim?.policy?.vet_insurance_providers?.name ||"Insurance"} • Claim{""}
 {slice.claim?.claim_number ||"pending"}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-3">
 <div className="text-right">
 <p className="font-bold text-warning">${Number(slice.gap_amount).toFixed(2)}</p>
 <p className="text-xs text-warning">Balance due</p>
 </div>
 <ChevronRight className="h-5 w-5 text-warning" />
 </div>
 </div>
 ))}
 </CardContent>
 </Card>

 {/* Resolution Dialog */}
 <Dialog open={!!selectedSliceId} onOpenChange={(open) => !open && setSelectedSliceId(null)}>
 <DialogContent className="max-w-lg p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
 {selectedSliceId && (
 <ClaimResolutionScreen
 sliceId={selectedSliceId}
 onComplete={handleResolutionComplete}
 onBack={() => setSelectedSliceId(null)}
 />
 )}
 </DialogContent>
 </Dialog>
 </>
 );
}
