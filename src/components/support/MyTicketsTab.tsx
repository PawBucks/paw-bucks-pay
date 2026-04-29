import { useState } from'react';
import { useQuery, useMutation, useQueryClient } from'@tanstack/react-query';
import { supabase } from'@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from'@/components/ui/card';
import { Badge } from'@/components/ui/badge';
import { Button } from'@/components/ui/button';
import { Textarea } from'@/components/ui/textarea';
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
import { Ticket, Clock, CheckCircle, AlertCircle, MessageSquare, Send, Eye, Loader2 } from'lucide-react';
import { LoadingSpinner } from'@/components/LoadingSpinner';

const STATUS_CONFIG: Record<string, { label: string; variant:'default' |'secondary' |'destructive' |'outline' }> = {
 open: { label:'Open', variant:'destructive' },
 in_progress: { label:'In Progress', variant:'default' },
 awaiting_response: { label:'Awaiting Response', variant:'secondary' },
 resolved: { label:'Resolved', variant:'outline' },
 closed: { label:'Closed', variant:'outline' },
};

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
 low: { label:'Low', className:'bg-muted text-muted-foreground' },
 medium: { label:'Medium', className:'bg-primary/10 text-primary' },
 high: { label:'High', className:'bg-warning/10 text-warning' },
 urgent: { label:'Urgent', className:'bg-destructive/10 text-destructive' },
};

const CATEGORY_LABELS: Record<string, string> = {
 technical_issue:'Technical Issue',
 billing_payments:'Billing & Payments',
 account_profile:'Account & Profile',
 feature_request:'Feature Request',
 general:'General',
 other:'Other',
};

