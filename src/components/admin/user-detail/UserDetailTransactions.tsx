import { useEffect, useState } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from"@/components/ui/table";
import { Badge } from"@/components/ui/badge";
import { Skeleton } from"@/components/ui/skeleton";
import { Input } from"@/components/ui/input";
import { Search } from "lucide-react";
import { useDebounce } from"@/hooks/useDebounce";

import { Formatters } from "@/utils/formatters";
type Transaction = {
 id: string;
 amount: number;
 stripe_amount: number | null;
 pawbucks_used: number | null;
 application_fee: number | null;
 cashback_earned: number;
 status: string;
 description: string | null;
 created_at: string;
 payment_method: string | null;
 merchants: { business_name: string; business_type: string } | null;
 profiles: { full_name: string; email: string } | null;
};

export function UserDetailTransactions({ userId }: { userId: string }) {
 const [transactions, setTransactions] = useState<Transaction[]>([]);
 const [loading, setLoading] = useState(true);
 const [search, setSearch] = useState("");
 const [isMerchant, setIsMerchant] = useState(false);
 const debouncedSearch = useDebounce(search, 300);

 useEffect(() => {
 loadTransactions();
 }, [userId]);

 const loadTransactions = async () => {
 setLoading(true);
 try {
 // Check if user is a merchant
 const { data: merchantData } = await supabase
 .from("merchants")
 .select("id")
 .eq("user_id", userId)
 .maybeSingle();

 if (merchantData) {
 // Merchant: show transactions where they are the merchant
 setIsMerchant(true);
 const { data, error } = await supabase
 .from("transactions")
 .select("id, amount, stripe_amount, pawbucks_used, application_fee, cashback_earned, status, description, created_at, payment_method, profiles!transactions_user_id_fkey(full_name, email)")
 .eq("merchant_id", merchantData.id)
 .order("created_at", { ascending: false });

 if (error) throw error;
 setTransactions((data as unknown as Transaction[]) || []);
 } else {
 // Pet owner or other: show transactions where they are the customer
 setIsMerchant(false);
 const { data, error } = await supabase
 .from("transactions")
 .select("id, amount, stripe_amount, pawbucks_used, application_fee, cashback_earned, status, description, created_at, payment_method, merchants!transactions_merchant_id_fkey(business_name, business_type)")
 .eq("user_id", userId)
 .order("created_at", { ascending: false });

 if (error) throw error;
 setTransactions((data as unknown as Transaction[]) || []);
 }
 } catch (err) {
 console.error("Failed to load transactions:", err);
 } finally {
 setLoading(false);
 }
 };

 const filtered = debouncedSearch
 ? transactions.filter(t =>
 (t.description ||"").toLowerCase().includes(debouncedSearch.toLowerCase()) ||
 (t.merchants?.business_name ||"").toLowerCase().includes(debouncedSearch.toLowerCase()) ||
 (t.profiles?.full_name ||"").toLowerCase().includes(debouncedSearch.toLowerCase()) ||
 t.status.toLowerCase().includes(debouncedSearch.toLowerCase())
 )
 : transactions;

 const totalAmount = transactions.filter(t => t.status ==="completed").reduce((sum, t) => sum + t.amount, 0);
 const totalPawBucksUsed = transactions.filter(t => t.status ==="completed").reduce((sum, t) => sum + (t.pawbucks_used || 0), 0);

 if (loading) {
 return <Card><CardContent className="py-8"><Skeleton className="h-40 w-full" /></CardContent></Card>;
 }

 return (
 <Card>
 <CardHeader>
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <CardTitle>Transaction History ({transactions.length})</CardTitle>
 <div className="flex gap-4 text-sm">
 <span className="text-muted-foreground">
 {isMerchant ?"Total Revenue" :"Total Spent"}: <strong className="text-foreground">{Formatters.currency(totalAmount)}</strong>
 </span>
 <span className="text-muted-foreground flex items-center gap-1">
 <span className="w-3 h-3" aria-hidden="true">🪙</span> PB Used: <strong className="text-foreground">{totalPawBucksUsed.toLocaleString()}</strong>
 </span>
 </div>
 </div>
 <div className="relative mt-2">
 <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
 <Input placeholder="Search transactions..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
 </div>
 </CardHeader>
 <CardContent>
 {filtered.length === 0 ? (
 <p className="text-center text-muted-foreground py-8">No transactions found.</p>
 ) : (
 <div className="border rounded-lg overflow-auto">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Date</TableHead>
 <TableHead>Description</TableHead>
 <TableHead>{isMerchant ?"Customer" :"Merchant"}</TableHead>
 <TableHead className="text-right">Amount</TableHead>
 <TableHead className="text-right">Stripe</TableHead>
 <TableHead className="text-right">PawBucks</TableHead>
 <TableHead className="text-right">Fee</TableHead>
 <TableHead className="text-right">Cashback</TableHead>
 <TableHead>Method</TableHead>
 <TableHead>Status</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {filtered.map(t => (
 <TableRow key={t.id}>
 <TableCell className="whitespace-nowrap text-sm">{new Date(t.created_at).toLocaleDateString()}</TableCell>
 <TableCell className="text-sm max-w-[200px] truncate">{t.description ||"—"}</TableCell>
 <TableCell className="text-sm">
 {isMerchant
 ? (t.profiles?.full_name || t.profiles?.email ||"—")
 : (t.merchants?.business_name ||"—")}
 </TableCell>
 <TableCell className="text-right font-medium">{Formatters.currency(t.amount)}</TableCell>
 <TableCell className="text-right text-sm">{Formatters.currency((t.stripe_amount ?? t.amount))}</TableCell>
 <TableCell className="text-right text-sm">
 {t.pawbucks_used ? (
 <span className="flex items-center justify-end gap-1">
 <span className="w-3 h-3 text-primary" aria-hidden="true">🪙</span>{t.pawbucks_used.toLocaleString()}
 </span>
 ) :"—"}
 </TableCell>
 <TableCell className="text-right text-sm">{Formatters.currency((t.application_fee ?? 0))}</TableCell>
 <TableCell className="text-right text-sm">{t.cashback_earned > 0 ? `${Formatters.currency((t.cashback_earned * 0.001))}` :"—"}</TableCell>
 <TableCell className="text-sm">{t.payment_method ||"Card"}</TableCell>
 <TableCell>
 <Badge variant={t.status ==="completed" ?"default" : t.status ==="refunded" ?"destructive" :"secondary"}>
 {t.status}
 </Badge>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 )}
 </CardContent>
 </Card>
 );
}