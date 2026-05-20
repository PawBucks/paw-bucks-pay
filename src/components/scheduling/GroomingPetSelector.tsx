import { useState, useEffect, useMemo } from"react";
import { useQuery } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { useAuth } from"@/hooks/useAuth";
import { Label } from"@/components/ui/label";
import { Badge } from"@/components/ui/badge";
import { Textarea } from"@/components/ui/textarea";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
import { AlertTriangle, CheckCircle2, Dog, Loader2, XCircle } from "lucide-react";
import { differenceInMonths, parseISO } from"date-fns";

import { Formatters } from "@/utils/formatters";
const COAT_CONDITIONS = [
 { value:"good", label:"Good – well maintained" },
 { value:"matted", label:"Matted – some tangles" },
 { value:"severely_matted", label:"Severely Matted – may need shave-down" },
];

export interface GroomingPetData {
 petId: string | null;
 breed: string;
 weightLbs: string;
 coatType: string;
 coatCondition: string;
 temperamentNotes: string;
 specialInstructions: string;
 vaccineStatus: Record<string, { status:"valid" |"expired" |"missing"; recordDate?: string }>;
 adjustedDuration: number | null;
 adjustedPrice: number | null;
 hasBlockingVaccineIssue: boolean;
 vaccineWarnings: string[];
}

interface GroomingPetSelectorProps {
 merchantId: string;
 baseDuration: number;
 basePrice: number;
 groomingData: GroomingPetData;
 onGroomingDataChange: (data: GroomingPetData) => void;
}

