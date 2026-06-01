import { useState, useEffect } from"react";
import { useNavigate } from"react-router-dom";
import { useAuth } from"@/hooks/useAuth";
import { useSubscription } from"@/hooks/useSubscription";
import { supabase } from"@/integrations/supabase/client";
import { Header } from"@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Textarea } from"@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from"@/components/ui/select";
import { Checkbox } from"@/components/ui/checkbox";
import { toast } from"sonner";
import { CheckCircle, Clock, Crown, Upload, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from"@/components/ui/alert";

import { Formatters } from "@/utils/formatters";
interface PartnerVet {
 id: string;
 name: string;
 location: string;
}

interface LoanResponse {
 status: string;
 message: string;
 next_steps: string;
 loan_id: string;
 repayment_schedule?: Array<{
 month: number;
 amount: number;
 due_date: string;
 status: string;
 }>;
}

const VetLoanApply = () => { const { user, loading, signOut } = useAuth();
 const { subscription, loading: subscriptionLoading, createCheckout } = useSubscription();
 const navigate = useNavigate();

 const [vets, setVets] = useState<PartnerVet[]>([]);
 const [selectedVet, setSelectedVet] = useState("");
 const [invoiceAmount, setInvoiceAmount] = useState("");
 const [requestedAmount, setRequestedAmount] = useState("");
 const [purpose, setPurpose] = useState("");
 const [termMonths, setTermMonths] = useState("6");
 const [agreedToTerms, setAgreedToTerms] = useState(false);
 const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [result, setResult] = useState<LoanResponse | null>(null);

 useEffect(() => {
 if (!loading && !user) {
 navigate("/auth");
 }
 }, [user, loading, navigate]);

 useEffect(() => {
 fetchVets();
 }, []);

 useEffect(() => {
 // Auto-fill requested amount with invoice amount
 setRequestedAmount(invoiceAmount);
 }, [invoiceAmount]);

 const fetchVets = async () => {
 const { data, error } = await supabase
 .from("partner_vets_public")
 .select("id, name, location")
 .order("name");

 if (error) {
 console.error("Error fetching vets:", error);
 toast.error("Failed to load vet clinics");
 return;
 }

 setVets(data || []);
 };

 const handleSignOut = async () => { await signOut(); };

 const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 if (e.target.files && e.target.files[0]) {
 const file = e.target.files[0];
 
 // Validate file type
 if (!file.type.includes('pdf') && !file.type.includes('image')) {
 toast.error("Please upload a PDF or image file");
 return;
 }

 // Validate file size (max 5MB)
 if (file.size > 5 * 1024 * 1024) {
 toast.error("File size must be less than 5MB");
 return;
 }

 setInvoiceFile(file);
 }
 };

 const uploadInvoice = async (): Promise<string | null> => {
 if (!invoiceFile || !user) return null;

 const fileExt = invoiceFile.name.split('.').pop();
 const fileName = `${user.id}/${Date.now()}.${fileExt}`;

 const { error } = await supabase.storage
 .from('vet-invoices')
 .upload(fileName, invoiceFile);

 if (error) {
 console.error("Error uploading invoice:", error);
 toast.error("Failed to upload invoice");
 return null;
 }

 const { data: { publicUrl } } = supabase.storage
 .from('vet-invoices')
 .getPublicUrl(fileName);

 return publicUrl;
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();

 if (!selectedVet || !invoiceAmount || !requestedAmount || !termMonths) {
 toast.error("Please fill in all required fields");
 return;
 }

 if (!agreedToTerms) {
 toast.error("Please agree to the terms and conditions");
 return;
 }

 if (!invoiceFile) {
 toast.error("Please upload your vet invoice");
 return;
 }

 setIsSubmitting(true);
 setResult(null);

 try {
 // Upload invoice
 const invoiceUrl = await uploadInvoice();
 if (!invoiceUrl) {
 throw new Error("Failed to upload invoice");
 }

 // Get session token
 const { data: { session } } = await supabase.auth.getSession();
 if (!session) {
 throw new Error("No active session");
 }

 // Submit loan application
 const { data, error } = await supabase.functions.invoke('apply-vet-loan', {
 body: {
 vet_id: selectedVet,
 invoice_amount: parseFloat(invoiceAmount),
 requested_amount: parseFloat(requestedAmount),
 term_months: parseInt(termMonths),
 purpose,
 invoice_url: invoiceUrl,
 agreed_to_terms: agreedToTerms
 },
 headers: {
 Authorization: `Bearer ${session.access_token}`,
 },
 });

 if (error) throw error;

 setResult(data);

 if (data.status ==='approved') {
 toast.success("Loan approved!");
 } else if (data.status ==='declined') {
 toast.error("Loan declined");
 }
 } catch (error) {
 console.error("Error submitting loan:", error);
 toast.error("Failed to submit loan application");
 } finally {
 setIsSubmitting(false);
 }
 };

 const isFormValid = () => {
 return selectedVet && invoiceAmount && requestedAmount && termMonths && agreedToTerms && invoiceFile;
 };

 const handleUpgradeToPremium = async () => {
 try {
 await createCheckout();
 } catch (error) {
 toast.error("Failed to start checkout process");
 }
 };

 if (loading || subscriptionLoading) {
 return (
 <div className="min-h-screen flex items-center justify-center">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-background">
 <Header isAuthenticated={true} onLogout={handleSignOut} />
 
 <div className="container max-w-5xl mx-auto px-4 py-8">
 {/* Header Section */}
 <div className="text-center mb-8 space-y-2">
 <h1 className="text-4xl font-bold text-foreground">Vet Bill Financing</h1>
 <p className="text-lg text-muted-foreground">
 Get instant funding for your vet bill — pay over time through PawBucks.
 </p>
 <p className="text-sm text-muted-foreground italic">
 We're here to help you care for your pet — stress-free.
 </p>
 </div>

 {/* Premium Required Notice */}
 {!subscription.subscribed && (
 <Alert className="border-accent bg-accent/10">
 <Crown className="h-5 w-5 text-accent" aria-hidden="true" />
 <AlertTitle className="text-lg font-bold">PawPass Required</AlertTitle>
 <AlertDescription className="space-y-4">
 <p>
 Vet Bill Financing is an exclusive benefit for PawPass members. 
 Upgrade to PawPass to unlock instant funding for your pet's veterinary care.
 </p>
 <div className="space-y-2">
 <p className="font-semibold">PawPass Benefits Include:</p>
 <ul className="list-disc list-inside space-y-1 text-sm">
 <li>20x points on all purchases (vs 10x for free users)</li>
 <li>Instant vet bill financing up to $10,000</li>
 <li>Flexible repayment terms (3, 6, or 12 months)</li>
 <li>Priority customer support</li>
 <li>No application fees</li>
 </ul>
 </div>
 <div className="flex gap-3">
 <Button onClick={handleUpgradeToPremium} className="gap-2">
 <Crown className="h-4 w-4" aria-hidden="true" />
 Upgrade to PawPass
 </Button>
 <Button onClick={() => navigate('/home')} variant="outline">
 Back to Dashboard
 </Button>
 </div>
 </AlertDescription>
 </Alert>
 )}

 {/* Result Display */}
 {result && (
 <Card className="mb-6 border-2">
 <CardContent className="pt-6">
 <div className="flex items-start gap-4">
 {result.status ==='approved' && (
 <CheckCircle className="h-12 w-12 text-success flex-shrink-0" />
 )}
 {result.status ==='declined' && (
 <XCircle className="h-12 w-12 text-destructive flex-shrink-0" />
 )}
 {result.status ==='pending' && (
 <Clock className="h-12 w-12 text-warning flex-shrink-0" aria-hidden="true" />
 )}
 
 <div className="flex-1 space-y-2">
 <h3 className="text-xl font-bold">{result.message}</h3>
 <p className="text-muted-foreground">{result.next_steps}</p>
 
 {result.repayment_schedule && (
 <div className="mt-4 p-4 bg-muted rounded-lg">
 <h4 className="font-semibold mb-2">Repayment Schedule:</h4>
 <div className="space-y-1 text-sm">
 {result.repayment_schedule.map((payment) => (
 <div key={payment.month} className="flex justify-between">
 <span>Month {payment.month}</span>
 <span className="font-medium">{Formatters.currency(payment.amount)}</span>
 </div>
 ))}
 </div>
 </div>
 )}

 <div className="mt-4 flex gap-2">
 <Button onClick={() => navigate('/home')} variant="default">
 Go to Dashboard
 </Button>
 <Button onClick={() => setResult(null)} variant="outline">
 Apply Again
 </Button>
 </div>
 </div>
 </div>
 </CardContent>
 </Card>
 )}

 {/* Application Form - Only show if Premium subscriber */}
 {!result && subscription.subscribed && (
 <Card>
 <CardHeader>
 <CardTitle>Loan Application</CardTitle>
 <CardDescription>Fill out the form below to apply for vet bill financing</CardDescription>
 </CardHeader>
 <CardContent>
 <form onSubmit={handleSubmit} className="space-y-6">
 {/* Vet Clinic Selection */}
 <div className="space-y-2">
 <Label htmlFor="vet">Partner Vet Clinic *</Label>
 <Select value={selectedVet} onValueChange={setSelectedVet}>
 <SelectTrigger id="vet">
 <SelectValue placeholder="Select a vet clinic" />
 </SelectTrigger>
 <SelectContent>
 {vets.map((vet) => (
 <SelectItem key={vet.id} value={vet.id}>
 {vet.name} - {vet.location}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 {/* Invoice Amount */}
 <div className="space-y-2">
 <Label htmlFor="invoice-amount">Invoice Amount (USD) *</Label>
 <Input
 id="invoice-amount"
 type="number"
 step="0.01"
 min="0"
 placeholder="0.00"
 value={invoiceAmount}
 onChange={(e) => setInvoiceAmount(e.target.value)}
 />
 </div>

 {/* Requested Amount */}
 <div className="space-y-2">
 <Label htmlFor="requested-amount">Requested Loan Amount (USD) *</Label>
 <Input
 id="requested-amount"
 type="number"
 step="0.01"
 min="0"
 placeholder="0.00"
 value={requestedAmount}
 onChange={(e) => setRequestedAmount(e.target.value)}
 />
 <p className="text-xs text-muted-foreground">
 Cannot exceed invoice amount
 </p>
 </div>

 {/* Purpose */}
 <div className="space-y-2">
 <Label htmlFor="purpose">Purpose (Optional)</Label>
 <Textarea
 id="purpose"
 placeholder="e.g., Emergency surgery for Luna"
 value={purpose}
 onChange={(e) => setPurpose(e.target.value)}
 rows={3}
 />
 </div>

 {/* Invoice Upload */}
 <div className="space-y-2">
 <Label htmlFor="invoice">Upload Vet Invoice *</Label>
 <div className="flex items-center gap-4">
 <Input
 id="invoice"
 type="file"
 accept=".pdf,.jpg,.jpeg,.png"
 onChange={handleFileChange}
 className="flex-1"
 />
 {invoiceFile && (
 <div className="flex items-center gap-2 text-success">
 <Upload className="h-4 w-4" />
 <span className="text-sm">{invoiceFile.name}</span>
 </div>
 )}
 </div>
 <p className="text-xs text-muted-foreground">
 PDF or image files only, max 5MB
 </p>
 </div>

 {/* Repayment Term */}
 <div className="space-y-2">
 <Label htmlFor="term">Repayment Term *</Label>
 <Select value={termMonths} onValueChange={setTermMonths}>
 <SelectTrigger id="term">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="3">3 months</SelectItem>
 <SelectItem value="6">6 months</SelectItem>
 <SelectItem value="12">12 months</SelectItem>
 </SelectContent>
 </Select>
 </div>

 {/* Terms Agreement */}
 <div className="flex items-start gap-3">
 <Checkbox
 id="terms"
 checked={agreedToTerms}
 onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
 />
 <Label htmlFor="terms" className="text-sm cursor-pointer leading-relaxed">
 I agree to credit terms and PawBucks's loan policy. I understand that this is a binding financial agreement.
 </Label>
 </div>

 {/* Submit Button */}
 <Button
 type="submit"
 className="w-full"
 disabled={!isFormValid() || isSubmitting}
 >
 {isSubmitting ? (
 <>
 <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
 Checking your eligibility...
 </>
 ) : (
"Apply for Loan"
 )}
 </Button>
 </form>
 </CardContent>
 </Card>
 )}
 </div>
 </div>
 );
};

export default VetLoanApply;