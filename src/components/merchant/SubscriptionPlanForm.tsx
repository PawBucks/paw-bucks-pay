import { useState } from"react";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Textarea } from"@/components/ui/textarea";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogFooter,
 DialogHeader,
 DialogTitle,
} from"@/components/ui/dialog";
import { Loader2, Plus, X } from"lucide-react";
import { Badge } from"@/components/ui/badge";

import { Formatters } from "@/utils/formatters";
type BillingInterval ="day" |"week" |"month" |"year";

interface SubscriptionPlanFormProps {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 onSubmit: (data: {
 name: string;
 description: string;
 amount: number;
 billingInterval: BillingInterval;
 billingIntervalCount: number;
 features: string[];
 trialDays: number;
 }) => Promise<void>;
 initialData?: {
 name: string;
 description: string;
 amount: number;
 billingInterval: BillingInterval;
 billingIntervalCount: number;
 features: string[];
 trialDays: number;
 };
 isEditing?: boolean;
}

export function SubscriptionPlanForm({
 open,
 onOpenChange,
 onSubmit,
 initialData,
 isEditing = false,
}: SubscriptionPlanFormProps) {
 const [name, setName] = useState(initialData?.name ||"");
 const [description, setDescription] = useState(initialData?.description ||"");
 const [amount, setAmount] = useState(initialData?.amount ? (initialData.amount / 100).toString() :"");
 const [billingInterval, setBillingInterval] = useState<BillingInterval>(initialData?.billingInterval ||"month");
 const [billingIntervalCount, setBillingIntervalCount] = useState(initialData?.billingIntervalCount?.toString() ||"1");
 const [features, setFeatures] = useState<string[]>(initialData?.features || []);
 const [newFeature, setNewFeature] = useState("");
 const [trialDays, setTrialDays] = useState(initialData?.trialDays?.toString() ||"0");
 const [isSubmitting, setIsSubmitting] = useState(false);

 const handleAddFeature = () => {
 if (newFeature.trim()) {
 setFeatures([...features, newFeature.trim()]);
 setNewFeature("");
 }
 };

 const handleRemoveFeature = (index: number) => {
 setFeatures(features.filter((_, i) => i !== index));
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setIsSubmitting(true);
 
 try {
 await onSubmit({
 name,
 description,
 amount: Math.round(parseFloat(amount) * 100), // Convert to cents
 billingInterval,
 billingIntervalCount: parseInt(billingIntervalCount),
 features,
 trialDays: parseInt(trialDays) || 0,
 });
 onOpenChange(false);
 } finally {
 setIsSubmitting(false);
 }
 };

 const getIntervalLabel = () => {
 const count = parseInt(billingIntervalCount) || 1;
 const labels: Record<BillingInterval, string> = {
 day: count === 1 ?"day" :"days",
 week: count === 1 ?"week" :"weeks",
 month: count === 1 ?"month" :"months",
 year: count === 1 ?"year" :"years",
 };
 return count === 1 ? `per ${labels[billingInterval]}` : `every ${count} ${labels[billingInterval]}`;
 };

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>{isEditing ?"Edit Subscription Plan" :"Create Subscription Plan"}</DialogTitle>
 <DialogDescription>
 {isEditing ?"Update your recurring billing plan details." :"Create a recurring billing plan for your customers."}
 </DialogDescription>
 </DialogHeader>

 <form onSubmit={handleSubmit} className="space-y-4">
 <div className="space-y-2">
 <Label htmlFor="name">Plan Name *</Label>
 <Input
 id="name"
 value={name}
 onChange={(e) => setName(e.target.value)}
 placeholder="e.g., Monthly Wellness Plan"
 required
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="description">Description</Label>
 <Textarea
 id="description"
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 placeholder="Describe what's included in this plan..."
 rows={3}
 />
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="amount">Price (USD) *</Label>
 <div className="relative">
 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
 <Input
 id="amount"
 type="number"
 step="0.01"
 min="0.50"
 value={amount}
 onChange={(e) => setAmount(e.target.value)}
 placeholder="29.99"
 className="pl-7"
 required
 />
 </div>
 </div>

 <div className="space-y-2">
 <Label htmlFor="trialDays">Trial Days</Label>
 <Input
 id="trialDays"
 type="number"
 min="0"
 max="365"
 value={trialDays}
 onChange={(e) => setTrialDays(e.target.value)}
 placeholder="0"
 />
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>Billing Interval *</Label>
 <Select value={billingInterval} onValueChange={(v: BillingInterval) => setBillingInterval(v)}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="day">Daily</SelectItem>
 <SelectItem value="week">Weekly</SelectItem>
 <SelectItem value="month">Monthly</SelectItem>
 <SelectItem value="year">Yearly</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label htmlFor="intervalCount">Every X Intervals</Label>
 <Input
 id="intervalCount"
 type="number"
 min="1"
 max="365"
 value={billingIntervalCount}
 onChange={(e) => setBillingIntervalCount(e.target.value)}
 placeholder="1"
 />
 </div>
 </div>

 {amount && (
 <div className="p-3 rounded-lg bg-muted text-sm">
 <span className="font-medium">{Formatters.currency(parseFloat(amount ||"0"))}</span>
 <span className="text-muted-foreground"> {getIntervalLabel()}</span>
 </div>
 )}

 <div className="space-y-2">
 <Label>Plan Features</Label>
 <div className="flex gap-2">
 <Input
 value={newFeature}
 onChange={(e) => setNewFeature(e.target.value)}
 placeholder="Add a feature..."
 onKeyDown={(e) => {
 if (e.key ==="Enter") {
 e.preventDefault();
 handleAddFeature();
 }
 }}
 />
 <Button type="button" variant="outline" size="icon" onClick={handleAddFeature}>
 <Plus className="h-4 w-4" />
 </Button>
 </div>
 {features.length > 0 && (
 <div className="flex flex-wrap gap-2 mt-2">
 {features.map((feature, index) => (
 <Badge key={index} variant="secondary" className="gap-1">
 {feature}
 <button
 type="button"
 onClick={() => handleRemoveFeature(index)}
 className="ml-1 hover:text-destructive"
 >
 <X className="h-3 w-3" />
 </button>
 </Badge>
 ))}
 </div>
 )}
 </div>

 <DialogFooter>
 <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
 Cancel
 </Button>
 <Button type="submit" disabled={isSubmitting || !name || !amount}>
 {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
 {isEditing ?"Save Changes" :"Create Plan"}
 </Button>
 </DialogFooter>
 </form>
 </DialogContent>
 </Dialog>
 );
}
