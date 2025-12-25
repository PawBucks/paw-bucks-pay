import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GradientCard } from "@/components/ui/gradient-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Coins } from "lucide-react";
import { format } from "date-fns";

type CreditLog = {
  id: string;
  admin_id: string;
  entity_id: string;
  changes: {
    amount: number;
    reason: string;
    old_balance: number;
    new_balance: number;
  };
  created_at: string;
  admin_profile?: {
    full_name: string;
    email: string;
  };
  recipient_profile?: {
    full_name: string;
    email: string;
  };
};

export const PawBucksCreditLogsTab = () => {
  const [logs, setLogs] = useState<CreditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    setLoading(true);
    try {
      // Fetch audit logs for credit_pawbucks action
      const { data: auditLogs, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("action", "credit_pawbucks")
        .eq("entity_type", "pawbucks_wallet")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      if (!auditLogs || auditLogs.length === 0) {
        setLogs([]);
        setLoading(false);
        return;
      }

      // Get unique admin and recipient IDs
      const adminIds = [...new Set(auditLogs.map(log => log.admin_id))];
      const recipientIds = [...new Set(auditLogs.map(log => log.entity_id).filter(Boolean))] as string[];

      // Fetch admin profiles
      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", adminIds);

      // Fetch recipient profiles
      const { data: recipientProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", recipientIds);

      // Map profiles to logs
      const logsWithProfiles = auditLogs.map(log => ({
        ...log,
        changes: log.changes as CreditLog['changes'],
        admin_profile: adminProfiles?.find(p => p.id === log.admin_id),
        recipient_profile: recipientProfiles?.find(p => p.id === log.entity_id),
      }));

      setLogs(logsWithProfiles);
    } catch (error) {
      console.error("Error loading credit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <GradientCard>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-semibold">Manual PawBucks Credit Log</h3>
        </div>
        <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No manual PawBucks credits have been made yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Balance Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(log.created_at), "MMM d, yyyy h:mm a")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {log.admin_profile?.full_name || "Unknown Admin"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {log.admin_profile?.email || log.admin_id}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {log.recipient_profile?.full_name || "Unknown User"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {log.recipient_profile?.email || log.entity_id}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="default" className="bg-green-600">
                      +{log.changes?.amount?.toLocaleString() || 0} PB
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <span className="line-clamp-2" title={log.changes?.reason}>
                      {log.changes?.reason || "No reason provided"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <span className="text-muted-foreground">
                      {log.changes?.old_balance?.toLocaleString() || 0}
                    </span>
                    <span className="mx-1">→</span>
                    <span className="font-medium text-green-600">
                      {log.changes?.new_balance?.toLocaleString() || 0}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </GradientCard>
  );
};
