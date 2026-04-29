import { useState } from"react";
import { Button } from"@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from"@/components/ui/dialog";
import { Upload, Download, FileText } from"lucide-react";
import { toast } from"sonner";
import { supabase } from"@/integrations/supabase/client";
import { ErrorHandler } from"@/utils/errorHandler";

interface ImportResult {
 success: number;
 failed: number;
 errors: string[];
}

export function MerchantOfferImport({ onImportComplete }: { onImportComplete: () => void }) {
 const [dialogOpen, setDialogOpen] = useState(false);
 const [importing, setImporting] = useState(false);
 const [result, setResult] = useState<ImportResult | null>(null);

 const downloadTemplate = () => {
 const template = [
 ["title","description","coins_required","cash_equivalent","start_date","end_date","redemption_cap","per_user_limit"],
 ["$10 Off Grooming","Get $10 off your next grooming service","10000","10","2025-01-01","2025-12-31","500","1"],
 ["Free Toy","Redeem for a free toy with any purchase","5000","5","","","1000","2"]
 ];

 const csv = template.map(row => row.join(",")).join("\n");
 const blob = new Blob([csv], { type:"text/csv" });
 const url = window.URL.createObjectURL(blob);
 const a = document.createElement("a");
 a.href = url;
 a.download ="offer-import-template.csv";
 a.click();
 window.URL.revokeObjectURL(url);
 toast.success("Template downloaded");
 };

 const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;

 if (!file.name.endsWith(".csv")) {
 toast.error("Please upload a CSV file");
 return;
 }

 try {
 setImporting(true);
 const text = await file.text();
 const lines = text.split("\n").filter(line => line.trim());
 
 if (lines.length < 2) {
 throw new Error("CSV file must have at least a header row and one data row");
 }

 const headers = lines[0].split(",").map(h => h.trim());
 const requiredHeaders = ["title","description","coins_required"];
 
 const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
 if (missingHeaders.length > 0) {
 throw new Error(`Missing required columns: ${missingHeaders.join(",")}`);
 }

 const { data: { session } } = await supabase.auth.getSession();
 if (!session) {
 throw new Error("Not authenticated");
 }

 const offers = [];
 const errors: string[] = [];
 let successCount = 0;
 let failedCount = 0;

 for (let i = 1; i < lines.length; i++) {
 const values = lines[i].split(",").map(v => v.trim());
 const row: Record<string, string> = {};
 
 headers.forEach((header, index) => {
 row[header] = values[index] ||"";
 });

 try {
 // Validate required fields
 if (!row.title || !row.description || !row.coins_required) {
 throw new Error("Missing required fields");
 }

 const coinsRequired = parseInt(row.coins_required);
 if (isNaN(coinsRequired) || coinsRequired <= 0) {
 throw new Error("Invalid coins_required value");
 }

 const offerData: any = {
 title: row.title,
 description: row.description,
 coins_required: coinsRequired,
 cash_equivalent: row.cash_equivalent ? parseFloat(row.cash_equivalent) : null,
 start_date: row.start_date || null,
 end_date: row.end_date || null,
 redemption_cap: row.redemption_cap ? parseInt(row.redemption_cap) : null,
 per_user_limit: row.per_user_limit ? parseInt(row.per_user_limit) : 1,
 require_approval: false
 };

 const { error } = await supabase.functions.invoke("merchant-create-offer", {
 body: offerData,
 headers: {
 Authorization: `Bearer ${session.access_token}`
 }
 });

 if (error) throw error;
 
 successCount++;
 } catch (error: any) {
 failedCount++;
 errors.push(`Row ${i}: ${error.message}`);
 }
 }

 setResult({ success: successCount, failed: failedCount, errors });
 
 if (successCount > 0) {
 toast.success(`Imported ${successCount} offers successfully`);
 onImportComplete();
 }
 
 if (failedCount > 0) {
 toast.error(`Failed to import ${failedCount} offers`);
 }
 } catch (error) {
 ErrorHandler.handle(error);
 } finally {
 setImporting(false);
 }
 };

 return (
 <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
 <DialogTrigger asChild>
 <Button variant="outline">
 <Upload className="mr-2 h-4 w-4" />
 Import CSV
 </Button>
 </DialogTrigger>
 <DialogContent className="max-w-2xl">
 <DialogHeader>
 <DialogTitle>Import Offers from CSV</DialogTitle>
 <DialogDescription>
 Upload a CSV file to create multiple offers at once
 </DialogDescription>
 </DialogHeader>
 
 <div className="space-y-4 py-4">
 <Card>
 <CardHeader>
 <CardTitle className="text-base">Template</CardTitle>
 <CardDescription>
 Download the template to see the required format
 </CardDescription>
 </CardHeader>
 <CardContent>
 <Button variant="outline" onClick={downloadTemplate}>
 <Download className="mr-2 h-4 w-4" />
 Download Template
 </Button>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="text-base">Upload CSV</CardTitle>
 <CardDescription>
 Select your CSV file to import offers
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div className="border-2 border-dashed rounded-lg p-8 text-center">
 <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
 <label htmlFor="csv-upload" className="cursor-pointer">
 <input
 id="csv-upload"
 type="file"
 accept=".csv"
 className="hidden"
 onChange={handleFileUpload}
 disabled={importing}
 />
 <Button variant="outline" asChild>
 <span>
 {importing ?"Importing..." :"Select CSV File"}
 </span>
 </Button>
 </label>
 <p className="text-sm text-muted-foreground mt-2">
 CSV files only
 </p>
 </div>
 </CardContent>
 </Card>

 {result && (
 <Card>
 <CardHeader>
 <CardTitle className="text-base">Import Results</CardTitle>
 </CardHeader>
 <CardContent className="space-y-2">
 <p className="text-sm">
 <span className="font-semibold text-success">Success:</span> {result.success} offers
 </p>
 {result.failed > 0 && (
 <>
 <p className="text-sm">
 <span className="font-semibold text-destructive">Failed:</span> {result.failed} offers
 </p>
 {result.errors.length > 0 && (
 <div className="mt-4">
 <p className="text-sm font-semibold mb-2">Errors:</p>
 <div className="max-h-40 overflow-y-auto space-y-1">
 {result.errors.map((error, index) => (
 <p key={index} className="text-xs text-destructive">{error}</p>
 ))}
 </div>
 </div>
 )}
 </>
 )}
 </CardContent>
 </Card>
 )}
 </div>

 <DialogFooter>
 <Button variant="outline" onClick={() => {
 setDialogOpen(false);
 setResult(null);
 }}>
 Close
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}
