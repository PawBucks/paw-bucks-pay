import { useState, useEffect, useRef, useCallback } from"react";
import { useNavigate } from"react-router-dom";
import { useForm } from"react-hook-form";
import { zodResolver } from"@hookform/resolvers/zod";
import { z } from"zod";
import { ArrowLeft, ArrowRight, Building2, Check, CreditCard, Edit, FileText, PartyPopper, Phone, Save, Shield, ShieldCheck, Stethoscope, User, Wallet } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Textarea } from"@/components/ui/textarea";
import { Label } from"@/components/ui/label";
import { Switch } from"@/components/ui/switch";
import { Checkbox } from"@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from"@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Progress } from"@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from"@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from"@/components/ui/form";
import { toast } from"@/hooks/use-toast";
import { supabase } from"@/integrations/supabase/client";
import { useAuth } from"@/hooks/useAuth";
import { cn } from"@/lib/utils";
import { MERCHANT_TOS_CONTENT } from"@/components/shared/MerchantTermsOfService";
import { VET_ADDENDUM_CONTENT } from"@/components/shared/VetServicesAddendum";

// Step schemas
const step1Schema = z.object({
 legal_practice_name: z.string().min(2,"Practice name is required"),
 dba_name: z.string().optional(),
 primary_phone: z.string().min(10,"Valid phone number required"),
 sms_capability: z.boolean().default(false),
 physical_address: z.string().min(5,"Address is required"),
 city: z.string().min(2,"City is required"),
 state: z.string().min(2,"State is required"),
 zip_code: z.string().min(5,"ZIP code is required"),
 website_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
 tax_id_ein: z.string().min(9,"Valid EIN required (XX-XXXXXXX)"),
});

const step2Schema = z.object({
 medical_director_name: z.string().min(2,"Director name is required"),
 dvm_license_number: z.string().min(4,"License number is required"),
 dvm_license_state: z.string().min(2,"License state is required"),
 npi_number: z.string().optional(),
 practice_type: z.string().min(1,"Practice type is required"),
 accreditations: z.array(z.string()).default([]),
});

const step3Schema = z.object({
 insurance_partners: z.array(z.string()).min(1,"Select at least one insurance partner"),
 direct_pay_capability: z.boolean().default(false),
 splicing_preference: z.string().min(1,"Splicing preference is required"),
 admin_splicing_fee: z.number().min(0).max(50).optional(),
});

const step4Schema = z.object({
 pims_software: z.string().min(1,"PIMS software is required"),
 data_sync_permission: z.boolean().default(false),
 preferred_referral_partners: z.string().optional(),
});

const step5Schema = z.object({
 clinic_bio: z.string().min(10,"Please provide a clinic bio (minimum 10 characters)"),
 services_provided: z.array(z.string()).min(1,"Select at least one service"),
 accepting_new_patients: z.boolean().default(true),
 emergency_phone: z.string().optional(),
 emergency_protocol: z.string().optional(),
});

const step6Schema = z.object({
 subscription_tier: z.string().min(1,"Please select a subscription tier"),
});

const step7Schema = z.object({
 agreed_to_tos: z.boolean().refine(val => val === true,"You must agree to the Terms of Service"),
 agreed_to_vet_addendum: z.boolean().refine(val => val === true,"You must agree to the Veterinary Services Disclosure Addendum"),
 agreed_to_splicing_liability: z.boolean().refine(val => val === true,"You must agree to the Insurance Splicing Liability Agreement"),
});

const fullSchema = step1Schema.merge(step2Schema).merge(step3Schema).merge(step4Schema).merge(step5Schema).merge(step6Schema).merge(step7Schema);
type FormData = z.infer<typeof fullSchema>;

const STEPS = [
 { id: 1, title:"Practice Identity", icon: Building2, description:"Basic practice information" },
 { id: 2, title:"Medical Verification", icon: Stethoscope, description:"Credentials & licenses" },
 { id: 3, title:"Insurance Setup", icon: ShieldCheck, description:"Claim-splicing configuration" },
 { id: 4, title:"Integration", icon: Wallet, description:"Platform connections" },
 { id: 5, title:"Public Profile", icon: User, description:"How pet owners see you" },
 { id: 6, title:"Financial Setup", icon: CreditCard, description:"Payment & subscription" },
 { id: 7, title:"Legal & Compliance", icon: FileText, description:"Agreements & terms" },
 { id: 8, title:"Review", icon: Check, description:"Confirm your details" },
];

const PRACTICE_TYPES = [
"General Practice",
"Emergency",
"Specialty/Referral",
"Mobile/House Call",
"Exotic",
];

const ACCREDITATIONS = [
 { id:"aaha", label:"AAHA Accredited" },
 { id:"fear-free", label:"Fear-Free Certified" },
 { id:"cat-friendly", label:"Cat-Friendly Practice" },
];

const INSURANCE_PARTNERS = [
 { id:"trupanion", name:"Trupanion", icon:"🐾" },
 { id:"nationwide", name:"Nationwide", icon:"🏠" },
 { id:"lemonade", name:"Lemonade", icon:"🍋" },
 { id:"pets-best", name:"Pets Best", icon:"⭐" },
 { id:"embrace", name:"Embrace", icon:"🤗" },
 { id:"healthy-paws", name:"Healthy Paws", icon:"🐕" },
 { id:"figo", name:"Figo", icon:"📱" },
 { id:"aspca", name:"ASPCA", icon:"🏥" },
];

const PIMS_OPTIONS = [
"Cornerstone",
"Neo",
"ezyVet",
"AVImark",
"IDEXX Neo",
"Shepherd",
"Digitail",
"Other",
];

const SERVICES_PROVIDED = [
 { id:"general", label:"General Wellness", icon:"🩺" },
 { id:"dental", label:"Dental Care", icon:"🦷" },
 { id:"surgery", label:"Surgery", icon:"⚕️" },
 { id:"exotics", label:"Exotic Animals", icon:"🦎" },
 { id:"emergency", label:"Emergency Care", icon:"🚨" },
 { id:"dermatology", label:"Dermatology", icon:"🐾" },
 { id:"cardiology", label:"Cardiology", icon:"❤️" },
 { id:"oncology", label:"Oncology", icon:"🔬" },
];

const US_STATES = [
"AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
"HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
"MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
"NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
"SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"
];

// Use the shared Merchant TOS (which includes veterinary professionals)
const TERMS_OF_SERVICE = MERCHANT_TOS_CONTENT;

const INSURANCE_SPLICING_AGREEMENT = `Insurance Splicing & Direct-Pay Liability Agreement

Version 1.0 (January 2026)

1. Nature of Service
PawBucks.app (the"Platform") provides a proprietary"Claim-Splicing" engine designed to facilitate the division of veterinary service payments between the Pet Owner (the"Subscriber") and the Pet Insurance Provider (the"Carrier"). The Merchant (the"Veterinary Practice") acknowledges that PawBucks.app is a payment facilitator and technology provider, not an insurance underwriter or a guarantor of claim approval.

2. Adjudication &"Splicing" Logic
• Real-Time Estimates: Spliced payment amounts are calculated based on data provided by the Carrier's API or manual input by the Veterinary Practice staff. These amounts are estimates and do not constitute a final determination of coverage.
• Authorization: By initiating a Spliced Transaction, the Veterinary Practice authorizes PawBucks.app to execute two distinct payment instructions: (a) an immediate charge to the Owner's payment method for the"Co-pay/Deductible" portion, and (b) a pending ledger entry for the"Carrier" portion.

3. Recourse & Denied Claims
In the event that a Carrier denies, partially pays, or"claws back" a claim that has been processed through the Claim-Splicing engine:
• Primary Responsibility: The Pet Owner remains legally responsible for the full balance of the veterinary invoice.
• Practice Recourse: The Veterinary Practice agrees that PawBucks.app is not liable for the unpaid balance. PawBucks.app will provide the Practice with automated tools to re-invoice the Pet Owner via the Platform for any shortfall resulting from Carrier denial.
• Success Fees: Processing fees and PawBucks reward distributions are calculated based on the total invoice amount and are non-refundable once the initial transaction is successful, regardless of subsequent Carrier adjudication.

4. Accuracy of Clinical Data
The Veterinary Practice is solely responsible for the accuracy of the medical codes (ICD/CPT), clinical notes, and invoice totals submitted for splicing. Any discrepancies leading to claim rejection are the responsibility of the Practice to resolve with the Carrier.

5. Funding & Payouts
• Owner Funds: Funds collected from the Pet Owner (Co-pay) will be settled to the Practice's Stripe Connect account according to the standard payout schedule.
• Carrier Funds:"Spliced" funds from Carriers are settled to the Practice only upon actual receipt of funds from the Carrier, unless the Practice has opted into the"PawBucks Instant-Fund" program (if available), which is subject to a separate risk-premium agreement.

6. Acceptance of Terms
By checking"I Agree" and clicking"Finalize Onboarding," the authorized representative of the Veterinary Practice acknowledges they have the authority to bind the Practice to these financial terms and understands the operational mechanics of the Claim-Splicing engine.`;

