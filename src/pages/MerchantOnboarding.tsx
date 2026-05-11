import { useState, useEffect, useMemo } from"react";
import { useNavigate } from"react-router-dom";
import { useAuth } from"@/hooks/useAuth";
import { useGeocoding } from"@/hooks/useGeocoding";
import { supabase } from"@/integrations/supabase/client";
import { SEO } from"@/components/SEO";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from"@/components/ui/select";
import { Textarea } from"@/components/ui/textarea";
import { Badge } from"@/components/ui/badge";
import { toast } from"sonner";
import { PawBucksLogo } from "@/components/PawBucksLogo";
import { Store, Loader2, PawPrint, Stethoscope, Scissors, ShoppingBag, Bone, Home, Dog, Sun, Camera, Shield, Truck, Mountain, Zap, Hand, Brain, Heart, Building2, Car, Users, AlertCircle, Info } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { merchantOnboardingSchema, PET_BUSINESS_TYPES, ENTITY_TYPES, WORKING_STYLES } from"@/lib/validation";
import { MerchantTermsOfService } from"@/components/shared/MerchantTermsOfService";

// Business type configuration with icons and descriptions
const BUSINESS_TYPE_CONFIG: Record<string, { icon: React.ElementType; label: string; description: string }> = {
 veterinary: { icon: Stethoscope, label:"Veterinary / Clinic", description:"Full-service vet, specialty clinic, or emergency care" },
 grooming: { icon: Scissors, label:"Grooming Salon", description:"Fixed-location grooming services" },
 mobile_groomer: { icon: Car, label:"Mobile Groomer", description:"On-the-go grooming at client locations" },
 training: { icon: Sparkles, label:"Training", description:"Obedience, behavior, or specialty training" },
 walker: { icon: Dog, label:"Dog Walker", description:"Daily walking services" },
 runner: { icon: Zap, label:"Pet Runner / Jogger", description:"Active running companions for dogs" },
 hiker: { icon: Mountain, label:"Pet Hiker", description:"Trail and adventure excursions" },
 sitter: { icon: Home, label:"Pet Sitter", description:"In-home pet sitting services" },
 daycare: { icon: Sun, label:"Daycare", description:"Daytime care and socialization" },
 boarding: { icon: Building2, label:"Boarding / Kennel", description:"Overnight stays and extended care" },
 pet_store: { icon: ShoppingBag, label:"Pet Store / Retail", description:"Products, supplies, and merchandise" },
 food: { icon: Bone, label:"Food & Treats", description:"Specialty foods, bakery, or nutrition" },
 breeder: { icon: Heart, label:"Breeder", description:"Responsible breeding program" },
 rescue_nonprofit: { icon: Users, label:"Rescue / Nonprofit", description:"Animal rescue or nonprofit organization" },
 photography: { icon: Camera, label:"Pet Photography", description:"Professional pet portraits and sessions" },
 insurance: { icon: Shield, label:"Pet Insurance", description:"Insurance products and services" },
 delivery: { icon: Truck, label:"Pet Delivery", description:"Transport and delivery services" },
 masseuse: { icon: Hand, label:"Pet Masseuse", description:"Massage and wellness therapies" },
 behaviorist: { icon: Brain, label:"Behaviorist", description:"Advanced behavior consultation" },
 other: { icon: PawPrint, label:"Other", description:"Other pet-related business" },
};

// Entity type configuration
const ENTITY_TYPE_CONFIG: Record<string, { label: string; description: string; taxNote: string }> = {
 sole_proprietor: { 
 label:"Sole Proprietor", 
 description:"Individual owner, no formal entity",
 taxNote:"Schedule C on personal return"
 },
 llc: { 
 label:"LLC", 
 description:"Limited Liability Company",
 taxNote:"Pass-through or elect corporate taxation"
 },
 s_corp: { 
 label:"S-Corp", 
 description:"S Corporation",
 taxNote:"Pass-through taxation with payroll requirements"
 },
 c_corp: { 
 label:"C-Corp", 
 description:"C Corporation",
 taxNote:"Corporate taxation, potential double tax"
 },
 partnership: { 
 label:"Partnership", 
 description:"Multi-member partnership",
 taxNote:"Form 1065, K-1s to partners"
 },
 nonprofit: { 
 label:"Nonprofit / 501(c)(3)", 
 description:"Tax-exempt organization",
 taxNote:"Form 990, limited deductions apply"
 },
};