export const MyTicketsTab = () => {
 const queryClient = useQueryClient();
 const [selectedTicket, setSelectedTicket] = useState<any>(null);
 const [replyMessage, setReplyMessage] = useState('');
 const [filterStatus, setFilterStatus] = useState('all');

 const { data: tickets, isLoading } = useQuery({
 queryKey: ['my-support-tickets', filterStatus],
 queryFn: async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) throw new Error('Not authenticated');

 let query = supabase
 .from('support_tickets')
 .select('*')
 .eq('user_id', user.id)
 .order('created_at', { ascending: false });

 if (filterStatus !=='all') {
 query = query.eq('status', filterStatus as any);
 }

 const { data, error } = await query;
 if (error) throw error;
 return data;
 },
 });

 const { data: ticketReplies, isLoading: repliesLoading } = useQuery({
 queryKey: ['ticket-replies', selectedTicket?.id],
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

 const replyMutation = useMutation({
 mutationFn: async (message: string) => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) throw new Error('Not authenticated');

 // Get user name for notification
 const { data: profile } = await supabase
 .from('profiles')
 .select('full_name')
 .eq('id', user.id)
 .single();

 const { error } = await supabase
 .from('support_ticket_replies')
 .insert({
 ticket_id: selectedTicket.id,
 user_id: user.id,
 is_admin_reply: false,
 message: message.trim(),
 });
 if (error) throw error;

 // Notify admins about user reply (fire-and-forget)
 supabase.functions.invoke('send-support-ticket-notification', {
 body: {
 type:'user_reply',
 ticketId: selectedTicket.id,
 ticketNumber: selectedTicket.ticket_number,
 ticketSubject: selectedTicket.subject,
 replyMessage: message.trim(),
 senderName: profile?.full_name ||'User',
 submitterType: selectedTicket.submitter_type,
 },
 }).catch((err) => console.error('Notification error:', err));
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['ticket-replies', selectedTicket?.id] });
 setReplyMessage('');
 toast.success('Reply sent');
 },
 onError: () => toast.error('Failed to send reply'),
 });

 const handleSendReply = () => {
 if (!replyMessage.trim()) return;
 replyMutation.mutate(replyMessage);
 };

 const openCount = tickets?.filter(t => t.status ==='open' || t.status ==='in_progress' || t.status ==='awaiting_response').length || 0;

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between flex-wrap gap-4">
 <div>
 <h3 className="text-lg font-semibold flex items-center gap-2">
 <Ticket className="w-5 h-5 text-primary" />
 My Support Tickets
 </h3>
 <p className="text-sm text-muted-foreground">
 {openCount > 0 ? `${openCount} open ticket${openCount > 1 ?'s' :''}` :'No open tickets'}
 </p>
 </div>
 <Select value={filterStatus} onValueChange={setFilterStatus}>
 <SelectTrigger className="w-40">
 <SelectValue placeholder="Filter..." />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Tickets</SelectItem>
 <SelectItem value="open">Open</SelectItem>
 <SelectItem value="in_progress">In Progress</SelectItem>
 <SelectItem value="awaiting_response">Awaiting Response</SelectItem>
 <SelectItem value="resolved">Resolved</SelectItem>
 <SelectItem value="closed">Closed</SelectItem>
 </SelectContent>
 </Select>
 </div>

 {isLoading ? (
 <div className="flex justify-center py-12"><LoadingSpinner text="Loading tickets..." /></div>
 ) : !tickets?.length ? (
 <Card>
 <CardContent className="py-12 text-center">
 <Ticket className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
 <p className="text-muted-foreground">No tickets found</p>
 <p className="text-sm text-muted-foreground mt-1">Submit a ticket above to get help</p>
 </CardContent>
 </Card>
 ) : (
 <div className="space-y-3">
 {tickets.map(ticket => {
 const statusCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
 const priorityCfg = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium;

 return (
 <Card key={ticket.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedTicket(ticket)}>
 <CardContent className="p-4">
 <div className="flex items-start justify-between gap-4">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 <span className="text-xs font-mono text-muted-foreground">{ticket.ticket_number}</span>
 <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
 <span className={`text-xs px-2 py-0.5 rounded-full ${priorityCfg.className}`}>
 {priorityCfg.label}
 </span>
 <span className="text-xs text-muted-foreground">
 {CATEGORY_LABELS[ticket.category] || ticket.category}
 </span>
 </div>
 <p className="font-medium text-sm truncate">{ticket.subject}</p>
 <p className="text-xs text-muted-foreground mt-1">
 {format(new Date(ticket.created_at),'MMM d, yyyy h:mm a')}
 </p>
 </div>
 <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedTicket(ticket); }}>
 <Eye className="w-4 h-4" />
 </Button>
 </div>
 </CardContent>
 </Card>
 );
 })}
 </div>
 )}

 {/* Ticket Detail Dialog */}
 <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
 <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <span className="font-mono text-sm text-muted-foreground">{selectedTicket?.ticket_number}</span>
 {selectedTicket && <Badge variant={STATUS_CONFIG[selectedTicket.status]?.variant}>{STATUS_CONFIG[selectedTicket.status]?.label}</Badge>}
 </DialogTitle>
 </DialogHeader>

 {selectedTicket && (
 <div className="space-y-4">
 <div>
 <h3 className="font-semibold">{selectedTicket.subject}</h3>
 <div className="flex items-center gap-2 mt-1 flex-wrap">
 <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[selectedTicket.category]}</span>
 <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_CONFIG[selectedTicket.priority]?.className}`}>
 {PRIORITY_CONFIG[selectedTicket.priority]?.label} Priority
 </span>
 {selectedTicket.affected_feature && (
 <span className="text-xs text-muted-foreground">• {selectedTicket.affected_feature}</span>
 )}
 </div>
 </div>

 <Card className="bg-muted/30">
 <CardContent className="p-4">
 <p className="text-sm whitespace-pre-wrap">{selectedTicket.description}</p>
 </CardContent>
 </Card>

 {selectedTicket.steps_to_reproduce && (
 <div className="text-sm">
 <p className="font-medium text-muted-foreground mb-1">Steps to Reproduce:</p>
 <p className="whitespace-pre-wrap">{selectedTicket.steps_to_reproduce}</p>
 </div>
 )}

 {(selectedTicket.expected_behavior || selectedTicket.actual_behavior) && (
 <div className="grid grid-cols-2 gap-4 text-sm">
 {selectedTicket.expected_behavior && (
 <div>
 <p className="font-medium text-muted-foreground mb-1">Expected:</p>
 <p>{selectedTicket.expected_behavior}</p>
 </div>
 )}
 {selectedTicket.actual_behavior && (
 <div>
 <p className="font-medium text-muted-foreground mb-1">Actual:</p>
 <p>{selectedTicket.actual_behavior}</p>
 </div>
 )}
 </div>
 )}

 {selectedTicket.resolution_notes && (
 <Card className="border-success/20 bg-success/10">
 <CardContent className="p-4">
 <p className="text-sm font-medium text-success mb-1">Resolution:</p>
 <p className="text-sm">{selectedTicket.resolution_notes}</p>
 </CardContent>
 </Card>
 )}

 {/* Replies Thread */}
 <div className="border-t pt-4">
 <p className="text-sm font-semibold mb-3 flex items-center gap-2">
 <MessageSquare className="w-4 h-4" />
 Conversation
 </p>

 {repliesLoading ? (
 <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin" /></div>
 ) : !ticketReplies?.length ? (
 <p className="text-sm text-muted-foreground py-2">No replies yet</p>
 ) : (
 <div className="space-y-3 max-h-60 overflow-y-auto">
 {ticketReplies.map(reply => (
 <div key={reply.id} className={`rounded-lg p-3 text-sm ${reply.is_admin_reply ?'bg-primary/5 border border-primary/20 ml-4' :'bg-muted mr-4'}`}>
 <div className="flex items-center gap-2 mb-1">
 <span className="font-medium text-xs">
 {reply.is_admin_reply ?'🛡️ Support Team' :'You'}
 </span>
 <span className="text-xs text-muted-foreground">
 {format(new Date(reply.created_at),'MMM d, h:mm a')}
 </span>
 </div>
 <p className="whitespace-pre-wrap">{reply.message}</p>
 </div>
 ))}
 </div>
 )}

 {/* Reply input - only for non-closed/resolved */}
 {selectedTicket.status !=='closed' && selectedTicket.status !=='resolved' && (
 <div className="flex gap-2 mt-3">
 <Textarea
 placeholder="Type a reply..."
 value={replyMessage}
 onChange={(e) => setReplyMessage(e.target.value)}
 rows={2}
 className="resize-none"
 />
 <Button onClick={handleSendReply} disabled={!replyMessage.trim() || replyMutation.isPending} size="icon" className="shrink-0 self-end">
 <Send className="w-4 h-4" />
 </Button>
 </div>
 )}
 </div>

 <p className="text-xs text-muted-foreground">
 Submitted {format(new Date(selectedTicket.created_at),"MMMM d, yyyy'at' h:mm a")}
 </p>
 </div>
 )}
 </DialogContent>
 </Dialog>
 </div>
 );
};
