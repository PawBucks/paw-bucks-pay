import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GradientCard } from "@/components/ui/gradient-card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

type Subscriber = {
  id: string;
  user_id: string;
  product_name: string;
  amount: number;
  currency: string;
  status: string;
  billing_interval: string;
  billing_interval_count: number;
  current_period_start: string;
  current_period_end: string;
  next_billing_date: string;
  cancel_at_period_end: boolean;
  created_at: string;
  profiles: { full_name: string; email: string } | null;
};

type MerchantSubscribersTabProps = {
  merchantId: string;
};

const statusVariant = (status: string) => {
  switch (status) {
    case "active":
      return "default";
    case "past_due":
      return "destructive";
    case "canceled":
      return "secondary";
    default:
      return "outline";
  }
};

export function MerchantSubscribersTab({ merchantId }: MerchantSubscribersTabProps) {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscribers = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("merchant_subscriptions")
        .select("*, profiles!merchant_subscriptions_user_id_fkey(full_name, email)")
        .eq("merchant_id", merchantId)
        .in("status", ["active", "past_due"])
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setSubscribers((data as Subscriber[]) || []);
    } catch (err: any) {
      console.error("Error fetching subscribers:", err);
      setError(err.message || "Failed to load subscribers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscribers();
  }, [merchantId]);

  const activeCount = subscribers.filter((s) => s.status === "active").length;
  const pastDueCount = subscribers.filter((s) => s.status === "past_due").length;
  const totalMRR = subscribers
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + s.amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Subscribers</h2>
          <p className="text-muted-foreground">View all active subscribers and their plans.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSubscribers}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GradientCard>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Subscribers</p>
              <p className="text-2xl font-bold">{activeCount}</p>
            </div>
          </div>
        </GradientCard>
        <GradientCard>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Past Due</p>
              <p className="text-2xl font-bold">{pastDueCount}</p>
            </div>
          </div>
        </GradientCard>
        <GradientCard>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
              <span className="text-lg font-bold text-secondary">$</span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Monthly Recurring</p>
              <p className="text-2xl font-bold">${(totalMRR / 100).toFixed(2)}</p>
            </div>
          </div>
        </GradientCard>
      </div>

      {/* Subscriber table */}
      {error ? (
        <GradientCard className="text-center py-8">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 text-destructive" />
          <p className="text-destructive">{error}</p>
        </GradientCard>
      ) : subscribers.length === 0 ? (
        <GradientCard className="text-center py-12">
          <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground font-medium">No active subscribers yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Subscribers will appear here once customers subscribe to your plans.
          </p>
        </GradientCard>
      ) : (
        <GradientCard className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subscriber</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Next Billing</TableHead>
                <TableHead>Since</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscribers.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {sub.profiles?.full_name || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sub.profiles?.email || "—"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{sub.product_name}</span>
                  </TableCell>
                  <TableCell>
                    ${(sub.amount / 100).toFixed(2)}
                    <span className="text-xs text-muted-foreground ml-1">
                      /{sub.billing_interval_count > 1 ? `${sub.billing_interval_count} ` : ""}
                      {sub.billing_interval}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(sub.status)}>
                      {sub.status === "active" && sub.cancel_at_period_end
                        ? "Canceling"
                        : sub.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {sub.cancel_at_period_end
                      ? "—"
                      : format(new Date(sub.next_billing_date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(sub.created_at), "MMM d, yyyy")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </GradientCard>
      )}
    </div>
  );
}
