import { useState, useRef, useCallback } from'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from'@/components/ui/dialog';
import { Button } from'@/components/ui/button';
import { Card, CardContent } from'@/components/ui/card';
import { Camera, Upload, Loader2, CheckCircle2, AlertCircle, Sparkles, RotateCcw } from'lucide-react';
import { toast } from'sonner';
import { supabase } from'@/integrations/supabase/client';
import { TaxExpenseCategory } from'./types';

interface ExtractedReceiptData {
 vendor_name: string | null;
 amount: number | null;
 date: string | null;
 description: string | null;
 suggested_category: TaxExpenseCategory;
 confidence:'high' |'medium' |'low';
}

interface SmartReceiptScannerProps {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 onDataExtracted: (data: ExtractedReceiptData, imageFile: File) => void;
}

export function SmartReceiptScanner({ open, onOpenChange, onDataExtracted }: SmartReceiptScannerProps) {
 const [isProcessing, setIsProcessing] = useState(false);
 const [previewUrl, setPreviewUrl] = useState<string | null>(null);
 const [extractedData, setExtractedData] = useState<ExtractedReceiptData | null>(null);
 const [currentFile, setCurrentFile] = useState<File | null>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);
 const cameraInputRef = useRef<HTMLInputElement>(null);

 const resetState = useCallback(() => {
 setPreviewUrl(null);
 setExtractedData(null);
 setCurrentFile(null);
 setIsProcessing(false);
 }, []);

 const handleClose = useCallback(() => {
 resetState();
 onOpenChange(false);
 }, [onOpenChange, resetState]);

 const fileToBase64 = (file: File): Promise<string> => {
 return new Promise((resolve, reject) => {
 const reader = new FileReader();
 reader.readAsDataURL(file);
 reader.onload = () => {
 const result = reader.result as string;
 // Remove the data:image/...;base64, prefix
 const base64 = result.split(',')[1];
 resolve(base64);
 };
 reader.onerror = reject;
 });
 };

 const processReceipt = async (file: File) => {
 setIsProcessing(true);
 setCurrentFile(file);

 // Create preview URL
 const url = URL.createObjectURL(file);
 setPreviewUrl(url);

 try {
 // Convert file to base64
 const base64 = await fileToBase64(file);

 // Call the OCR edge function
 const { data, error } = await supabase.functions.invoke('process-receipt-ocr', {
 body: { imageBase64: base64 }
 });

 if (error) throw error;

 if (data?.success && data?.data) {
 setExtractedData(data.data);
 
 const confidence = data.data.confidence;
 if (confidence ==='high') {
 toast.success('Receipt scanned successfully!');
 } else if (confidence ==='medium') {
 toast.success('Receipt scanned - please verify the details');
 } else {
 toast.warning('Low confidence scan - please review and correct');
 }
 } else {
 throw new Error(data?.error ||'Failed to extract data');
 }
 } catch (error) {
 console.error('Error processing receipt:', error);
 toast.error('Failed to scan receipt. Please try again or enter manually.');
 setExtractedData(null);
 } finally {
 setIsProcessing(false);
 }
 };

 const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
 const file = event.target.files?.[0];
 if (file) {
 if (file.size > 10 * 1024 * 1024) {
 toast.error('File too large. Please use an image under 10MB.');
 return;
 }
 processReceipt(file);
 }
 // Reset the input so the same file can be selected again
 event.target.value ='';
 };

 const handleConfirm = () => {
 if (extractedData && currentFile) {
 onDataExtracted(extractedData, currentFile);
 handleClose();
 }
 };

 const confidenceColors = {
 high:'text-success bg-success/10 border-success/30',
 medium:'text-warning bg-warning/10 border-warning/30',
 low:'text-destructive bg-destructive/5 border-destructive/30'
 };

 const confidenceLabels = {
 high:'High Confidence',
 medium:'Medium Confidence',
 low:'Low Confidence'
 };

 return (
 <Dialog open={open} onOpenChange={handleClose}>
 <DialogContent className="sm:max-w-[500px]">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Sparkles className="h-5 w-5 text-primary" />
 Smart Receipt Scanner
 </DialogTitle>
 <DialogDescription>
 Snap a photo or upload a receipt image. Our AI will automatically extract the details.
 </DialogDescription>
 </DialogHeader>

 <div className="space-y-4">
 {/* Hidden file inputs */}
 <input
 ref={fileInputRef}
 type="file"
 accept="image/*"
 onChange={handleFileSelect}
 className="hidden"
 />
 <input
 ref={cameraInputRef}
 type="file"
 accept="image/*"
 capture="environment"
 onChange={handleFileSelect}
 className="hidden"
 />

 {!previewUrl && !isProcessing && (
 <div className="grid grid-cols-2 gap-4">
 <Card 
 className="cursor-pointer hover:border-primary/50 transition-colors"
 onClick={() => cameraInputRef.current?.click()}
 >
 <CardContent className="flex flex-col items-center justify-center p-6 text-center">
 <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
 <Camera className="h-6 w-6 text-primary" />
 </div>
 <p className="font-medium">Take Photo</p>
 <p className="text-xs text-muted-foreground mt-1">Use your camera</p>
 </CardContent>
 </Card>

 <Card 
 className="cursor-pointer hover:border-primary/50 transition-colors"
 onClick={() => fileInputRef.current?.click()}
 >
 <CardContent className="flex flex-col items-center justify-center p-6 text-center">
 <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
 <Upload className="h-6 w-6 text-primary" />
 </div>
 <p className="font-medium">Upload Image</p>
 <p className="text-xs text-muted-foreground mt-1">Select from files</p>
 </CardContent>
 </Card>
 </div>
 )}

 {isProcessing && (
 <div className="flex flex-col items-center justify-center py-12">
 <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
 <p className="font-medium">Scanning receipt...</p>
 <p className="text-sm text-muted-foreground">AI is extracting the details</p>
 </div>
 )}

 {previewUrl && !isProcessing && (
 <div className="space-y-4">
 {/* Image preview */}
 <div className="relative rounded-lg overflow-hidden border bg-muted">
 <img 
 src={previewUrl} 
 alt="Receipt preview" 
 className="w-full max-h-48 object-contain"
 />
 </div>

 {/* Extracted data display */}
 {extractedData && (
 <Card className={`border-2 ${confidenceColors[extractedData.confidence]}`}>
 <CardContent className="p-4 space-y-3">
 <div className="flex items-center justify-between">
 <span className="text-xs font-medium uppercase tracking-wide">
 Extracted Data
 </span>
 <span className={`text-xs px-2 py-0.5 rounded-full ${confidenceColors[extractedData.confidence]}`}>
 {extractedData.confidence ==='high' && <CheckCircle2 className="h-3 w-3 inline mr-1" />}
 {extractedData.confidence ==='low' && <AlertCircle className="h-3 w-3 inline mr-1" />}
 {confidenceLabels[extractedData.confidence]}
 </span>
 </div>

 <div className="grid grid-cols-2 gap-3 text-sm">
 <div>
 <p className="text-muted-foreground text-xs">Vendor</p>
 <p className="font-medium truncate">
 {extractedData.vendor_name || <span className="text-muted-foreground italic">Not detected</span>}
 </p>
 </div>
 <div>
 <p className="text-muted-foreground text-xs">Amount</p>
 <p className="font-medium">
 {extractedData.amount !== null 
 ? `$${extractedData.amount.toFixed(2)}` 
 : <span className="text-muted-foreground italic">Not detected</span>}
 </p>
 </div>
 <div>
 <p className="text-muted-foreground text-xs">Date</p>
 <p className="font-medium">
 {extractedData.date || <span className="text-muted-foreground italic">Not detected</span>}
 </p>
 </div>
 <div>
 <p className="text-muted-foreground text-xs">Category</p>
 <p className="font-medium capitalize">
 {extractedData.suggested_category.replace(/_/g,'')}
 </p>
 </div>
 </div>

 {extractedData.description && (
 <div>
 <p className="text-muted-foreground text-xs">Items</p>
 <p className="text-sm">{extractedData.description}</p>
 </div>
 )}
 </CardContent>
 </Card>
 )}

 {/* Action buttons */}
 <div className="flex gap-2">
 <Button variant="outline" onClick={resetState} className="flex-1">
 <RotateCcw className="h-4 w-4 mr-2" />
 Rescan
 </Button>
 <Button 
 onClick={handleConfirm} 
 className="flex-1"
 disabled={!extractedData}
 >
 <CheckCircle2 className="h-4 w-4 mr-2" />
 Use This Data
 </Button>
 </div>
 </div>
 )}

 {/* Tips */}
 {!previewUrl && !isProcessing && (
 <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
 <p className="font-medium">Tips for best results:</p>
 <ul className="list-disc list-inside space-y-0.5">
 <li>Ensure good lighting and clear focus</li>
 <li>Capture the entire receipt including the total</li>
 <li>Avoid shadows and glare on the receipt</li>
 </ul>
 </div>
 )}
 </div>
 </DialogContent>
 </Dialog>
 );
}
