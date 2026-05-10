import { useQuery } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { GradientCard } from"@/components/ui/gradient-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { Button } from"@/components/ui/button";
import { Loader2, MessageCircle, Mail, Phone, Monitor, CalendarCheck, AlertTriangle, CheckCircle, ArrowRight, Zap } from "lucide-react";
import { useState } from"react";
import { toast } from"sonner";

interface SupportDashboard {
 generated_at: string;
 merchant_name: string;
 subscription_status: {
 active: boolean;
 expires_at: string | null;
 days_remaining: number | null;
 };
 metrics: {
 total_tickets: number;
 resolved_tickets: number;
 avg_response_time: string;
 satisfaction_rating: number;
 priority_level: string;
 dedicated_agent: string;
 agent_availability: string;
 next_check_in: string;
 };
 recent_interactions: {
 id: string;
 type: string;
 subject: string;
 status: string;
 created_at: string;
 resolved_at: string;
 response_time: string;
 }[];
 support_features: {
 name: string;
 description: string;
 status: string;
 icon: string;
 }[];
 knowledge_base: {
 title: string;
 category: string;
 read_time: string;
 relevance: string;
 }[];
 quick_actions: {
 action: string;
 description: string;
 cta: string;
 priority: string;
 }[];
}

const iconMap: Record<string, any> = {
'message-circle': MessageCircle,
'mail': Mail,
'phone': Phone,
'monitor': Monitor,
'calendar-check': CalendarCheck,
'alert-triangle': AlertTriangle,
};

