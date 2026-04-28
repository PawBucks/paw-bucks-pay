import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { parseLocalDate } from '@/utils/formatters';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Download, 
  FileText, 
  FileSpreadsheet, 
  Package, 
  DollarSign,
  Car,
  Receipt,
  Home,
  Briefcase,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import { TaxExpense, CATEGORY_LABELS, SCHEDULE_C_MAPPING, TaxExpenseCategory } from './types';

interface YearEndExportsProps {
  merchantId: string;
  businessName: string;
  taxYear: number;
  expenses: TaxExpense[];
}

// Fallback IRS rates if database fetch fails (updated annually)
const FALLBACK_IRS_RATES: Record<number, number> = {
  2024: 0.67,
  2025: 0.70,
  2026: 0.725,
};

export function YearEndExports({ merchantId, businessName, taxYear, expenses }: YearEndExportsProps) {
  const [notes, setNotes] = useState('');
  const [isExporting, setIsExporting] = useState<string | null>(null);

  // Fetch IRS mileage rate for the selected tax year
  const { data: irsRateData } = useQuery({
    queryKey: ['irs-mileage-rate', taxYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('irs_mileage_rates')
        .select('rate_per_mile, notes, source_url')
        .eq('tax_year', taxYear)
        .single();

      if (error) {
        console.warn(`No IRS rate found for ${taxYear}, using fallback`);
        return null;
      }
      return data;
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  // Use database rate or fallback
  const IRS_MILEAGE_RATE = irsRateData?.rate_per_mile 
    ? Number(irsRateData.rate_per_mile) 
    : (FALLBACK_IRS_RATES[taxYear] || FALLBACK_IRS_RATES[2026]);

  // Fetch mileage data
  const { data: mileageEntries = [] } = useQuery({
    queryKey: ['mileage-log', merchantId, taxYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('merchant_mileage_log')
        .select('*')
        .eq('merchant_id', merchantId)
        .eq('tax_year', taxYear)
        .order('trip_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!merchantId,
  });

  // Fetch earnings data
  const { data: earningsData } = useQuery({
    queryKey: ['merchant-dashboard', merchantId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('merchant-dashboard');
      if (error) throw error;
      return data;
    },
    enabled: !!merchantId,
  });

  // Calculate totals
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const businessMiles = mileageEntries
    .filter((m: any) => m.trip_type === 'pet_commute')
    .reduce((sum, m: any) => sum + Number(m.miles || 0), 0);
  const mileageDeduction = businessMiles * IRS_MILEAGE_RATE;
  const grossIncome = earningsData?.total_sales || 0;
  const netProfit = Math.max(0, grossIncome - totalExpenses - mileageDeduction);

  // Category totals
  const categoryTotals = expenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {} as Record<TaxExpenseCategory, number>);

  // Export all expenses as CSV
  const exportExpensesCSV = () => {
    setIsExporting('expenses');
    try {
      const headers = ['Date', 'Category', 'Schedule C Line', 'Vendor', 'Description', 'Amount', 'Receipt'];
      const rows = expenses.map((expense) => [
        format(parseLocalDate(expense.expense_date), 'yyyy-MM-dd'),
        CATEGORY_LABELS[expense.category],
        SCHEDULE_C_MAPPING[expense.category].line,
        expense.vendor_name || '',
        expense.description || '',
        expense.amount.toFixed(2),
        expense.receipt_url ? 'Yes' : 'No',
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');

      downloadFile(csvContent, `${businessName.replace(/\s+/g, '_')}_Expenses_${taxYear}.csv`, 'text/csv');
      toast.success('Expenses CSV downloaded');
    } finally {
      setIsExporting(null);
    }
  };

  // Export income summary CSV
  const exportIncomeCSV = () => {
    setIsExporting('income');
    try {
      const headers = ['Category', 'Amount'];
      const rows = [
        ['Gross Income (Platform Sales)', grossIncome.toFixed(2)],
        ['Total Expenses', (-totalExpenses).toFixed(2)],
        ['Vehicle/Mileage Deduction', (-mileageDeduction).toFixed(2)],
        ['Net Profit', netProfit.toFixed(2)],
      ];

      const csvContent = [
        `Income Summary - ${businessName} - Tax Year ${taxYear}`,
        '',
        headers.join(','),
        ...rows.map(row => row.join(',')),
        '',
        'Expenses by Category:',
        ...Object.entries(categoryTotals).map(([cat, amt]) => 
          `${CATEGORY_LABELS[cat as TaxExpenseCategory]},${amt.toFixed(2)}`
        ),
      ].join('\n');

      downloadFile(csvContent, `${businessName.replace(/\s+/g, '_')}_Income_Summary_${taxYear}.csv`, 'text/csv');
      toast.success('Income summary downloaded');
    } finally {
      setIsExporting(null);
    }
  };

  // Export mileage log CSV
  const exportMileageCSV = () => {
    setIsExporting('mileage');
    try {
      const headers = ['Date', 'Trip Type', 'Miles', 'Destination', 'Description', 'Vehicle'];
      const rows = mileageEntries.map((entry: any) => [
        format(parseLocalDate(entry.trip_date), 'yyyy-MM-dd'),
        entry.trip_type === 'pet_commute' ? 'Business' : 'Personal',
        entry.miles,
        entry.destination || '',
        entry.description || '',
        entry.vehicle_name || '',
      ]);

      const csvContent = [
        `Mileage Log - ${businessName} - Tax Year ${taxYear}`,
        '',
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
        '',
        `Total Business Miles: ${businessMiles}`,
        `IRS Rate: $${IRS_MILEAGE_RATE}/mile`,
        `Total Deduction: $${mileageDeduction.toFixed(2)}`,
      ].join('\n');

      downloadFile(csvContent, `${businessName.replace(/\s+/g, '_')}_Mileage_${taxYear}.csv`, 'text/csv');
      toast.success('Mileage log downloaded');
    } finally {
      setIsExporting(null);
    }
  };

  // Export Excel-compatible bundle (all in one)
  const exportExcelBundle = () => {
    setIsExporting('excel');
    try {
      // Create a multi-sheet CSV (Excel can open)
      const sections = [
        '=== INCOME SUMMARY ===',
        `Gross Income,$${grossIncome.toFixed(2)}`,
        `Total Expenses,$${totalExpenses.toFixed(2)}`,
        `Mileage Deduction,$${mileageDeduction.toFixed(2)}`,
        `Net Profit,$${netProfit.toFixed(2)}`,
        '',
        '=== EXPENSES BY CATEGORY ===',
        'Category,Schedule C Line,Amount',
        ...Object.entries(categoryTotals).map(([cat, amt]) => 
          `${CATEGORY_LABELS[cat as TaxExpenseCategory]},${SCHEDULE_C_MAPPING[cat as TaxExpenseCategory].line},$${amt.toFixed(2)}`
        ),
        '',
        '=== DETAILED EXPENSES ===',
        'Date,Category,Vendor,Description,Amount',
        ...expenses.map(e => 
          `${format(new Date(e.expense_date), 'yyyy-MM-dd')},${CATEGORY_LABELS[e.category]},"${e.vendor_name || ''}","${e.description || ''}",$${e.amount.toFixed(2)}`
        ),
        '',
        '=== MILEAGE LOG ===',
        'Date,Type,Miles,Destination,Description',
        ...mileageEntries.map((m: any) => 
          `${format(new Date(m.trip_date), 'yyyy-MM-dd')},${m.trip_type === 'pet_commute' ? 'Business' : 'Personal'},${m.miles},"${m.destination || ''}","${m.description || ''}"`
        ),
        '',
        `Business Miles Total: ${businessMiles}`,
        `Mileage Deduction: $${mileageDeduction.toFixed(2)}`,
      ];

      downloadFile(sections.join('\n'), `${businessName.replace(/\s+/g, '_')}_TaxBundle_${taxYear}.csv`, 'text/csv');
      toast.success('Excel bundle downloaded');
    } finally {
      setIsExporting(null);
    }
  };

  // Generate branded PDF Tax Summary
  const generateTaxSummaryPDF = () => {
    setIsExporting('pdf');
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Header with branding
      doc.setFillColor(125, 212, 212);
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      doc.text('PAWBUCKS', pageWidth / 2, 20, { align: 'center' });
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text('Year-End Tax Summary', pageWidth / 2, 32, { align: 'center' });

      // Business info
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(businessName, 20, 55);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Tax Year: ${taxYear}`, 20, 63);
      doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy')}`, 20, 70);

      // YTD Revenue Section
      let yPos = 90;
      doc.setFillColor(240, 240, 240);
      doc.rect(15, yPos - 6, pageWidth - 30, 30, 'F');
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Year-to-Date Revenue', 20, yPos);
      yPos += 10;
      
      doc.setFontSize(24);
      doc.setTextColor(34, 139, 34);
      doc.text(`$${grossIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 20, yPos + 8);
      
      // Deductions by Category
      yPos += 40;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Deductions by Category', 20, yPos);
      yPos += 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      Object.entries(categoryTotals)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .forEach(([cat, amt]) => {
          const scheduleC = SCHEDULE_C_MAPPING[cat as TaxExpenseCategory];
          doc.text(CATEGORY_LABELS[cat as TaxExpenseCategory], 25, yPos);
          doc.text(`(${scheduleC.line})`, 110, yPos);
          doc.text(`$${(amt as number).toFixed(2)}`, pageWidth - 25, yPos, { align: 'right' });
          yPos += 7;
        });

      // Mileage deduction
      if (mileageDeduction > 0) {
        doc.text('Vehicle/Mileage', 25, yPos);
        doc.text('(Line 9)', 110, yPos);
        doc.text(`$${mileageDeduction.toFixed(2)}`, pageWidth - 25, yPos, { align: 'right' });
        yPos += 7;
      }

      // Total line
      yPos += 5;
      doc.setLineWidth(0.5);
      doc.line(20, yPos, pageWidth - 20, yPos);
      yPos += 8;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Total Deductions:', 25, yPos);
      doc.text(`$${(totalExpenses + mileageDeduction).toFixed(2)}`, pageWidth - 25, yPos, { align: 'right' });

      // Net Profit Box
      yPos += 20;
      doc.setFillColor(34, 139, 34);
      doc.rect(15, yPos - 6, pageWidth - 30, 25, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.text('Net Profit (Schedule C Line 31)', 20, yPos + 2);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(`$${netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, pageWidth - 25, yPos + 12, { align: 'right' });

      // Notes section
      if (notes.trim()) {
        yPos += 40;
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Notes', 20, yPos);
        yPos += 8;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const splitNotes = doc.splitTextToSize(notes, pageWidth - 40);
        doc.text(splitNotes, 20, yPos);
      }

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text('This document is for informational purposes only. Consult a tax professional for official tax filings.', pageWidth / 2, pageHeight - 15, { align: 'center' });
      doc.text(`© ${taxYear} PawBucks. All rights reserved.`, pageWidth / 2, pageHeight - 10, { align: 'center' });

      doc.save(`${businessName.replace(/\s+/g, '_')}_Tax_Summary_${taxYear}.pdf`);
      toast.success('Tax Summary PDF downloaded');
    } finally {
      setIsExporting(null);
    }
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type: `${type};charset=utf-8;` });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Branded PDF */}
        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Tax Summary PDF
            </CardTitle>
            <CardDescription>
              Branded PDF with YTD revenue, deductions, and net profit
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">Add Notes for Accountant (Optional)</Label>
              <Textarea
                placeholder="Any additional context for your accountant..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-20 text-sm"
              />
            </div>
            <Button 
              onClick={generateTaxSummaryPDF} 
              className="w-full"
              disabled={isExporting === 'pdf'}
            >
              {isExporting === 'pdf' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download Tax Summary
            </Button>
          </CardContent>
        </Card>

        {/* Excel Bundle */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-success" />
              Complete Excel Bundle
            </CardTitle>
            <CardDescription>
              All data in one spreadsheet-ready file
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground mb-3 space-y-1">
              <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> Income summary</p>
              <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> Expenses by category</p>
              <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> Detailed expense log</p>
              <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> Mileage log</p>
            </div>
            <Button 
              onClick={exportExcelBundle} 
              variant="outline" 
              className="w-full"
              disabled={isExporting === 'excel'}
            >
              {isExporting === 'excel' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Package className="h-4 w-4 mr-2" />
              )}
              Download Bundle
            </Button>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Individual Exports */}
      <div>
        <h4 className="text-sm font-semibold mb-3">Individual CSV Exports</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button 
            variant="outline" 
            onClick={exportExpensesCSV}
            disabled={isExporting === 'expenses'}
            className="justify-start"
          >
            {isExporting === 'expenses' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Receipt className="h-4 w-4 mr-2" />
            )}
            Expenses ({expenses.length})
          </Button>
          
          <Button 
            variant="outline" 
            onClick={exportIncomeCSV}
            disabled={isExporting === 'income'}
            className="justify-start"
          >
            {isExporting === 'income' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <DollarSign className="h-4 w-4 mr-2" />
            )}
            Income Summary
          </Button>
          
          <Button 
            variant="outline" 
            onClick={exportMileageCSV}
            disabled={isExporting === 'mileage'}
            className="justify-start"
          >
            {isExporting === 'mileage' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Car className="h-4 w-4 mr-2" />
            )}
            Mileage Log ({mileageEntries.length})
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <Card className="bg-muted/30">
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-success">${grossIncome.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">Gross Income</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-destructive">${(totalExpenses + mileageDeduction).toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">Total Deductions</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">${netProfit.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">Net Profit</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{expenses.length}</p>
              <p className="text-xs text-muted-foreground">Expenses Logged</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
