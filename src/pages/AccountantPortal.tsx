import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  FileText, 
  DollarSign, 
  Car, 
  Receipt, 
  Shield, 
  MessageSquare,
  Eye,
  Loader2,
  AlertTriangle,
  Building2,
  Calendar
} from 'lucide-react';

interface InvitationData {
  id: string;
  merchant_id: string;
  accountant_name: string | null;
  accountant_email: string;
  permissions: {
    view_expenses: boolean;
    view_income: boolean;
    view_mileage: boolean;
    add_notes: boolean;
    recategorize: boolean;
  };
  status: string;
  expires_at: string;
  merchants: {
    business_name: string;
    owner_name: string | null;
  };
}

interface Expense {
  id: string;
  expense_date: string;
  category: string;
  description: string | null;
  amount: number;
  vendor_name: string | null;
  receipt_url: string | null;
}

interface MileageEntry {
  id: string;
  trip_date: string;
  trip_type: string;
  miles: number;
  destination: string | null;
  description: string | null;
}

interface AccountantNote {
  id: string;
  expense_id: string;
  note: string;
  suggested_category: string | null;
  created_at: string;
}

const TAX_CATEGORIES = [
  'inventory_supplies',
  'specialized_equipment',
  'professional_services',
  'marketing_advertising',
  'insurance',
  'travel_transportation',
  'utilities_communications',
  'rent_facilities',
  'training_education',
  'health_safety',
  'software_subscriptions',
  'other_deductible'
];

