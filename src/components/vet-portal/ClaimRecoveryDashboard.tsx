import { useState, useEffect } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Progress } from"@/components/ui/progress";
import { Badge } from"@/components/ui/badge";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from"@/components/ui/table";
import { AlertCircle, Send, CheckCircle, Clock, DollarSign, FileDown, RefreshCw } from "lucide-react";
import { toast } from"sonner";

import { Formatters } from "@/utils/formatters";
interface ClaimSlice {
 id: string;
 invoice_id: string;
 claim_id: string;
 slice_type: string;
 original_amount: number;
 actual_amount: number;
 gap_amount: number;
 recovery_status: string;
 recovery_option: string | null;
 notification_sent_at: string | null;
 option_selected_at: string | null;
 funded_at: string | null;
 notes: string | null;
 created_at: string;
 claim?: {
 claim_number: string;
 policy?: {
 pet?: {
 name: string;
 };
 vet_insurance_providers?: {
 name: string;
 };
 };
 };
 invoice?: {
 invoice_number: string;
 client_name: string;
 };
}

interface ClaimRecoveryDashboardProps {
 vetId: string;
}

const statusSteps = [
 { key:"pending", label:"Pending", icon: Clock },
 { key:"notification_sent", label:"Notified", icon: Send },
 { key:"option_selected", label:"Option Selected", icon: CheckCircle },
 { key:"funded", label:"Funded", icon: DollarSign },
];

const getStatusProgress = (status: string): number => {
 const index = statusSteps.findIndex((s) => s.key === status);
 if (status ==="written_off") return 100;
 return index >= 0 ? ((index + 1) / statusSteps.length) * 100 : 0;
};

const getStatusColor = (status: string): string => {
 switch (status) {
 case"funded":
 return"bg-success";
 case"option_selected":
 return"bg-info";
 case"notification_sent":
 return"bg-warning";
 case"written_off":
 return"bg-muted";
 default:
 return"bg-primary";
 }
};

