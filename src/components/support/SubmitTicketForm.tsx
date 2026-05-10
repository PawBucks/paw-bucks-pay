import { useState } from'react';
import { Button } from'@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from'@/components/ui/card';
import { Input } from'@/components/ui/input';
import { Label } from'@/components/ui/label';
import { Textarea } from'@/components/ui/textarea';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from'@/components/ui/select';
import { supabase } from'@/integrations/supabase/client';
import { toast } from'sonner';
import { Send, AlertTriangle, Bug, CreditCard, UserCog, Lightbulb, HelpCircle } from "lucide-react";
import { LoadingSpinner } from'@/components/LoadingSpinner';

interface SubmitTicketFormProps {
 submitterType:'merchant' |'vet';
 entityId?: string;
 onTicketCreated?: () => void;
}

const CATEGORY_OPTIONS = [
 { value:'technical_issue', label:'Technical Issue / Bug', icon: Bug, description:'Something isn\'t working correctly' },
 { value:'billing_payments', label:'Billing & Payments', icon: CreditCard, description:'Payouts, fees, invoices, Stripe issues' },
 { value:'account_profile', label:'Account & Profile', icon: UserCog, description:'Profile settings, verification, approval' },
 { value:'feature_request', label:'Feature Request', icon: Lightbulb, description:'Suggest new functionality' },
 { value:'general', label:'General Inquiry', icon: HelpCircle, description:'Other questions or feedback' },
 { value:'other', label:'Other', icon: AlertTriangle, description:'Doesn\'t fit other categories' },
];

const PRIORITY_OPTIONS = [
 { value:'low', label:'Low', description:'Minor issue, no rush' },
 { value:'medium', label:'Medium', description:'Affecting workflow but workaround exists' },
 { value:'high', label:'High', description:'Significant impact on business' },
 { value:'urgent', label:'Urgent', description:'Critical — cannot operate' },
];

const AFFECTED_FEATURES = [
'Dashboard','Payments / Stripe','Invoicing','PawBucks Wallet','Customer Management',
'Loyalty Program','Analytics / Reports','Profile / Settings','Notifications',
'Scheduling / Bookings','EMR System','Prescriptions','Lab Results','Insurance Claims',
'Messaging','Premium Services','Other',
];