const formatCategory = (category: string) => {
  return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

export default function AccountantPortal() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [mileage, setMileage] = useState<MileageEntry[]>([]);
  const [notes, setNotes] = useState<AccountantNote[]>([]);
  const [incomeData, setIncomeData] = useState<{ total: number; byMonth: Record<string, number> }>({ total: 0, byMonth: {} });
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');
  const [suggestedCategory, setSuggestedCategory] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (token) {
      validateAndLoadData();
    }
  }, [token, selectedYear]);

  const validateAndLoadData = async () => {
    try {
      setLoading(true);

      // Validate the access token and get invitation details
      const { data: invitationData, error: invError } = await supabase
        .from('accountant_invitations')
        .select(`
          id,
          merchant_id,
          accountant_name,
          accountant_email,
          permissions,
          status,
          expires_at,
          merchants (
            business_name,
            owner_name
          )
        `)
        .eq('access_token', token)
        .single();

      if (invError || !invitationData) {
        toast.error('Invalid or expired access link');
        navigate('/');
        return;
      }

      // Check if invitation is valid
      if (invitationData.status === 'revoked') {
        toast.error('This access has been revoked by the merchant');
        navigate('/');
        return;
      }

      if (new Date(invitationData.expires_at) < new Date()) {
        toast.error('This access link has expired');
        navigate('/');
        return;
      }

      // Update status to accepted if pending
      if (invitationData.status === 'pending') {
        await supabase
          .from('accountant_invitations')
          .update({ 
            status: 'accepted', 
            accepted_at: new Date().toISOString(),
            last_accessed_at: new Date().toISOString()
          })
          .eq('id', invitationData.id);
      } else {
        // Update last accessed time
        await supabase
          .from('accountant_invitations')
          .update({ last_accessed_at: new Date().toISOString() })
          .eq('id', invitationData.id);
      }

      // Log activity
      await supabase.from('accountant_activity_log').insert({
        invitation_id: invitationData.id,
        merchant_id: invitationData.merchant_id,
        action: 'portal_access',
        entity_type: 'portal',
        notes: `Accessed portal for tax year ${selectedYear}`
      });

      setInvitation(invitationData as InvitationData);

      const permissions = invitationData.permissions as InvitationData['permissions'];

      // Load data based on permissions
      if (permissions.view_expenses) {
        const { data: expenseData } = await supabase
          .from('merchant_tax_expenses')
          .select('*')
          .eq('merchant_id', invitationData.merchant_id)
          .eq('tax_year', selectedYear)
          .order('expense_date', { ascending: false });
        
        setExpenses(expenseData || []);

        // Load notes for expenses
        const { data: notesData } = await supabase
          .from('accountant_expense_notes')
          .select('*')
          .eq('invitation_id', invitationData.id);
        
        setNotes(notesData || []);
      }

      if (permissions.view_mileage) {
        const { data: mileageData } = await supabase
          .from('merchant_mileage_log')
          .select('*')
          .eq('merchant_id', invitationData.merchant_id)
          .eq('tax_year', selectedYear)
          .order('trip_date', { ascending: false });
        
        setMileage(mileageData || []);
      }

      if (permissions.view_income) {
        // Fetch income from merchant transactions
        const { data: earningsData } = await supabase
          .from('direct_payments')
          .select('amount, created_at')
          .eq('merchant_id', invitationData.merchant_id)
          .eq('status', 'succeeded')
          .gte('created_at', `${selectedYear}-01-01`)
          .lte('created_at', `${selectedYear}-12-31`);

        const byMonth: Record<string, number> = {};
        let total = 0;

        (earningsData || []).forEach(payment => {
          const month = format(new Date(payment.created_at), 'MMM yyyy');
          byMonth[month] = (byMonth[month] || 0) + payment.amount;
          total += payment.amount;
        });

        setIncomeData({ total, byMonth });
      }

    } catch (error) {
      console.error('Error loading portal data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedExpenseId || !newNote.trim() || !invitation) return;

    setSavingNote(true);
    try {
      const { error } = await supabase.from('accountant_expense_notes').insert({
        invitation_id: invitation.id,
        expense_id: selectedExpenseId,
        note: newNote.trim(),
        suggested_category: suggestedCategory || null
      });

      if (error) throw error;

      // Log activity
      await supabase.from('accountant_activity_log').insert({
        invitation_id: invitation.id,
        merchant_id: invitation.merchant_id,
        action: 'add_note',
        entity_type: 'expense',
        entity_id: selectedExpenseId,
        notes: newNote.trim()
      });

      toast.success('Note added successfully');
      setNoteDialogOpen(false);
      setNewNote('');
      setSuggestedCategory('');
      setSelectedExpenseId(null);

      // Refresh notes
      const { data: notesData } = await supabase
        .from('accountant_expense_notes')
        .select('*')
        .eq('invitation_id', invitation.id);
      
      setNotes(notesData || []);

    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Failed to add note');
    } finally {
      setSavingNote(false);
    }
  };

  const getExpenseNotes = (expenseId: string) => {
    return notes.filter(n => n.expense_id === expenseId);
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalMiles = mileage.reduce((sum, m) => sum + m.miles, 0);
  const mileageDeduction = totalMiles * 0.67; // 2024 IRS rate

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Validating access...</p>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">This access link is invalid or has expired.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const permissions = invitation.permissions;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold">{invitation.merchants.business_name}</h1>
                <p className="text-sm text-muted-foreground">Tax Vault - Accountant Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                Read-Only Access
              </Badge>
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="w-32">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026].map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {permissions.view_income && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-sm">Gross Income</span>
                </div>
                <p className="text-2xl font-bold">${incomeData.total.toLocaleString()}</p>
              </CardContent>
            </Card>
          )}
          {permissions.view_expenses && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Receipt className="h-4 w-4" />
                  <span className="text-sm">Total Expenses</span>
                </div>
                <p className="text-2xl font-bold">${totalExpenses.toLocaleString()}</p>
              </CardContent>
            </Card>
          )}
          {permissions.view_mileage && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Car className="h-4 w-4" />
                  <span className="text-sm">Mileage Deduction</span>
                </div>
                <p className="text-2xl font-bold">${mileageDeduction.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{totalMiles.toLocaleString()} miles @ $0.67</p>
              </CardContent>
            </Card>
          )}
          {permissions.view_income && permissions.view_expenses && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm">Net Profit</span>
                </div>
                <p className="text-2xl font-bold text-primary">
                  ${(incomeData.total - totalExpenses - mileageDeduction).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Data Tabs */}
        <Tabs defaultValue={permissions.view_expenses ? "expenses" : permissions.view_income ? "income" : "mileage"}>
          <TabsList>
            {permissions.view_expenses && (
              <TabsTrigger value="expenses" className="flex items-center gap-1">
                <Receipt className="h-4 w-4" />
                Expenses
              </TabsTrigger>
            )}
            {permissions.view_income && (
              <TabsTrigger value="income" className="flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                Income
              </TabsTrigger>
            )}
            {permissions.view_mileage && (
              <TabsTrigger value="mileage" className="flex items-center gap-1">
                <Car className="h-4 w-4" />
                Mileage
              </TabsTrigger>
            )}
          </TabsList>

          {/* Expenses Tab */}
          {permissions.view_expenses && (
            <TabsContent value="expenses">
              <Card>
                <CardHeader>
                  <CardTitle>Expense Log</CardTitle>
                  <CardDescription>All logged expenses for tax year {selectedYear}</CardDescription>
                </CardHeader>
                <CardContent>
                  {expenses.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No expenses logged for this year</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Receipt</TableHead>
                          {permissions.add_notes && <TableHead>Notes</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expenses.map(expense => {
                          const expenseNotes = getExpenseNotes(expense.id);
                          return (
                            <TableRow key={expense.id}>
                              <TableCell>{format(new Date(expense.expense_date), 'MMM d, yyyy')}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{formatCategory(expense.category)}</Badge>
                              </TableCell>
                              <TableCell>{expense.vendor_name || '-'}</TableCell>
                              <TableCell className="max-w-xs truncate">{expense.description || '-'}</TableCell>
                              <TableCell className="text-right font-medium">${expense.amount.toFixed(2)}</TableCell>
                              <TableCell>
                                {expense.receipt_url ? (
                                  <a 
                                    href={expense.receipt_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline text-sm"
                                  >
                                    View
                                  </a>
                                ) : '-'}
                              </TableCell>
                              {permissions.add_notes && (
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {expenseNotes.length > 0 && (
                                      <Badge variant="secondary" className="text-xs">
                                        {expenseNotes.length} note{expenseNotes.length > 1 ? 's' : ''}
                                      </Badge>
                                    )}
                                    <Dialog open={noteDialogOpen && selectedExpenseId === expense.id} onOpenChange={(open) => {
                                      setNoteDialogOpen(open);
                                      if (!open) {
                                        setSelectedExpenseId(null);
                                        setNewNote('');
                                        setSuggestedCategory('');
                                      }
                                    }}>
                                      <DialogTrigger asChild>
                                        <Button 
                                          size="sm" 
                                          variant="ghost"
                                          onClick={() => setSelectedExpenseId(expense.id)}
                                        >
                                          <MessageSquare className="h-4 w-4" />
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent>
                                        <DialogHeader>
                                          <DialogTitle>Add Note for Expense</DialogTitle>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                          <div className="bg-muted/50 p-3 rounded-lg text-sm">
                                            <p><strong>Date:</strong> {format(new Date(expense.expense_date), 'MMM d, yyyy')}</p>
                                            <p><strong>Amount:</strong> ${expense.amount.toFixed(2)}</p>
                                            <p><strong>Current Category:</strong> {formatCategory(expense.category)}</p>
                                          </div>

                                          {expenseNotes.length > 0 && (
                                            <div className="space-y-2">
                                              <p className="text-sm font-medium">Previous Notes:</p>
                                              {expenseNotes.map(note => (
                                                <div key={note.id} className="bg-muted/30 p-2 rounded text-sm">
                                                  <p>{note.note}</p>
                                                  {note.suggested_category && (
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                      Suggested: {formatCategory(note.suggested_category)}
                                                    </p>
                                                  )}
                                                  <p className="text-xs text-muted-foreground">
                                                    {format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}
                                                  </p>
                                                </div>
                                              ))}
                                            </div>
                                          )}

                                          <Textarea
                                            placeholder="Add your note or observation..."
                                            value={newNote}
                                            onChange={(e) => setNewNote(e.target.value)}
                                            rows={3}
                                          />

                                          {permissions.recategorize && (
                                            <div>
                                              <label className="text-sm font-medium mb-1 block">
                                                Suggest Different Category (optional)
                                              </label>
                                              <Select value={suggestedCategory} onValueChange={setSuggestedCategory}>
                                                <SelectTrigger>
                                                  <SelectValue placeholder="Select category..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="">No suggestion</SelectItem>
                                                  {TAX_CATEGORIES.map(cat => (
                                                    <SelectItem key={cat} value={cat}>
                                                      {formatCategory(cat)}
                                                    </SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            </div>
                                          )}

                                          <Button 
                                            onClick={handleAddNote} 
                                            disabled={!newNote.trim() || savingNote}
                                            className="w-full"
                                          >
                                            {savingNote ? (
                                              <>
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                Saving...
                                              </>
                                            ) : (
                                              'Add Note'
                                            )}
                                          </Button>
                                        </div>
                                      </DialogContent>
                                    </Dialog>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}

                  {/* Category Summary */}
                  {expenses.length > 0 && (
                    <div className="mt-6 pt-6 border-t">
                      <h4 className="font-medium mb-3">By Category</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(
                          expenses.reduce((acc, e) => {
                            acc[e.category] = (acc[e.category] || 0) + e.amount;
                            return acc;
                          }, {} as Record<string, number>)
                        ).sort((a, b) => b[1] - a[1]).map(([category, amount]) => (
                          <div key={category} className="bg-muted/50 p-3 rounded-lg">
                            <p className="text-sm text-muted-foreground">{formatCategory(category)}</p>
                            <p className="font-semibold">${amount.toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Income Tab */}
          {permissions.view_income && (
            <TabsContent value="income">
              <Card>
                <CardHeader>
                  <CardTitle>Income Summary</CardTitle>
                  <CardDescription>Revenue by month for tax year {selectedYear}</CardDescription>
                </CardHeader>
                <CardContent>
                  {Object.keys(incomeData.byMonth).length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No income recorded for this year</p>
                  ) : (
                    <div className="space-y-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Month</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(incomeData.byMonth)
                            .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
                            .map(([month, amount]) => (
                              <TableRow key={month}>
                                <TableCell>{month}</TableCell>
                                <TableCell className="text-right font-medium">${amount.toLocaleString()}</TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                      <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
                        <p className="text-sm text-muted-foreground">Total Gross Revenue</p>
                        <p className="text-2xl font-bold text-primary">${incomeData.total.toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Mileage Tab */}
          {permissions.view_mileage && (
            <TabsContent value="mileage">
              <Card>
                <CardHeader>
                  <CardTitle>Mileage Log</CardTitle>
                  <CardDescription>Business miles for tax year {selectedYear}</CardDescription>
                </CardHeader>
                <CardContent>
                  {mileage.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No mileage logged for this year</p>
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Destination</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Miles</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mileage.map(entry => (
                            <TableRow key={entry.id}>
                              <TableCell>{format(new Date(entry.trip_date), 'MMM d, yyyy')}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{entry.trip_type.replace('_', ' ')}</Badge>
                              </TableCell>
                              <TableCell>{entry.destination || '-'}</TableCell>
                              <TableCell className="max-w-xs truncate">{entry.description || '-'}</TableCell>
                              <TableCell className="text-right font-medium">{entry.miles}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>

                      <div className="mt-6 pt-6 border-t grid grid-cols-2 gap-4">
                        <div className="bg-muted/50 p-4 rounded-lg">
                          <p className="text-sm text-muted-foreground">Total Miles</p>
                          <p className="text-2xl font-bold">{totalMiles.toLocaleString()}</p>
                        </div>
                        <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
                          <p className="text-sm text-muted-foreground">Standard Mileage Deduction</p>
                          <p className="text-2xl font-bold text-primary">${mileageDeduction.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">@ $0.67/mile (2024 rate)</p>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Security Notice */}
        <div className="mt-8 flex items-center gap-3 text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
          <Shield className="h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-medium">Secure Access</p>
            <p>This portal provides read-only access to {invitation.merchants.business_name}'s tax records. 
            All activity is logged for audit purposes. Access expires {format(new Date(invitation.expires_at), 'MMMM d, yyyy')}.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