// Working style configuration
const WORKING_STYLE_CONFIG: Record<string, { icon: React.ElementType; label: string; description: string; emphasis: string }> = {
 home_based: { 
 icon: Home, 
 label:"Home-Based", 
 description:"Operate primarily from your home",
 emphasis:"Home office deductions, utilities allocation"
 },
 storefront: { 
 icon: Building2, 
 label:"Storefront / Commercial", 
 description:"Fixed commercial location",
 emphasis:"Rent, utilities, commercial insurance"
 },
 mobile: { 
 icon: Car, 
 label:"Mobile / Van-Based", 
 description:"Travel to client locations",
 emphasis:"Mileage, vehicle expenses, equipment"
 },
 mixed: { 
 icon: Users, 
 label:"Mixed / Hybrid", 
 description:"Combination of locations",
 emphasis:"All deduction categories apply"
 },
};

const MerchantOnboarding = () => {
 const navigate = useNavigate();
 const { user, loading: authLoading } = useAuth();
 const { geocodeAddress } = useGeocoding();
 const [isLoading, setIsLoading] = useState(false);
 const [businessType, setBusinessType] = useState<string>("");
 const [businessCategories, setBusinessCategories] = useState<string[]>([]);

 const toggleCategory = (key: string) => {
 setBusinessCategories((prev) => {
 const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
 // Keep primary business_type as the first selected category for backward compat
 if (next.length > 0) {
 setBusinessType(next[0]);
 } else {
 setBusinessType("");
 }
 return next;
 });
 };
 const [entityType, setEntityType] = useState<string>("");
 const [workingStyle, setWorkingStyle] = useState<string>("");
 const [country, setCountry] = useState("US");
 const [stateOfIncorporation, setStateOfIncorporation] = useState("");
 const [profile, setProfile] = useState<any>(null);
 const [logoFile, setLogoFile] = useState<File | null>(null);
 const [logoPreview, setLogoPreview] = useState<string | null>(null);
 const [logoZoom, setLogoZoom] = useState(1);
 const [agreedToTos, setAgreedToTos] = useState(false);

 // Show entity type section only for certain business types
 const showEntitySection = businessType && businessType !=="";
 
 // Show state of incorporation for formal entities
 const showStateOfIncorporation = entityType && ["llc","s_corp","c_corp","partnership","nonprofit"].includes(entityType);

 // Tax relevance hints based on selections
 const taxHints = useMemo(() => {
 const hints: string[] = [];
 
 if (workingStyle ==="home_based") {
 hints.push("📍 Home office deduction tracking available");
 }
 if (workingStyle ==="mobile" || workingStyle ==="mixed") {
 hints.push("🚗 Mileage log and vehicle expense tracking available");
 }
 if (entityType ==="sole_proprietor" || entityType ==="llc") {
 hints.push("📋 Self-employment tax estimates included");
 }
 if (entityType ==="nonprofit") {
 hints.push("📊 Nonprofit-specific reporting available");
 }
 if (businessType ==="veterinary" || businessType ==="grooming" || businessType ==="mobile_groomer") {
 hints.push("🧴 Equipment & supplies tracking optimized");
 }
 
 return hints;
 }, [businessType, entityType, workingStyle]);

 useEffect(() => {
 if (!authLoading && !user) {
 navigate("/auth");
 }
 }, [user, authLoading, navigate]);

 useEffect(() => {
 if (user) {
 checkProfile();
 }
 }, [user]);

 const checkProfile = async () => {
 if (!user) return;

 const { data } = await supabase
 .from("profiles")
 .select("*")
 .eq("id", user.id)
 .single();

 setProfile(data);

 // Check if merchant profile already exists
 if (data?.user_type ==="merchant") {
 const { data: merchantData } = await supabase
 .from("merchants")
 .select("*")
 .eq("user_id", user.id)
 .single();

 if (merchantData) {
 navigate("/merchant-dashboard");
 }
 }
 };

 const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (file) {
 setLogoFile(file);
 const reader = new FileReader();
 reader.onloadend = () => {
 setLogoPreview(reader.result as string);
 };
 reader.readAsDataURL(file);
 }
 };

 const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 if (!user) return;

 setIsLoading(true);

 try {
 const formData = new FormData(e.currentTarget);
 const businessName = (formData.get("businessName") as string).trim();
 const contactPerson = (formData.get("contactPerson") as string).trim();
 const phone = (formData.get("phone") as string).trim();
 const streetAddress = (formData.get("streetAddress") as string).trim();
 const city = (formData.get("city") as string).trim();
 const state = (formData.get("state") as string).trim();
 const zipCode = (formData.get("zipCode") as string).trim();
 const description = (formData.get("description") as string)?.trim() ||"";

 // Validate input first (before any DB calls)
 const validatedData = merchantOnboardingSchema.parse({
 businessName,
 contactPerson,
 phone,
 businessType: businessType ||"other",
 entityType: entityType || undefined,
 country,
 stateOfIncorporation: stateOfIncorporation || undefined,
 workingStyle: workingStyle || undefined,
 streetAddress,
 city,
 state,
 zipCode,
 description,
 cashbackRate: 10.0,
 });

 // Check if merchant already exists for this user (prevent duplicates)
 const { data: existingMerchant } = await supabase
 .from("merchants")
 .select("id")
 .eq("user_id", user.id)
 .maybeSingle();

 if (existingMerchant) {
 toast.info("Your merchant profile already exists!");
 navigate("/merchant-dashboard");
 return;
 }

 // Upload logo if provided (non-blocking failure)
 let logoUrl: string | null = null;
 if (logoFile) {
 try {
 const fileExt = logoFile.name.split('.').pop();
 const filePath = `${user.id}/${Date.now()}.${fileExt}`;
 
 const { error: uploadError } = await supabase.storage
 .from('merchant-logos')
 .upload(filePath, logoFile);

 if (!uploadError) {
 const { data: urlData } = supabase.storage
 .from('merchant-logos')
 .getPublicUrl(filePath);
 logoUrl = urlData.publicUrl;
 } else {
 console.warn("Logo upload failed (continuing without logo):", uploadError);
 }
 } catch (logoErr) {
 console.warn("Logo upload error (continuing without logo):", logoErr);
 }
 }

 // Combine address fields into full address
 const fullAddress = `${validatedData.streetAddress}, ${validatedData.city}, ${validatedData.state} ${validatedData.zipCode}`;

 // Update profile to merchant type if needed
 if (profile?.user_type !=="merchant") {
 const { error: profileError } = await supabase
 .from("profiles")
 .update({ user_type:"merchant" })
 .eq("id", user.id);

 if (profileError) {
 console.error("Error updating profile:", profileError);
 throw new Error("Failed to update account type. Please try again.");
 }
 }

 // Generate storefront slug using the DB function to avoid collisions
 const { data: slugData } = await supabase.rpc('generate_storefront_slug', {
 business_name: validatedData.businessName,
 });
 const storefrontSlug = slugData || validatedData.businessName.toLowerCase().replace(/[^a-z0-9]/g,'');

 // Create merchant profile
 const { data: merchantData, error: merchantError } = await supabase.from("merchants").insert({
 user_id: user.id,
 business_name: validatedData.businessName,
 contact_person: validatedData.contactPerson,
 phone: validatedData.phone,
 business_type: validatedData.businessType,
 business_categories: businessCategories.length > 0 ? businessCategories : [validatedData.businessType],
 entity_type: validatedData.entityType || null,
 country: validatedData.country,
 state_of_incorporation: validatedData.stateOfIncorporation || null,
 working_style: validatedData.workingStyle || null,
 address: fullAddress,
 description: validatedData.description || null,
 cashback_rate: validatedData.cashbackRate,
 logo_url: logoUrl,
 storefront_slug: storefrontSlug,
 }).select('id').single();

 if (merchantError) {
 console.error("Error creating merchant:", merchantError);
 if (merchantError.code ==='23505') {
 throw new Error("A merchant profile already exists for this account.");
 }
 throw new Error("Failed to create merchant profile. Please try again.");
 }

 // Geocode the address in the background (don't block navigation)
 if (merchantData?.id) {
 geocodeAddress(fullAddress, merchantData.id).catch(err => {
 console.warn("Geocoding error (non-critical):", err);
 });
 }

 toast.success("Merchant profile created! Your account is pending admin approval.", {
 description:"You can explore the dashboard while we review your application.",
 duration: 6000,
 });
 navigate("/merchant-dashboard");
 } catch (error: any) {
 if (error.errors) {
 const messages = error.errors.map((e: any) => e.message).filter(Boolean);
 toast.error(messages[0] ||"Please check your input and try again.");
 } else {
 toast.error(error.message ||"Failed to create merchant profile. Please try again.");
 }
 console.error("Error creating merchant profile:", error);
 } finally {
 setIsLoading(false);
 }
 };

 if (authLoading) {
 return (
 <div className="min-h-screen flex items-center justify-center">
 <Loader2 className="w-8 h-8 animate-spin text-primary" />
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-[var(--gradient-hero)] py-8 px-4">
 <SEO 
 title="Set Up Your Pet Business | PawBucks"
 description="Create your merchant profile and start accepting payments from pet owners"
 />
 
 <div className="max-w-3xl mx-auto space-y-6">
 {/* Header Card */}
 <Card>
 <CardHeader className="text-center pb-4">
 <div className="flex justify-center mb-4">
 <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
 <span className="w-8 h-8 text-primary-foreground" aria-hidden="true">🏪</span>
 </div>
 </div>
 <CardTitle className="text-3xl font-bold">Set Up Your Pet Business</CardTitle>
 <CardDescription className="text-base">
 Tell us about your business so we can tailor PawBucks to your needs—including smart tax tracking
 </CardDescription>
 </CardHeader>
 </Card>

 <form onSubmit={handleSubmit} className="space-y-6">
 {/* Step 1: Business Basics */}
 <Card>
 <CardHeader>
 <CardTitle className="text-lg flex items-center gap-2">
 <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">1</span>
 Business Basics
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 {/* Business Name */}
 <div className="space-y-2">
 <Label htmlFor="businessName">Business Name *</Label>
 <Input
 id="businessName"
 name="businessName"
 placeholder="Paws & Claws Pet Care"
 required
 />
 </div>

 {/* Contact Person & Phone */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="contactPerson">Contact Person *</Label>
 <Input
 id="contactPerson"
 name="contactPerson"
 placeholder="Jane Smith"
 required
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="phone">Phone Number *</Label>
 <Input
 id="phone"
 name="phone"
 type="tel"
 placeholder="(310) 555-1234"
 required
 />
 </div>
 </div>

 {/* Business Logo */}
 <div className="space-y-2">
 <Label htmlFor="logo">Business Logo (Optional)</Label>
 <div className="flex flex-col gap-4">
 <Input
 id="logo"
 type="file"
 accept="image/*"
 onChange={handleLogoChange}
 />
 {logoPreview && (
 <div className="space-y-3">
 <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-border mx-auto relative">
 <div 
 className="absolute inset-0 flex items-center justify-center"
 style={{
 transform: `scale(${logoZoom})`,
 transition:'transform 0.2s ease'
 }}
 >
 <img
 src={logoPreview}
 alt="Logo preview"
 className="w-full h-full object-cover"
 />
 </div>
 </div>
 <div className="space-y-1">
 <Label htmlFor="logoZoom" className="text-xs">Adjust Size</Label>
 <input
 id="logoZoom"
 type="range"
 min="0.5"
 max="2"
 step="0.1"
 value={logoZoom}
 onChange={(e) => setLogoZoom(parseFloat(e.target.value))}
 className="w-full"
 />
 </div>
 </div>
 )}
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Step 2: Type of Business */}
 <Card>
 <CardHeader>
 <CardTitle className="text-lg flex items-center gap-2">
 <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">2</span>
 What Type of Pet Business?
 </CardTitle>
 <CardDescription>
 Select <strong>all categories</strong> that apply. The first one becomes your primary category.
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
 {Object.entries(BUSINESS_TYPE_CONFIG).map(([key, config]) => {
 const Icon = config.icon;
 const isSelected = businessCategories.includes(key);
 const isPrimary = businessType === key && businessCategories.length > 1;
 return (
 <button
 key={key}
 type="button"
 onClick={() => toggleCategory(key)}
 className={`relative p-3 rounded-lg border-2 transition-all text-left ${
 isSelected 
 ?'border-primary bg-primary/10' 
 :'border-border hover:border-primary hover:bg-muted'
 }`}
 >
 <Icon className={`w-5 h-5 mb-1 ${isSelected ?'text-primary' :'text-muted-foreground'}`} />
 <div className="text-sm font-medium truncate">{config.label}</div>
 {isPrimary && (
 <Badge className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0 h-4">Primary</Badge>
 )}
 </button>
 );
 })}
 </div>
 {businessCategories.length > 0 && (
 <div className="mt-3 space-y-2">
 <p className="text-sm text-muted-foreground flex items-center gap-2">
 <Info className="w-4 h-4" />
 {businessCategories.length} {businessCategories.length === 1 ?'category' :'categories'} selected
 </p>
 <div className="flex flex-wrap gap-2">
 {businessCategories.map((key) => (
 <Badge key={key} variant="secondary" className="text-xs">
 {BUSINESS_TYPE_CONFIG[key]?.label || key}
 </Badge>
 ))}
 </div>
 </div>
 )}
 </CardContent>
 </Card>

 {/* Step 3: Entity Type & Jurisdiction */}
 {showEntitySection && (
 <Card>
 <CardHeader>
 <CardTitle className="text-lg flex items-center gap-2">
 <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">3</span>
 Business Structure
 </CardTitle>
 <CardDescription>This helps us suggest relevant tax categories (U.S. businesses only for now)</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-2">
 <Label>Entity Type</Label>
 <Select value={entityType} onValueChange={setEntityType}>
 <SelectTrigger>
 <SelectValue placeholder="Select your business structure..." />
 </SelectTrigger>
 <SelectContent>
 {Object.entries(ENTITY_TYPE_CONFIG).map(([key, config]) => (
 <SelectItem key={key} value={key}>
 <div className="flex flex-col">
 <span>{config.label}</span>
 </div>
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 {entityType && ENTITY_TYPE_CONFIG[entityType] && (
 <div className="bg-muted rounded-lg p-3 mt-2">
 <p className="text-sm text-muted-foreground">{ENTITY_TYPE_CONFIG[entityType].description}</p>
 <Badge variant="outline" className="mt-2">
 {ENTITY_TYPE_CONFIG[entityType].taxNote}
 </Badge>
 </div>
 )}
 </div>

 {showStateOfIncorporation && (
 <div className="space-y-2">
 <Label htmlFor="stateOfIncorporation">State of Incorporation/Registration</Label>
 <Input
 id="stateOfIncorporation"
 value={stateOfIncorporation}
 onChange={(e) => setStateOfIncorporation(e.target.value)}
 placeholder="e.g., Delaware, California"
 />
 </div>
 )}

 {entityType ==="nonprofit" && (
 <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
 <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
 <div className="text-sm">
 <p className="font-medium text-warning">Nonprofit Note</p>
 <p className="text-muted-foreground">Some tax deduction categories may not apply to 501(c)(3) organizations. We'll adjust recommendations accordingly.</p>
 </div>
 </div>
 )}
 </CardContent>
 </Card>
 )}

 {/* Step 4: Working Style */}
 {showEntitySection && (
 <Card>
 <CardHeader>
 <CardTitle className="text-lg flex items-center gap-2">
 <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">4</span>
 How Do You Work?
 </CardTitle>
 <CardDescription>This tailors which expense categories we emphasize for you</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 {Object.entries(WORKING_STYLE_CONFIG).map(([key, config]) => {
 const Icon = config.icon;
 const isSelected = workingStyle === key;
 return (
 <button
 key={key}
 type="button"
 onClick={() => setWorkingStyle(key)}
 className={`p-4 rounded-lg border-2 transition-all text-left ${
 isSelected 
 ?'border-primary bg-primary/10' 
 :'border-border hover:border-primary hover:bg-muted'
 }`}
 >
 <div className="flex items-center gap-3">
 <Icon className={`w-6 h-6 ${isSelected ?'text-primary' :'text-muted-foreground'}`} />
 <div>
 <div className="font-medium">{config.label}</div>
 <div className="text-sm text-muted-foreground">{config.description}</div>
 </div>
 </div>
 {isSelected && (
 <Badge variant="secondary" className="mt-2">
 {config.emphasis}
 </Badge>
 )}
 </button>
 );
 })}
 </div>
 </CardContent>
 </Card>
 )}

 {/* Tax Hints Preview */}
 {taxHints.length > 0 && (
 <Card className="bg-primary/5 border-primary/20">
 <CardContent className="pt-4">
 <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <PawBucksLogo className="w-4 h-4 text-primary" />
                      </div>
 <div>
 <p className="font-medium mb-2">Tailored for Your Business:</p>
 <ul className="space-y-1">
 {taxHints.map((hint, i) => (
 <li key={i} className="text-sm text-muted-foreground">{hint}</li>
 ))}
 </ul>
 </div>
 </div>
 </CardContent>
 </Card>
 )}

 {/* Step 5: Business Address */}
 <Card>
 <CardHeader>
 <CardTitle className="text-lg flex items-center gap-2">
 <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
 {showEntitySection ?"5" :"3"}
 </span>
 Business Address
 </CardTitle>
 <CardDescription>
 {workingStyle ==="home_based" 
 ?"Your home address (kept private, used for discovery radius)" 
 : workingStyle ==="mobile"
 ?"Your base of operations (for discovery)"
 :"Where customers can find you"
 }
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-2">
 <Label htmlFor="streetAddress">Street Address *</Label>
 <Input
 id="streetAddress"
 name="streetAddress"
 placeholder="123 Pet Street"
 required
 />
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div className="space-y-2">
 <Label htmlFor="city">City *</Label>
 <Input
 id="city"
 name="city"
 placeholder="Los Angeles"
 required
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="state">State *</Label>
 <Input
 id="state"
 name="state"
 placeholder="CA"
 required
 />
 </div>
 </div>
 <div className="w-1/2">
 <div className="space-y-2">
 <Label htmlFor="zipCode">ZIP Code *</Label>
 <Input
 id="zipCode"
 name="zipCode"
 placeholder="90066"
 required
 />
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Step 6: Description */}
 <Card>
 <CardHeader>
 <CardTitle className="text-lg flex items-center gap-2">
 <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
 {showEntitySection ?"6" :"4"}
 </span>
 About Your Business
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-2">
 <Label htmlFor="description">Description (Optional)</Label>
 <Textarea
 id="description"
 name="description"
 placeholder="Tell customers what makes your business special..."
 rows={3}
 />
 </div>

 <div className="bg-muted rounded-lg p-4">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <PawBucksLogo className="w-4 h-4" />
                      Banking Setup (Stripe Connect)
                    </h3>
 <p className="text-sm text-muted-foreground">
 After creating your profile, you'll connect your bank account through Stripe to receive payments directly.
 </p>
 </div>
 </CardContent>
 </Card>

 {/* Terms of Service */}
 <MerchantTermsOfService
 agreed={agreedToTos}
 onAgreeChange={setAgreedToTos}
 disabled={isLoading}
 />

 {/* Submit */}
 <div className="flex gap-3">
 <Button
 type="button"
 variant="outline"
 onClick={() => navigate("/dashboard")}
 className="flex-1"
 disabled={isLoading}
 >
 Cancel
 </Button>
 <Button 
 type="submit" 
 className="flex-1" 
 disabled={isLoading || !businessType || !agreedToTos}
 >
 {isLoading ? (
 <>
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 Creating...
 </>
 ) : (
"Create Business Profile"
 )}
 </Button>
 </div>
 </form>
 </div>
 </div>
 );
};

export default MerchantOnboarding;
