import { useState } from"react";
import { useQuery, useMutation, useQueryClient } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Textarea } from"@/components/ui/textarea";
import { Badge } from"@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from"@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from"@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { Separator } from"@/components/ui/separator";
import { toast } from"sonner";
import { FileText, DollarSign, Send, Clock, CheckCircle2, XCircle, AlertTriangle, Plus, Search, Loader2 } from "lucide-react";

import { Formatters } from "@/utils/formatters";
interface InsuranceClaimSplitterProps {
 vetId: string;
}

interface InsuranceProvider {
 id: string;
 name: string;
 code: string;
 claim_submission_email: string;
}

interface InsurancePolicy {
 id: string;
 pet_id: string;
 policy_number: string;
 copay_percentage: number;
 deductible_amount: number;
 deductible_met: number;
 annual_limit: number | null;
 annual_used: number;
 is_active: boolean;
 vet_insurance_providers: InsuranceProvider;
 pet_profiles?: {
 id: string;
 name: string;
 type: string;
 };
}

interface InsuranceClaim {
 id: string;
 claim_number: string;
 policy_id: string;
 invoice_id: string | null;
 service_date: string;
 total_amount: number;
 covered_amount: number | null;
 copay_amount: number | null;
 owner_responsibility: number | null;
 status: string;
 submitted_at: string | null;
 created_at: string;
 pet_insurance_policies?: InsurancePolicy;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
 draft: { label:"Draft", color:"bg-muted text-muted-foreground", icon: FileText },
 pending_submission: { label:"Pending", color:"bg-warning/10 text-warning", icon: Clock },
 submitted: { label:"Submitted", color:"bg-info/10 text-info", icon: Send },
 under_review: { label:"Under Review", color:"bg-primary/10 text-primary", icon: Search },
 approved: { label:"Approved", color:"bg-success/10 text-success", icon: CheckCircle2 },
 partially_approved: { label:"Partial", color:"bg-warning/10 text-warning", icon: AlertTriangle },
 denied: { label:"Denied", color:"bg-destructive/10 text-destructive", icon: XCircle },
 paid: { label:"Paid", color:"bg-success/10 text-success", icon: DollarSign },
 appealed: { label:"Appealed", color:"bg-primary/10 text-primary", icon: FileText },
};

