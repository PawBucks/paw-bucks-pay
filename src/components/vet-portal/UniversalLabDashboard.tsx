import { useState } from"react";
import { useQuery, useMutation, useQueryClient } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { Card } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { Input } from"@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from"@/components/ui/table";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
} from"@/components/ui/dialog";
import {
 FlaskConical,
 Search,
 Filter,
 CheckCircle,
 AlertTriangle,
 Clock,
 Eye,
 Link,
 FileText,
 Image,
 Download,
 RefreshCw,
} from"lucide-react";
import { format } from"date-fns";
import { toast } from"sonner";

interface UniversalLabDashboardProps {
 vetId: string;
}

export function UniversalLabDashboard({ vetId }: UniversalLabDashboardProps) {
 const queryClient = useQueryClient();
 const [searchTerm, setSearchTerm] = useState("");
 const [statusFilter, setStatusFilter] = useState<string>("all");
 const [vendorFilter, setVendorFilter] = useState<string>("all");
 const [selectedResult, setSelectedResult] = useState<any>(null);
 const [activeTab, setActiveTab] = useState("labs");

 // Fetch external lab results
 const { data: labResults, isLoading: labsLoading } = useQuery({
 queryKey: ["external-lab-results", vetId, statusFilter, vendorFilter],
 queryFn: async () => {
 let query = supabase
 .from("external_lab_results")
 .select(`
 *,
 pet:pet_profiles(id, name, type)
 `)
 .eq("vet_id", vetId)
 .order("result_date", { ascending: false })
 .limit(100);

 if (statusFilter !=="all") {
 query = query.eq("status", statusFilter);
 }
 if (vendorFilter !=="all") {
 query = query.eq("lab_vendor", vendorFilter);
 }

 const { data, error } = await query;
 if (error) throw error;
 return data;
 },
 });

 // Fetch external imaging results
 const { data: imagingResults, isLoading: imagingLoading } = useQuery({
 queryKey: ["external-imaging-results", vetId],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("external_imaging_results")
 .select(`
 *,
 pet:pet_profiles(id, name, type)
 `)
 .eq("vet_id", vetId)
 .order("study_date", { ascending: false })
 .limit(100);

 if (error) throw error;
 return data;
 },
 });

 // Mark as reviewed mutation
 const markReviewedMutation = useMutation({
 mutationFn: async ({ id, type }: { id: string; type:"lab" |"imaging" }) => {
 const table = type ==="lab" ?"external_lab_results" :"external_imaging_results";
 const { error } = await supabase
 .from(table)
 .update({
 is_reviewed: true,
 reviewed_by: vetId,
 reviewed_at: new Date().toISOString(),
 })
 .eq("id", id);
 if (error) throw error;
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["external-lab-results"] });
 queryClient.invalidateQueries({ queryKey: ["external-imaging-results"] });
 toast.success("Marked as reviewed");
 },
 });

 // Link to EMR mutation
 const linkToEMRMutation = useMutation({
 mutationFn: async ({ id, type }: { id: string; type:"lab" |"imaging" }) => {
 // In production, this would create an entry in pet_lab_results or pet_imaging_records
 // and link it back to this external result
 const table = type ==="lab" ?"external_lab_results" :"external_imaging_results";
 const { error } = await supabase
 .from(table)
 .update({ linked_to_emr: true })
 .eq("id", id);
 if (error) throw error;
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["external-lab-results"] });
 queryClient.invalidateQueries({ queryKey: ["external-imaging-results"] });
 toast.success("Linked to patient EMR");
 },
 });

 const filteredLabResults = labResults?.filter((result) =>
 result.test_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
 result.pet?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
 result.external_order_id.toLowerCase().includes(searchTerm.toLowerCase())
 );

 const pendingLabCount = labResults?.filter((r) => !r.is_reviewed).length || 0;
 const abnormalLabCount = labResults?.filter((r) => r.has_abnormal_values).length || 0;
 const pendingImagingCount = imagingResults?.filter((r) => !r.is_reviewed).length || 0;

 const getStatusBadge = (status: string, hasAbnormal: boolean) => {
 if (hasAbnormal) {
 return (
 <Badge variant="destructive">
 <AlertTriangle className="h-3 w-3 mr-1" />
 Abnormal
 </Badge>
 );
 }
 switch (status) {
 case"final":
 return <Badge className="bg-success/10 text-success"><CheckCircle className="h-3 w-3 mr-1" />Final</Badge>;
 case"preliminary":
 return <Badge className="bg-warning/10 text-warning"><Clock className="h-3 w-3 mr-1" />Preliminary</Badge>;
 default:
 return <Badge variant="secondary">{status}</Badge>;
 }
 };

 const getVendorBadge = (vendor: string) => {
 const colors: Record<string, string> = {
 idexx:"bg-info/10 text-info",
 antech:"bg-primary/10 text-primary",
 zoetis:"bg-success/10 text-success",
 heska:"bg-warning/10 text-warning",
 };
 return (
 <Badge className={colors[vendor] ||"bg-muted text-muted-foreground"}>
 {vendor.toUpperCase()}
 </Badge>
 );
 };

 return (
 <div className="space-y-6">
 {/* Header Stats */}
 <div className="grid gap-4 md:grid-cols-4">
 <Card className="p-4">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
 <Clock className="h-5 w-5 text-warning" />
 </div>
 <div>
 <p className="text-2xl font-bold">{pendingLabCount}</p>
 <p className="text-xs text-muted-foreground">Pending Labs</p>
 </div>
 </div>
 </Card>
 <Card className="p-4">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
 <AlertTriangle className="h-5 w-5 text-destructive" />
 </div>
 <div>
 <p className="text-2xl font-bold">{abnormalLabCount}</p>
 <p className="text-xs text-muted-foreground">Abnormal Results</p>
 </div>
 </div>
 </Card>
 <Card className="p-4">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-info/10 flex items-center justify-center">
 <Image className="h-5 w-5 text-info" />
 </div>
 <div>
 <p className="text-2xl font-bold">{pendingImagingCount}</p>
 <p className="text-xs text-muted-foreground">Pending Imaging</p>
 </div>
 </div>
 </Card>
 <Card className="p-4">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
 <CheckCircle className="h-5 w-5 text-success" />
 </div>
 <div>
 <p className="text-2xl font-bold">{labResults?.filter((r) => r.is_reviewed).length || 0}</p>
 <p className="text-xs text-muted-foreground">Reviewed Today</p>
 </div>
 </div>
 </Card>
 </div>

 {/* Tabs */}
 <Tabs value={activeTab} onValueChange={setActiveTab}>
 <TabsList>
 <TabsTrigger value="labs" className="flex items-center gap-2">
 <FlaskConical className="h-4 w-4" />
 Bloodwork & Labs
 {pendingLabCount > 0 && (
 <Badge variant="secondary" className="ml-1">{pendingLabCount}</Badge>
 )}
 </TabsTrigger>
 <TabsTrigger value="imaging" className="flex items-center gap-2">
 <Image className="h-4 w-4" />
 Imaging (DICOM)
 {pendingImagingCount > 0 && (
 <Badge variant="secondary" className="ml-1">{pendingImagingCount}</Badge>
 )}
 </TabsTrigger>
 </TabsList>

 <TabsContent value="labs" className="space-y-4">
 {/* Filters */}
 <div className="flex gap-4 flex-wrap">
 <div className="relative flex-1 min-w-[200px] max-w-sm">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input
 placeholder="Search tests, patients, order IDs..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="pl-10"
 />
 </div>
 <Select value={statusFilter} onValueChange={setStatusFilter}>
 <SelectTrigger className="w-[150px]">
 <Filter className="h-4 w-4 mr-2" />
 <SelectValue placeholder="Status" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Status</SelectItem>
 <SelectItem value="pending">Pending</SelectItem>
 <SelectItem value="preliminary">Preliminary</SelectItem>
 <SelectItem value="final">Final</SelectItem>
 </SelectContent>
 </Select>
 <Select value={vendorFilter} onValueChange={setVendorFilter}>
 <SelectTrigger className="w-[150px]">
 <SelectValue placeholder="Lab Vendor" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Labs</SelectItem>
 <SelectItem value="idexx">IDEXX</SelectItem>
 <SelectItem value="antech">Antech</SelectItem>
 <SelectItem value="zoetis">Zoetis</SelectItem>
 <SelectItem value="heska">Heska</SelectItem>
 </SelectContent>
 </Select>
 </div>

 {/* Lab Results Table */}
 <Card>
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Date</TableHead>
 <TableHead>Patient</TableHead>
 <TableHead>Test</TableHead>
 <TableHead>Lab</TableHead>
 <TableHead>Status</TableHead>
 <TableHead>Reviewed</TableHead>
 <TableHead className="text-right">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {labsLoading ? (
 <TableRow>
 <TableCell colSpan={7} className="text-center py-8">
 <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
 Loading lab results...
 </TableCell>
 </TableRow>
 ) : filteredLabResults && filteredLabResults.length > 0 ? (
 filteredLabResults.map((result) => (
 <TableRow 
 key={result.id}
 className={result.has_abnormal_values ?"bg-destructive/10 /20" :""}
 >
 <TableCell className="text-sm">
 {format(new Date(result.result_date),"MMM d, yyyy")}
 </TableCell>
 <TableCell>
 <div className="font-medium">{result.pet?.name ||"Unknown"}</div>
 <div className="text-xs text-muted-foreground">
 Order: {result.external_order_id}
 </div>
 </TableCell>
 <TableCell>
 <div className="font-medium">{result.test_name}</div>
 {result.test_category && (
 <div className="text-xs text-muted-foreground">{result.test_category}</div>
 )}
 </TableCell>
 <TableCell>{getVendorBadge(result.lab_vendor)}</TableCell>
 <TableCell>
 {getStatusBadge(result.status, result.has_abnormal_values)}
 </TableCell>
 <TableCell>
 {result.is_reviewed ? (
 <CheckCircle className="h-4 w-4 text-success" />
 ) : (
 <Clock className="h-4 w-4 text-warning" />
 )}
 </TableCell>
 <TableCell className="text-right">
 <div className="flex justify-end gap-2">
 <Button
 variant="outline"
 size="sm"
 onClick={() => setSelectedResult({ ...result, type:"lab" })}
 >
 <Eye className="h-4 w-4" />
 </Button>
 {!result.linked_to_emr && (
 <Button
 variant="outline"
 size="sm"
 onClick={() => linkToEMRMutation.mutate({ id: result.id, type:"lab" })}
 >
 <Link className="h-4 w-4" />
 </Button>
 )}
 {result.pdf_url && (
 <Button
 variant="outline"
 size="sm"
 asChild
 >
 <a href={result.pdf_url} target="_blank" rel="noopener noreferrer">
 <Download className="h-4 w-4" />
 </a>
 </Button>
 )}
 </div>
 </TableCell>
 </TableRow>
 ))
 ) : (
 <TableRow>
 <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
 <FlaskConical className="h-8 w-8 mx-auto mb-2 opacity-50" />
 No lab results found
 </TableCell>
 </TableRow>
 )}
 </TableBody>
 </Table>
 </Card>
 </TabsContent>

 <TabsContent value="imaging" className="space-y-4">
 <Card>
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Date</TableHead>
 <TableHead>Patient</TableHead>
 <TableHead>Study</TableHead>
 <TableHead>Modality</TableHead>
 <TableHead>Lab</TableHead>
 <TableHead>Status</TableHead>
 <TableHead className="text-right">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {imagingLoading ? (
 <TableRow>
 <TableCell colSpan={7} className="text-center py-8">
 <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
 Loading imaging results...
 </TableCell>
 </TableRow>
 ) : imagingResults && imagingResults.length > 0 ? (
 imagingResults.map((result) => (
 <TableRow key={result.id}>
 <TableCell className="text-sm">
 {format(new Date(result.study_date),"MMM d, yyyy")}
 </TableCell>
 <TableCell>
 <div className="font-medium">{result.pet?.name ||"Unknown"}</div>
 <div className="text-xs text-muted-foreground">
 Study: {result.external_study_id}
 </div>
 </TableCell>
 <TableCell>
 <div className="font-medium">{result.study_description ||"Imaging Study"}</div>
 {result.body_part && (
 <div className="text-xs text-muted-foreground">{result.body_part}</div>
 )}
 </TableCell>
 <TableCell>
 <Badge variant="outline">
 {result.modality.toUpperCase()}
 </Badge>
 </TableCell>
 <TableCell>{getVendorBadge(result.lab_vendor)}</TableCell>
 <TableCell>
 <Badge variant={result.status ==="final" ?"default" :"secondary"}>
 {result.status}
 </Badge>
 </TableCell>
 <TableCell className="text-right">
 <div className="flex justify-end gap-2">
 <Button
 variant="outline"
 size="sm"
 onClick={() => setSelectedResult({ ...result, type:"imaging" })}
 >
 <Eye className="h-4 w-4" />
 </Button>
 {result.dicom_viewer_url && (
 <Button
 variant="outline"
 size="sm"
 asChild
 >
 <a href={result.dicom_viewer_url} target="_blank" rel="noopener noreferrer">
 <Image className="h-4 w-4" />
 </a>
 </Button>
 )}
 {!result.linked_to_emr && (
 <Button
 variant="outline"
 size="sm"
 onClick={() => linkToEMRMutation.mutate({ id: result.id, type:"imaging" })}
 >
 <Link className="h-4 w-4" />
 </Button>
 )}
 </div>
 </TableCell>
 </TableRow>
 ))
 ) : (
 <TableRow>
 <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
 <Image className="h-8 w-8 mx-auto mb-2 opacity-50" />
 No imaging results found
 </TableCell>
 </TableRow>
 )}
 </TableBody>
 </Table>
 </Card>
 </TabsContent>
 </Tabs>

 {/* Result Detail Dialog */}
 <Dialog open={!!selectedResult} onOpenChange={() => setSelectedResult(null)}>
 <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 {selectedResult?.type ==="lab" ? (
 <FlaskConical className="h-5 w-5" />
 ) : (
 <Image className="h-5 w-5" />
 )}
 {selectedResult?.type ==="lab" ? selectedResult?.test_name : selectedResult?.study_description}
 </DialogTitle>
 </DialogHeader>

 {selectedResult && (
 <div className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <p className="text-xs text-muted-foreground">Patient</p>
 <p className="font-medium">{selectedResult.pet?.name ||"Unknown"}</p>
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Date</p>
 <p className="font-medium">
 {format(new Date(selectedResult.result_date || selectedResult.study_date),"MMMM d, yyyy")}
 </p>
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Lab Vendor</p>
 <p className="font-medium">{selectedResult.lab_vendor.toUpperCase()}</p>
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Status</p>
 <p className="font-medium capitalize">{selectedResult.status}</p>
 </div>
 </div>

 {selectedResult.type ==="lab" && selectedResult.results && (
 <div>
 <h4 className="font-medium mb-2">Results</h4>
 <Card className="p-4">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Analyte</TableHead>
 <TableHead>Value</TableHead>
 <TableHead>Reference Range</TableHead>
 <TableHead>Flag</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {Array.isArray(selectedResult.results) ? (
 selectedResult.results.map((item: any, index: number) => (
 <TableRow key={index}>
 <TableCell>{item.name || item.analyte}</TableCell>
 <TableCell className="font-mono">{item.value} {item.unit}</TableCell>
 <TableCell className="text-sm text-muted-foreground">
 {item.reference_range ||"-"}
 </TableCell>
 <TableCell>
 {item.flag && (
 <Badge variant={item.flag ==="H" || item.flag ==="L" ?"destructive" :"secondary"}>
 {item.flag}
 </Badge>
 )}
 </TableCell>
 </TableRow>
 ))
 ) : (
 <TableRow>
 <TableCell colSpan={4} className="text-center text-muted-foreground">
 Raw results data available
 </TableCell>
 </TableRow>
 )}
 </TableBody>
 </Table>
 </Card>
 </div>
 )}

 {selectedResult.type ==="imaging" && selectedResult.radiologist_report && (
 <div>
 <h4 className="font-medium mb-2">Radiologist Report</h4>
 <Card className="p-4">
 <p className="text-sm whitespace-pre-wrap">{selectedResult.radiologist_report}</p>
 </Card>
 </div>
 )}

 {selectedResult.notes && (
 <div>
 <h4 className="font-medium mb-2">Notes</h4>
 <Card className="p-4">
 <p className="text-sm">{selectedResult.notes}</p>
 </Card>
 </div>
 )}

 <div className="flex gap-2 pt-4">
 {!selectedResult.is_reviewed && (
 <Button
 onClick={() => {
 markReviewedMutation.mutate({
 id: selectedResult.id,
 type: selectedResult.type,
 });
 setSelectedResult(null);
 }}
 >
 <CheckCircle className="h-4 w-4 mr-2" />
 Mark as Reviewed
 </Button>
 )}
 {!selectedResult.linked_to_emr && (
 <Button
 variant="outline"
 onClick={() => {
 linkToEMRMutation.mutate({
 id: selectedResult.id,
 type: selectedResult.type,
 });
 }}
 >
 <Link className="h-4 w-4 mr-2" />
 Link to EMR
 </Button>
 )}
 </div>
 </div>
 )}
 </DialogContent>
 </Dialog>
 </div>
 );
}