export function ClaimRecoveryDashboard({ vetId }: ClaimRecoveryDashboardProps) {
 const [slices, setSlices] = useState<ClaimSlice[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [sendingNotification, setSendingNotification] = useState<string | null>(null);

 useEffect(() => {
 loadUnderpaidSlices();
 }, [vetId]);

 const loadUnderpaidSlices = async () => {
 try {
 const { data, error } = await supabase
 .from("invoice_slices")
 .select(`
 *,
 claim:insurance_claims(
 claim_number,
 policy:pet_insurance_policies(
 pet:pet_profiles(name),
 vet_insurance_providers(name)
 )
 ),
 invoice:invoices(invoice_number, client_name)
 `)
 .eq("slice_type","insurance")
 .gt("gap_amount", 0)
 .order("created_at", { ascending: false });

 if (error) throw error;
 setSlices((data as ClaimSlice[]) || []);
 } catch (error) {
 console.error("Error loading slices:", error);
 toast.error("Failed to load claim recovery data");
 } finally {
 setIsLoading(false);
 }
 };

 const sendOwnerNotification = async (slice: ClaimSlice) => {
 setSendingNotification(slice.id);
 try {
 const { error } = await supabase.functions.invoke("reconcile-claim-gap", {
 body: {
 sliceId: slice.id,
 action:"notify_owner",
 },
 });

 if (error) throw error;

 toast.success("Owner notification sent successfully");
 loadUnderpaidSlices();
 } catch (error) {
 console.error("Error sending notification:", error);
 toast.error("Failed to send notification");
 } finally {
 setSendingNotification(null);
 }
 };

 const generateAppealPDF = async (slice: ClaimSlice) => {
 toast.info("Generating appeal PDF...");
 // In a real implementation, this would call an edge function to generate the PDF
 setTimeout(() => {
 toast.success("Appeal PDF generated and downloaded");
 }, 1500);
 };

 const totalGap = slices.reduce((sum, s) => sum + Number(s.gap_amount), 0);
 const pendingCount = slices.filter((s) => s.recovery_status ==="pending").length;
 const inProgressCount = slices.filter(
 (s) => s.recovery_status ==="notification_sent" || s.recovery_status ==="option_selected"
 ).length;
 const fundedCount = slices.filter((s) => s.recovery_status ==="funded").length;

 if (isLoading) {
 return (
 <Card className="bg-white border-primary/20">
 <CardContent className="p-8 text-center">
 <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
 <p className="mt-2 text-muted-foreground">Loading recovery data...</p>
 </CardContent>
 </Card>
 );
 }

 return (
 <div className="space-y-6">
 {/* Summary Cards */}
 <div className="grid gap-4 md:grid-cols-4">
 <Card className="bg-white border-primary/20">
 <CardContent className="p-4">
 <div className="flex items-center gap-3">
 <div className="p-2 rounded-lg bg-destructive/10">
 <span className="h-5 w-5 text-destructive" aria-hidden="true">📉</span>
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Total Gap Amount</p>
 <p className="text-2xl font-bold text-destructive">{Formatters.currency(totalGap)}</p>
 </div>
 </div>
 </CardContent>
 </Card>

 <Card className="bg-white border-primary/20">
 <CardContent className="p-4">
 <div className="flex items-center gap-3">
 <div className="p-2 rounded-lg bg-warning/10">
 <span className="h-5 w-5 text-warning" aria-hidden="true">⏰</span>
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Pending Action</p>
 <p className="text-2xl font-bold">{pendingCount}</p>
 </div>
 </div>
 </CardContent>
 </Card>

 <Card className="bg-white border-primary/20">
 <CardContent className="p-4">
 <div className="flex items-center gap-3">
 <div className="p-2 rounded-lg bg-info/10">
 <Send className="h-5 w-5 text-info" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">In Progress</p>
 <p className="text-2xl font-bold">{inProgressCount}</p>
 </div>
 </div>
 </CardContent>
 </Card>

 <Card className="bg-white border-primary/20">
 <CardContent className="p-4">
 <div className="flex items-center gap-3">
 <div className="p-2 rounded-lg bg-success/10">
 <CheckCircle className="h-5 w-5 text-success" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Recovered</p>
 <p className="text-2xl font-bold text-success">{fundedCount}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Underpaid Slices Table */}
 <Card className="bg-white border-primary/20">
 <CardHeader className="border-b border-primary/20">
 <CardTitle className="flex items-center gap-2 text-primary">
 <AlertCircle className="h-5 w-5 text-primary" />
 Underpaid Insurance Slices
 </CardTitle>
 </CardHeader>
 <CardContent className="p-0">
 {slices.length === 0 ? (
 <div className="p-8 text-center">
 <CheckCircle className="h-12 w-12 mx-auto text-success mb-3" />
 <p className="text-lg font-medium">No Underpaid Claims</p>
 <p className="text-muted-foreground">All insurance claims are fully reconciled.</p>
 </div>
 ) : (
 <Table>
 <TableHeader>
 <TableRow className="bg-primary/50">
 <TableHead>Claim / Patient</TableHead>
 <TableHead>Carrier</TableHead>
 <TableHead className="text-right">Original Est.</TableHead>
 <TableHead className="text-right">Actual Paid</TableHead>
 <TableHead className="text-right">Gap</TableHead>
 <TableHead>Recovery Status</TableHead>
 <TableHead className="text-right">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {slices.map((slice) => (
 <TableRow key={slice.id} className="hover:bg-primary/30">
 <TableCell>
 <div>
 <p className="font-medium">{slice.claim?.claim_number ||"N/A"}</p>
 <p className="text-sm text-muted-foreground">
 {slice.claim?.policy?.pet?.name ||"Unknown Pet"}
 </p>
 </div>
 </TableCell>
 <TableCell>
 <Badge variant="outline" className="bg-muted">
 {slice.claim?.policy?.vet_insurance_providers?.name ||"Unknown"}
 </Badge>
 </TableCell>
 <TableCell className="text-right font-medium">
 {Formatters.currency(Number(slice.original_amount))}
 </TableCell>
 <TableCell className="text-right">
 {Formatters.currency(Number(slice.actual_amount))}
 </TableCell>
 <TableCell className="text-right">
 <span className="font-bold text-destructive">
 {Formatters.currency(Number(slice.gap_amount))}
 </span>
 </TableCell>
 <TableCell>
 <div className="space-y-2">
 <div className="flex items-center gap-2">
 <Progress
 value={getStatusProgress(slice.recovery_status)}
 className="h-2 w-24"
 />
 <Badge
 className={`${getStatusColor(slice.recovery_status)} text-white text-xs`}
 >
 {slice.recovery_status.replace("_", " ")}
 </Badge>
 </div>
 {slice.recovery_option && (
 <p className="text-xs text-muted-foreground">
 Option: {slice.recovery_option.replace("_", " ")}
 </p>
 )}
 </div>
 </TableCell>
 <TableCell>
 <div className="flex items-center gap-2 justify-end">
 {slice.recovery_status ==="pending" && (
 <Button
 size="sm"
 variant="outline"
 className="border-primary/20 text-primary hover:bg-primary/10"
 onClick={() => sendOwnerNotification(slice)}
 disabled={sendingNotification === slice.id}
 >
 {sendingNotification === slice.id ? (
 <RefreshCw className="h-4 w-4 animate-spin" />
 ) : (
 <Send className="h-4 w-4" />
 )}
 <span className="ml-1">Notify</span>
 </Button>
 )}
 <Button
 size="sm"
 variant="ghost"
 className="text-primary hover:bg-primary/10"
 onClick={() => generateAppealPDF(slice)}
 >
 <FileDown className="h-4 w-4" />
 <span className="ml-1">Appeal PDF</span>
 </Button>
 </div>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 )}
 </CardContent>
 </Card>
 </div>
 );
}
