import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Plus, Vault, DollarSign, Receipt, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ExpenseEntryDialog, ExpensesList, CategorySummary, ReportGenerator, TaxExpense, TaxExpenseCategory } from '@/components/merchant/TaxVault';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function MerchantTaxVault() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // Fetch merchant
  useEffect(() => {
    async function fetchMerchant() {
      if (!user) return;
      
      const { data } = await supabase
        .from('merchants')
        .select('id, business_name')
        .eq('user_id', user.id)
        .single();
      
      if (data) {
        setMerchantId(data.id);
        setBusinessName(data.business_name);
      }
    }
    
    fetchMerchant();
  }, [user]);

  // Fetch expenses
  const { data: expenses = [], isLoading, refetch } = useQuery({
    queryKey: ['tax-expenses', merchantId, selectedYear],
    queryFn: async () => {
      if (!merchantId) return [];
      
      const { data, error } = await supabase
        .from('merchant_tax_expenses')
        .select('*')
        .eq('merchant_id', merchantId)
        .eq('tax_year', selectedYear)
        .order('expense_date', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(expense => ({
        ...expense,
        category: expense.category as TaxExpenseCategory,
      })) as TaxExpense[];
    },
    enabled: !!merchantId,
  });

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const categoryCount = new Set(expenses.map(exp => exp.category)).size;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/merchant-dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Vault className="h-6 w-6 text-primary" />
                Tax Vault
              </h1>
              <p className="text-muted-foreground">Track and categorize business expenses for tax filing</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Expense
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Deductions</p>
                  <p className="text-2xl font-bold">${totalExpenses.toFixed(2)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Expenses</p>
                  <p className="text-2xl font-bold">{expenses.length}</p>
                </div>
                <Receipt className="h-8 w-8 text-blue-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Categories Used</p>
                  <p className="text-2xl font-bold">{categoryCount}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="expenses" className="space-y-6">
          <TabsList>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="summary">Category Summary</TabsTrigger>
            <TabsTrigger value="reports">Generate Reports</TabsTrigger>
          </TabsList>
          
          <TabsContent value="expenses">
            <Card>
              <CardHeader>
                <CardTitle>Expense Log</CardTitle>
                <CardDescription>All recorded business expenses for {selectedYear}</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : (
                  <ExpensesList expenses={expenses} onExpenseDeleted={refetch} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="summary">
            <CategorySummary expenses={expenses} />
          </TabsContent>
          
          <TabsContent value="reports">
            <ReportGenerator 
              expenses={expenses} 
              businessName={businessName} 
              taxYear={selectedYear} 
            />
          </TabsContent>
        </Tabs>
      </main>

      {merchantId && (
        <ExpenseEntryDialog
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          merchantId={merchantId}
          onExpenseAdded={refetch}
        />
      )}
    </div>
  );
}