export const SubmitTicketForm = ({ submitterType, entityId, onTicketCreated }: SubmitTicketFormProps) => {
 const [loading, setLoading] = useState(false);
 const [category, setCategory] = useState('');
 const [priority, setPriority] = useState('medium');
 const [subject, setSubject] = useState('');
 const [description, setDescription] = useState('');
 const [affectedFeature, setAffectedFeature] = useState('');
 const [stepsToReproduce, setStepsToReproduce] = useState('');
 const [expectedBehavior, setExpectedBehavior] = useState('');
 const [actualBehavior, setActualBehavior] = useState('');

 const showTechnicalFields = category ==='technical_issue';

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();

 if (!category || !subject.trim() || !description.trim()) {
 toast.error('Please fill in all required fields');
 return;
 }

 setLoading(true);

 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) throw new Error('Not authenticated');

 const browserInfo = `${navigator.userAgent} | ${window.innerWidth}x${window.innerHeight}`;

 const ticketData: Record<string, unknown> = {
 user_id: user.id,
 submitter_type: submitterType,
 category,
 priority,
 subject: subject.trim(),
 description: description.trim(),
 affected_feature: affectedFeature || null,
 browser_info: browserInfo,
 ticket_number:'', // trigger will set this
 };

 if (showTechnicalFields) {
 ticketData.steps_to_reproduce = stepsToReproduce.trim() || null;
 ticketData.expected_behavior = expectedBehavior.trim() || null;
 ticketData.actual_behavior = actualBehavior.trim() || null;
 }

 if (submitterType ==='merchant' && entityId) {
 ticketData.related_merchant_id = entityId;
 } else if (submitterType ==='vet' && entityId) {
 ticketData.related_vet_id = entityId;
 }

 const { data: insertedTickets, error } = await supabase
 .from('support_tickets')
 .insert(ticketData as any)
 .select('id, ticket_number')
 .single();

 if (error) throw error;

 // Send notifications (fire-and-forget)
 supabase.functions.invoke('send-support-ticket-notification', {
 body: {
 type:'ticket_created',
 ticketId: insertedTickets.id,
 ticketNumber: insertedTickets.ticket_number,
 ticketSubject: subject.trim(),
 submitterType: submitterType,
 },
 }).catch((err) => console.error('Notification error:', err));

 toast.success('Support ticket submitted successfully! We\'ll get back to you soon.');

 // Reset form
 setCategory('');
 setPriority('medium');
 setSubject('');
 setDescription('');
 setAffectedFeature('');
 setStepsToReproduce('');
 setExpectedBehavior('');
 setActualBehavior('');

 onTicketCreated?.();
 } catch (error: any) {
 console.error('Error submitting ticket:', error);
 toast.error('Failed to submit ticket. Please try again.');
 } finally {
 setLoading(false);
 }
 };

 return (
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Send className="w-5 h-5 text-primary" />
 Submit a Support Ticket
 </CardTitle>
 <CardDescription>
 Provide as much detail as possible so we can resolve your issue quickly.
 </CardDescription>
 </CardHeader>
 <CardContent>
 <form onSubmit={handleSubmit} className="space-y-6">
 {/* Category & Priority Row */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="category">Category *</Label>
 <Select value={category} onValueChange={setCategory}>
 <SelectTrigger>
 <SelectValue placeholder="Select a category..." />
 </SelectTrigger>
 <SelectContent>
 {CATEGORY_OPTIONS.map(opt => (
 <SelectItem key={opt.value} value={opt.value}>
 <div className="flex items-center gap-2">
 <opt.icon className="w-4 h-4" />
 <span>{opt.label}</span>
 </div>
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 {category && (
 <p className="text-xs text-muted-foreground">
 {CATEGORY_OPTIONS.find(c => c.value === category)?.description}
 </p>
 )}
 </div>

 <div className="space-y-2">
 <Label htmlFor="priority">Priority *</Label>
 <Select value={priority} onValueChange={setPriority}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {PRIORITY_OPTIONS.map(opt => (
 <SelectItem key={opt.value} value={opt.value}>
 {opt.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 <p className="text-xs text-muted-foreground">
 {PRIORITY_OPTIONS.find(p => p.value === priority)?.description}
 </p>
 </div>
 </div>

 {/* Affected Feature */}
 <div className="space-y-2">
 <Label htmlFor="affected-feature">Affected Feature</Label>
 <Select value={affectedFeature} onValueChange={setAffectedFeature}>
 <SelectTrigger>
 <SelectValue placeholder="Which feature is affected?" />
 </SelectTrigger>
 <SelectContent>
 {AFFECTED_FEATURES.map(feature => (
 <SelectItem key={feature} value={feature}>{feature}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 {/* Subject */}
 <div className="space-y-2">
 <Label htmlFor="subject">Subject *</Label>
 <Input
 id="subject"
 placeholder="Brief summary of your issue..."
 value={subject}
 onChange={(e) => setSubject(e.target.value)}
 maxLength={200}
 disabled={loading}
 />
 </div>

 {/* Description */}
 <div className="space-y-2">
 <Label htmlFor="description">Description *</Label>
 <Textarea
 id="description"
 placeholder="Please describe your issue in detail. Include any error messages you see, what you were trying to do, and when the issue started..."
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 rows={5}
 maxLength={5000}
 disabled={loading}
 className="resize-none"
 />
 <p className="text-xs text-muted-foreground text-right">{description.length}/5000</p>
 </div>

 {/* Technical Fields - only for bugs */}
 {showTechnicalFields && (
 <div className="space-y-4 rounded-lg border border-dashed p-4 bg-muted/30">
 <p className="text-sm font-medium text-muted-foreground">Bug Report Details</p>

 <div className="space-y-2">
 <Label htmlFor="steps">Steps to Reproduce</Label>
 <Textarea
 id="steps"
 placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
 value={stepsToReproduce}
 onChange={(e) => setStepsToReproduce(e.target.value)}
 rows={3}
 maxLength={2000}
 disabled={loading}
 className="resize-none"
 />
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="expected">Expected Behavior</Label>
 <Textarea
 id="expected"
 placeholder="What should happen..."
 value={expectedBehavior}
 onChange={(e) => setExpectedBehavior(e.target.value)}
 rows={2}
 maxLength={1000}
 disabled={loading}
 className="resize-none"
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="actual">Actual Behavior</Label>
 <Textarea
 id="actual"
 placeholder="What actually happens..."
 value={actualBehavior}
 onChange={(e) => setActualBehavior(e.target.value)}
 rows={2}
 maxLength={1000}
 disabled={loading}
 className="resize-none"
 />
 </div>
 </div>
 </div>
 )}

 <Button type="submit" disabled={loading || !category || !subject.trim() || !description.trim()} className="w-full">
 {loading ? (
 <LoadingSpinner size="sm" />
 ) : (
 <>
 <Send className="w-4 h-4 mr-2" />
 Submit Ticket
 </>
 )}
 </Button>
 </form>
 </CardContent>
 </Card>
 );
};
