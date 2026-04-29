import { useState } from'react';
import { useQuery, useMutation, useQueryClient } from'@tanstack/react-query';
import { supabase } from'@/integrations/supabase/client';
import { Card, CardContent } from'@/components/ui/card';
import { Badge } from'@/components/ui/badge';
import { Button } from'@/components/ui/button';
import { Textarea } from'@/components/ui/textarea';
import { Input } from'@/components/ui/input';
import { Label } from'@/components/ui/label';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
} from'@/components/ui/dialog';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from'@/components/ui/select';
import { toast } from'sonner';
import { format } from'date-fns';
import {
 Ticket, Clock, CheckCircle, AlertCircle, MessageSquare, Send, Eye, Loader2,
 Bug, CreditCard, UserCog, Lightbulb, HelpCircle, AlertTriangle, Search, User
} from'lucide-react';
import { LoadingSpinner } from'@/components/LoadingSpinner';

const STATUS_CONFIG: Record<string, { label: string; variant:'default' |'secondary' |'destructive' |'outline'; icon: typeof Clock }> = {
 open: { label:'Open', variant:'destructive', icon: AlertCircle },
 in_progress: { label:'In Progress', variant:'default', icon: Clock },
 awaiting_response: { label:'Awaiting Response', variant:'secondary', icon: MessageSquare },
 resolved: { label:'Resolved', variant:'outline', icon: CheckCircle },
 closed: { label:'Closed', variant:'outline', icon: CheckCircle },
};

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
 low: { label:'Low', className:'bg-muted text-muted-foreground' },
 medium: { label:'Medium', className:'bg-primary/10 text-primary' },
 high: { label:'High', className:'bg-warning/10 text-warning' },
 urgent: { label:'Urgent', className:'bg-destructive/10 text-destructive' },
};

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Bug }> = {
 technical_issue: { label:'Technical Issue', icon: Bug },
 billing_payments: { label:'Billing & Payments', icon: CreditCard },
 account_profile: { label:'Account & Profile', icon: UserCog },
 feature_request: { label:'Feature Request', icon: Lightbulb },
 general: { label:'General', icon: HelpCircle },
 other: { label:'Other', icon: AlertTriangle },
};

const SUBMITTER_LABELS: Record<string, string> = {
 pet_owner:'Pet Owner',
 merchant:'Merchant',
 vet:'Vet',
};

