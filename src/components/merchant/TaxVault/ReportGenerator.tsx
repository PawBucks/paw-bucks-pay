import { useState } from'react';
import { Button } from'@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from'@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from'@/components/ui/select';
import { FileText, Download, FileSpreadsheet, Upload } from'lucide-react';
import { TaxExpense, CATEGORY_LABELS, SCHEDULE_C_MAPPING, TaxExpenseCategory } from'./types';
import { format } from'date-fns';
import { parseLocalDate } from'@/utils/formatters';
import jsPDF from'jspdf';
import { toast } from'sonner';

interface ReportGeneratorProps {
 expenses: TaxExpense[];
 businessName: string;
 taxYear: number;
}

export function ReportGenerator({ expenses, businessName, taxYear }: ReportGeneratorProps) {
 const [exportFormat, setExportFormat] = useState<'pdf' |'csv' |'quickbooks'>('pdf');

 const categoryTotals = expenses.reduce((acc, expense) => {
 acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
 return acc;
 }, {} as Record<TaxExpenseCategory, number>);

 const totalExpenses = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);

 const generatePDF = () => {
 const doc = new jsPDF();
 const pageWidth = doc.internal.pageSize.getWidth();
 
 // Header
 doc.setFontSize(20);
 doc.setFont('helvetica','bold');
 doc.text('Tax Vault Report', pageWidth / 2, 20, { align:'center' });
 
 doc.setFontSize(12);
 doc.setFont('helvetica','normal');
 doc.text(`${businessName}`, pageWidth / 2, 28, { align:'center' });
 doc.text(`Tax Year: ${taxYear}`, pageWidth / 2, 35, { align:'center' });
 doc.text(`Generated: ${format(new Date(),'MMMM d, yyyy')}`, pageWidth / 2, 42, { align:'center' });
 
 // Schedule C Summary
 doc.setFontSize(14);
 doc.setFont('helvetica','bold');
 doc.text('Schedule C Summary', 20, 58);
 
 let yPos = 68;
 doc.setFontSize(10);
 doc.setFont('helvetica','normal');
 
 // Group by Schedule C line
 const lineGroups: Record<string, { categories: string[]; total: number }> = {};
 
 Object.entries(categoryTotals).forEach(([category, amount]) => {
 const scheduleC = SCHEDULE_C_MAPPING[category as TaxExpenseCategory];
 if (!lineGroups[scheduleC.line]) {
 lineGroups[scheduleC.line] = { categories: [], total: 0 };
 }
 lineGroups[scheduleC.line].categories.push(CATEGORY_LABELS[category as TaxExpenseCategory]);
 lineGroups[scheduleC.line].total += amount;
 });
 
 Object.entries(lineGroups)
 .sort(([a], [b]) => a.localeCompare(b))
 .forEach(([line, data]) => {
 const scheduleDesc = Object.entries(SCHEDULE_C_MAPPING).find(([, v]) => v.line === line)?.[1].description ||'';
 doc.setFont('helvetica','bold');
 doc.text(`${line} - ${scheduleDesc}`, 20, yPos);
 doc.text(`$${data.total.toFixed(2)}`, pageWidth - 20, yPos, { align:'right' });
 yPos += 6;
 
 doc.setFont('helvetica','normal');
 doc.setFontSize(9);
 doc.text(` Categories: ${data.categories.join(',')}`, 20, yPos);
 yPos += 10;
 doc.setFontSize(10);
 });
 
 // Total
 yPos += 5;
 doc.setLineWidth(0.5);
 doc.line(20, yPos, pageWidth - 20, yPos);
 yPos += 8;
 doc.setFontSize(12);
 doc.setFont('helvetica','bold');
 doc.text('Total Deductions:', 20, yPos);
 doc.text(`$${totalExpenses.toFixed(2)}`, pageWidth - 20, yPos, { align:'right' });
 
 // Detailed Expenses Section
 yPos += 20;
 if (yPos > 250) {
 doc.addPage();
 yPos = 20;
 }
 
 doc.setFontSize(14);
 doc.text('Detailed Expense Log', 20, yPos);
 yPos += 10;
 
 // Table headers
 doc.setFontSize(9);
 doc.setFont('helvetica','bold');
 doc.text('Date', 20, yPos);
 doc.text('Category', 45, yPos);
 doc.text('Vendor', 100, yPos);
 doc.text('Amount', pageWidth - 20, yPos, { align:'right' });
 yPos += 6;
 doc.line(20, yPos, pageWidth - 20, yPos);
 yPos += 4;
 
 doc.setFont('helvetica','normal');
 expenses.forEach((expense) => {
 if (yPos > 280) {
 doc.addPage();
 yPos = 20;
 }
 
 doc.text(format(parseLocalDate(expense.expense_date),'MM/dd/yy'), 20, yPos);
 doc.text(CATEGORY_LABELS[expense.category].substring(0, 20), 45, yPos);
 doc.text((expense.vendor_name ||'-').substring(0, 25), 100, yPos);
 doc.text(`$${expense.amount.toFixed(2)}`, pageWidth - 20, yPos, { align:'right' });
 yPos += 5;
 });
 
 doc.save(`TaxVault_${businessName.replace(/\s+/g,'_')}_${taxYear}.pdf`);
 toast.success('PDF report downloaded');
 };

 const generateCSV = () => {
 const headers = ['Date','Category','Schedule C Line','Vendor','Description','Amount'];
 const rows = expenses.map((expense) => [
 format(parseLocalDate(expense.expense_date),'yyyy-MM-dd'),
 CATEGORY_LABELS[expense.category],
 SCHEDULE_C_MAPPING[expense.category].line,
 expense.vendor_name ||'',
 expense.description ||'',
 expense.amount.toFixed(2),
 ]);
 
 const csvContent = [
 headers.join(','),
 ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
 ].join('\n');
 
 const blob = new Blob([csvContent], { type:'text/csv;charset=utf-8;' });
 const link = document.createElement('a');
 link.href = URL.createObjectURL(blob);
 link.download = `TaxVault_${businessName.replace(/\s+/g,'_')}_${taxYear}.csv`;
 link.click();
 
 toast.success('CSV file downloaded');
 };

 const generateQuickBooksIIF = () => {
 // Generate QuickBooks IIF format
 const lines = [
'!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO',
'!SPL\tSPLTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO',
'!ENDTRNS',
 ];
 
 expenses.forEach((expense) => {
 const date = format(parseLocalDate(expense.expense_date),'MM/dd/yyyy');
 const account = SCHEDULE_C_MAPPING[expense.category].description;
 
 lines.push(`TRNS\tCHECK\t${date}\tChecking\t${expense.vendor_name ||'Unknown'}\t-${expense.amount.toFixed(2)}\t${expense.description || CATEGORY_LABELS[expense.category]}`);
 lines.push(`SPL\tCHECK\t${date}\t${account}\t\t${expense.amount.toFixed(2)}\t`);
 lines.push('ENDTRNS');
 });
 
 const iifContent = lines.join('\n');
 const blob = new Blob([iifContent], { type:'text/plain;charset=utf-8;' });
 const link = document.createElement('a');
 link.href = URL.createObjectURL(blob);
 link.download = `TaxVault_${businessName.replace(/\s+/g,'_')}_${taxYear}.iif`;
 link.click();
 
 toast.success('QuickBooks IIF file downloaded');
 };

 const handleExport = () => {
 if (expenses.length === 0) {
 toast.error('No expenses to export');
 return;
 }

 switch (exportFormat) {
 case'pdf':
 generatePDF();
 break;
 case'csv':
 generateCSV();
 break;
 case'quickbooks':
 generateQuickBooksIIF();
 break;
 }
 };

 return (
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <FileText className="h-5 w-5" />
 Generate Tax Report
 </CardTitle>
 <CardDescription>
 Export your expenses in Schedule C-ready formats for tax filing
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div className="flex flex-col sm:flex-row gap-4">
 <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as typeof exportFormat)}>
 <SelectTrigger className="w-full sm:w-[250px]">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="pdf">
 <div className="flex items-center gap-2">
 <FileText className="h-4 w-4" />
 PDF Report (Schedule C Ready)
 </div>
 </SelectItem>
 <SelectItem value="csv">
 <div className="flex items-center gap-2">
 <FileSpreadsheet className="h-4 w-4" />
 CSV Spreadsheet
 </div>
 </SelectItem>
 <SelectItem value="quickbooks">
 <div className="flex items-center gap-2">
 <Upload className="h-4 w-4" />
 QuickBooks IIF Import
 </div>
 </SelectItem>
 </SelectContent>
 </Select>
 
 <Button onClick={handleExport} disabled={expenses.length === 0}>
 <Download className="mr-2 h-4 w-4" />
 Download Report
 </Button>
 </div>
 
 <div className="mt-4 p-4 bg-muted rounded-lg">
 <p className="text-sm text-muted-foreground">
 <strong>Report Summary:</strong> {expenses.length} expenses totaling ${totalExpenses.toFixed(2)} for tax year {taxYear}
 </p>
 </div>
 </CardContent>
 </Card>
 );
}
