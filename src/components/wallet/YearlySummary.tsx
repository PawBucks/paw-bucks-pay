import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GradientCard } from "@/components/ui/gradient-card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, Calendar, TrendingUp, DollarSign, Store, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import jsPDF from "jspdf";
import { getCategoryLabel, getCategoryColor, CATEGORY_CONFIG } from "@/lib/categoryMapping";

const COLORS = Object.values(CATEGORY_CONFIG).map(c => c.color);

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function YearlySummary() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());

  const { data: yearlyData, isLoading } = useQuery({
    queryKey: ['yearly-summary', selectedYear],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const startDate = new Date(parseInt(selectedYear), 0, 1);
      const endDate = new Date(parseInt(selectedYear), 11, 31, 23, 59, 59);

      // Fetch transactions with merchant_id
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('amount, created_at, merchant_id')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (txError) throw txError;

      // Fetch merchants from public view to get names
      const merchantIds = [...new Set(transactions?.map(t => t.merchant_id).filter(Boolean) || [])];
      let merchantMap: Record<string, { business_name: string; business_type: string }> = {};
      
      if (merchantIds.length > 0) {
        const { data: merchants } = await supabase
          .from('merchants_public')
          .select('id, business_name, business_type')
          .in('id', merchantIds);
        
        merchants?.forEach((m: any) => {
          merchantMap[m.id] = { business_name: m.business_name, business_type: m.business_type };
        });
      }

      // Fetch medical records for the year
      const { data: medicalRecords, error: medError } = await supabase
        .from('pet_medical_records')
        .select('price, record_date, title')
        .eq('user_id', user.id)
        .gte('record_date', startDate.toISOString().split('T')[0])
        .lte('record_date', endDate.toISOString().split('T')[0])
        .order('record_date', { ascending: true });

      if (medError) throw medError;

      // Process monthly totals
      const monthlyTotals = Array(12).fill(0);
      const categoryTotals: Record<string, number> = {};
      const merchantTotals: Record<string, { name: string; total: number }> = {};

      // Process transactions
      transactions?.forEach((tx: any) => {
        const month = new Date(tx.created_at).getMonth();
        const amount = parseFloat(tx.amount);
        monthlyTotals[month] += amount;

        const merchant = merchantMap[tx.merchant_id];
        const categoryLabel = getCategoryLabel(merchant?.business_type);
        categoryTotals[categoryLabel] = (categoryTotals[categoryLabel] || 0) + amount;

        const merchantName = merchant?.business_name || 'Unknown Merchant';
        if (!merchantTotals[merchantName]) {
          merchantTotals[merchantName] = { name: merchantName, total: 0 };
        }
        merchantTotals[merchantName].total += amount;
      });

      // Process medical records
      medicalRecords?.forEach((record: any) => {
        const month = new Date(record.record_date).getMonth();
        const amount = parseFloat(record.price) || 0;
        monthlyTotals[month] += amount;

        // Add to veterinary category
        categoryTotals['Veterinary'] = (categoryTotals['Veterinary'] || 0) + amount;

        // Add to "Vet Visits" as a merchant
        if (!merchantTotals['Vet Visits']) {
          merchantTotals['Vet Visits'] = { name: 'Vet Visits', total: 0 };
        }
        merchantTotals['Vet Visits'].total += amount;
      });

      const totalSpent = monthlyTotals.reduce((a, b) => a + b, 0);
      const avgMonthly = totalSpent / 12;
      const totalTransactionCount = (transactions?.length || 0) + (medicalRecords?.length || 0);

      return {
        transactions: transactions || [],
        medicalRecords: medicalRecords || [],
        monthlyData: MONTHS.map((month, idx) => ({
          month: month.substring(0, 3),
          amount: monthlyTotals[idx],
        })),
        categoryData: Object.entries(categoryTotals).map(([name, value]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value,
        })),
        topMerchants: Object.values(merchantTotals)
          .sort((a, b) => b.total - a.total)
          .slice(0, 5),
        totalSpent,
        avgMonthly,
        transactionCount: totalTransactionCount,
      };
    },
  });

  const generatePDF = () => {
    if (!yearlyData) return;

    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    
    // Header
    pdf.setFontSize(24);
    pdf.setTextColor(139, 92, 246);
    pdf.text('PawBucks', 20, 25);
    
    pdf.setFontSize(18);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`Yearly Spending Summary - ${selectedYear}`, 20, 40);
    
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Generated on ${new Date().toLocaleDateString()}`, 20, 48);

    // Summary section
    pdf.setFontSize(14);
    pdf.setTextColor(0, 0, 0);
    pdf.text('Summary', 20, 65);
    
    pdf.setFontSize(11);
    pdf.text(`Total Spent: $${yearlyData.totalSpent.toFixed(2)}`, 25, 75);
    pdf.text(`Total Transactions: ${yearlyData.transactionCount}`, 25, 82);
    pdf.text(`Average Monthly: $${yearlyData.avgMonthly.toFixed(2)}`, 25, 89);

    // Monthly breakdown
    pdf.setFontSize(14);
    pdf.text('Monthly Breakdown', 20, 105);
    
    let y = 115;
    pdf.setFontSize(10);
    yearlyData.monthlyData.forEach((item, idx) => {
      if (y > 270) {
        pdf.addPage();
        y = 20;
      }
      pdf.text(`${MONTHS[idx]}: $${item.amount.toFixed(2)}`, 25, y);
      y += 7;
    });

    // Category breakdown
    y += 10;
    if (y > 240) {
      pdf.addPage();
      y = 20;
    }
    pdf.setFontSize(14);
    pdf.text('Spending by Category', 20, y);
    y += 10;
    
    pdf.setFontSize(10);
    yearlyData.categoryData.forEach((item) => {
      if (y > 270) {
        pdf.addPage();
        y = 20;
      }
      const percentage = ((item.value / yearlyData.totalSpent) * 100).toFixed(1);
      pdf.text(`${item.name}: $${item.value.toFixed(2)} (${percentage}%)`, 25, y);
      y += 7;
    });

    // Top merchants
    y += 10;
    if (y > 240) {
      pdf.addPage();
      y = 20;
    }
    pdf.setFontSize(14);
    pdf.text('Top Merchants', 20, y);
    y += 10;
    
    pdf.setFontSize(10);
    yearlyData.topMerchants.forEach((merchant, idx) => {
      if (y > 270) {
        pdf.addPage();
        y = 20;
      }
      pdf.text(`${idx + 1}. ${merchant.name}: $${merchant.total.toFixed(2)}`, 25, y);
      y += 7;
    });

    // Footer
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    const footerY = pdf.internal.pageSize.getHeight() - 10;
    pdf.text('This document is for personal record-keeping and tax purposes.', pageWidth / 2, footerY, { align: 'center' });

    pdf.save(`PawBucks_Spending_${selectedYear}.pdf`);
  };

  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  if (isLoading) {
    return (
      <GradientCard className="p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </GradientCard>
    );
  }

  return (
    <div className="space-y-6">
      <GradientCard className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Yearly Spending Summary</h3>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={generatePDF} disabled={!yearlyData} className="gap-2">
              <FileDown className="h-4 w-4" />
              Download PDF
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-primary/10 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              Total Spent
            </div>
            <p className="text-2xl font-bold">${yearlyData?.totalSpent.toFixed(2) || '0.00'}</p>
          </div>
          <div className="bg-cyan-500/10 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              Avg Monthly
            </div>
            <p className="text-2xl font-bold">${yearlyData?.avgMonthly.toFixed(2) || '0.00'}</p>
          </div>
          <div className="bg-emerald-500/10 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Store className="h-4 w-4" />
              Transactions
            </div>
            <p className="text-2xl font-bold">{yearlyData?.transactionCount || 0}</p>
          </div>
        </div>

        {/* Monthly Chart */}
        <div className="h-64 mb-6">
          <h4 className="text-sm font-medium mb-3">Monthly Spending</h4>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={yearlyData?.monthlyData || []}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value: number) => [`$${value.toFixed(2)}`, 'Spent']}
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
              />
              <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category & Top Merchants */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium mb-3">Spending by Category</h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={yearlyData?.categoryData || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {yearlyData?.categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-3">Top Merchants</h4>
            <div className="space-y-2">
              {yearlyData?.topMerchants.map((merchant, idx) => (
                <div key={merchant.name} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground w-5">{idx + 1}.</span>
                    <span className="text-sm font-medium truncate max-w-[150px]">{merchant.name}</span>
                  </div>
                  <span className="text-sm font-semibold">${merchant.total.toFixed(2)}</span>
                </div>
              ))}
              {(!yearlyData?.topMerchants || yearlyData.topMerchants.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No transactions this year</p>
              )}
            </div>
          </div>
        </div>
      </GradientCard>
    </div>
  );
}