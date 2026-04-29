import { useState } from'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from'@/components/ui/dialog';
import { Button } from'@/components/ui/button';
import { Input } from'@/components/ui/input';
import { Label } from'@/components/ui/label';
import { Textarea } from'@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from'@/components/ui/select';
import { Calendar } from'@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from'@/components/ui/popover';
import { CalendarIcon, Upload, Loader2, Info, Camera, Sparkles } from'lucide-react';
import { format, parse } from'date-fns';
import { cn } from'@/lib/utils';
import { TaxExpenseCategory, CATEGORY_LABELS, CATEGORY_DESCRIPTIONS, CATEGORY_PRIORITY } from'./types';
import { supabase } from'@/integrations/supabase/client';
import { toast } from'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from'@/components/ui/tooltip';
import { SmartReceiptScanner } from'./SmartReceiptScanner';

interface ExpenseEntryDialogProps {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 merchantId: string;
 onExpenseAdded: () => void;
}

export function ExpenseEntryDialog({ open, onOpenChange, merchantId, onExpenseAdded }: ExpenseEntryDialogProps) {
 const [category, setCategory] = useState<TaxExpenseCategory>('other');
 const [amount, setAmount] = useState('');
 const [description, setDescription] = useState('');
 const [vendorName, setVendorName] = useState('');
 const [date, setDate] = useState<Date>(new Date());
 const [receiptFile, setReceiptFile] = useState<File | null>(null);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [showScanner, setShowScanner] = useState(false);

 const handleScanComplete = (data: {
 vendor_name: string | null;
 amount: number | null;
 date: string | null;
 description: string | null;
 suggested_category: TaxExpenseCategory;
 }, imageFile: File) => {
 // Auto-fill form with extracted data
 if (data.vendor_name) setVendorName(data.vendor_name);
 if (data.amount !== null) setAmount(data.amount.toString());
 if (data.date) {
 try {
 const parsedDate = parse(data.date,'yyyy-MM-dd', new Date());
 if (!isNaN(parsedDate.getTime())) {
 setDate(parsedDate);
 }
 } catch {
 // Keep current date if parsing fails
 }
 }
 if (data.description) setDescription(data.description);
 if (data.suggested_category) setCategory(data.suggested_category);
 
 // Set the receipt file
 setReceiptFile(imageFile);
 
 toast.success('Receipt data loaded! Review and submit when ready.');
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 
 if (!amount || parseFloat(amount) <= 0) {
 toast.error('Please enter a valid amount');
 return;
 }

 setIsSubmitting(true);

 try {
 let receiptUrl = null;

 // Upload receipt if provided
 if (receiptFile) {
 const fileExt = receiptFile.name.split('.').pop();
 const fileName = `${merchantId}/${Date.now()}.${fileExt}`;
 
 const { error: uploadError } = await supabase.storage
 .from('receipts')
 .upload(fileName, receiptFile);

 if (uploadError) throw uploadError;

 receiptUrl = fileName;
 }

 const { error } = await supabase
 .from('merchant_tax_expenses')
 .insert({
 merchant_id: merchantId,
 category,
 amount: parseFloat(amount),
 description: description || null,
 vendor_name: vendorName || null,
 expense_date: format(date,'yyyy-MM-dd'),
 receipt_url: receiptUrl,
 tax_year: date.getFullYear(),
 });

 if (error) throw error;

 toast.success('Expense added successfully');
 onExpenseAdded();
 onOpenChange(false);
 
 // Reset form
 setCategory('other');
 setAmount('');
 setDescription('');
 setVendorName('');
 setDate(new Date());
 setReceiptFile(null);
 } catch (error) {
 console.error('Error adding expense:', error);
 toast.error('Failed to add expense');
 } finally {
 setIsSubmitting(false);
 }
 };

 // Sort categories by priority, exclude merchant_market (auto-logged only)
 const sortedCategories = CATEGORY_PRIORITY
 .filter(cat => cat !=='merchant_market')
 .map(cat => ({ key: cat, label: CATEGORY_LABELS[cat] }));

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="sm:max-w-[500px]">
 <DialogHeader>
 <DialogTitle>Add Business Expense</DialogTitle>
 <DialogDescription>
 Record a tax-deductible business expense. Categories are mapped to IRS Schedule C.
 </DialogDescription>
 </DialogHeader>

 {/* Smart Receipt Scanner Button */}
 <Button
 type="button"
 variant="outline"
 className="w-full border-dashed border-2 py-6 mb-2"
 onClick={() => setShowScanner(true)}
 >
 <div className="flex items-center gap-3">
 <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
 <Camera className="h-5 w-5 text-primary" />
 </div>
 <div className="text-left">
 <p className="font-medium flex items-center gap-1.5">
 <Sparkles className="h-4 w-4 text-primary" />
 Smart Receipt Scanner
 </p>
 <p className="text-xs text-muted-foreground">Snap a photo to auto-fill expense details</p>
 </div>
 </div>
 </Button>

 <div className="relative">
 <div className="absolute inset-0 flex items-center">
 <span className="w-full border-t" />
 </div>
 <div className="relative flex justify-center text-xs uppercase">
 <span className="bg-background px-2 text-muted-foreground">or enter manually</span>
 </div>
 </div>
 
 <form onSubmit={handleSubmit} className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <div className="flex items-center gap-1.5">
 <Label htmlFor="category">Category</Label>
 <TooltipProvider>
 <Tooltip>
 <TooltipTrigger type="button">
 <Info className="h-3.5 w-3.5 text-muted-foreground" />
 </TooltipTrigger>
 <TooltipContent className="max-w-[250px]">
 <p className="text-xs">{CATEGORY_DESCRIPTIONS[category]}</p>
 </TooltipContent>
 </Tooltip>
 </TooltipProvider>
 </div>
 <Select value={category} onValueChange={(v) => setCategory(v as TaxExpenseCategory)}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {sortedCategories.map(({ key, label }) => (
 <SelectItem key={key} value={key}>
 {label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 
 <div className="space-y-2">
 <Label htmlFor="amount">Amount ($)</Label>
 <Input
 id="amount"
 type="number"
 step="0.01"
 min="0.01"
 placeholder="0.00"
 value={amount}
 onChange={(e) => setAmount(e.target.value)}
 required
 />
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>Date</Label>
 <Popover>
 <PopoverTrigger asChild>
 <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
 <CalendarIcon className="mr-2 h-4 w-4" />
 {format(date,'PPP')}
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-auto p-0" align="start">
 <Calendar
 mode="single"
 selected={date}
 onSelect={(d) => d && setDate(d)}
 initialFocus
 className="pointer-events-auto"
 />
 </PopoverContent>
 </Popover>
 </div>
 
 <div className="space-y-2">
 <Label htmlFor="vendor">Vendor Name</Label>
 <Input
 id="vendor"
 placeholder="e.g., PetSmart"
 value={vendorName}
 onChange={(e) => setVendorName(e.target.value)}
 />
 </div>
 </div>

 <div className="space-y-2">
 <Label htmlFor="description">Description</Label>
 <Textarea
 id="description"
 placeholder="Brief description of the expense..."
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 rows={2}
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="receipt">Receipt (Optional)</Label>
 <div className="flex items-center gap-2">
 <Input
 id="receipt"
 type="file"
 accept="image/*,.pdf"
 onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
 className="flex-1"
 />
 {receiptFile && (
 <Button type="button" variant="ghost" size="sm" onClick={() => setReceiptFile(null)}>
 Clear
 </Button>
 )}
 </div>
 </div>

 <div className="flex justify-end gap-2 pt-4">
 <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
 Cancel
 </Button>
 <Button type="submit" disabled={isSubmitting}>
 {isSubmitting ? (
 <>
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 Adding...
 </>
 ) : (
 <>
 <Upload className="mr-2 h-4 w-4" />
 Add Expense
 </>
 )}
 </Button>
 </div>
 </form>
 </DialogContent>

 {/* Smart Receipt Scanner Dialog */}
 <SmartReceiptScanner
 open={showScanner}
 onOpenChange={setShowScanner}
 onDataExtracted={handleScanComplete}
 />
 </Dialog>
 );
}
