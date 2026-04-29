import { useState } from"react";
import { Plus, X, Users, Mail, UserPlus } from"lucide-react";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Badge } from"@/components/ui/badge";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
import {
 Popover,
 PopoverContent,
 PopoverTrigger,
} from"@/components/ui/popover";
import { InvoiceClient } from"@/services/api/invoicing.service";

export interface InvoiceRecipient {
 id?: string;
 email: string;
 name?: string;
 recipient_type:"cc" |"bcc";
}

interface InvoiceRecipientsProps {
 recipients: InvoiceRecipient[];
 clients: InvoiceClient[];
 onChange: (recipients: InvoiceRecipient[]) => void;
}

export function InvoiceRecipients({
 recipients,
 clients,
 onChange,
}: InvoiceRecipientsProps) {
 const [isAdding, setIsAdding] = useState(false);
 const [newEmail, setNewEmail] = useState("");
 const [newName, setNewName] = useState("");
 const [newType, setNewType] = useState<"cc" |"bcc">("cc");

 const handleAddRecipient = () => {
 if (!newEmail.trim()) return;
 
 // Check for duplicates
 if (recipients.some(r => r.email.toLowerCase() === newEmail.toLowerCase())) {
 return;
 }

 onChange([
 ...recipients,
 {
 email: newEmail.trim(),
 name: newName.trim() || undefined,
 recipient_type: newType,
 },
 ]);

 setNewEmail("");
 setNewName("");
 setNewType("cc");
 setIsAdding(false);
 };

 const handleRemoveRecipient = (index: number) => {
 const updated = [...recipients];
 updated.splice(index, 1);
 onChange(updated);
 };

 const handleSelectClient = (clientId: string) => {
 const client = clients.find(c => c.id === clientId);
 if (client) {
 // Check for duplicates
 if (recipients.some(r => r.email.toLowerCase() === client.email.toLowerCase())) {
 return;
 }
 
 onChange([
 ...recipients,
 {
 email: client.email,
 name: client.name,
 recipient_type:"cc",
 },
 ]);
 }
 setIsAdding(false);
 };

 return (
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <Label className="flex items-center gap-2 text-sm font-medium">
 <Users className="h-4 w-4" />
 Additional Recipients
 </Label>
 <Popover open={isAdding} onOpenChange={setIsAdding}>
 <PopoverTrigger asChild>
 <Button variant="outline" size="sm" className="h-8">
 <UserPlus className="h-3.5 w-3.5 mr-1.5" />
 Add Recipient
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-80" align="end">
 <div className="space-y-4">
 <div className="space-y-2">
 <Label className="text-xs text-muted-foreground">
 Select from existing clients
 </Label>
 <Select onValueChange={handleSelectClient}>
 <SelectTrigger className="h-9">
 <SelectValue placeholder="Choose a client..." />
 </SelectTrigger>
 <SelectContent>
 {clients
 .filter(c => !recipients.some(r => r.email === c.email))
 .map((client) => (
 <SelectItem key={client.id} value={client.id}>
 {client.name} ({client.email})
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="relative">
 <div className="absolute inset-0 flex items-center">
 <span className="w-full border-t" />
 </div>
 <div className="relative flex justify-center text-xs uppercase">
 <span className="bg-popover px-2 text-muted-foreground">
 Or add manually
 </span>
 </div>
 </div>

 <div className="space-y-3">
 <div>
 <Label className="text-xs">Email *</Label>
 <Input
 type="email"
 placeholder="recipient@example.com"
 value={newEmail}
 onChange={(e) => setNewEmail(e.target.value)}
 className="h-9 mt-1"
 />
 </div>
 <div>
 <Label className="text-xs">Name (optional)</Label>
 <Input
 placeholder="Recipient name"
 value={newName}
 onChange={(e) => setNewName(e.target.value)}
 className="h-9 mt-1"
 />
 </div>
 <div>
 <Label className="text-xs">Type</Label>
 <Select value={newType} onValueChange={(v:"cc" |"bcc") => setNewType(v)}>
 <SelectTrigger className="h-9 mt-1">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="cc">CC (visible to all)</SelectItem>
 <SelectItem value="bcc">BCC (hidden)</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <Button
 size="sm"
 className="w-full"
 onClick={handleAddRecipient}
 disabled={!newEmail.trim()}
 >
 <Plus className="h-4 w-4 mr-1" />
 Add Recipient
 </Button>
 </div>
 </div>
 </PopoverContent>
 </Popover>
 </div>

 {recipients.length > 0 ? (
 <div className="flex flex-wrap gap-2">
 {recipients.map((recipient, index) => (
 <Badge
 key={index}
 variant="secondary"
 className="flex items-center gap-1.5 py-1.5 px-3"
 >
 <Mail className="h-3 w-3" />
 <span className="max-w-[180px] truncate">
 {recipient.name || recipient.email}
 </span>
 <span className="text-[10px] uppercase text-muted-foreground">
 {recipient.recipient_type}
 </span>
 <button
 type="button"
 onClick={() => handleRemoveRecipient(index)}
 className="ml-1 hover:text-destructive transition-colors"
 >
 <X className="h-3 w-3" />
 </button>
 </Badge>
 ))}
 </div>
 ) : (
 <p className="text-sm text-muted-foreground">
 No additional recipients. The primary client will receive the invoice.
 </p>
 )}
 </div>
 );
}
