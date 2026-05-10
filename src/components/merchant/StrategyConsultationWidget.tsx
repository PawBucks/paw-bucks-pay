import { useState } from"react";
import { useQuery } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Button } from"@/components/ui/button";
import { GradientCard } from"@/components/ui/gradient-card";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { ConsultationScheduleDialog } from"./ConsultationScheduleDialog";
import { toast } from"sonner";
import { format } from"date-fns";

export function StrategyConsultationWidget() {
 const [scheduleOpen, setScheduleOpen] = useState(false);
 const [isGenerating, setIsGenerating] = useState(false);

 // Fetch merchant info
 const { data: merchantData } = useQuery({
 queryKey: ['merchant-for-strategy'],
 queryFn: async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return null;
 const { data } = await supabase.from('merchants').select('id, business_name').eq('user_id', user.id).single();
 return data;
 }
 });

 // Fetch upcoming consultations
 const { data: bookings, isLoading: bookingsLoading } = useQuery({
 queryKey: ['consultation-bookings', merchantData?.id],
 queryFn: async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return [];
 const { data, error } = await supabase
 .from('consultation_bookings')
 .select('*')
 .eq('user_id', user.id)
 .order('booking_date', { ascending: true });
 if (error) throw error;
 return data || [];
 },
 enabled: !!merchantData?.id,
 });

 // Fetch AI strategy report
 const { data: aiReport, isLoading: reportLoading, refetch: refetchReport } = useQuery({
 queryKey: ['strategy-ai-report', merchantData?.id],
 queryFn: async () => {
 const { data, error } = await supabase.functions.invoke('merchant-generate-strategy-report');
 if (error) throw error;
 return data as {
 generated_at: string;
 summary: string;
 strengths: string[];
 opportunities: string[];
 actionItems: { action: string; priority:'high' |'medium' |'low'; timeline: string }[];
 projectedImpact: string;
 } | null;
 },
 enabled: !!merchantData?.id,
 retry: false,
 });

 const handleRegenerate = async () => {
 setIsGenerating(true);
 try {
 await refetchReport();
 toast.success('Strategy report regenerated');
 } catch {
 toast.error('Failed to regenerate report');
 } finally {
 setIsGenerating(false);
 }
 };

 const upcomingBookings = bookings?.filter(b => 
 b.status !=='cancelled' && new Date(b.booking_date) >= new Date()
 ) || [];
 
 const pastBookings = bookings?.filter(b => 
 new Date(b.booking_date) < new Date()
 ) || [];

 const getPriorityColor = (priority: string) => {
 switch (priority) {
 case'high': return'bg-destructive/10 text-destructive border-destructive/20';
 case'medium': return'bg-warning/10 text-warning border-warning/20';
 default: return'bg-info/10 text-info border-info/20';
 }
 };

 const getStatusColor = (status: string) => {
 switch (status) {
 case'confirmed': return'bg-success/10 text-success border-success/20';
 case'pending': return'bg-warning/10 text-warning border-warning/20';
 case'completed': return'bg-info/10 text-info border-info/20';
 default: return'bg-muted text-muted-foreground';
 }
 };

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div>
 <h2 className="text-2xl font-bold">Strategy Consultation</h2>
 <p className="text-muted-foreground">
 AI-powered strategy insights plus personalized expert consultations
 </p>
 </div>
 <Badge className="bg-gradient-to-r from-primary to-primary/60 gap-1 w-fit">
 <span className="h-3 w-3" aria-hidden="true">👑</span> Premium
 </Badge>
 </div>

 {/* Summary Cards */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <GradientCard gradient>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-md bg-primary/10">
 <span className="h-5 w-5 text-primary" aria-hidden="true">📅</span>
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Upcoming Sessions</p>
 <p className="text-2xl font-bold">{upcomingBookings.length}</p>
 </div>
 </div>
 </GradientCard>

 <GradientCard gradient>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-md bg-success/10">
 <CheckCircle2 className="h-5 w-5 text-success" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Sessions Completed</p>
 <p className="text-2xl font-bold">{pastBookings.length}</p>
 </div>
 </div>
 </GradientCard>

 <GradientCard gradient>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-md bg-accent/10">
 <span className="h-5 w-5 text-accent" aria-hidden="true">🧠</span>
 </div>
 <div>
 <p className="text-sm text-muted-foreground">AI Report</p>
 <p className="text-2xl font-bold">{aiReport ?'Ready' :'Generate'}</p>
 </div>
 </div>
 </GradientCard>
 </div>

 {/* Book Consultation CTA */}
 <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
 <CardContent className="py-6">
 <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
 <div className="flex items-center gap-4">
 <div className="p-3 rounded-md bg-primary/10">
 <span className="h-6 w-6 text-primary" aria-hidden="true">👥</span>
 </div>
 <div>
 <h3 className="font-semibold text-lg">Schedule a Consultation</h3>
 <p className="text-sm text-muted-foreground">
 Book a free 15-minute session with our merchant success team
 </p>
 </div>
 </div>
 <Button onClick={() => setScheduleOpen(true)}>
 <span className="h-4 w-4 mr-2" aria-hidden="true">📅</span>
 Book Session
 </Button>
 </div>
 </CardContent>
 </Card>

 {/* Upcoming Sessions */}
 {upcomingBookings.length > 0 && (
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <span className="h-5 w-5" aria-hidden="true">⏰</span>
 Upcoming Sessions
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 {upcomingBookings.map(booking => (
 <div key={booking.id} className="flex items-center justify-between p-4 rounded-lg border">
 <div>
 <p className="font-medium">
 {format(new Date(booking.booking_date),"EEEE, MMMM d, yyyy")}
 </p>
 <p className="text-sm text-muted-foreground">at {booking.time_slot} PT</p>
 </div>
 <Badge className={getStatusColor(booking.status)}>{booking.status}</Badge>
 </div>
 ))}
 </CardContent>
 </Card>
 )}

 {/* AI Strategy Report */}
 <Card>
 <CardHeader>
 <div className="flex items-center justify-between">
 <div>
 <CardTitle className="flex items-center gap-2">
 <span className="h-5 w-5" aria-hidden="true">🧠</span>
 AI Strategy Report
 </CardTitle>
 <CardDescription>
 Data-driven recommendations based on your business performance
 </CardDescription>
 </div>
 <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={isGenerating || reportLoading}>
 <RefreshCw className={`h-4 w-4 mr-1 ${isGenerating ?'animate-spin' :''}`} />
 {aiReport ?'Refresh' :'Generate'}
 </Button>
 </div>
 </CardHeader>
 <CardContent>
 {reportLoading ? (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="h-8 w-8 animate-spin text-primary" />
 </div>
 ) : aiReport ? (
 <div className="space-y-6">
 <p className="text-xs text-muted-foreground">
 Generated: {new Date(aiReport.generated_at).toLocaleString()}
 </p>

 {/* Summary */}
 <div className="p-4 rounded-lg bg-muted border">
 <p className="text-sm">{aiReport.summary}</p>
 </div>

 {/* Strengths */}
 <div>
 <h4 className="font-semibold mb-3 flex items-center gap-2">
 <CheckCircle2 className="h-4 w-4 text-success" />
 Key Strengths
 </h4>
 <div className="space-y-2">
 {aiReport.strengths.map((s, i) => (
 <p key={i} className="text-sm pl-6">• {s}</p>
 ))}
 </div>
 </div>

 {/* Opportunities */}
 <div>
 <h4 className="font-semibold mb-3 flex items-center gap-2">
 <span className="h-4 w-4 text-warning" aria-hidden="true">💡</span>
 Growth Opportunities
 </h4>
 <div className="space-y-2">
 {aiReport.opportunities.map((o, i) => (
 <p key={i} className="text-sm pl-6">• {o}</p>
 ))}
 </div>
 </div>

 {/* Action Items */}
 <div>
 <h4 className="font-semibold mb-3 flex items-center gap-2">
 <span className="h-4 w-4 text-primary" aria-hidden="true">🎯</span>
 Recommended Actions
 </h4>
 <div className="space-y-3">
 {aiReport.actionItems.map((item, i) => (
 <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
 <Badge variant="outline" className={getPriorityColor(item.priority)}>
 {item.priority}
 </Badge>
 <div className="flex-1">
 <p className="text-sm font-medium">{item.action}</p>
 <p className="text-xs text-muted-foreground mt-1">Timeline: {item.timeline}</p>
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* Projected Impact */}
 <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
 <h4 className="font-semibold mb-2 flex items-center gap-2">
 <span className="h-4 w-4" aria-hidden="true">📄</span>
 Projected Impact
 </h4>
 <p className="text-sm">{aiReport.projectedImpact}</p>
 </div>
 </div>
 ) : (
 <div className="text-center py-8">
 <span className="h-12 w-12 text-muted-foreground mx-auto mb-4" aria-hidden="true">🧠</span>
 <p className="text-muted-foreground mb-4">
 Click"Generate" to create your personalized AI strategy report based on your business data.
 </p>
 </div>
 )}
 </CardContent>
 </Card>

 <ConsultationScheduleDialog
 open={scheduleOpen}
 onOpenChange={setScheduleOpen}
 merchantName={merchantData?.business_name}
 />
 </div>
 );
}