export const SupportTicketsTab = () => {
 const queryClient = useQueryClient();
 const [selectedTicket, setSelectedTicket] = useState<any>(null);
 const [filterStatus, setFilterStatus] = useState('all');
 const [filterCategory, setFilterCategory] = useState('all');
 const [filterPriority, setFilterPriority] = useState('all');
 const [searchQuery, setSearchQuery] = useState('');
 const [adminReply, setAdminReply] = useState('');
 const [resolutionNotes, setResolutionNotes] = useState('');

 const { data: tickets, isLoading } = useQuery({
 queryKey: ['admin-support-tickets', filterStatus, filterCategory, filterPriority],
 queryFn: async () => {
 let query = supabase
 .from('support_tickets')
 .select('*')
 .order('created_at', { ascending: false });

 if (filterStatus !=='all') query = query.eq('status', filterStatus as any);
 if (filterCategory !=='all') query = query.eq('category', filterCategory as any);
 if (filterPriority !=='all') query = query.eq('priority', filterPriority as any);

 const { data, error } = await query;
 if (error) throw error;
 return data;
 },
 });

 const { data: ticketReplies, isLoading: repliesLoading } = useQuery({
 queryKey: ['admin-ticket-replies', selectedTicket?.id],
 queryFn: async () => {
 if (!selectedTicket) return [];
 const { data, error } = await supabase
 .from('support_ticket_replies')
 .select('*')
 .eq('ticket_id', selectedTicket.id)
 .order('created_at', { ascending: true });
 if (error) throw error;
 return data;
 },
 enabled: !!selectedTicket,
 });

 const updateTicketMutation = useMutation({
 mutationFn: async ({ id, updates, ticket }: { id: string; updates: Record<string, unknown>; ticket?: any }) => {
 const oldStatus = ticket?.status;
 const { error } = await supabase
 .from('support_tickets')
 .update(updates)
 .eq('id', id);
 if (error) throw error;

 // Send status change notification if status changed
 if (ticket && updates.status && updates.status !== oldStatus) {
 supabase.functions.invoke('send-support-ticket-notification', {
 body: {
 type:'status_changed',
 ticketId: id,
 ticketNumber: ticket.ticket_number,
 ticketSubject: ticket.subject,
 newStatus: updates.status,
 oldStatus: oldStatus,
 resolutionNotes: updates.resolution_notes || undefined,
 },
 }).catch((err) => console.error('Notification error:', err));
 }
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
 toast.success('Ticket updated');
 },
 onError: () => toast.error('Failed to update ticket'),
 });

 const replyMutation = useMutation({
 mutationFn: async (message: string) => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) throw new Error('Not authenticated');

 const { error } = await supabase
 .from('support_ticket_replies')
 .insert({
 ticket_id: selectedTicket.id,
 user_id: user.id,
 is_admin_reply: true,
 message: message.trim(),
 });
 if (error) throw error;

 // Set status to awaiting_response if currently open
 if (selectedTicket.status ==='open' || selectedTicket.status ==='in_progress') {
 await supabase
 .from('support_tickets')
 .update({ status:'awaiting_response' })
 .eq('id', selectedTicket.id);
 }

 // Notify ticket owner about admin reply (fire-and-forget)
 supabase.functions.invoke('send-support-ticket-notification', {
 body: {
 type:'admin_reply',
 ticketId: selectedTicket.id,
 ticketNumber: selectedTicket.ticket_number,
 ticketSubject: selectedTicket.subject,
 replyMessage: message.trim(),
 },
 }).catch((err) => console.error('Notification error:', err));
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['admin-ticket-replies', selectedTicket?.id] });
 queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
 setAdminReply('');
 toast.success('Reply sent');
 },
 onError: () => toast.error('Failed to send reply'),
 });

 const handleStatusChange = (ticket: any, newStatus: string) => {
 const updates: Record<string, unknown> = { status: newStatus };
 if (newStatus ==='resolved') {
 updates.resolved_at = new Date().toISOString();
 if (resolutionNotes.trim()) updates.resolution_notes = resolutionNotes.trim();
 }
 updateTicketMutation.mutate({ id: ticket.id, updates, ticket });
 };

 const handleResolve = () => {
 if (!selectedTicket) return;
 handleStatusChange(selectedTicket,'resolved');
 setSelectedTicket(null);
 setResolutionNotes('');
 };

 const filteredTickets = tickets?.filter(t => {
 if (!searchQuery.trim()) return true;
 const q = searchQuery.toLowerCase();
 return (
 t.subject?.toLowerCase().includes(q) ||
 t.ticket_number?.toLowerCase().includes(q) ||
 t.description?.toLowerCase().includes(q)
 );
 });

 // Status counts
 const counts = {
 open: tickets?.filter(t => t.status ==='open').length || 0,
 in_progress: tickets?.filter(t => t.status ==='in_progress').length || 0,
 awaiting: tickets?.filter(t => t.status ==='awaiting_response').length || 0,
 resolved: tickets?.filter(t => t.status ==='resolved').length || 0,
 };

 return (
 <div className="space-y-6">
 <div>
 <h2 className="text-2xl font-bold">Support Tickets</h2>
 <p className="text-muted-foreground">Manage support tickets from merchants, vets, and pet owners</p>
 </div>

 {/* Summary Cards */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><AlertCircle className="h-4 w-4 text-destructive" /><span className="text-sm text-muted-foreground">Open</span></div><p className="text-2xl font-bold">{counts.open}</p></CardContent></Card>
 <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /><span className="text-sm text-muted-foreground">In Progress</span></div><p className="text-2xl font-bold">{counts.in_progress}</p></CardContent></Card>
 <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Awaiting</span></div><p className="text-2xl font-bold">{counts.awaiting}</p></CardContent></Card>
 <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-success" /><span className="text-sm text-muted-foreground">Resolved</span></div><p className="text-2xl font-bold">{counts.resolved}</p></CardContent></Card>
 </div>

 {/* Filters */}
 <div className="flex flex-wrap gap-3 items-center">
 <div className="relative flex-1 min-w-[200px]">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
 <Input placeholder="Search tickets..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
 </div>
 <Select value={filterStatus} onValueChange={setFilterStatus}>
 <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Status</SelectItem>
 {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
 </SelectContent>
 </Select>
 <Select value={filterCategory} onValueChange={setFilterCategory}>
 <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Categories</SelectItem>
 {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
 </SelectContent>
 </Select>
 <Select value={filterPriority} onValueChange={setFilterPriority}>
 <SelectTrigger className="w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Priority</SelectItem>
 {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>

 {/* Ticket List */}
 {isLoading ? (
 <div className="flex justify-center py-12"><LoadingSpinner text="Loading tickets..." /></div>
 ) : !filteredTickets?.length ? (
 <Card><CardContent className="py-12 text-center"><Ticket className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">No tickets found</p></CardContent></Card>
 ) : (
 <div className="space-y-3">
 {filteredTickets.map(ticket => {
 const statusCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
 const priorityCfg = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium;
 const categoryCfg = CATEGORY_CONFIG[ticket.category] || CATEGORY_CONFIG.general;
 const CategoryIcon = categoryCfg.icon;

 return (
 <Card key={ticket.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => { setSelectedTicket(ticket); setResolutionNotes(ticket.resolution_notes ||''); }}>
 <CardContent className="p-4">
 <div className="flex items-start justify-between gap-4">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 <span className="text-xs font-mono text-muted-foreground">{ticket.ticket_number}</span>
 <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
 <span className={`text-xs px-2 py-0.5 rounded-full ${priorityCfg.className}`}>{priorityCfg.label}</span>
 <span className="text-xs flex items-center gap-1 text-muted-foreground"><CategoryIcon className="w-3 h-3" />{categoryCfg.label}</span>
 <Badge variant="outline" className="text-xs"><User className="w-3 h-3 mr-1" />{SUBMITTER_LABELS[ticket.submitter_type] || ticket.submitter_type}</Badge>
 </div>
 <p className="font-medium text-sm truncate">{ticket.subject}</p>
 <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{ticket.description}</p>
 <p className="text-xs text-muted-foreground mt-1">{format(new Date(ticket.created_at),'MMM d, yyyy h:mm a')}</p>
 </div>
 <div className="flex items-center gap-2">
 <Select value={ticket.status} onValueChange={(v) => { handleStatusChange(ticket, v); }}>
 <SelectTrigger className="w-36" onClick={e => e.stopPropagation()}><SelectValue /></SelectTrigger>
 <SelectContent>
 {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
 </SelectContent>
 </Select>
 <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedTicket(ticket); setResolutionNotes(ticket.resolution_notes ||''); }}>
 <Eye className="w-4 h-4" />
 </Button>
 </div>
 </div>
 </CardContent>
 </Card>
 );
 })}
 </div>
 )}

 {/* Detail Dialog */}
 <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
 <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2 flex-wrap">
 <span className="font-mono text-sm text-muted-foreground">{selectedTicket?.ticket_number}</span>
 {selectedTicket && <Badge variant={STATUS_CONFIG[selectedTicket.status]?.variant}>{STATUS_CONFIG[selectedTicket.status]?.label}</Badge>}
 {selectedTicket && <Badge variant="outline"><User className="w-3 h-3 mr-1" />{SUBMITTER_LABELS[selectedTicket.submitter_type]}</Badge>}
 </DialogTitle>
 </DialogHeader>

 {selectedTicket && (
 <div className="space-y-4">
 <div>
 <h3 className="font-semibold text-lg">{selectedTicket.subject}</h3>
 <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-muted-foreground">
 <span>{CATEGORY_CONFIG[selectedTicket.category]?.label}</span>
 <span>•</span>
 <span className={`px-2 py-0.5 rounded-full ${PRIORITY_CONFIG[selectedTicket.priority]?.className}`}>
 {PRIORITY_CONFIG[selectedTicket.priority]?.label} Priority
 </span>
 {selectedTicket.affected_feature && <><span>•</span><span>{selectedTicket.affected_feature}</span></>}
 </div>
 </div>

 <Card className="bg-muted/30">
 <CardContent className="p-4">
 <p className="text-sm whitespace-pre-wrap">{selectedTicket.description}</p>
 </CardContent>
 </Card>

 {selectedTicket.steps_to_reproduce && (
 <div className="text-sm"><p className="font-medium text-muted-foreground mb-1">Steps to Reproduce:</p><p className="whitespace-pre-wrap">{selectedTicket.steps_to_reproduce}</p></div>
 )}

 {(selectedTicket.expected_behavior || selectedTicket.actual_behavior) && (
 <div className="grid grid-cols-2 gap-4 text-sm">
 {selectedTicket.expected_behavior && <div><p className="font-medium text-muted-foreground mb-1">Expected:</p><p>{selectedTicket.expected_behavior}</p></div>}
 {selectedTicket.actual_behavior && <div><p className="font-medium text-muted-foreground mb-1">Actual:</p><p>{selectedTicket.actual_behavior}</p></div>}
 </div>
 )}

 {selectedTicket.browser_info && (
 <p className="text-xs text-muted-foreground bg-muted rounded p-2 font-mono break-all">{selectedTicket.browser_info}</p>
 )}

 {/* Replies */}
 <div className="border-t pt-4">
 <p className="text-sm font-semibold mb-3 flex items-center gap-2"><MessageSquare className="w-4 h-4" />Conversation</p>
 {repliesLoading ? (
 <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin" /></div>
 ) : !ticketReplies?.length ? (
 <p className="text-sm text-muted-foreground py-2">No replies yet</p>
 ) : (
 <div className="space-y-3 max-h-60 overflow-y-auto">
 {ticketReplies.map(reply => (
 <div key={reply.id} className={`rounded-lg p-3 text-sm ${reply.is_admin_reply ?'bg-primary/5 border border-primary/20 ml-4' :'bg-muted mr-4'}`}>
 <div className="flex items-center gap-2 mb-1">
 <span className="font-medium text-xs">{reply.is_admin_reply ?'🛡️ Admin' :'👤 User'}</span>
 <span className="text-xs text-muted-foreground">{format(new Date(reply.created_at),'MMM d, h:mm a')}</span>
 </div>
 <p className="whitespace-pre-wrap">{reply.message}</p>
 </div>
 ))}
 </div>
 )}

 <div className="mt-3 space-y-2">
 <Label className="text-sm">Admin Reply</Label>
 <div className="flex gap-2">
 <Textarea placeholder="Type admin reply..." value={adminReply} onChange={e => setAdminReply(e.target.value)} rows={2} className="resize-none" />
 <Button onClick={() => replyMutation.mutate(adminReply)} disabled={!adminReply.trim() || replyMutation.isPending} size="icon" className="shrink-0 self-end">
 <Send className="w-4 h-4" />
 </Button>
 </div>
 </div>
 </div>

 {/* Resolution */}
 <div className="border-t pt-4 space-y-3">
 <Label className="text-sm">Resolution Notes</Label>
 <Textarea placeholder="Add resolution notes..." value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} rows={2} className="resize-none" />

 <div className="flex items-center justify-between">
 <Select value={selectedTicket.status} onValueChange={v => { handleStatusChange(selectedTicket, v); setSelectedTicket({ ...selectedTicket, status: v }); }}>
 <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
 <SelectContent>
 {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
 </SelectContent>
 </Select>
 <div className="flex gap-2">
 <Button variant="outline" onClick={() => setSelectedTicket(null)}>Close</Button>
 <Button onClick={handleResolve} variant="default" className="bg-success hover:bg-success">
 <CheckCircle className="w-4 h-4 mr-2" />
 Mark Resolved
 </Button>
 </div>
 </div>
 </div>

 <p className="text-xs text-muted-foreground">Submitted {format(new Date(selectedTicket.created_at),"MMMM d, yyyy'at' h:mm a")}</p>
 </div>
 )}
 </DialogContent>
 </Dialog>
 </div>
 );
};
