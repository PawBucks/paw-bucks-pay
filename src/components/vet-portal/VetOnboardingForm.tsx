import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Stethoscope, ShieldCheck, Wallet, Check, Save, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

// Step schemas
const step1Schema = z.object({
  legal_practice_name: z.string().min(2, "Practice name is required"),
  dba_name: z.string().optional(),
  primary_phone: z.string().min(10, "Valid phone number required"),
  sms_capability: z.boolean().default(false),
  physical_address: z.string().min(5, "Address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  zip_code: z.string().min(5, "ZIP code is required"),
  website_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  tax_id_ein: z.string().min(9, "Valid EIN required (XX-XXXXXXX)"),
});

const step2Schema = z.object({
  medical_director_name: z.string().min(2, "Director name is required"),
  dvm_license_number: z.string().min(4, "License number is required"),
  dvm_license_state: z.string().min(2, "License state is required"),
  npi_number: z.string().optional(),
  practice_type: z.string().min(1, "Practice type is required"),
  accreditations: z.array(z.string()).default([]),
});

const step3Schema = z.object({
  insurance_partners: z.array(z.string()).min(1, "Select at least one insurance partner"),
  direct_pay_capability: z.boolean().default(false),
  splicing_preference: z.string().min(1, "Splicing preference is required"),
  admin_splicing_fee: z.number().min(0).max(50).optional(),
});

const step4Schema = z.object({
  pims_software: z.string().min(1, "PIMS software is required"),
  data_sync_permission: z.boolean().default(false),
  preferred_referral_partners: z.string().optional(),
});

const fullSchema = step1Schema.merge(step2Schema).merge(step3Schema).merge(step4Schema);
type FormData = z.infer<typeof fullSchema>;

const STEPS = [
  { id: 1, title: "Practice Identity", icon: Building2, description: "Basic practice information" },
  { id: 2, title: "Medical Verification", icon: Stethoscope, description: "Credentials & licenses" },
  { id: 3, title: "Insurance Setup", icon: ShieldCheck, description: "Claim-splicing configuration" },
  { id: 4, title: "Integration", icon: Wallet, description: "Platform connections" },
];

const PRACTICE_TYPES = [
  "General Practice",
  "Emergency",
  "Specialty/Referral",
  "Mobile/House Call",
  "Exotic",
];

const ACCREDITATIONS = [
  { id: "aaha", label: "AAHA Accredited" },
  { id: "fear-free", label: "Fear-Free Certified" },
  { id: "cat-friendly", label: "Cat-Friendly Practice" },
];

const INSURANCE_PARTNERS = [
  { id: "trupanion", name: "Trupanion", icon: "🐾" },
  { id: "nationwide", name: "Nationwide", icon: "🏠" },
  { id: "lemonade", name: "Lemonade", icon: "🍋" },
  { id: "pets-best", name: "Pets Best", icon: "⭐" },
  { id: "embrace", name: "Embrace", icon: "🤗" },
  { id: "healthy-paws", name: "Healthy Paws", icon: "🐕" },
  { id: "figo", name: "Figo", icon: "📱" },
  { id: "aspca", name: "ASPCA", icon: "🏥" },
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

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

export const VetOnboardingForm = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(fullSchema),
    defaultValues: {
      legal_practice_name: "",
      dba_name: "",
      primary_phone: "",
      sms_capability: false,
      physical_address: "",
      city: "",
      state: "",
      zip_code: "",
      website_url: "",
      tax_id_ein: "",
      medical_director_name: "",
      dvm_license_number: "",
      dvm_license_state: "",
      npi_number: "",
      practice_type: "",
      accreditations: [],
      insurance_partners: [],
      direct_pay_capability: false,
      splicing_preference: "",
      admin_splicing_fee: 0,
      pims_software: "",
      data_sync_permission: false,
      preferred_referral_partners: "",
    },
    mode: "onChange",
  });

  // Load existing draft on mount
  useEffect(() => {
    const loadDraft = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from("pending_onboarding")
        .select("*")
        .eq("user_id", user.id)
        .eq("onboarding_type", "vet")
        .is("completed_at", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && !error) {
        setPendingId(data.id);
        setCurrentStep(data.current_step || 1);
        
        // Populate form with saved data
        const formData: Partial<FormData> = {
          legal_practice_name: data.legal_practice_name || "",
          dba_name: data.dba_name || "",
          primary_phone: data.primary_phone || "",
          sms_capability: data.sms_capability || false,
          physical_address: data.physical_address || "",
          city: data.city || "",
          state: data.state || "",
          zip_code: data.zip_code || "",
          website_url: data.website_url || "",
          tax_id_ein: data.tax_id_ein || "",
          medical_director_name: data.medical_director_name || "",
          dvm_license_number: data.dvm_license_number || "",
          dvm_license_state: data.dvm_license_state || "",
          npi_number: data.npi_number || "",
          practice_type: data.practice_type || "",
          accreditations: data.accreditations || [],
          insurance_partners: data.insurance_partners || [],
          direct_pay_capability: data.direct_pay_capability || false,
          splicing_preference: data.splicing_preference || "",
          admin_splicing_fee: data.admin_splicing_fee || 0,
          pims_software: data.pims_software || "",
          data_sync_permission: data.data_sync_permission || false,
          preferred_referral_partners: data.preferred_referral_partners || "",
        };

        Object.entries(formData).forEach(([key, value]) => {
          form.setValue(key as keyof FormData, value as any);
        });

        toast({
          title: "Draft Loaded",
          description: "We've restored your previous progress.",
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
        default:
          return true;
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach((err) => {
          form.setError(err.path[0] as keyof FormData, {
            type: "manual",
            message: err.message,
          });
        });
      }
      return false;
    }
  };

  const handleNext = async () => {
    const isValid = await validateCurrentStep();
    if (isValid && currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const saveDraft = async () => {
    if (!user) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to save your progress.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    const values = form.getValues();

    try {
      const draftData = {
        user_id: user.id,
        onboarding_type: "vet",
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
        title: "Progress Saved",
        description: "Your draft has been saved. You can continue later.",
      });
    } catch (error) {
      console.error("Error saving draft:", error);
      toast({
        title: "Save Failed",
        description: "Could not save your progress. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);

    try {
      // Mark pending onboarding as completed
      if (pendingId) {
        await supabase
          .from("pending_onboarding")
          .update({ completed_at: new Date().toISOString() })
          .eq("id", pendingId);
      }

      // Create the partner_vets record with required fields
      const fullAddress = `${data.physical_address}, ${data.city}, ${data.state} ${data.zip_code}`;
      const { error } = await supabase.from("partner_vets").insert({
        name: data.legal_practice_name,
        location: fullAddress,
        contact_email: user?.email || "",
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
        is_verified: false,
      });

      if (error) throw error;

      toast({
        title: "Welcome to PawBucks!",
        description: "Your veterinary practice has been registered. Our team will verify your credentials shortly.",
      });

      navigate("/vet-dashboard");
    } catch (error) {
      console.error("Error submitting:", error);
      toast({
        title: "Submission Failed",
        description: "Could not complete registration. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const progressPercentage = (currentStep / 4) * 100;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-slate-900">Veterinary Practice Onboarding</h1>
          <p className="text-slate-600 mt-1">Join the PawBucks network and grow your practice</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Progress Stepper */}
        <div className="mb-8">
          <Progress value={progressPercentage} className="h-2 mb-6" />
          <div className="grid grid-cols-4 gap-4">
            {STEPS.map((step) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;

              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex flex-col items-center text-center p-3 rounded-lg transition-all",
                    isActive && "bg-indigo-50 border-2 border-indigo-600",
                    isCompleted && "bg-green-50",
                    !isActive && !isCompleted && "bg-white border border-slate-200"
                  )}
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center mb-2",
                      isActive && "bg-indigo-600 text-white",
                      isCompleted && "bg-green-500 text-white",
                      !isActive && !isCompleted && "bg-slate-200 text-slate-600"
                    )}
                  >
                    {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={cn(
                    "text-sm font-medium",
                    isActive && "text-indigo-600",
                    isCompleted && "text-green-600",
                    !isActive && !isCompleted && "text-slate-500"
                  )}>
                    {step.title}
                  </span>
                  <span className="text-xs text-slate-400 hidden sm:block">{step.description}</span>
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
              <Card className="bg-white border-slate-200 rounded-lg shadow-sm">
                <CardHeader className="border-b border-slate-100">
                  <CardTitle className="flex items-center gap-2 text-slate-900">
                    <Building2 className="h-5 w-5 text-indigo-600" />
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
                        <FormItem className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
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
              <Card className="bg-white border-slate-200 rounded-lg shadow-sm">
                <CardHeader className="border-b border-slate-100">
                  <CardTitle className="flex items-center gap-2 text-slate-900">
                    <Stethoscope className="h-5 w-5 text-indigo-600" />
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
                                      ? "border-indigo-600 bg-indigo-50"
                                      : "border-slate-200 hover:border-indigo-300"
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
              <Card className="bg-white border-slate-200 rounded-lg shadow-sm">
                <CardHeader className="border-b border-slate-100">
                  <CardTitle className="flex items-center gap-2 text-slate-900">
                    <ShieldCheck className="h-5 w-5 text-indigo-600" />
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
                                      ? "border-indigo-600 bg-indigo-50 ring-2 ring-indigo-600"
                                      : "border-slate-200 hover:border-indigo-300"
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
                      <FormItem className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
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
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
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
              <Card className="bg-white border-slate-200 rounded-lg shadow-sm">
                <CardHeader className="border-b border-slate-100">
                  <CardTitle className="flex items-center gap-2 text-slate-900">
                    <Wallet className="h-5 w-5 text-indigo-600" />
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
                      <FormItem className="rounded-lg border border-slate-200 p-4">
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
                            <FormDescription className="text-sm text-slate-500 mt-1">
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
                {isSaving ? "Saving..." : "Save & Finish Later"}
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

                {currentStep < 4 ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                  >
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                  >
                    {isSubmitting ? "Submitting..." : "Complete Registration"}
                    <Check className="h-4 w-4 ml-2" />
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