export function GroomingPetSelector({
 merchantId,
 baseDuration,
 basePrice,
 groomingData,
 onGroomingDataChange,
}: GroomingPetSelectorProps) {
 const { user } = useAuth();

 // Fetch user's pets
 const { data: pets = [] } = useQuery({
 queryKey: ["user-pets", user?.id],
 queryFn: async () => {
 if (!user) return [];
 const { data, error } = await supabase
 .from("pet_profiles")
 .select("id, name, breed, size, type, photo_url")
 .eq("user_id", user.id)
 .order("name");
 if (error) throw error;
 return data || [];
 },
 enabled: !!user,
 });

 // Fetch breed profiles for this groomer
 const { data: breedProfiles = [] } = useQuery({
 queryKey: ["grooming-breeds", merchantId],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("grooming_breed_profiles")
 .select("*")
 .eq("merchant_id", merchantId)
 .eq("is_active", true);
 if (error) throw error;
 return data || [];
 },
 });

 // Fetch vaccine requirements
 const { data: vaccineRequirements = [] } = useQuery({
 queryKey: ["groomer-vaccines", merchantId],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("groomer_vaccine_requirements")
 .select("*")
 .eq("merchant_id", merchantId)
 .eq("is_active", true);
 if (error) throw error;
 return data || [];
 },
 });

 // Fetch medical records for selected pet (for vaccine verification)
 const { data: medicalRecords = [], isLoading: loadingRecords } = useQuery({
 queryKey: ["pet-medical-records", groomingData.petId],
 queryFn: async () => {
 if (!groomingData.petId) return [];
 const { data, error } = await supabase
 .from("pet_medical_records")
 .select("id, title, record_type, record_date")
 .eq("pet_id", groomingData.petId)
 .eq("record_type","vaccination")
 .order("record_date", { ascending: false });
 if (error) throw error;
 return data || [];
 },
 enabled: !!groomingData.petId,
 });

 // When pet is selected, auto-fill data
 const handlePetSelect = (petId: string) => {
 const pet = pets.find((p) => p.id === petId);
 if (!pet) return;

 // Find breed profile match
 const breedMatch = breedProfiles.find(
 (bp) => bp.breed_name.toLowerCase() === pet.breed?.toLowerCase()
 );

 onGroomingDataChange({
 ...groomingData,
 petId,
 breed: pet.breed ||"",
 coatType: breedMatch?.coat_type || groomingData.coatType ||"",
 adjustedDuration: breedMatch?.duration_minutes_override || null,
 adjustedPrice: breedMatch?.price_override || null,
 });
 };

 // Verify vaccines whenever records or requirements change
 useEffect(() => {
 if (vaccineRequirements.length === 0 || !groomingData.petId) return;

 const vaccineStatus: GroomingPetData["vaccineStatus"] = {};
 const warnings: string[] = [];
 let hasBlocking = false;

 vaccineRequirements.forEach((req) => {
 const matchingRecord = medicalRecords.find((r) =>
 r.title.toLowerCase().includes(req.vaccine_name.toLowerCase())
 );

 if (!matchingRecord) {
 vaccineStatus[req.vaccine_name] = { status:"missing" };
 if (req.enforcement_level ==="required") {
 hasBlocking = true;
 warnings.push(`${req.vaccine_name} vaccine record is missing (required)`);
 } else if (req.enforcement_level ==="warning") {
 warnings.push(`${req.vaccine_name} vaccine record not found`);
 }
 } else {
 const monthsAgo = differenceInMonths(new Date(), parseISO(matchingRecord.record_date));
 if (monthsAgo > req.max_age_months) {
 vaccineStatus[req.vaccine_name] = { status:"expired", recordDate: matchingRecord.record_date };
 if (req.enforcement_level ==="required") {
 hasBlocking = true;
 warnings.push(`${req.vaccine_name} vaccine is expired (${monthsAgo} months old, max ${req.max_age_months})`);
 } else if (req.enforcement_level ==="warning") {
 warnings.push(`${req.vaccine_name} may be due for renewal`);
 }
 } else {
 vaccineStatus[req.vaccine_name] = { status:"valid", recordDate: matchingRecord.record_date };
 }
 }
 });

 onGroomingDataChange({
 ...groomingData,
 vaccineStatus,
 hasBlockingVaccineIssue: hasBlocking,
 vaccineWarnings: warnings,
 });
 }, [medicalRecords, vaccineRequirements, groomingData.petId]);

 // Recalculate duration/price when breed changes
 useEffect(() => {
 if (!groomingData.breed) return;
 const breedMatch = breedProfiles.find(
 (bp) => bp.breed_name.toLowerCase() === groomingData.breed.toLowerCase()
 );
 if (breedMatch) {
 onGroomingDataChange({
 ...groomingData,
 adjustedDuration: breedMatch.duration_minutes_override || null,
 adjustedPrice: breedMatch.price_override || null,
 coatType: breedMatch.coat_type || groomingData.coatType,
 });
 }
 }, [groomingData.breed, breedProfiles]);

 const effectiveDuration = groomingData.adjustedDuration || baseDuration;
 const effectivePrice = groomingData.adjustedPrice || basePrice;

 return (
 <div className="space-y-4 p-4 rounded-md bg-muted/30 border">
 <h4 className="text-sm font-medium flex items-center gap-2">
 <Dog className="w-4 h-4 text-primary" />
 Pet & Grooming Details
 </h4>

 {/* Pet Selector */}
 {pets.length > 0 && (
 <div>
 <Label className="text-sm">Select Your Pet</Label>
 <Select value={groomingData.petId ||""} onValueChange={handlePetSelect}>
 <SelectTrigger>
 <SelectValue placeholder="Choose a pet..." />
 </SelectTrigger>
 <SelectContent>
 {pets.map((pet) => (
 <SelectItem key={pet.id} value={pet.id}>
 {pet.name} {pet.breed ? `(${pet.breed})` :""} – {pet.type}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 )}

 {/* Auto-filled / editable fields */}
 {groomingData.petId && (
 <>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <Label className="text-sm">Breed</Label>
 <p className="text-sm font-medium mt-1">{groomingData.breed ||"Not specified"}</p>
 </div>
 <div>
 <Label className="text-sm">Coat Type</Label>
 <p className="text-sm font-medium mt-1 capitalize">{groomingData.coatType?.replace(/_/g, " ") ||"Not specified"}</p>
 </div>
 </div>

 {/* Adjusted pricing display */}
 {(groomingData.adjustedDuration || groomingData.adjustedPrice) && (
 <div className="flex gap-3 text-sm">
 {groomingData.adjustedDuration && groomingData.adjustedDuration !== baseDuration && (
 <Badge variant="outline" className="bg-info/10 text-info border-info/20">
 Duration adjusted: {effectiveDuration} min (was {baseDuration})
 </Badge>
 )}
 {groomingData.adjustedPrice && groomingData.adjustedPrice !== basePrice && (
 <Badge variant="outline" className="bg-success/10 text-success border-success/20">
 Price: {Formatters.currency(effectivePrice)} (was {Formatters.currency(basePrice)})
 </Badge>
 )}
 </div>
 )}

 {/* Coat Condition */}
 <div>
 <Label className="text-sm">Coat Condition</Label>
 <Select
 value={groomingData.coatCondition}
 onValueChange={(v) => onGroomingDataChange({ ...groomingData, coatCondition: v })}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {COAT_CONDITIONS.map((c) => (
 <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 {/* Vaccine Status */}
 {vaccineRequirements.length > 0 && (
 <div className="space-y-2">
 <Label className="text-sm">Vaccine Verification</Label>
 {loadingRecords ? (
 <div className="flex items-center gap-2 text-sm text-muted-foreground">
 <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking records...
 </div>
 ) : (
 <div className="space-y-1">
 {vaccineRequirements.map((req) => {
 const status = groomingData.vaccineStatus[req.vaccine_name];
 return (
 <div key={req.id} className="flex items-center gap-2 text-sm">
 {status?.status ==="valid" ? (
 <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
 ) : status?.status ==="expired" ? (
 <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
 ) : (
 <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
 )}
 <span className={status?.status ==="valid" ?"text-success" : status?.status ==="expired" ?"text-warning" :"text-destructive"}>
 {req.vaccine_name}
 </span>
 <span className="text-xs text-muted-foreground">
 {status?.status ==="valid" ?"Up to date" : status?.status ==="expired" ?"Expired" :"Missing"}
 </span>
 {req.enforcement_level ==="required" && (
 <Badge variant="destructive" className="text-[10px] h-4 px-1">Required</Badge>
 )}
 </div>
 );
 })}
 </div>
 )}
 {groomingData.vaccineWarnings.length > 0 && (
 <div className={`p-3 rounded-lg text-sm ${groomingData.hasBlockingVaccineIssue ?"bg-destructive/10 border border-destructive/20" :"bg-warning/10 border border-warning/20"}`}>
 {groomingData.hasBlockingVaccineIssue ? (
 <p className="font-medium text-destructive mb-1 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Booking cannot proceed:</p>
 ) : (
 <p className="font-medium text-warning mb-1">Heads up:</p>
 )}
 <ul className="list-disc list-inside space-y-0.5 text-xs">
 {groomingData.vaccineWarnings.map((w, i) => (
 <li key={i}>{w}</li>
 ))}
 </ul>
 </div>
 )}
 </div>
 )}

 {/* Special Instructions */}
 <div>
 <Label className="text-sm">Special Instructions for Groomer</Label>
 <Textarea
 value={groomingData.specialInstructions}
 onChange={(e) => onGroomingDataChange({ ...groomingData, specialInstructions: e.target.value })}
 placeholder="e.g., Anxious around dryers, prefers scissor cut on face..."
 rows={2}
 />
 </div>
 </>
 )}
 </div>
 );
}

export const createDefaultGroomingData = (): GroomingPetData => ({
 petId: null,
 breed:"",
 weightLbs:"",
 coatType:"",
 coatCondition:"good",
 temperamentNotes:"",
 specialInstructions:"",
 vaccineStatus: {},
 adjustedDuration: null,
 adjustedPrice: null,
 hasBlockingVaccineIssue: false,
 vaccineWarnings: [],
});