// Confetti effect component
const ConfettiEffect = ({ active }: { active: boolean }) => {
 if (!active) return null;

 return (
 <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
 {[...Array(50)].map((_, i) => (
 <div
 key={i}
 className="absolute animate-confetti"
 style={{
 left: `${Math.random() * 100}%`,
 top:'-10px',
 animationDelay: `${Math.random() * 2}s`,
 animationDuration: `${2 + Math.random() * 2}s`,
 }}
 >
 <div
 className="w-3 h-3 rounded-sm"
 style={{
 backgroundColor: ['#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#ec4899'][Math.floor(Math.random() * 6)],
 transform: `rotate(${Math.random() * 360}deg)`,
 }}
 />
 </div>
 ))}
 <style>{`
 @keyframes confetti {
 0% { transform: translateY(0) rotate(0deg); opacity: 1; }
 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
 }
 .animate-confetti {
 animation: confetti 3s ease-out forwards;
 }
 `}</style>
 </div>
 );
};

export const VetOnboardingForm = () => {
 const navigate = useNavigate();
 const { user } = useAuth();
 const [currentStep, setCurrentStep] = useState(1);
 const [isSaving, setIsSaving] = useState(false);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [pendingId, setPendingId] = useState<string | null>(null);
 const [showConfetti, setShowConfetti] = useState(false);
 const [showWelcomeModal, setShowWelcomeModal] = useState(false);
 
 // Scroll detection for legal agreements
 const [hasScrolledTos, setHasScrolledTos] = useState(false);
 const [hasScrolledVetAddendum, setHasScrolledVetAddendum] = useState(false);
 const [hasScrolledSplicing, setHasScrolledSplicing] = useState(false);
 const tosScrollRef = useRef<HTMLDivElement>(null);
 const vetAddendumScrollRef = useRef<HTMLDivElement>(null);
 const splicingScrollRef = useRef<HTMLDivElement>(null);

 // Handle scroll detection for Terms of Service
 const handleTosScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
 const target = e.currentTarget;
 const isAtBottom = Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 10;
 if (isAtBottom && !hasScrolledTos) {
 setHasScrolledTos(true);
 }
 }, [hasScrolledTos]);

 // Handle scroll detection for Vet Addendum
 const handleVetAddendumScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
 const target = e.currentTarget;
 const isAtBottom = Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 10;
 if (isAtBottom && !hasScrolledVetAddendum) {
 setHasScrolledVetAddendum(true);
 }
 }, [hasScrolledVetAddendum]);

 // Handle scroll detection for Splicing Agreement
 const handleSplicingScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
 const target = e.currentTarget;
 const isAtBottom = Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 10;
 if (isAtBottom && !hasScrolledSplicing) {
 setHasScrolledSplicing(true);
 }
 }, [hasScrolledSplicing]);

 // Reset scroll states when entering Step 7
 useEffect(() => {
 if (currentStep === 7) {
 setHasScrolledTos(false);
 setHasScrolledVetAddendum(false);
 setHasScrolledSplicing(false);
 }
 }, [currentStep]);

 const form = useForm<FormData>({
 resolver: zodResolver(fullSchema),
 defaultValues: {
 legal_practice_name:"",
 dba_name:"",
 primary_phone:"",
 sms_capability: false,
 physical_address:"",
 city:"",
 state:"",
 zip_code:"",
 website_url:"",
 tax_id_ein:"",
 medical_director_name:"",
 dvm_license_number:"",
 dvm_license_state:"",
 npi_number:"",
 practice_type:"",
 accreditations: [],
 insurance_partners: [],
 direct_pay_capability: false,
 splicing_preference:"",
 admin_splicing_fee: 0,
 pims_software:"",
 data_sync_permission: false,
 preferred_referral_partners:"",
 clinic_bio:"",
 services_provided: [],
 accepting_new_patients: true,
 emergency_phone:"",
 emergency_protocol:"",
 subscription_tier:"standard",
 agreed_to_tos: false,
 agreed_to_vet_addendum: false,
 agreed_to_splicing_liability: false,
 },
 mode:"onChange",
 });

 // Load existing draft on mount
 useEffect(() => {
 const loadDraft = async () => {
 if (!user) return;

 const { data, error } = await supabase
 .from("pending_onboarding")
 .select("*")
 .eq("user_id", user.id)
 .eq("onboarding_type","vet")
 .is("completed_at", null)
 .order("updated_at", { ascending: false })
 .limit(1)
 .maybeSingle();

 if (data && !error) {
 setPendingId(data.id);
 setCurrentStep(data.current_step || 1);
 
 const formData: Partial<FormData> = {
 legal_practice_name: data.legal_practice_name ||"",
 dba_name: data.dba_name ||"",
 primary_phone: data.primary_phone ||"",
 sms_capability: data.sms_capability || false,
 physical_address: data.physical_address ||"",
 city: data.city ||"",
 state: data.state ||"",
 zip_code: data.zip_code ||"",
 website_url: data.website_url ||"",
 tax_id_ein: data.tax_id_ein ||"",
 medical_director_name: data.medical_director_name ||"",
 dvm_license_number: data.dvm_license_number ||"",
 dvm_license_state: data.dvm_license_state ||"",
 npi_number: data.npi_number ||"",
 practice_type: data.practice_type ||"",
 accreditations: data.accreditations || [],
 insurance_partners: data.insurance_partners || [],
 direct_pay_capability: data.direct_pay_capability || false,
 splicing_preference: data.splicing_preference ||"",
 admin_splicing_fee: data.admin_splicing_fee || 0,
 pims_software: data.pims_software ||"",
 data_sync_permission: data.data_sync_permission || false,
 preferred_referral_partners: data.preferred_referral_partners ||"",
 clinic_bio: data.clinic_bio ||"",
 services_provided: data.services_provided || [],
 accepting_new_patients: data.accepting_new_patients ?? true,
 emergency_phone: data.emergency_phone ||"",
 emergency_protocol: data.emergency_protocol ||"",
 subscription_tier: data.subscription_tier ||"standard",
 agreed_to_tos: data.agreed_to_tos || false,
 agreed_to_vet_addendum: (data as any).agreed_to_vet_addendum || false,
 agreed_to_splicing_liability: data.agreed_to_splicing_liability || false,
 };

 Object.entries(formData).forEach(([key, value]) => {
 form.setValue(key as keyof FormData, value as any);
 });

 toast({
 title:"Draft Loaded",
 description:"We've restored your previous progress.",
 });
 }
 };

 loadDraft();
 }, [user]);

 const validateCurrentStep = async (): Promise<boolean> => {
 const values = form.getValues();
 
 try {
 switch (currentStep) {
 case 1:
 await step1Schema.parseAsync(values);
 return true;
 case 2:
 await step2Schema.parseAsync(values);
 return true;
 case 3:
 await step3Schema.parseAsync(values);
 return true;
 case 4:
 await step4Schema.parseAsync(values);
 return true;
 case 5:
 await step5Schema.parseAsync(values);
 return true;
 case 6:
 await step6Schema.parseAsync(values);
 return true;
 case 7:
 await step7Schema.parseAsync(values);
 return true;
 case 8:
 // Review step - no validation needed
 return true;
 default:
 return true;
 }
 } catch (error) {
 if (error instanceof z.ZodError) {
 error.errors.forEach((err) => {
 form.setError(err.path[0] as keyof FormData, {
 type:"manual",
 message: err.message,
 });
 });
 }
 return false;
 }
 };

 const handleNext = async () => {
 const isValid = await validateCurrentStep();
 if (isValid && currentStep < 8) {
 setCurrentStep(currentStep + 1);
 }
 };

 const handlePrevious = () => {
 if (currentStep > 1) {
 setCurrentStep(currentStep - 1);
 }
 };

 const goToStep = (step: number) => {
 setCurrentStep(step);
 };

 const saveDraft = async () => {
 if (!user) {
 toast({
 title:"Sign In Required",
 description:"Please sign in to save your progress.",
 variant:"destructive",
 });
 return;
 }

 setIsSaving(true);
 const values = form.getValues();

 try {
 const draftData = {
 user_id: user.id,
 onboarding_type:"vet",
 current_step: currentStep,
 legal_practice_name: values.legal_practice_name,
 dba_name: values.dba_name,
 primary_phone: values.primary_phone,
 sms_capability: values.sms_capability,
 physical_address: values.physical_address,
 city: values.city,
 state: values.state,
 zip_code: values.zip_code,
 website_url: values.website_url,
 tax_id_ein: values.tax_id_ein,
 medical_director_name: values.medical_director_name,
 dvm_license_number: values.dvm_license_number,
 dvm_license_state: values.dvm_license_state,
 npi_number: values.npi_number,
 practice_type: values.practice_type,
 accreditations: values.accreditations,
 insurance_partners: values.insurance_partners,
 direct_pay_capability: values.direct_pay_capability,
 splicing_preference: values.splicing_preference,
 admin_splicing_fee: values.admin_splicing_fee,
 pims_software: values.pims_software,
 data_sync_permission: values.data_sync_permission,
 preferred_referral_partners: values.preferred_referral_partners,
 clinic_bio: values.clinic_bio,
 services_provided: values.services_provided,
 accepting_new_patients: values.accepting_new_patients,
 emergency_phone: values.emergency_phone,
 emergency_protocol: values.emergency_protocol,
 subscription_tier: values.subscription_tier,
 agreed_to_tos: values.agreed_to_tos,
 agreed_to_vet_addendum: values.agreed_to_vet_addendum,
 agreed_to_splicing_liability: values.agreed_to_splicing_liability,
 };

 if (pendingId) {
 await supabase
 .from("pending_onboarding")
 .update(draftData)
 .eq("id", pendingId);
 } else {
 const { data } = await supabase
 .from("pending_onboarding")
 .insert(draftData)
 .select("id")
 .single();
 
 if (data) setPendingId(data.id);
 }

 toast({
 title:"Progress Saved",
 description:"Your draft has been saved. You can continue later.",
 });
 } catch (error) {
 console.error("Error saving draft:", error);
 toast({
 title:"Save Failed",
 description:"Could not save your progress. Please try again.",
 variant:"destructive",
 });
 } finally {
 setIsSaving(false);
 }
 };

 const onSubmit = async (data: FormData) => {
 setIsSubmitting(true);

 try {
 // Gather all data into a single JSON payload
 const fullPayload = {
 // Step 1: Practice Identity
 legal_practice_name: data.legal_practice_name,
 dba_name: data.dba_name,
 primary_phone: data.primary_phone,
 sms_capability: data.sms_capability,
 physical_address: data.physical_address,
 city: data.city,
 state: data.state,
 zip_code: data.zip_code,
 website_url: data.website_url,
 tax_id_ein: data.tax_id_ein,
 // Step 2: Medical Verification
 medical_director_name: data.medical_director_name,
 dvm_license_number: data.dvm_license_number,
 dvm_license_state: data.dvm_license_state,
 npi_number: data.npi_number,
 practice_type: data.practice_type,
 accreditations: data.accreditations,
 // Step 3: Insurance Setup
 insurance_partners: data.insurance_partners,
 direct_pay_capability: data.direct_pay_capability,
 splicing_preference: data.splicing_preference,
 admin_splicing_fee: data.admin_splicing_fee,
 // Step 4: Integration
 pims_software: data.pims_software,
 data_sync_permission: data.data_sync_permission,
 preferred_referral_partners: data.preferred_referral_partners,
 // Step 5: Public Profile
 clinic_bio: data.clinic_bio,
 services_provided: data.services_provided,
 accepting_new_patients: data.accepting_new_patients,
 emergency_phone: data.emergency_phone,
 emergency_protocol: data.emergency_protocol,
 // Step 6: Financial
 subscription_tier: data.subscription_tier,
 // Step 7: Legal
 agreed_to_tos: data.agreed_to_tos,
 agreed_to_vet_addendum: data.agreed_to_vet_addendum,
 agreed_to_splicing_liability: data.agreed_to_splicing_liability,
 // Metadata
 user_id: user?.id,
 user_email: user?.email,
 submitted_at: new Date().toISOString(),
 };

 // Console log the final payload as requested
 console.log("POST /api/v1/vet/onboarding payload:", JSON.stringify(fullPayload, null, 2));

 // Mark pending onboarding as completed
 if (pendingId) {
 await supabase
 .from("pending_onboarding")
 .update({ completed_at: new Date().toISOString() })
 .eq("id", pendingId);
 }

 // Create the partner_vets record with all fields
 const fullAddress = `${data.physical_address}, ${data.city}, ${data.state} ${data.zip_code}`;
 const { error } = await supabase.from("partner_vets").insert({
 name: data.legal_practice_name,
 location: fullAddress,
 contact_email: user?.email ||"",
 user_id: user?.id,
 clinic_name: data.legal_practice_name,
 dba_name: data.dba_name || null,
 clinic_phone: data.primary_phone,
 sms_enabled: data.sms_capability,
 website_url: data.website_url || null,
 tax_id: data.tax_id_ein,
 medical_director_name: data.medical_director_name,
 license_number: data.dvm_license_number,
 license_state: data.dvm_license_state,
 npi_number: data.npi_number || null,
 practice_type: data.practice_type,
 accreditations: data.accreditations,
 insurance_partners: data.insurance_partners,
 direct_pay_enabled: data.direct_pay_capability,
 splicing_preference: data.splicing_preference,
 splicing_fee: data.admin_splicing_fee || null,
 pims_software: data.pims_software,
 data_sync_enabled: data.data_sync_permission,
 preferred_referrals: data.preferred_referral_partners || null,
 clinic_bio: data.clinic_bio,
 services_provided: data.services_provided,
 accepting_new_patients: data.accepting_new_patients,
 emergency_phone: data.emergency_phone || null,
 emergency_protocol: data.emergency_protocol || null,
 subscription_tier: data.subscription_tier,
 agreed_to_tos: data.agreed_to_tos,
 agreed_to_tos_at: data.agreed_to_tos ? new Date().toISOString() : null,
 agreed_to_vet_addendum: data.agreed_to_vet_addendum,
 agreed_to_vet_addendum_at: data.agreed_to_vet_addendum ? new Date().toISOString() : null,
 agreed_to_splicing_liability: data.agreed_to_splicing_liability,
 agreed_to_splicing_liability_at: data.agreed_to_splicing_liability ? new Date().toISOString() : null,
 is_verified: false,
 });

 if (error) throw error;

 // Show celebration effects
 setShowConfetti(true);
 setShowWelcomeModal(true);

 // Stop confetti after 5 seconds
 setTimeout(() => setShowConfetti(false), 5000);

 } catch (error) {
 console.error("Error submitting:", error);
 toast({
 title:"Submission Failed",
 description:"Could not complete registration. Please try again.",
 variant:"destructive",
 });
 } finally {
 setIsSubmitting(false);
 }
 };

 const handleWelcomeModalClose = () => {
 setShowWelcomeModal(false);
 navigate("/vet-dashboard");
 };

 const progressPercentage = (currentStep / 8) * 100;
 const values = form.getValues();

 return (
 <div className="min-h-screen bg-muted">
 <ConfettiEffect active={showConfetti} />
 
 {/* Welcome Modal */}
 <Dialog open={showWelcomeModal} onOpenChange={setShowWelcomeModal}>
 <DialogContent className="sm:max-w-md text-center">
 <DialogHeader>
 <div className="mx-auto mb-4 w-16 h-16 bg-primary rounded-full flex items-center justify-center">
 <PartyPopper className="h-8 w-8 text-primary-foreground" />
 </div>
 <DialogTitle className="text-2xl">Welcome to the PawBucks Family! 🎉</DialogTitle>
 <DialogDescription className="text-base mt-4">
 Your veterinary practice has been successfully registered. Our team will review your credentials 
 and you'll be ready to start accepting patients through PawBucks within 24-48 hours.
 </DialogDescription>
 </DialogHeader>
 <div className="mt-6">
 <Button
 onClick={handleWelcomeModalClose}
 className="w-full rounded-lg"
 >
 Go to Dashboard
 <ArrowRight className="h-4 w-4 ml-2" />
 </Button>
 </div>
 </DialogContent>
 </Dialog>

 {/* Header */}
 <div className="bg-card border-b border-border">
 <div className="max-w-5xl mx-auto px-4 py-6">
 <h1 className="text-2xl font-bold text-foreground">Veterinary Practice Onboarding</h1>
 <p className="text-muted-foreground mt-1">Join the PawBucks network and grow your practice</p>
 </div>
 </div>

 <div className="max-w-5xl mx-auto px-4 py-8">
 {/* Progress Stepper */}
 <div className="mb-8">
 <Progress value={progressPercentage} className="h-2 mb-6" />
 <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
 {STEPS.map((step) => {
 const Icon = step.icon;
 const isActive = currentStep === step.id;
 const isCompleted = currentStep > step.id;

 return (
 <div
 key={step.id}
 className={cn(
"flex flex-col items-center text-center p-2 rounded-lg transition-all cursor-pointer",
 isActive &&"bg-primary/10 border-2 border-primary",
 isCompleted &&"bg-success/10 hover:bg-success/15",
 !isActive && !isCompleted &&"bg-card border border-border hover:border-primary/40"
 )}
 onClick={() => isCompleted && goToStep(step.id)}
 >
 <div
 className={cn(
"w-8 h-8 rounded-full flex items-center justify-center mb-1",
 isActive &&"bg-primary text-primary-foreground",
 isCompleted &&"bg-success text-success-foreground",
 !isActive && !isCompleted &&"bg-muted text-muted-foreground"
 )}
 >
 {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
 </div>
 <span className={cn(
"text-xs font-medium hidden md:block",
 isActive &&"text-primary",
 isCompleted &&"text-success",
 !isActive && !isCompleted &&"text-muted-foreground"
 )}>
 {step.title}
 </span>
 </div>
 );
 })}
 </div>
 </div>

 {/* Form */}
 <Form {...form}>
 <form onSubmit={form.handleSubmit(onSubmit)}>
 {/* Step 1: Practice Identity */}
 {currentStep === 1 && (
 <Card className="bg-card border-border rounded-lg shadow-sm">
 <CardHeader className="border-b border-border">
 <CardTitle className="flex items-center gap-2 text-muted-foreground">
 <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
 Practice Identity
 </CardTitle>
 <CardDescription>Tell us about your veterinary practice</CardDescription>
 </CardHeader>
 <CardContent className="pt-6 space-y-6">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <FormField
 control={form.control}
 name="legal_practice_name"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Legal Practice Name *</FormLabel>
 <FormControl>
 <Input placeholder="Northside Animal Hospital" {...field} className="rounded-lg" />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="dba_name"
 render={({ field }) => (
 <FormItem>
 <FormLabel>DBA Name (if different)</FormLabel>
 <FormControl>
 <Input placeholder="Optional" {...field} className="rounded-lg" />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <FormField
 control={form.control}
 name="primary_phone"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Primary Clinic Phone *</FormLabel>
 <FormControl>
 <Input placeholder="(555) 123-4567" {...field} className="rounded-lg" />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="sms_capability"
 render={({ field }) => (
 <FormItem className="flex items-center justify-between rounded-lg border border-border p-4">
 <div>
 <FormLabel>SMS Appointment Reminders</FormLabel>
 <FormDescription>Enable text message reminders</FormDescription>
 </div>
 <FormControl>
 <Switch checked={field.value} onCheckedChange={field.onChange} />
 </FormControl>
 </FormItem>
 )}
 />
 </div>

 <FormField
 control={form.control}
 name="physical_address"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Physical Address *</FormLabel>
 <FormControl>
 <Input placeholder="123 Main Street" {...field} className="rounded-lg" />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />

 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <FormField
 control={form.control}
 name="city"
 render={({ field }) => (
 <FormItem className="col-span-2 md:col-span-2">
 <FormLabel>City *</FormLabel>
 <FormControl>
 <Input placeholder="San Francisco" {...field} className="rounded-lg" />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="state"
 render={({ field }) => (
 <FormItem>
 <FormLabel>State *</FormLabel>
 <Select onValueChange={field.onChange} value={field.value}>
 <FormControl>
 <SelectTrigger className="rounded-lg">
 <SelectValue placeholder="State" />
 </SelectTrigger>
 </FormControl>
 <SelectContent>
 {US_STATES.map((state) => (
 <SelectItem key={state} value={state}>{state}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 <FormMessage />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="zip_code"
 render={({ field }) => (
 <FormItem>
 <FormLabel>ZIP *</FormLabel>
 <FormControl>
 <Input placeholder="94102" {...field} className="rounded-lg" />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <FormField
 control={form.control}
 name="website_url"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Clinic Website URL</FormLabel>
 <FormControl>
 <Input placeholder="https://yourvet.com" {...field} className="rounded-lg" />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="tax_id_ein"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Tax ID (EIN) *</FormLabel>
 <FormControl>
 <Input placeholder="XX-XXXXXXX" {...field} className="rounded-lg" />
 </FormControl>
 <FormDescription>Required for payment processing</FormDescription>
 <FormMessage />
 </FormItem>
 )}
 />
 </div>
 </CardContent>
 </Card>
 )}

 {/* Step 2: Medical Verification */}
 {currentStep === 2 && (
 <Card className="bg-card border-border rounded-lg shadow-sm">
 <CardHeader className="border-b border-border">
 <CardTitle className="flex items-center gap-2 text-muted-foreground">
 <Stethoscope className="h-5 w-5 text-primary" aria-hidden="true" />
 Medical Authority & Verification
 </CardTitle>
 <CardDescription>Verify your professional credentials</CardDescription>
 </CardHeader>
 <CardContent className="pt-6 space-y-6">
 <FormField
 control={form.control}
 name="medical_director_name"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Medical Director Name (Lead DVM) *</FormLabel>
 <FormControl>
 <Input placeholder="Dr. Jane Smith, DVM" {...field} className="rounded-lg" />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />

 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <FormField
 control={form.control}
 name="dvm_license_number"
 render={({ field }) => (
 <FormItem>
 <FormLabel>DVM License Number *</FormLabel>
 <FormControl>
 <Input placeholder="VET-123456" {...field} className="rounded-lg" />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="dvm_license_state"
 render={({ field }) => (
 <FormItem>
 <FormLabel>State of Issuance *</FormLabel>
 <Select onValueChange={field.onChange} value={field.value}>
 <FormControl>
 <SelectTrigger className="rounded-lg">
 <SelectValue placeholder="Select state" />
 </SelectTrigger>
 </FormControl>
 <SelectContent>
 {US_STATES.map((state) => (
 <SelectItem key={state} value={state}>{state}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 <FormMessage />
 </FormItem>
 )}
 />
 </div>

 <FormField
 control={form.control}
 name="npi_number"
 render={({ field }) => (
 <FormItem>
 <FormLabel>National Provider Identifier (NPI)</FormLabel>
 <FormControl>
 <Input placeholder="10-digit NPI (if applicable)" {...field} className="rounded-lg" />
 </FormControl>
 <FormDescription>Optional - becoming standard in 2026</FormDescription>
 <FormMessage />
 </FormItem>
 )}
 />

 <FormField
 control={form.control}
 name="practice_type"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Practice Type *</FormLabel>
 <Select onValueChange={field.onChange} value={field.value}>
 <FormControl>
 <SelectTrigger className="rounded-lg">
 <SelectValue placeholder="Select practice type" />
 </SelectTrigger>
 </FormControl>
 <SelectContent>
 {PRACTICE_TYPES.map((type) => (
 <SelectItem key={type} value={type}>{type}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 <FormMessage />
 </FormItem>
 )}
 />

 <FormField
 control={form.control}
 name="accreditations"
 render={() => (
 <FormItem>
 <FormLabel>Accreditations & Certifications</FormLabel>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
 {ACCREDITATIONS.map((item) => (
 <FormField
 key={item.id}
 control={form.control}
 name="accreditations"
 render={({ field }) => (
 <FormItem
 className={cn(
"flex items-center space-x-3 space-y-0 rounded-lg border p-4 cursor-pointer transition-all",
 field.value?.includes(item.id)
 ?"border-primary bg-primary/10"
 :"border-border hover:border-primary/40"
 )}
 >
 <FormControl>
 <Checkbox
 checked={field.value?.includes(item.id)}
 onCheckedChange={(checked) => {
 const current = field.value || [];
 return checked
 ? field.onChange([...current, item.id])
 : field.onChange(current.filter((v) => v !== item.id));
 }}
 />
 </FormControl>
 <FormLabel className="font-normal cursor-pointer">{item.label}</FormLabel>
 </FormItem>
 )}
 />
 ))}
 </div>
 <FormMessage />
 </FormItem>
 )}
 />
 </CardContent>
 </Card>
 )}

 {/* Step 3: Insurance Setup */}
 {currentStep === 3 && (
 <Card className="bg-card border-border rounded-lg shadow-sm">
 <CardHeader className="border-b border-border">
 <CardTitle className="flex items-center gap-2 text-muted-foreground">
 <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
 Claim-Splicing Configuration
 </CardTitle>
 <CardDescription>Set up your insurance processing preferences</CardDescription>
 </CardHeader>
 <CardContent className="pt-6 space-y-6">
 <FormField
 control={form.control}
 name="insurance_partners"
 render={() => (
 <FormItem>
 <FormLabel>Insurance Partners *</FormLabel>
 <FormDescription>Select the insurance carriers you work with</FormDescription>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
 {INSURANCE_PARTNERS.map((partner) => (
 <FormField
 key={partner.id}
 control={form.control}
 name="insurance_partners"
 render={({ field }) => (
 <FormItem
 className={cn(
"flex flex-col items-center justify-center p-4 rounded-lg border cursor-pointer transition-all text-center",
 field.value?.includes(partner.id)
 ?"border-primary bg-primary/10 ring-2 ring-primary"
 :"border-border hover:border-primary/40"
 )}
 onClick={() => {
 const current = field.value || [];
 const updated = current.includes(partner.id)
 ? current.filter((v) => v !== partner.id)
 : [...current, partner.id];
 field.onChange(updated);
 }}
 >
 <span className="text-2xl mb-2">{partner.icon}</span>
 <FormLabel className="font-medium cursor-pointer text-sm">
 {partner.name}
 </FormLabel>
 </FormItem>
 )}
 />
 ))}
 </div>
 <FormMessage />
 </FormItem>
 )}
 />

 <FormField
 control={form.control}
 name="direct_pay_capability"
 render={({ field }) => (
 <FormItem className="flex items-center justify-between rounded-lg border border-border p-4">
 <div>
 <FormLabel>Direct-Pay from Insurers</FormLabel>
 <FormDescription>
 Do you currently accept direct payments from insurance carriers?
 </FormDescription>
 </div>
 <FormControl>
 <Switch checked={field.value} onCheckedChange={field.onChange} />
 </FormControl>
 </FormItem>
 )}
 />

 <FormField
 control={form.control}
 name="splicing_preference"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Claim Processing Preference *</FormLabel>
 <Select onValueChange={field.onChange} value={field.value}>
 <FormControl>
 <SelectTrigger className="rounded-lg">
 <SelectValue placeholder="Select processing method" />
 </SelectTrigger>
 </FormControl>
 <SelectContent>
 <SelectItem value="manual">Manual Adjudication</SelectItem>
 <SelectItem value="api">API-Integrated (Automated)</SelectItem>
 </SelectContent>
 </Select>
 <FormDescription>
 API integration automates claim splitting with supported carriers
 </FormDescription>
 <FormMessage />
 </FormItem>
 )}
 />

 <FormField
 control={form.control}
 name="admin_splicing_fee"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Admin Splicing Fee (Optional)</FormLabel>
 <FormControl>
 <div className="relative">
 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
 <Input
 type="number"
 min={0}
 max={50}
 placeholder="0.00"
 className="pl-8 rounded-lg"
 {...field}
 onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
 />
 </div>
 </FormControl>
 <FormDescription>
 Optional fee ($5–$10 typical) charged to pet owners for processing insurance splits
 </FormDescription>
 <FormMessage />
 </FormItem>
 )}
 />
 </CardContent>
 </Card>
 )}

 {/* Step 4: Integration */}
 {currentStep === 4 && (
 <Card className="bg-card border-border rounded-lg shadow-sm">
 <CardHeader className="border-b border-border">
 <CardTitle className="flex items-center gap-2 text-muted-foreground">
 <Wallet className="h-5 w-5 text-primary" aria-hidden="true" />
 Platform Integration
 </CardTitle>
 <CardDescription>Connect your practice management systems</CardDescription>
 </CardHeader>
 <CardContent className="pt-6 space-y-6">
 <FormField
 control={form.control}
 name="pims_software"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Practice Information Management System (PIMS) *</FormLabel>
 <Select onValueChange={field.onChange} value={field.value}>
 <FormControl>
 <SelectTrigger className="rounded-lg">
 <SelectValue placeholder="Select your PIMS software" />
 </SelectTrigger>
 </FormControl>
 <SelectContent>
 {PIMS_OPTIONS.map((pims) => (
 <SelectItem key={pims} value={pims}>{pims}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 <FormMessage />
 </FormItem>
 )}
 />

 <FormField
 control={form.control}
 name="data_sync_permission"
 render={({ field }) => (
 <FormItem className="rounded-lg border border-border p-4">
 <div className="flex items-start space-x-4">
 <FormControl>
 <Checkbox
 checked={field.value}
 onCheckedChange={field.onChange}
 className="mt-1"
 />
 </FormControl>
 <div>
 <FormLabel className="font-medium">Data Sync Authorization</FormLabel>
 <FormDescription className="text-sm text-muted-foreground mt-1">
 I authorize PawBucks to sync patient vaccine and appointment history from my PIMS 
 to provide seamless health record access for pet owners.
 </FormDescription>
 </div>
 </div>
 </FormItem>
 )}
 />

 <FormField
 control={form.control}
 name="preferred_referral_partners"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Preferred Referral Partners</FormLabel>
 <FormControl>
 <Textarea
 placeholder="List any local trainers, walkers, groomers, or specialists you currently trust and recommend to clients..."
 className="rounded-lg min-h-[100px]"
 {...field}
 />
 </FormControl>
 <FormDescription>
 These partners may receive priority visibility in your patient's app recommendations
 </FormDescription>
 <FormMessage />
 </FormItem>
 )}
 />
 </CardContent>
 </Card>
 )}

 {/* Step 5: Public Profile & Merchant Display */}
 {currentStep === 5 && (
 <Card className="bg-card border-border rounded-lg shadow-sm">
 <CardHeader className="border-b border-border">
 <CardTitle className="flex items-center gap-2 text-muted-foreground">
 <User className="h-5 w-5 text-primary" aria-hidden="true" />
 Public Profile & Merchant Display
 </CardTitle>
 <CardDescription>How pet owners will see your practice</CardDescription>
 </CardHeader>
 <CardContent className="pt-6 space-y-6">
 <FormField
 control={form.control}
 name="clinic_bio"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Clinic Bio *</FormLabel>
 <FormControl>
 <Textarea
 placeholder="Tell pet owners about your practice, your philosophy of care, and what makes you unique..."
 className="rounded-lg min-h-[150px]"
 {...field}
 />
 </FormControl>
 <FormDescription>
 This will be displayed on your public profile. Rich formatting is supported.
 </FormDescription>
 <FormMessage />
 </FormItem>
 )}
 />

 <FormField
 control={form.control}
 name="services_provided"
 render={() => (
 <FormItem>
 <FormLabel>Services Provided *</FormLabel>
 <FormDescription>Select all services your practice offers</FormDescription>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
 {SERVICES_PROVIDED.map((service) => (
 <FormField
 key={service.id}
 control={form.control}
 name="services_provided"
 render={({ field }) => (
 <FormItem
 className={cn(
"flex flex-col items-center justify-center p-4 rounded-lg border cursor-pointer transition-all text-center",
 field.value?.includes(service.id)
 ?"border-primary bg-primary/10 ring-2 ring-primary"
 :"border-border hover:border-primary/40"
 )}
 onClick={() => {
 const current = field.value || [];
 const updated = current.includes(service.id)
 ? current.filter((v) => v !== service.id)
 : [...current, service.id];
 field.onChange(updated);
 }}
 >
 <span className="text-2xl mb-2">{service.icon}</span>
 <FormLabel className="font-medium cursor-pointer text-sm">
 {service.label}
 </FormLabel>
 </FormItem>
 )}
 />
 ))}
 </div>
 <FormMessage />
 </FormItem>
 )}
 />

 <FormField
 control={form.control}
 name="accepting_new_patients"
 render={({ field }) => (
 <FormItem className="flex items-center justify-between rounded-lg border border-border p-4">
 <div>
 <FormLabel>Accepting New Patients</FormLabel>
 <FormDescription>
 Toggle off if you're currently not accepting new patients
 </FormDescription>
 </div>
 <FormControl>
 <Switch checked={field.value} onCheckedChange={field.onChange} />
 </FormControl>
 </FormItem>
 )}
 />

 <div className="space-y-4 rounded-lg border border-border p-4">
 <div className="flex items-center gap-2 text-muted-foreground font-medium">
 <Phone className="h-5 w-5 text-primary" aria-hidden="true" />
 Emergency Protocol
 </div>
 
 <FormField
 control={form.control}
 name="emergency_phone"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Emergency Phone Number</FormLabel>
 <FormControl>
 <Input placeholder="(555) 911-1234" {...field} className="rounded-lg" />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />

 <FormField
 control={form.control}
 name="emergency_protocol"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Emergency Instructions</FormLabel>
 <FormControl>
 <Textarea
 placeholder="For after-hours emergencies, please call our emergency line or proceed to the nearest emergency animal hospital..."
 className="rounded-lg min-h-[80px]"
 {...field}
 />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />

 {values.emergency_phone && (
 <div className="mt-4 p-3 bg-muted rounded-lg">
 <p className="text-sm text-muted-foreground mb-2">Tap to Call Preview:</p>
 <Button
 type="button"
 variant="outline"
 className="w-full rounded-lg border-primary/20 text-primary hover:bg-primary/10"
 onClick={() => window.open(`tel:${values.emergency_phone}`)}
 >
 <Phone className="h-4 w-4 mr-2" aria-hidden="true" />
 Call Emergency Line: {values.emergency_phone}
 </Button>
 </div>
 )}
 </div>
 </CardContent>
 </Card>
 )}

 {/* Step 6: Financial Onboarding */}
 {currentStep === 6 && (
 <Card className="bg-card border-border rounded-lg shadow-sm">
 <CardHeader className="border-b border-border">
 <CardTitle className="flex items-center gap-2 text-muted-foreground">
 <CreditCard className="h-5 w-5 text-primary" aria-hidden="true" />
 Financial Onboarding
 </CardTitle>
 <CardDescription>Set up your payment processing and subscription</CardDescription>
 </CardHeader>
 <CardContent className="pt-6 space-y-6">
 {/* Stripe Connect Card */}
 <div className="rounded-lg border-2 border-dashed border-border p-6 text-center">
 <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-primary/20 to-primary/20 rounded-full flex items-center justify-center">
 <CreditCard className="h-8 w-8 text-primary-foreground" aria-hidden="true" />
 </div>
 <h3 className="text-lg font-semibold text-muted-foreground mb-2">Stripe Connect</h3>
 <p className="text-muted-foreground mb-4">
 Connect your bank account to receive payments directly from pet owners and insurance carriers.
 </p>
 <Button
 type="button"
 className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg"
 onClick={() => {
 toast({
 title:"Stripe Connect",
 description:"Bank account connection will be available after registration.",
 });
 }}
 >
 Connect Bank Account
 </Button>
 <p className="text-xs text-muted-foreground mt-3">
 You can complete this step after registration from your dashboard
 </p>
 </div>

 {/* Tier Selection */}
 <FormField
 control={form.control}
 name="subscription_tier"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Select Your Subscription Tier *</FormLabel>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
 {/* Standard Tier */}
 <div
 className={cn(
"relative rounded-lg border-2 p-6 cursor-pointer transition-all",
 field.value ==="standard"
 ?"border-primary bg-primary/10 ring-2 ring-primary"
 :"border-border hover:border-primary/40"
 )}
 onClick={() => field.onChange("standard")}
 >
 {field.value ==="standard" && (
 <div className="absolute top-3 right-3 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
 <Check className="h-4 w-4 text-primary-foreground" />
 </div>
 )}
 <div className="mb-4">
 <h4 className="text-lg font-semibold text-muted-foreground">Standard</h4>
 <p className="text-2xl font-bold text-primary mt-1">$99<span className="text-sm font-normal text-muted-foreground">/month</span></p>
 </div>
 <ul className="space-y-2 text-sm text-muted-foreground">
 <li className="flex items-center gap-2">
 <Check className="h-4 w-4 text-success" />
 Full EMR System Access
 </li>
 <li className="flex items-center gap-2">
 <Check className="h-4 w-4 text-success" />
 <span className="font-medium text-primary">Claim-Splicing Engine</span>
 </li>
 <li className="flex items-center gap-2">
 <Check className="h-4 w-4 text-success" />
 AI Clinical Assistant
 </li>
 <li className="flex items-center gap-2">
 <Check className="h-4 w-4 text-success" />
 Patient Portal
 </li>
 <li className="flex items-center gap-2">
 <Check className="h-4 w-4 text-success" />
 3% Transaction Fee
 </li>
 </ul>
 </div>

 {/* Enterprise Tier */}
 <div
 className={cn(
"relative rounded-lg border-2 p-6 cursor-pointer transition-all",
 field.value ==="enterprise"
 ?"border-primary bg-primary/10 ring-2 ring-primary"
 :"border-border hover:border-primary/40"
 )}
 onClick={() => field.onChange("enterprise")}
 >
 <div className="absolute -top-3 left-4 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
 Most Popular
 </div>
 {field.value ==="enterprise" && (
 <div className="absolute top-3 right-3 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
 <Check className="h-4 w-4 text-primary-foreground" />
 </div>
 )}
 <div className="mb-4">
 <h4 className="text-lg font-semibold text-muted-foreground">Enterprise</h4>
 <p className="text-2xl font-bold text-primary mt-1">$299<span className="text-sm font-normal text-muted-foreground">/month</span></p>
 </div>
 <ul className="space-y-2 text-sm text-muted-foreground">
 <li className="flex items-center gap-2">
 <Check className="h-4 w-4 text-success" />
 Everything in Standard
 </li>
 <li className="flex items-center gap-2">
 <Check className="h-4 w-4 text-success" />
 Multi-Location Support
 </li>
 <li className="flex items-center gap-2">
 <Check className="h-4 w-4 text-success" />
 Advanced Analytics
 </li>
 <li className="flex items-center gap-2">
 <Check className="h-4 w-4 text-success" />
 Priority Support
 </li>
 <li className="flex items-center gap-2">
 <Check className="h-4 w-4 text-success" />
 2% Transaction Fee
 </li>
 <li className="flex items-center gap-2">
 <Check className="h-4 w-4 text-success" />
 Custom Integrations
 </li>
 </ul>
 </div>
 </div>
 <FormMessage />
 </FormItem>
 )}
 />
 </CardContent>
 </Card>
 )}

 {/* Step 7: Legal & Compliance */}
 {currentStep === 7 && (
 <Card className="bg-card border-border rounded-lg shadow-sm">
 <CardHeader className="border-b border-border">
 <CardTitle className="flex items-center gap-2 text-muted-foreground">
 <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
 Legal & Compliance
 </CardTitle>
 <CardDescription>Review and agree to our terms and policies</CardDescription>
 </CardHeader>
 <CardContent className="pt-6 space-y-6">
 {/* Terms of Service */}
 <div className="space-y-4">
 <Label className="text-base font-semibold">PawBucks Merchant Terms of Service</Label>
 <p className="text-sm text-muted-foreground">
 This agreement applies to all merchants and veterinary professionals using the platform.
 </p>
 <div 
 ref={tosScrollRef}
 onScroll={handleTosScroll}
 className="h-64 rounded-lg border border-border p-4 bg-muted overflow-y-auto"
 >
 <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans">
 {TERMS_OF_SERVICE}
 </pre>
 </div>
 {!hasScrolledTos && (
 <p className="text-xs text-warning flex items-center gap-1">
 <span className="inline-block w-1.5 h-1.5 bg-warning rounded-full animate-pulse" />
 Please scroll to the bottom to read the entire agreement
 </p>
 )}
 <FormField
 control={form.control}
 name="agreed_to_tos"
 render={({ field }) => (
 <FormItem className="flex items-start space-x-3 space-y-0">
 <FormControl>
 <Checkbox
 checked={field.value}
 onCheckedChange={field.onChange}
 disabled={!hasScrolledTos}
 className={cn(!hasScrolledTos &&"opacity-50 cursor-not-allowed")}
 />
 </FormControl>
 <div className="leading-none">
 <FormLabel className={cn(
"text-sm font-medium",
 !hasScrolledTos &&"text-muted-foreground"
 )}>
 I have read and agree to the PawBucks Merchant Terms of Service *
 </FormLabel>
 </div>
 <FormMessage />
 </FormItem>
 )}
 />
 </div>

 {/* Veterinary Services Disclosure Addendum */}
 <div className="space-y-4">
 <Label className="text-base font-semibold">Veterinary Services Disclosure Addendum</Label>
 <p className="text-sm text-muted-foreground">
 This addendum supplements the Merchant Terms of Service and applies specifically to veterinary professionals.
 </p>
 <div 
 ref={vetAddendumScrollRef}
 onScroll={handleVetAddendumScroll}
 className="h-64 rounded-lg border border-border p-4 bg-muted overflow-y-auto"
 >
 <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans">
 {VET_ADDENDUM_CONTENT}
 </pre>
 </div>
 {!hasScrolledVetAddendum && (
 <p className="text-xs text-warning flex items-center gap-1">
 <span className="inline-block w-1.5 h-1.5 bg-warning rounded-full animate-pulse" />
 Please scroll to the bottom to read the entire addendum
 </p>
 )}
 <FormField
 control={form.control}
 name="agreed_to_vet_addendum"
 render={({ field }) => (
 <FormItem className="flex items-start space-x-3 space-y-0">
 <FormControl>
 <Checkbox
 checked={field.value}
 onCheckedChange={field.onChange}
 disabled={!hasScrolledVetAddendum}
 className={cn(!hasScrolledVetAddendum &&"opacity-50 cursor-not-allowed")}
 />
 </FormControl>
 <div className="leading-none">
 <FormLabel className={cn(
"text-sm font-medium",
 !hasScrolledVetAddendum &&"text-muted-foreground"
 )}>
 I have read and agree to the Veterinary Services Disclosure Addendum *
 </FormLabel>
 </div>
 <FormMessage />
 </FormItem>
 )}
 />
 </div>

 {/* Insurance Splicing & Direct-Pay Liability Agreement */}
 <div className="space-y-4">
 <Label className="text-base font-semibold">Insurance Splicing & Direct-Pay Liability Agreement</Label>
 <div 
 ref={splicingScrollRef}
 onScroll={handleSplicingScroll}
 className="h-64 rounded-lg border border-border p-4 bg-muted overflow-y-auto"
 >
 <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
 {INSURANCE_SPLICING_AGREEMENT}
 </pre>
 </div>
 {!hasScrolledSplicing && (
 <p className="text-xs text-warning flex items-center gap-1">
 <span className="inline-block w-1.5 h-1.5 bg-warning rounded-full animate-pulse" />
 Please scroll to the bottom to enable agreement
 </p>
 )}
 <FormField
 control={form.control}
 name="agreed_to_splicing_liability"
 render={({ field }) => (
 <FormItem className="flex items-start space-x-3 space-y-0">
 <FormControl>
 <Checkbox
 checked={field.value}
 onCheckedChange={field.onChange}
 disabled={!hasScrolledSplicing}
 className={cn(!hasScrolledSplicing &&"opacity-50 cursor-not-allowed")}
 />
 </FormControl>
 <div className="leading-none">
 <FormLabel className={cn(
"text-sm font-medium",
 !hasScrolledSplicing &&"text-muted-foreground"
 )}>
 I have read and agree to the Insurance Splicing & Direct-Pay Liability Agreement *
 </FormLabel>
 </div>
 <FormMessage />
 </FormItem>
 )}
 />
 </div>
 </CardContent>
 </Card>
 )}

 {/* Step 8: Review */}
 {currentStep === 8 && (
 <Card className="bg-card border-border rounded-lg shadow-sm">
 <CardHeader className="border-b border-border">
 <CardTitle className="flex items-center gap-2 text-muted-foreground">
 <Check className="h-5 w-5 text-primary" />
 Review Your Details
 </CardTitle>
 <CardDescription>Please verify all information before submitting</CardDescription>
 </CardHeader>
 <CardContent className="pt-6 space-y-6">
 {/* Practice Identity Summary */}
 <div className="rounded-lg border border-border p-4">
 <div className="flex items-center justify-between mb-3">
 <h4 className="font-semibold text-muted-foreground flex items-center gap-2">
 <Building2 className="h-4 w-4 text-primary" aria-hidden="true" />
 Practice Identity
 </h4>
 <Button type="button" variant="ghost" size="sm" onClick={() => goToStep(1)}>
 <Edit className="h-4 w-4 mr-1" /> Edit
 </Button>
 </div>
 <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
 <div><span className="text-muted-foreground">Name:</span> {values.legal_practice_name}</div>
 <div><span className="text-muted-foreground">Phone:</span> {values.primary_phone}</div>
 <div><span className="text-muted-foreground">Address:</span> {values.physical_address}, {values.city}, {values.state} {values.zip_code}</div>
 <div><span className="text-muted-foreground">EIN:</span> {values.tax_id_ein}</div>
 </div>
 </div>

 {/* Medical Verification Summary */}
 <div className="rounded-lg border border-border p-4">
 <div className="flex items-center justify-between mb-3">
 <h4 className="font-semibold text-muted-foreground flex items-center gap-2">
 <Stethoscope className="h-4 w-4 text-primary" aria-hidden="true" />
 Medical Verification
 </h4>
 <Button type="button" variant="ghost" size="sm" onClick={() => goToStep(2)}>
 <Edit className="h-4 w-4 mr-1" /> Edit
 </Button>
 </div>
 <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
 <div><span className="text-muted-foreground">Medical Director:</span> {values.medical_director_name}</div>
 <div><span className="text-muted-foreground">License:</span> {values.dvm_license_number} ({values.dvm_license_state})</div>
 <div><span className="text-muted-foreground">Practice Type:</span> {values.practice_type}</div>
 <div><span className="text-muted-foreground">Accreditations:</span> {values.accreditations?.join(",") ||"None"}</div>
 </div>
 </div>

 {/* Insurance Setup Summary */}
 <div className="rounded-lg border border-border p-4">
 <div className="flex items-center justify-between mb-3">
 <h4 className="font-semibold text-muted-foreground flex items-center gap-2">
 <Shield className="h-4 w-4 text-primary" aria-hidden="true" />
 Insurance Setup
 </h4>
 <Button type="button" variant="ghost" size="sm" onClick={() => goToStep(3)}>
 <Edit className="h-4 w-4 mr-1" /> Edit
 </Button>
 </div>
 <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
 <div><span className="text-muted-foreground">Partners:</span> {values.insurance_partners?.length || 0} selected</div>
 <div><span className="text-muted-foreground">Direct-Pay:</span> {values.direct_pay_capability ?"Yes" :"No"}</div>
 <div><span className="text-muted-foreground">Splicing:</span> {values.splicing_preference ==="api" ?"API-Integrated" :"Manual"}</div>
 <div><span className="text-muted-foreground">Fee:</span> ${values.admin_splicing_fee || 0}</div>
 </div>
 </div>

 {/* Integration Summary */}
 <div className="rounded-lg border border-border p-4">
 <div className="flex items-center justify-between mb-3">
 <h4 className="font-semibold text-muted-foreground flex items-center gap-2">
 <Wallet className="h-4 w-4 text-primary" aria-hidden="true" />
 Integration
 </h4>
 <Button type="button" variant="ghost" size="sm" onClick={() => goToStep(4)}>
 <Edit className="h-4 w-4 mr-1" /> Edit
 </Button>
 </div>
 <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
 <div><span className="text-muted-foreground">PIMS:</span> {values.pims_software}</div>
 <div><span className="text-muted-foreground">Data Sync:</span> {values.data_sync_permission ?"Authorized" :"Not Authorized"}</div>
 </div>
 </div>

 {/* Public Profile Summary */}
 <div className="rounded-lg border border-border p-4">
 <div className="flex items-center justify-between mb-3">
 <h4 className="font-semibold text-muted-foreground flex items-center gap-2">
 <User className="h-4 w-4 text-primary" aria-hidden="true" />
 Public Profile
 </h4>
 <Button type="button" variant="ghost" size="sm" onClick={() => goToStep(5)}>
 <Edit className="h-4 w-4 mr-1" /> Edit
 </Button>
 </div>
 <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
 <div><span className="text-muted-foreground">Services:</span> {values.services_provided?.length || 0} selected</div>
 <div><span className="text-muted-foreground">New Patients:</span> {values.accepting_new_patients ?"Accepting" :"Not Accepting"}</div>
 <div><span className="text-muted-foreground">Emergency Phone:</span> {values.emergency_phone ||"Not set"}</div>
 </div>
 </div>

 {/* Financial Summary */}
 <div className="rounded-lg border border-border p-4">
 <div className="flex items-center justify-between mb-3">
 <h4 className="font-semibold text-muted-foreground flex items-center gap-2">
 <CreditCard className="h-4 w-4 text-primary" aria-hidden="true" />
 Financial Setup
 </h4>
 <Button type="button" variant="ghost" size="sm" onClick={() => goToStep(6)}>
 <Edit className="h-4 w-4 mr-1" /> Edit
 </Button>
 </div>
 <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
 <div><span className="text-muted-foreground">Subscription:</span> {values.subscription_tier ==="enterprise" ?"Enterprise ($299/mo)" :"Standard ($99/mo)"}</div>
 <div><span className="text-muted-foreground">Stripe:</span> Connect after registration</div>
 </div>
 </div>

 {/* Legal Summary */}
 <div className="rounded-lg border border-border p-4">
 <div className="flex items-center justify-between mb-3">
 <h4 className="font-semibold text-muted-foreground flex items-center gap-2">
 <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
 Legal & Compliance
 </h4>
 <Button type="button" variant="ghost" size="sm" onClick={() => goToStep(7)}>
 <Edit className="h-4 w-4 mr-1" /> Edit
 </Button>
 </div>
 <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
 <div className="flex items-center gap-2">
 {values.agreed_to_tos ? <Check className="h-4 w-4 text-success" /> : <span className="h-4 w-4 rounded border border-border" />}
 Terms of Service
 </div>
 <div className="flex items-center gap-2">
 {values.agreed_to_splicing_liability ? <Check className="h-4 w-4 text-success" /> : <span className="h-4 w-4 rounded border border-border" />}
 Splicing Liability Agreement
 </div>
 </div>
 </div>
 </CardContent>
 </Card>
 )}

 {/* Navigation Buttons */}
 <div className="flex justify-between items-center mt-8">
 <Button
 type="button"
 variant="outline"
 onClick={saveDraft}
 disabled={isSaving}
 className="rounded-lg"
 >
 <Save className="h-4 w-4 mr-2" />
 {isSaving ?"Saving..." :"Save & Finish Later"}
 </Button>

 <div className="flex gap-4">
 {currentStep > 1 && (
 <Button
 type="button"
 variant="outline"
 onClick={handlePrevious}
 className="rounded-lg"
 >
 <ArrowLeft className="h-4 w-4 mr-2" />
 Previous
 </Button>
 )}

 {currentStep < 8 ? (
 <Button
 type="button"
 onClick={handleNext}
 className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg"
 >
 Next
 <ArrowRight className="h-4 w-4 ml-2" />
 </Button>
 ) : (
 <Button
 type="submit"
 disabled={isSubmitting || !values.agreed_to_tos || !values.agreed_to_splicing_liability}
 className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg"
 >
 {isSubmitting ? (
 <>Submitting...</>
 ) : (
 <>
 <Sparkles className="h-4 w-4 mr-2" />
 Complete Registration
 </>
 )}
 </Button>
 )}
 </div>
 </div>
 </form>
 </Form>
 </div>
 </div>
 );
};