export function PrioritySupportWidget() {
 const [activeChat, setActiveChat] = useState(false);

 const { data, isLoading } = useQuery({
 queryKey: ['priority-support-dashboard'],
 queryFn: async () => {
 const { data, error } = await supabase.functions.invoke('priority-support-dashboard');
 if (error) throw error;
 return data as { has_access: boolean; dashboard?: SupportDashboard; message?: string };
 }
 });

 const handleStartChat = () => {
 setActiveChat(true);
 toast.success('Connecting to support agent...', {
 description:'A priority support agent will be with you shortly.',
 });
 };

 const handleScheduleCall = () => {
 toast.success('Opening calendar...', {
 description:'Select a time slot for your strategy call.',
 });
 };

 if (isLoading) {
 return (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="h-8 w-8 animate-spin text-primary" />
 </div>
 );
 }

 if (!data?.has_access) {
 return (
 <Card className="border-dashed">
 <CardContent className="py-12 text-center">
 <span className="h-12 w-12 text-muted-foreground mx-auto mb-4" aria-hidden="true">🎧</span>
 <h3 className="font-semibold mb-2">Priority Merchant Support</h3>
 <p className="text-muted-foreground text-sm max-w-md mx-auto">
 {data?.message ||'This premium feature must be assigned by an admin. Get 24/7 dedicated support with priority response times.'}
 </p>
 </CardContent>
 </Card>
 );
 }

 const dashboard = data.dashboard!;
 const { metrics, recent_interactions, support_features, knowledge_base, quick_actions, subscription_status } = dashboard;

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div>
 <h2 className="text-2xl font-bold flex items-center gap-2">
 <span className="h-6 w-6 text-primary" aria-hidden="true">🎧</span>
 Priority Support
 </h2>
 <p className="text-muted-foreground">
 Your dedicated 24/7 support channel with premium response times
 </p>
 </div>
 <div className="flex items-center gap-2">
 <Badge className="bg-success/10 text-success border-success/20">
 <span className="w-2 h-2 rounded-full bg-success animate-pulse mr-1.5" />
 Support Active
 </Badge>
 <Badge className="bg-gradient-to-r from-primary to-primary/60 gap-1">
 <span className="h-3 w-3" aria-hidden="true">👑</span> Premium
 </Badge>
 </div>
 </div>

 {/* Quick Action Bar */}
 <GradientCard gradient className="flex flex-col md:flex-row items-center justify-between gap-4">
 <div className="flex items-center gap-4">
 <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
 <span className="h-7 w-7 text-primary" aria-hidden="true">👤</span>
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Your Dedicated Agent</p>
 <p className="text-xl font-bold">{metrics.dedicated_agent}</p>
 <p className="text-sm text-success">Available {metrics.agent_availability}</p>
 </div>
 </div>
 <div className="flex gap-2">
 <Button onClick={handleStartChat} className="gap-2">
 <span className="h-4 w-4" aria-hidden="true">💬</span>
 Start Chat
 </Button>
 <Button variant="outline" onClick={handleScheduleCall} className="gap-2">
 <span className="h-4 w-4" aria-hidden="true">📞</span>
 Schedule Call
 </Button>
 </div>
 </GradientCard>

 {/* Metrics Row */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <Card>
 <CardContent className="pt-4">
 <div className="flex items-center gap-3">
 <div className="p-2 rounded-lg bg-info/10">
 <span className="h-5 w-5 text-info" aria-hidden="true">⏰</span>
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Avg Response</p>
 <p className="text-xl font-bold">{metrics.avg_response_time}</p>
 </div>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardContent className="pt-4">
 <div className="flex items-center gap-3">
 <div className="p-2 rounded-lg bg-success/10">
 <CheckCircle className="h-5 w-5 text-success" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Resolved</p>
 <p className="text-xl font-bold">{metrics.resolved_tickets}/{metrics.total_tickets}</p>
 </div>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardContent className="pt-4">
 <div className="flex items-center gap-3">
 <div className="p-2 rounded-lg bg-warning/10">
 <span className="h-5 w-5 text-warning" aria-hidden="true">⭐</span>
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Satisfaction</p>
 <p className="text-xl font-bold">{metrics.satisfaction_rating}/5</p>
 </div>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardContent className="pt-4">
 <div className="flex items-center gap-3">
 <div className="p-2 rounded-lg bg-accent/10">
 <span className="h-5 w-5 text-accent" aria-hidden="true">📅</span>
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Next Check-in</p>
 <p className="text-xl font-bold">
 {new Date(metrics.next_check_in).toLocaleDateString('en-US', { month:'short', day:'numeric' })}
 </p>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>

 <Tabs defaultValue="features" className="space-y-6">
 <TabsList className="grid grid-cols-4 w-full max-w-lg">
 <TabsTrigger value="features">Features</TabsTrigger>
 <TabsTrigger value="history">History</TabsTrigger>
 <TabsTrigger value="knowledge">Resources</TabsTrigger>
 <TabsTrigger value="actions">Actions</TabsTrigger>
 </TabsList>

 {/* Features Tab */}
 <TabsContent value="features" className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {support_features.map((feature, idx) => {
 const IconComponent = iconMap[feature.icon] || Zap;
 return (
 <Card key={idx} className="hover:border-primary transition-colors">
 <CardContent className="pt-4">
 <div className="flex items-start gap-3">
 <div className="p-2 rounded-lg bg-primary/10">
 <IconComponent className="h-5 w-5 text-primary" />
 </div>
 <div className="flex-1">
 <div className="flex items-center justify-between">
 <h4 className="font-semibold">{feature.name}</h4>
 <Badge variant="outline" className="bg-success/10 text-success text-xs">
 Available
 </Badge>
 </div>
 <p className="text-sm text-muted-foreground mt-1">{feature.description}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 );
 })}
 </div>
 </TabsContent>

 {/* History Tab */}
 <TabsContent value="history" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>Recent Support Interactions</CardTitle>
 <CardDescription>Your support history and resolution times</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 {recent_interactions.map((interaction) => (
 <div key={interaction.id} className="flex items-center justify-between p-4 border rounded-lg">
 <div className="flex items-center gap-4">
 <div className={`p-2 rounded-lg ${
 interaction.type ==='chat' ?'bg-info/10' :
 interaction.type ==='email' ?'bg-accent/10' :'bg-success/10'
 }`}>
 {interaction.type ==='chat' ? <span className="h-5 w-5 text-info" aria-hidden="true">💬</span> :
 interaction.type ==='email' ? <span className="h-5 w-5 text-accent" aria-hidden="true">📧</span> :
 <span className="h-5 w-5 text-success" aria-hidden="true">📞</span>}
 </div>
 <div>
 <p className="font-medium">{interaction.subject}</p>
 <p className="text-sm text-muted-foreground">
 {new Date(interaction.created_at).toLocaleDateString()}
 </p>
 </div>
 </div>
 <div className="text-right">
 <Badge variant="outline" className="bg-success/10 text-success">
 {interaction.status}
 </Badge>
 <p className="text-sm text-muted-foreground mt-1">
 Resolved in {interaction.response_time}
 </p>
 </div>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 {/* Knowledge Base Tab */}
 <TabsContent value="knowledge" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <span className="h-5 w-5" aria-hidden="true">📖</span>
 Curated Resources
 </CardTitle>
 <CardDescription>Articles selected for your business type</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="space-y-3">
 {knowledge_base.map((article, idx) => (
 <div key={idx} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted cursor-pointer transition-colors">
 <div>
 <p className="font-medium">{article.title}</p>
 <div className="flex items-center gap-2 mt-1">
 <Badge variant="outline" className="text-xs">{article.category}</Badge>
 <span className="text-sm text-muted-foreground">{article.read_time}</span>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <Badge className={
 article.relevance ==='High' ?'bg-success/10 text-success' :'bg-info/10 text-info'
 }>
 {article.relevance}
 </Badge>
 <ArrowRight className="h-4 w-4 text-muted-foreground" />
 </div>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 {/* Quick Actions Tab */}
 <TabsContent value="actions" className="space-y-4">
 <div className="grid gap-4">
 {quick_actions.map((action, idx) => (
 <Card key={idx} className={action.priority ==='recommended' ?'border-primary' :''}>
 <CardContent className="pt-4">
 <div className="flex items-center justify-between">
 <div>
 <div className="flex items-center gap-2">
 <h4 className="font-semibold">{action.action}</h4>
 {action.priority ==='recommended' && (
 <Badge className="bg-primary/10 text-primary">Recommended</Badge>
 )}
 </div>
 <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
 </div>
 <Button variant={action.priority ==='recommended' ?'default' :'outline'}>
 {action.cta}
 </Button>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 </TabsContent>
 </Tabs>

 {/* Subscription Status Footer */}
 {subscription_status.days_remaining && (
 <Card className="bg-muted/30">
 <CardContent className="pt-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <span className="h-5 w-5 text-primary" aria-hidden="true">👑</span>
 <span className="text-sm text-muted-foreground">
 Priority Support active • {subscription_status.days_remaining} days remaining
 </span>
 </div>
 <Button variant="outline" size="sm">Renew Subscription</Button>
 </div>
 </CardContent>
 </Card>
 )}
 </div>
 );
}