export function InsuranceClaimSplitter({ vetId }: InsuranceClaimSplitterProps) {
 const queryClient = useQueryClient();
 const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
 const [selectedInvoice, setSelectedInvoice] = useState<string>("");
 const [selectedPolicy, setSelectedPolicy] = useState<string>("");
 const [serviceDate, setServiceDate] = useState(new Date().toISOString().split("T")[0]);
 const [diagnosisCodes, setDiagnosisCodes] = useState("");
 const [procedureCodes, setProcedureCodes] = useState("");
 const [notes, setNotes] = useState("");

 // Fetch insurance claims
 const { data: claims = [], isLoading: claimsLoading } = useQuery({
 queryKey: ["insurance-claims", vetId],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("insurance_claims")
 .select(`
 *,
 pet_insurance_policies(
 *,
 vet_insurance_providers(*),
 pet_profiles(id, name, type)
 )
 `)
 .eq("vet_id", vetId)
 .order("created_at", { ascending: false });

 if (error) throw error;
 return data as InsuranceClaim[];
 },
 });

 // Fetch unpaid invoices (simplified - get recent invoices)
 const { data: invoices = [] } = useQuery({
 queryKey: ["vet-invoices-for-claims", vetId],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("invoices")
 .select("id, invoice_number, client_name, total, status")
 .in("status", ["sent","viewed","partially_paid"])
 .order("created_at", { ascending: false })
 .limit(50);

 if (error) throw error;
 return data || [];
 },
 });

 // Fetch all active insurance policies (for vet to see patient policies)
 const { data: policies = [] } = useQuery({
 queryKey: ["all-insurance-policies", vetId],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("pet_insurance_policies")
 .select(`
 *,
 vet_insurance_providers(*),
 pet_profiles(id, name, type)
 `)
 .eq("is_active", true)
 .order("created_at", { ascending: false });

 if (error) throw error;
 return data as InsurancePolicy[];
 },
 });

 // Process claim mutation
 const processClaimMutation = useMutation({
 mutationFn: async () => {
 const { data, error } = await supabase.functions.invoke("process-insurance-claim", {
 body: {
 invoiceId: selectedInvoice,
 policyId: selectedPolicy,
 serviceDate,
 diagnosisCodes: diagnosisCodes.split(",").map((c) => c.trim()).filter(Boolean),
 procedureCodes: procedureCodes.split(",").map((c) => c.trim()).filter(Boolean),
 notes,
 autoSubmit: false,
 },
 });

 if (error) throw error;
 return data;
 },
 onSuccess: (data) => {
 queryClient.invalidateQueries({ queryKey: ["insurance-claims", vetId] });
 setIsCreateDialogOpen(false);
 resetForm();
 
 toast.success(
 <div>
 <p className="font-medium">Claim created: {data.claim.claimNumber}</p>
 <p className="text-sm">Owner copay: {Formatters.currency(data.paymentSplit.ownerCopay)}</p>
 </div>
 );
 },
 onError: (error) => {
 toast.error(`Failed to process claim: ${error.message}`);
 },
 });

 // Submit claim mutation
 const submitClaimMutation = useMutation({
 mutationFn: async (claimId: string) => {
 const { error } = await supabase
 .from("insurance_claims")
 .update({ 
 status:"submitted", 
 submitted_at: new Date().toISOString(),
 })
 .eq("id", claimId);

 if (error) throw error;
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["insurance-claims", vetId] });
 toast.success("Claim submitted to insurance provider");
 },
 });

 // Deny claim mutation
 const [denyingClaimId, setDenyingClaimId] = useState<string | null>(null);
 
 const denyClaimMutation = useMutation({
 mutationFn: async ({ claimId, denialReason }: { claimId: string; denialReason: string }) => {
 setDenyingClaimId(claimId);
 const { data, error } = await supabase.functions.invoke("deny-insurance-claim", {
 body: { claimId, denialReason },
 });

 if (error) throw error;
 return data;
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["insurance-claims", vetId] });
 toast.success("Claim marked as denied - owner has been notified");
 setDenyingClaimId(null);
 },
 onError: (error) => {
 toast.error(`Failed to deny claim: ${error.message}`);
 setDenyingClaimId(null);
 },
 });

 const handleDenyClaim = (claimId: string, denialReason: string) => {
 denyClaimMutation.mutate({ claimId, denialReason });
 };

 const resetForm = () => {
 setSelectedInvoice("");
 setSelectedPolicy("");
 setServiceDate(new Date().toISOString().split("T")[0]);
 setDiagnosisCodes("");
 setProcedureCodes("");
 setNotes("");
 };

 // Get selected policy details for preview
 const selectedPolicyDetails = policies.find((p) => p.id === selectedPolicy);
 const selectedInvoiceDetails = invoices.find((i) => i.id === selectedInvoice);

 // Calculate estimated coverage
 const calculateEstimatedCoverage = () => {
 if (!selectedPolicyDetails || !selectedInvoiceDetails) return null;

 const total = selectedInvoiceDetails.total;
 const copay = selectedPolicyDetails.copay_percentage || 20;
 const deductibleRemaining = Math.max(0, 
 (selectedPolicyDetails.deductible_amount || 0) - (selectedPolicyDetails.deductible_met || 0)
 );

 const afterDeductible = Math.max(0, total - deductibleRemaining);
 const insurancePortion = afterDeductible * (1 - copay / 100);
 const ownerResponsibility = total - insurancePortion;

 return {
 total,
 deductibleApplied: Math.min(deductibleRemaining, total),
 insurancePortion: Math.round(insurancePortion * 100) / 100,
 ownerResponsibility: Math.round(ownerResponsibility * 100) / 100,
 copayPercentage: copay,
 };
 };

 const estimatedCoverage = calculateEstimatedCoverage();

 if (claimsLoading) {
 return <div className="flex items-center justify-center p-8">Loading insurance claims...</div>;
 }

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-2xl font-bold flex items-center gap-2">
 <span className="h-6 w-6 text-info" aria-hidden="true">🛡️</span>
 Insurance Claim Splitter
 </h2>
 <p className="text-muted-foreground">
 Automatically split invoices between insurance and owner copay
 </p>
 </div>
 <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
 <DialogTrigger asChild>
 <Button className="gap-2">
 <Plus className="h-4 w-4" />
 Process Claim
 </Button>
 </DialogTrigger>
 <DialogContent className="max-w-2xl">
 <DialogHeader>
 <DialogTitle>Process Insurance Claim</DialogTitle>
 <DialogDescription>
 Split an invoice between insurance coverage and owner responsibility
 </DialogDescription>
 </DialogHeader>

 <div className="space-y-4 mt-4">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label>Select Invoice *</Label>
 <Select value={selectedInvoice} onValueChange={setSelectedInvoice}>
 <SelectTrigger>
 <SelectValue placeholder="Choose invoice..." />
 </SelectTrigger>
 <SelectContent>
 {invoices.map((inv) => (
 <SelectItem key={inv.id} value={inv.id}>
 {inv.invoice_number} - {inv.client_name} (${inv.total})
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div>
 <Label>Insurance Policy *</Label>
 <Select value={selectedPolicy} onValueChange={setSelectedPolicy}>
 <SelectTrigger>
 <SelectValue placeholder="Choose policy..." />
 </SelectTrigger>
 <SelectContent>
 {policies.map((policy) => (
 <SelectItem key={policy.id} value={policy.id}>
 {policy.pet_profiles?.name} - {policy.vet_insurance_providers?.name} ({policy.policy_number})
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>

 <div>
 <Label>Service Date</Label>
 <Input
 type="date"
 value={serviceDate}
 onChange={(e) => setServiceDate(e.target.value)}
 />
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label>Diagnosis Codes (comma-separated)</Label>
 <Input
 value={diagnosisCodes}
 onChange={(e) => setDiagnosisCodes(e.target.value)}
 placeholder="e.g., K08.0, R11"
 />
 </div>
 <div>
 <Label>Procedure Codes (comma-separated)</Label>
 <Input
 value={procedureCodes}
 onChange={(e) => setProcedureCodes(e.target.value)}
 placeholder="e.g., 99213, 71046"
 />
 </div>
 </div>

 <div>
 <Label>Notes</Label>
 <Textarea
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 placeholder="Additional notes for the claim..."
 rows={2}
 />
 </div>

 {/* Coverage Preview */}
 {estimatedCoverage && (
 <Card className="bg-muted">
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium">Estimated Coverage Split</CardTitle>
 </CardHeader>
 <CardContent className="space-y-2">
 <div className="flex justify-between text-sm">
 <span>Invoice Total:</span>
 <span className="font-medium">{Formatters.currency(estimatedCoverage.total)}</span>
 </div>
 {estimatedCoverage.deductibleApplied > 0 && (
 <div className="flex justify-between text-sm text-muted-foreground">
 <span>Deductible Applied:</span>
 <span>-{Formatters.currency(estimatedCoverage.deductibleApplied)}</span>
 </div>
 )}
 <Separator />
 <div className="flex justify-between text-sm">
 <span className="flex items-center gap-1">
 <span className="h-4 w-4 text-info" aria-hidden="true">🛡️</span>
 Insurance Pays:
 </span>
 <span className="font-medium text-info">
 {Formatters.currency(estimatedCoverage.insurancePortion)}
 </span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="flex items-center gap-1">
 <span className="h-4 w-4 text-warning" aria-hidden="true">💳</span>
 Owner Copay ({estimatedCoverage.copayPercentage}%):
 </span>
 <span className="font-medium text-warning">
 {Formatters.currency(estimatedCoverage.ownerResponsibility)}
 </span>
 </div>
 </CardContent>
 </Card>
 )}
 </div>

 <DialogFooter className="mt-6">
 <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
 Cancel
 </Button>
 <Button
 onClick={() => processClaimMutation.mutate()}
 disabled={!selectedInvoice || !selectedPolicy || processClaimMutation.isPending}
 >
 {processClaimMutation.isPending ? (
 <>
 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
 Processing...
 </>
 ) : (
"Process Claim"
 )}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>

 {/* Claims Overview Tabs */}
 <Tabs defaultValue="all" className="space-y-4">
 <TabsList>
 <TabsTrigger value="all">All Claims ({claims.length})</TabsTrigger>
 <TabsTrigger value="pending">
 Pending ({claims.filter((c) => ["draft","pending_submission"].includes(c.status)).length})
 </TabsTrigger>
 <TabsTrigger value="submitted">
 Submitted ({claims.filter((c) => ["submitted","under_review"].includes(c.status)).length})
 </TabsTrigger>
 <TabsTrigger value="resolved">
 Resolved ({claims.filter((c) => ["approved","paid","denied"].includes(c.status)).length})
 </TabsTrigger>
 </TabsList>

 <TabsContent value="all" className="space-y-4">
 {claims.length === 0 ? (
 <Card className="border-dashed">
 <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
 <span className="h-12 w-12 mb-4 opacity-50" aria-hidden="true">🛡️</span>
 <h3 className="text-lg font-medium mb-1">No Insurance Claims</h3>
 <p className="text-sm mb-4">Process your first claim to split invoices automatically</p>
 <Button onClick={() => setIsCreateDialogOpen(true)}>
 <Plus className="h-4 w-4 mr-2" />
 Process First Claim
 </Button>
 </CardContent>
 </Card>
 ) : (
 <div className="space-y-3">
 {claims.map((claim) => {
 const statusConfig = STATUS_CONFIG[claim.status] || STATUS_CONFIG.draft;
 const StatusIcon = statusConfig.icon;
 const policy = claim.pet_insurance_policies;

 return (
 <Card key={claim.id}>
 <CardContent className="py-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className={`p-2 rounded-full ${statusConfig.color}`}>
 <StatusIcon className="h-4 w-4" />
 </div>
 <div>
 <div className="flex items-center gap-2">
 <span className="font-medium">{claim.claim_number}</span>
 <Badge variant="outline" className={statusConfig.color}>
 {statusConfig.label}
 </Badge>
 </div>
 <p className="text-sm text-muted-foreground">
 {policy?.pet_profiles?.name} • {policy?.vet_insurance_providers?.name} • 
 Service: {new Date(claim.service_date).toLocaleDateString()}
 </p>
 </div>
 </div>

 <div className="flex items-center gap-6">
 <div className="text-right">
 <p className="text-sm text-muted-foreground">Total</p>
 <p className="font-medium">{Formatters.currency(claim.total_amount ?? 0)}</p>
 </div>
 {claim.covered_amount !== null && (
 <div className="text-right">
 <p className="text-sm text-muted-foreground">Insurance</p>
 <p className="font-medium text-info">
 {Formatters.currency(claim.covered_amount ?? 0)}
 </p>
 </div>
 )}
 {claim.owner_responsibility !== null && (
 <div className="text-right">
 <p className="text-sm text-muted-foreground">Owner</p>
 <p className="font-medium text-warning">
 {Formatters.currency(claim.owner_responsibility ?? 0)}
 </p>
 </div>
 )}

 {claim.status ==="draft" && (
 <Button
 size="sm"
 onClick={() => submitClaimMutation.mutate(claim.id)}
 disabled={submitClaimMutation.isPending}
 >
 <Send className="h-4 w-4 mr-1" />
 Submit
 </Button>
 )}
 </div>
 </div>
 </CardContent>
 </Card>
 );
 })}
 </div>
 )}
 </TabsContent>

 <TabsContent value="pending">
 {claims.filter((c) => ["draft","pending_submission"].includes(c.status)).length === 0 ? (
 <Card className="border-dashed">
 <CardContent className="py-8 text-center text-muted-foreground">
 <span className="h-8 w-8 mx-auto mb-2 opacity-50" aria-hidden="true">⏰</span>
 <p>No pending claims</p>
 </CardContent>
 </Card>
 ) : (
 <div className="space-y-3">
 {claims
 .filter((c) => ["draft","pending_submission"].includes(c.status))
 .map((claim) => (
 <ClaimCard key={claim.id} claim={claim} onSubmit={() => submitClaimMutation.mutate(claim.id)} />
 ))}
 </div>
 )}
 </TabsContent>

 <TabsContent value="submitted">
 {claims.filter((c) => ["submitted","under_review"].includes(c.status)).length === 0 ? (
 <Card className="border-dashed">
 <CardContent className="py-8 text-center text-muted-foreground">
 <Send className="h-8 w-8 mx-auto mb-2 opacity-50" />
 <p>No submitted claims awaiting response</p>
 </CardContent>
 </Card>
 ) : (
 <div className="space-y-3">
 {claims
 .filter((c) => ["submitted","under_review"].includes(c.status))
 .map((claim) => (
 <ClaimCard key={claim.id} claim={claim} />
 ))}
 </div>
 )}
 </TabsContent>

 <TabsContent value="resolved">
 {claims.filter((c) => ["approved","paid","denied","partially_approved"].includes(c.status)).length === 0 ? (
 <Card className="border-dashed">
 <CardContent className="py-8 text-center text-muted-foreground">
 <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
 <p>No resolved claims</p>
 </CardContent>
 </Card>
 ) : (
 <div className="space-y-3">
 {claims
 .filter((c) => ["approved","paid","denied","partially_approved"].includes(c.status))
 .map((claim) => (
 <ClaimCard key={claim.id} claim={claim} />
 ))}
 </div>
 )}
 </TabsContent>
 </Tabs>

 {/* How It Works Card */}
 <Card className="bg-gradient-to-r from-info/20 to-info/20 /30 /30">
 <CardContent className="py-4">
 <div className="flex items-start gap-3">
 <span className="h-5 w-5 text-info mt-0.5" aria-hidden="true">🛡️</span>
 <div>
 <p className="font-medium">Direct-to-Vet Insurance Processing</p>
 <p className="text-sm text-muted-foreground mt-1">
 When you process a claim, PawBucks automatically calculates the insurance coverage based on the
 patient's policy details (copay %, deductible, annual limits). The owner only pays their copay
 portion at checkout, and the claim is submitted directly to the insurance provider.
 </p>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>
 );
}

// Helper component for claim cards with deny action
function ClaimCard({ 
 claim, 
 onSubmit,
 onDeny,
 isDenying 
}: { 
 claim: InsuranceClaim; 
 onSubmit?: () => void;
 onDeny?: (claimId: string, reason: string) => void;
 isDenying?: boolean;
}) {
 const [showDenyDialog, setShowDenyDialog] = useState(false);
 const [denialReason, setDenialReason] = useState("");
 
 const statusConfig = STATUS_CONFIG[claim.status] || STATUS_CONFIG.draft;
 const StatusIcon = statusConfig.icon;
 const policy = claim.pet_insurance_policies;

 const handleDeny = () => {
 if (onDeny) {
 onDeny(claim.id, denialReason);
 setShowDenyDialog(false);
 setDenialReason("");
 }
 };

 const canDeny = ["submitted","under_review"].includes(claim.status);

 return (
 <>
 <Card>
 <CardContent className="py-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className={`p-2 rounded-full ${statusConfig.color}`}>
 <StatusIcon className="h-4 w-4" />
 </div>
 <div>
 <div className="flex items-center gap-2">
 <span className="font-medium">{claim.claim_number}</span>
 <Badge variant="outline" className={statusConfig.color}>
 {statusConfig.label}
 </Badge>
 </div>
 <p className="text-sm text-muted-foreground">
 {policy?.pet_profiles?.name} • {policy?.vet_insurance_providers?.name}
 </p>
 </div>
 </div>

 <div className="flex items-center gap-6">
 <div className="text-right">
 <p className="text-sm text-muted-foreground">Total</p>
 <p className="font-medium">{Formatters.currency(claim.total_amount ?? 0)}</p>
 </div>
 {claim.covered_amount !== null && (
 <div className="text-right">
 <p className="text-sm text-muted-foreground">Insurance</p>
 <p className="font-medium text-info">{Formatters.currency(claim.covered_amount ?? 0)}</p>
 </div>
 )}
 {claim.owner_responsibility !== null && (
 <div className="text-right">
 <p className="text-sm text-muted-foreground">Owner</p>
 <p className="font-medium text-warning">{Formatters.currency(claim.owner_responsibility ?? 0)}</p>
 </div>
 )}
 
 <div className="flex items-center gap-2">
 {onSubmit && claim.status ==="draft" && (
 <Button size="sm" onClick={onSubmit}>
 <Send className="h-4 w-4 mr-1" />
 Submit
 </Button>
 )}
 {canDeny && onDeny && (
 <Button 
 size="sm" 
 variant="outline"
 className="border-destructive/20 text-destructive hover:bg-destructive/10"
 onClick={() => setShowDenyDialog(true)}
 >
 <XCircle className="h-4 w-4 mr-1" />
 Mark Denied
 </Button>
 )}
 </div>
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Deny Claim Dialog */}
 <Dialog open={showDenyDialog} onOpenChange={setShowDenyDialog}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2 text-destructive">
 <XCircle className="h-5 w-5" />
 Mark Claim as Denied
 </DialogTitle>
 <DialogDescription>
 This will notify the pet owner that their claim was denied and they need to pay the full balance.
 </DialogDescription>
 </DialogHeader>
 
 <div className="space-y-4 mt-4">
 <div className="p-3 bg-warning/10 rounded-lg border border-warning/20">
 <p className="text-sm text-warning">
 <strong>Claim:</strong> {claim.claim_number}<br />
 <strong>Patient:</strong> {policy?.pet_profiles?.name}<br />
 <strong>Amount:</strong> {Formatters.currency(claim.total_amount ?? 0)}
 </p>
 </div>
 
 <div>
 <Label>Denial Reason (from carrier)</Label>
 <Textarea
 value={denialReason}
 onChange={(e) => setDenialReason(e.target.value)}
 placeholder="e.g., Pre-existing condition exclusion, Waiting period not met..."
 rows={3}
 />
 </div>
 </div>

 <DialogFooter className="mt-4">
 <Button variant="outline" onClick={() => setShowDenyDialog(false)}>
 Cancel
 </Button>
 <Button 
 variant="destructive"
 onClick={handleDeny}
 disabled={isDenying}
 >
 {isDenying ? (
 <>
 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
 Processing...
 </>
 ) : (
"Confirm Denial"
 )}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </>
 );
}
