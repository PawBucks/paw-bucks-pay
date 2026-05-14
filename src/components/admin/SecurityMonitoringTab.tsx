import { useState, useEffect } from"react";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Button } from"@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from"@/components/ui/table";
import { supabase } from"@/integrations/supabase/client";
import { AlertTriangle, BarChart3, CheckCircle, Clock, MapPin, Shield, XCircle } from "lucide-react";
import { format } from"date-fns";
import { toast } from"sonner";

interface SecurityAlert {
 id: string;
 alert_type: string;
 severity: string;
 user_id: string | null;
 ip_address: string | null;
 email: string | null;
 details: Record<string, unknown>;
 is_resolved: boolean;
 resolved_by: string | null;
 resolved_at: string | null;
 created_at: string;
}

interface AuthEvent {
 id: string;
 user_id: string | null;
 event_type: string;
 ip_address: string | null;
 user_agent: string | null;
 email: string | null;
 success: boolean;
 failure_reason: string | null;
 metadata: Record<string, unknown>;
 created_at: string;
}

export const SecurityMonitoringTab = () => {
 const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
 const [events, setEvents] = useState<AuthEvent[]>([]);
 const [loading, setLoading] = useState(true);
 const [stats, setStats] = useState({
 totalEvents: 0,
 failedLogins: 0,
 unresolvedAlerts: 0,
 uniqueIPs: 0,
 });

 useEffect(() => {
 fetchSecurityData();
 
 // Subscribe to real-time security alerts
 const channel = supabase
 .channel("security-alerts")
 .on(
"postgres_changes",
 { event:"INSERT", schema:"public", table:"security_alerts" },
 (payload) => {
 const newAlert = payload.new as SecurityAlert;
 setAlerts((prev) => [newAlert, ...prev]);
 toast.error(`New Security Alert: ${newAlert.alert_type.replace(/_/g," ")}`, {
 description: (newAlert.details as { description?: string })?.description,
 });
 }
 )
 .subscribe();

 return () => {
 supabase.removeChannel(channel);
 };
 }, []);

 const fetchSecurityData = async () => {
 setLoading(true);
 try {
 // Fetch security alerts
 const { data: alertsData } = await supabase
 .from("security_alerts")
 .select("*")
 .order("created_at", { ascending: false })
 .limit(100);

 // Fetch auth events
 const { data: eventsData } = await supabase
 .from("auth_security_events")
 .select("*")
 .order("created_at", { ascending: false })
 .limit(200);

 if (alertsData) setAlerts(alertsData as SecurityAlert[]);
 if (eventsData) {
 setEvents(eventsData as AuthEvent[]);
 
 // Calculate stats
 const failedLogins = eventsData.filter((e) => !e.success && e.event_type ==="login").length;
 const uniqueIPs = new Set(eventsData.map((e) => e.ip_address).filter(Boolean)).size;
 
 setStats({
 totalEvents: eventsData.length,
 failedLogins,
 unresolvedAlerts: alertsData?.filter((a) => !a.is_resolved).length || 0,
 uniqueIPs,
 });
 }
 } catch (error) {
 console.error("Error fetching security data:", error);
 toast.error("Failed to load security data");
 } finally {
 setLoading(false);
 }
 };

 const resolveAlert = async (alertId: string) => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;

 const { error } = await supabase
 .from("security_alerts")
 .update({
 is_resolved: true,
 resolved_by: user.id,
 resolved_at: new Date().toISOString(),
 })
 .eq("id", alertId);

 if (error) {
 toast.error("Failed to resolve alert");
 return;
 }

 setAlerts((prev) =>
 prev.map((a) =>
 a.id === alertId
 ? { ...a, is_resolved: true, resolved_by: user.id, resolved_at: new Date().toISOString() }
 : a
 )
 );
 toast.success("Alert resolved");
 };

 const getSeverityColor = (severity: string) => {
 switch (severity) {
 case"critical":
 return"bg-destructive";
 case"high":
 return"bg-warning";
 case"medium":
 return"bg-warning";
 default:
 return"bg-info";
 }
 };

 const getAlertTypeIcon = (alertType: string) => {
 switch (alertType) {
 case"brute_force_ip":
 case"brute_force_account":
 return <AlertTriangle className="h-4 w-4" />;
 case"rapid_requests":
 return <BarChart3 className="h-4 w-4" aria-hidden="true" />;
 default:
 return <Shield className="h-4 w-4" aria-hidden="true" />;
 }
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center h-64">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
 </div>
 );
 }

 return (
 <div className="space-y-6">
 {/* Stats Cards */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 <Card>
 <CardHeader className="flex flex-row items-center justify-between pb-2">
 <CardTitle className="text-sm font-medium">Total Auth Events</CardTitle>
 <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{stats.totalEvents}</div>
 <p className="text-xs text-muted-foreground">Last 200 events</p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between pb-2">
 <CardTitle className="text-sm font-medium">Failed Logins</CardTitle>
 <XCircle className="h-4 w-4 text-destructive" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-destructive">{stats.failedLogins}</div>
 <p className="text-xs text-muted-foreground">Tracked attempts</p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between pb-2">
 <CardTitle className="text-sm font-medium">Unresolved Alerts</CardTitle>
 <AlertTriangle className="h-4 w-4 text-warning" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-warning">{stats.unresolvedAlerts}</div>
 <p className="text-xs text-muted-foreground">Require attention</p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between pb-2">
 <CardTitle className="text-sm font-medium">Unique IPs</CardTitle>
 <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{stats.uniqueIPs}</div>
 <p className="text-xs text-muted-foreground">Distinct sources</p>
 </CardContent>
 </Card>
 </div>

 <Tabs defaultValue="alerts" className="w-full">
 <TabsList>
 <TabsTrigger value="alerts" className="flex items-center gap-2">
 <Shield className="h-4 w-4" aria-hidden="true" />
 Security Alerts
 {stats.unresolvedAlerts > 0 && (
 <Badge variant="destructive" className="ml-1">
 {stats.unresolvedAlerts}
 </Badge>
 )}
 </TabsTrigger>
 <TabsTrigger value="events" className="flex items-center gap-2">
 <BarChart3 className="h-4 w-4" aria-hidden="true" />
 Auth Events
 </TabsTrigger>
 </TabsList>

 <TabsContent value="alerts" className="mt-4">
 <Card>
 <CardHeader>
 <CardTitle>Security Alerts</CardTitle>
 </CardHeader>
 <CardContent>
 {alerts.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" aria-hidden="true" />
 <p>No security alerts detected</p>
 </div>
 ) : (
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Type</TableHead>
 <TableHead>Severity</TableHead>
 <TableHead>Target</TableHead>
 <TableHead>Details</TableHead>
 <TableHead>Time</TableHead>
 <TableHead>Status</TableHead>
 <TableHead>Action</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {alerts.map((alert) => (
 <TableRow key={alert.id}>
 <TableCell>
 <div className="flex items-center gap-2">
 {getAlertTypeIcon(alert.alert_type)}
 <span className="capitalize">
 {alert.alert_type.replace(/_/g," ")}
 </span>
 </div>
 </TableCell>
 <TableCell>
 <Badge className={getSeverityColor(alert.severity)}>
 {alert.severity}
 </Badge>
 </TableCell>
 <TableCell>
 {alert.email || alert.ip_address ||"N/A"}
 </TableCell>
 <TableCell className="max-w-xs truncate">
 {(alert.details as { description?: string })?.description ||"—"}
 </TableCell>
 <TableCell>
 <div className="flex items-center gap-1 text-sm text-muted-foreground">
 <Clock className="h-3 w-3" aria-hidden="true" />
 {format(new Date(alert.created_at),"MMM d, HH:mm")}
 </div>
 </TableCell>
 <TableCell>
 {alert.is_resolved ? (
 <Badge variant="secondary" className="bg-success/15 text-success">
 <CheckCircle className="h-3 w-3 mr-1" />
 Resolved
 </Badge>
 ) : (
 <Badge variant="destructive">Active</Badge>
 )}
 </TableCell>
 <TableCell>
 {!alert.is_resolved && (
 <Button
 size="sm"
 variant="outline"
 onClick={() => resolveAlert(alert.id)}
 >
 Resolve
 </Button>
 )}
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 )}
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="events" className="mt-4">
 <Card>
 <CardHeader>
 <CardTitle>Authentication Events</CardTitle>
 </CardHeader>
 <CardContent>
 {events.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" aria-hidden="true" />
 <p>No authentication events recorded</p>
 </div>
 ) : (
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Event</TableHead>
 <TableHead>Status</TableHead>
 <TableHead>Email</TableHead>
 <TableHead>IP Address</TableHead>
 <TableHead>Failure Reason</TableHead>
 <TableHead>Time</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {events.map((event) => (
 <TableRow key={event.id}>
 <TableCell className="capitalize">
 {event.event_type}
 </TableCell>
 <TableCell>
 {event.success ? (
 <Badge variant="secondary" className="bg-success/15 text-success">
 <CheckCircle className="h-3 w-3 mr-1" />
 Success
 </Badge>
 ) : (
 <Badge variant="destructive">
 <XCircle className="h-3 w-3 mr-1" />
 Failed
 </Badge>
 )}
 </TableCell>
 <TableCell>{event.email ||"—"}</TableCell>
 <TableCell className="font-mono text-sm">
 {event.ip_address ||"—"}
 </TableCell>
 <TableCell className="text-sm text-muted-foreground">
 {event.failure_reason ||"—"}
 </TableCell>
 <TableCell>
 <div className="flex items-center gap-1 text-sm text-muted-foreground">
 <Clock className="h-3 w-3" aria-hidden="true" />
 {format(new Date(event.created_at),"MMM d, HH:mm:ss")}
 </div>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 )}
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>
 </div>
 );
};
