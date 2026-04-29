import { useState, useEffect } from"react";
import { useParams, useNavigate } from"react-router-dom";
import { supabase } from"@/integrations/supabase/client";
import { useAuth } from"@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Textarea } from"@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from"@/components/ui/select";
import { Checkbox } from"@/components/ui/checkbox";
import { Separator } from"@/components/ui/separator";
import { Loader2, Building2, AlertCircle, CheckCircle2 } from"lucide-react";
import { toast } from"sonner";

type Brand = {
 id: string;
 brand_name: string;
 invitation_email: string | null;
 invitation_claimed_at: string | null;
 setup_completed_at?: string | null;
};

const BUSINESS_TYPES = ["LLC","Corporation","S-Corp","Sole Proprietor","Partnership","Non-Profit","Other"];
const COMPANY_SIZES = ["1-10","11-50","51-200","201-500","501-1000","1000+"];
const INDUSTRIES = ["Pet Food","Pet Supplies & Accessories","Pet Health & Pharma","Grooming Products","Pet Tech","Pet Insurance","Veterinary","Pet Services","Other"];

const BrandSetup = () => {
 const { token } = useParams<{ token: string }>();
 const navigate = useNavigate();
 const { user, loading: authLoading } = useAuth();
 const [brand, setBrand] = useState<Brand | null>(null);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [showSignIn, setShowSignIn] = useState(false);
 const [authBusy, setAuthBusy] = useState(false);

 // Auth form
 const [authForm, setAuthForm] = useState({ email:"", password:"", full_name:"" });

 // Setup form (full business profile)
 const [form, setForm] = useState({
 legal_business_name:"",
 business_type:"",
 industry_category:"",
 company_size:"",
 year_founded:"",
 tax_id:"",
 website_url:"",
 description:"",
 // Address
 address_line1:"",
 address_line2:"",
 city:"",
 state:"",
 postal_code:"",
 country:"US",
 // Primary contact
 contact_name:"",
 contact_email:"",
 contact_phone:"",
 contact_title:"",
 // Billing contact
 billing_same_as_primary: true,
 billing_contact_name:"",
 billing_contact_email:"",
 billing_contact_phone:"",
 // Social
 instagram:"",
 facebook:"",
 linkedin:"",
 // Marketing prefs
 opt_in_newsletter: true,
 opt_in_partnership_offers: true,
 // Terms
 terms_accepted: false,
 });

 useEffect(() => {
 if (token) fetchBrand();
 }, [token]);

 useEffect(() => {
 if (brand && !brand.invitation_claimed_at && user) claimSilently();
 }, [user, brand]);

 const fetchBrand = async () => {
 setLoading(true);
 try {
 const { data, error } = await supabase.rpc("get_brand_by_invitation_token", { p_token: token ||"" });
 if (error || !data || data.length === 0) {
 setError("Invalid or expired invitation link.");
 return;
 }
 const b = data[0] as Brand;
 setBrand(b);
 setForm((f) => ({
 ...f,
 contact_email: b.invitation_email || f.contact_email,
 legal_business_name: b.brand_name || f.legal_business_name,
 }));
 if (b.invitation_email) setAuthForm((a) => ({ ...a, email: b.invitation_email! }));
 } catch {
 setError("Something went wrong. Please try again.");
 } finally {
 setLoading(false);
 }
 };

 const claimSilently = async () => {
 if (!brand) return;
 await supabase.rpc("claim_brand_account", { p_token: token ||"" });
 fetchBrand();
 };

 const handleSignUp = async (e: React.FormEvent) => {
 e.preventDefault();
 setAuthBusy(true);
 try {
 const { data, error } = await supabase.auth.signUp({
 email: authForm.email,
 password: authForm.password,
 options: { data: { full_name: authForm.full_name, user_type:"brand" } },
 });
 if (error) { toast.error(error.message); return; }
 if (data.user && !data.session) {
 toast.success("Account created! Check your email to verify, then return to this link.");
 }
 } catch {
 toast.error("Failed to create account.");
 } finally { setAuthBusy(false); }
 };

 const handleSignIn = async (e: React.FormEvent) => {
 e.preventDefault();
 setAuthBusy(true);
 try {
 const { error } = await supabase.auth.signInWithPassword({
 email: authForm.email, password: authForm.password,
 });
 if (error) toast.error(error.message);
 } catch {
 toast.error("Failed to sign in.");
 } finally { setAuthBusy(false); }
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!brand) return;
 if (!form.terms_accepted) { toast.error("Please accept the terms to continue."); return; }
 setSaving(true);
 try {
 const payload = {
 legal_business_name: form.legal_business_name,
 business_type: form.business_type,
 industry_category: form.industry_category,
 company_size: form.company_size,
 year_founded: form.year_founded,
 tax_id: form.tax_id,
 website_url: form.website_url,
 description: form.description,
 address_line1: form.address_line1,
 address_line2: form.address_line2,
 city: form.city,
 state: form.state,
 postal_code: form.postal_code,
 country: form.country,
 contact_name: form.contact_name,
 contact_email: form.contact_email,
 contact_phone: form.contact_phone,
 contact_title: form.contact_title,
 billing_contact_name: form.billing_same_as_primary ? form.contact_name : form.billing_contact_name,
 billing_contact_email: form.billing_same_as_primary ? form.contact_email : form.billing_contact_email,
 billing_contact_phone: form.billing_same_as_primary ? form.contact_phone : form.billing_contact_phone,
 social_links: { instagram: form.instagram, facebook: form.facebook, linkedin: form.linkedin },
 marketing_preferences: {
 newsletter: form.opt_in_newsletter,
 partnership_offers: form.opt_in_partnership_offers,
 },
 terms_accepted: form.terms_accepted,
 };
 const { data, error } = await supabase.rpc("complete_brand_setup", {
 p_brand_id: brand.id, p_payload: payload,
 });
 if (error) { toast.error(error.message); return; }
 const result = data as { success: boolean; error?: string } | null;
 if (result && !result.success) { toast.error(result.error ||"Setup failed."); return; }
 toast.success("🎉 Brand setup complete! Welcome to PawBucks.");
 navigate("/brand-dashboard");
 } catch {
 toast.error("Failed to save setup.");
 } finally { setSaving(false); }
 };

 if (loading || authLoading) {
 return (
 <div className="min-h-screen flex items-center justify-center bg-background">
 <Loader2 className="w-8 h-8 animate-spin text-primary" />
 </div>
 );
 }

 if (error) {
 return (
 <div className="min-h-screen flex items-center justify-center bg-background p-4">
 <Card className="w-full max-w-md">
 <CardContent className="pt-6 text-center space-y-4">
 <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
 <h2 className="text-xl font-bold">{error}</h2>
 <p className="text-muted-foreground">Please contact the PawBucks team for assistance.</p>
 <Button onClick={() => navigate("/")} variant="outline">Go to Homepage</Button>
 </CardContent>
 </Card>
 </div>
 );
 }

 // Step 1: auth
 if (!user) {
 return (
 <div className="min-h-screen flex items-center justify-center bg-background p-4">
 <Card className="w-full max-w-md">
 <CardHeader className="text-center">
 <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
 <Building2 className="h-8 w-8 text-primary" />
 </div>
 <CardTitle className="text-2xl">Welcome, {brand?.brand_name}!</CardTitle>
 <CardDescription>
 {showSignIn ?"Sign in to claim your brand account." :"Create your account to begin brand onboarding."}
 </CardDescription>
 </CardHeader>
 <CardContent>
 <form onSubmit={showSignIn ? handleSignIn : handleSignUp} className="space-y-4">
 {!showSignIn && (
 <div className="space-y-2">
 <Label>Full Name</Label>
 <Input value={authForm.full_name} onChange={(e) => setAuthForm((f) => ({ ...f, full_name: e.target.value }))} required />
 </div>
 )}
 <div className="space-y-2">
 <Label>Email</Label>
 <Input type="email" value={authForm.email} onChange={(e) => setAuthForm((f) => ({ ...f, email: e.target.value }))} required />
 </div>
 <div className="space-y-2">
 <Label>Password</Label>
 <Input type="password" minLength={8} value={authForm.password} onChange={(e) => setAuthForm((f) => ({ ...f, password: e.target.value }))} required />
 </div>
 <Button type="submit" className="w-full" disabled={authBusy}>
 {authBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
 {showSignIn ?"Sign In" :"Create Account"}
 </Button>
 </form>
 <div className="text-center mt-4">
 <button type="button" className="text-sm text-primary hover:underline" onClick={() => setShowSignIn(!showSignIn)}>
 {showSignIn ?"Need an account? Sign up" :"Already have an account? Sign in"}
 </button>
 </div>
 </CardContent>
 </Card>
 </div>
 );
 }

 // Step 2: full setup form
 return (
 <div className="min-h-screen bg-background py-10 px-4">
 <div className="max-w-3xl mx-auto">
 <div className="text-center mb-8">
 <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
 <Building2 className="h-8 w-8 text-primary" />
 </div>
 <h1 className="text-3xl font-bold">Complete Your Brand Setup</h1>
 <p className="text-muted-foreground mt-2">
 Tell us about <strong>{brand?.brand_name}</strong>. This information will appear on your campaigns and invoices.
 </p>
 </div>

 <form onSubmit={handleSubmit} className="space-y-6">
 {/* Business profile */}
 <Card>
 <CardHeader><CardTitle>Business Profile</CardTitle></CardHeader>
 <CardContent className="grid md:grid-cols-2 gap-4">
 <div className="space-y-2 md:col-span-2">
 <Label>Legal Business Name *</Label>
 <Input required value={form.legal_business_name} onChange={(e) => setForm((f) => ({ ...f, legal_business_name: e.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label>Business Type *</Label>
 <Select value={form.business_type} onValueChange={(v) => setForm((f) => ({ ...f, business_type: v }))}>
 <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
 <SelectContent>{BUSINESS_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label>Industry *</Label>
 <Select value={form.industry_category} onValueChange={(v) => setForm((f) => ({ ...f, industry_category: v }))}>
 <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
 <SelectContent>{INDUSTRIES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label>Company Size</Label>
 <Select value={form.company_size} onValueChange={(v) => setForm((f) => ({ ...f, company_size: v }))}>
 <SelectTrigger><SelectValue placeholder="Employees" /></SelectTrigger>
 <SelectContent>{COMPANY_SIZES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label>Year Founded</Label>
 <Input type="number" min={1800} max={new Date().getFullYear()} value={form.year_founded} onChange={(e) => setForm((f) => ({ ...f, year_founded: e.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label>Tax ID / EIN</Label>
 <Input value={form.tax_id} onChange={(e) => setForm((f) => ({ ...f, tax_id: e.target.value }))} placeholder="XX-XXXXXXX" />
 </div>
 <div className="space-y-2">
 <Label>Website</Label>
 <Input type="url" value={form.website_url} onChange={(e) => setForm((f) => ({ ...f, website_url: e.target.value }))} placeholder="https://" />
 </div>
 <div className="space-y-2 md:col-span-2">
 <Label>Brand Description</Label>
 <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Tell pet owners what your brand is about..." rows={3} />
 </div>
 </CardContent>
 </Card>

 {/* Address */}
 <Card>
 <CardHeader><CardTitle>Business Address</CardTitle></CardHeader>
 <CardContent className="grid md:grid-cols-2 gap-4">
 <div className="space-y-2 md:col-span-2">
 <Label>Address Line 1 *</Label>
 <Input required value={form.address_line1} onChange={(e) => setForm((f) => ({ ...f, address_line1: e.target.value }))} />
 </div>
 <div className="space-y-2 md:col-span-2">
 <Label>Address Line 2</Label>
 <Input value={form.address_line2} onChange={(e) => setForm((f) => ({ ...f, address_line2: e.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label>City *</Label>
 <Input required value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label>State *</Label>
 <Input required value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label>Postal Code *</Label>
 <Input required value={form.postal_code} onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label>Country</Label>
 <Input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} />
 </div>
 </CardContent>
 </Card>

 {/* Primary contact */}
 <Card>
 <CardHeader><CardTitle>Primary Contact</CardTitle></CardHeader>
 <CardContent className="grid md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>Full Name *</Label>
 <Input required value={form.contact_name} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label>Title / Role</Label>
 <Input value={form.contact_title} onChange={(e) => setForm((f) => ({ ...f, contact_title: e.target.value }))} placeholder="Marketing Director" />
 </div>
 <div className="space-y-2">
 <Label>Email *</Label>
 <Input type="email" required value={form.contact_email} onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label>Phone *</Label>
 <Input type="tel" required value={form.contact_phone} onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))} />
 </div>
 </CardContent>
 </Card>

 {/* Billing contact */}
 <Card>
 <CardHeader>
 <CardTitle>Billing Contact</CardTitle>
 <CardDescription>Who should receive campaign invoices?</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <label className="flex items-center gap-2 cursor-pointer">
 <Checkbox checked={form.billing_same_as_primary} onCheckedChange={(v) => setForm((f) => ({ ...f, billing_same_as_primary: !!v }))} />
 <span className="text-sm">Same as primary contact</span>
 </label>
 {!form.billing_same_as_primary && (
 <div className="grid md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>Billing Name</Label>
 <Input value={form.billing_contact_name} onChange={(e) => setForm((f) => ({ ...f, billing_contact_name: e.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label>Billing Email</Label>
 <Input type="email" value={form.billing_contact_email} onChange={(e) => setForm((f) => ({ ...f, billing_contact_email: e.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label>Billing Phone</Label>
 <Input type="tel" value={form.billing_contact_phone} onChange={(e) => setForm((f) => ({ ...f, billing_contact_phone: e.target.value }))} />
 </div>
 </div>
 )}
 </CardContent>
 </Card>

 {/* Social */}
 <Card>
 <CardHeader><CardTitle>Social Presence (optional)</CardTitle></CardHeader>
 <CardContent className="grid md:grid-cols-3 gap-4">
 <div className="space-y-2">
 <Label>Instagram</Label>
 <Input value={form.instagram} onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))} placeholder="@brand" />
 </div>
 <div className="space-y-2">
 <Label>Facebook</Label>
 <Input value={form.facebook} onChange={(e) => setForm((f) => ({ ...f, facebook: e.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label>LinkedIn</Label>
 <Input value={form.linkedin} onChange={(e) => setForm((f) => ({ ...f, linkedin: e.target.value }))} />
 </div>
 </CardContent>
 </Card>

 {/* Preferences + terms */}
 <Card>
 <CardHeader><CardTitle>Preferences & Terms</CardTitle></CardHeader>
 <CardContent className="space-y-3">
 <label className="flex items-start gap-2 cursor-pointer">
 <Checkbox checked={form.opt_in_newsletter} onCheckedChange={(v) => setForm((f) => ({ ...f, opt_in_newsletter: !!v }))} />
 <span className="text-sm">Send me PawBucks brand newsletters and product updates.</span>
 </label>
 <label className="flex items-start gap-2 cursor-pointer">
 <Checkbox checked={form.opt_in_partnership_offers} onCheckedChange={(v) => setForm((f) => ({ ...f, opt_in_partnership_offers: !!v }))} />
 <span className="text-sm">Notify me about partnership opportunities and merchant collaborations.</span>
 </label>
 <Separator />
 <label className="flex items-start gap-2 cursor-pointer">
 <Checkbox checked={form.terms_accepted} onCheckedChange={(v) => setForm((f) => ({ ...f, terms_accepted: !!v }))} />
 <span className="text-sm">
 I accept the <a href="/terms" target="_blank" className="text-primary underline">Terms of Service</a> and{""}
 <a href="/privacy" target="_blank" className="text-primary underline">Privacy Policy</a>, and confirm I'm authorized to represent this brand.
 </span>
 </label>
 </CardContent>
 </Card>

 <div className="flex justify-end">
 <Button type="submit" size="lg" disabled={saving || !form.terms_accepted}>
 {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
 Complete Setup & Enter Dashboard
 </Button>
 </div>
 </form>
 </div>
 </div>
 );
};

export default BrandSetup;
