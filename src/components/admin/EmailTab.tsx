import { useState, useMemo } from"react";
import DOMPurify from"dompurify";
import { useQuery } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Textarea } from"@/components/ui/textarea";
import { Badge } from"@/components/ui/badge";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from"@/components/ui/table";
import { Checkbox } from"@/components/ui/checkbox";
import { ScrollArea } from"@/components/ui/scroll-area";
import { Loader2, Mail, Search, Send, Store, Users, X } from "lucide-react";
import { toast } from"sonner";

type RecipientType ="all" |"merchants" |"pet_owners" |"individual";

interface Profile {
 id: string;
 email: string;
 full_name: string | null;
 user_type: string;
}

export function EmailTab() {
 const [recipientType, setRecipientType] = useState<RecipientType>("all");
 const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
 const [subject, setSubject] = useState("");
 const [htmlContent, setHtmlContent] = useState("");
 const [sending, setSending] = useState(false);
 const [searchTerm, setSearchTerm] = useState("");

 // Fetch users for individual selection
 const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
 queryKey: ["admin-email-profiles"],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("profiles")
 .select("id, email, full_name, user_type")
 .not("email","is", null)
 .order("full_name");

 if (error) throw error;
 return data as Profile[];
 },
 });

 const filteredProfiles = profiles.filter((profile) => {
 const matchesSearch =
 profile.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
 profile.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
 
 if (recipientType ==="merchants") {
 return matchesSearch && profile.user_type ==="merchant";
 } else if (recipientType ==="pet_owners") {
 return matchesSearch && profile.user_type ==="pet_owner";
 }
 return matchesSearch;
 });

 const handleSelectEmail = (email: string, checked: boolean) => {
 if (checked) {
 setSelectedEmails((prev) => [...prev, email]);
 } else {
 setSelectedEmails((prev) => prev.filter((e) => e !== email));
 }
 };

 const handleSelectAll = (checked: boolean) => {
 if (checked) {
 setSelectedEmails(filteredProfiles.map((p) => p.email));
 } else {
 setSelectedEmails([]);
 }
 };

 const removeSelectedEmail = (email: string) => {
 setSelectedEmails((prev) => prev.filter((e) => e !== email));
 };

 const getRecipientCount = (): number => {
 if (recipientType ==="individual") {
 return selectedEmails.length;
 } else if (recipientType ==="all") {
 return profiles.length;
 } else if (recipientType ==="merchants") {
 return profiles.filter((p) => p.user_type ==="merchant").length;
 } else if (recipientType ==="pet_owners") {
 return profiles.filter((p) => p.user_type ==="pet_owner").length;
 }
 return 0;
 };

 const handleSendEmail = async () => {
 if (!subject.trim()) {
 toast.error("Please enter a subject");
 return;
 }

 if (!htmlContent.trim()) {
 toast.error("Please enter email content");
 return;
 }

 if (recipientType ==="individual" && selectedEmails.length === 0) {
 toast.error("Please select at least one recipient");
 return;
 }

 setSending(true);
 try {
 const { data, error } = await supabase.functions.invoke("admin-send-email", {
 body: {
 recipientType,
 individualEmails: recipientType ==="individual" ? selectedEmails : undefined,
 subject,
 htmlContent: htmlContent,
 },
 });

 if (error) throw error;

 if (data.success) {
 toast.success(`Email sent to ${data.sent} recipients${data.failed > 0 ? `, ${data.failed} failed` :""}`);
 setSubject("");
 setHtmlContent("");
 setSelectedEmails([]);
 } else {
 throw new Error(data.error ||"Failed to send emails");
 }
 } catch (error: any) {
 console.error("Error sending email:", error);
 toast.error(error.message ||"Failed to send email");
 } finally {
 setSending(false);
 }
 };

 return (
 <div className="space-y-6">
 <div className="flex items-center gap-2 mb-4">
 <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
 <h2 className="text-xl font-semibold">Email Users</h2>
 </div>

 <div className="grid gap-6 md:grid-cols-2">
 {/* Left Column - Recipients */}
 <div className="space-y-4">
 <div>
 <Label htmlFor="recipientType">Recipient Type</Label>
 <Select
 value={recipientType}
 onValueChange={(value) => {
 setRecipientType(value as RecipientType);
 setSelectedEmails([]);
 }}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select recipient type" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">
 <div className="flex items-center gap-2">
 <Users className="h-4 w-4" aria-hidden="true" />
 All Users
 </div>
 </SelectItem>
 <SelectItem value="merchants">
 <div className="flex items-center gap-2">
 <Store className="h-4 w-4" aria-hidden="true" />
 Merchants Only
 </div>
 </SelectItem>
 <SelectItem value="pet_owners">
 <div className="flex items-center gap-2">
 <Users className="h-4 w-4" aria-hidden="true" />
 Pet Owners Only
 </div>
 </SelectItem>
 <SelectItem value="individual">
 <div className="flex items-center gap-2">
 <Mail className="h-4 w-4" aria-hidden="true" />
 Individual Selection
 </div>
 </SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="bg-muted rounded-lg p-3">
 <p className="text-sm text-muted-foreground">
 Recipients: <span className="font-medium text-foreground">{getRecipientCount()}</span>
 </p>
 </div>

 {recipientType ==="individual" && (
 <div className="space-y-3">
 {selectedEmails.length > 0 && (
 <div className="flex flex-wrap gap-2">
 {selectedEmails.map((email) => (
 <Badge key={email} variant="secondary" className="gap-1">
 {email}
 <button onClick={() => removeSelectedEmail(email)}>
 <X className="h-3 w-3" />
 </button>
 </Badge>
 ))}
 </div>
 )}

 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input
 placeholder="Search users..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="pl-9"
 />
 </div>

 <ScrollArea className="h-[300px] border rounded-lg">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead className="w-10">
 <Checkbox
 checked={
 filteredProfiles.length > 0 &&
 filteredProfiles.every((p) => selectedEmails.includes(p.email))
 }
 onCheckedChange={handleSelectAll}
 />
 </TableHead>
 <TableHead>Name</TableHead>
 <TableHead>Email</TableHead>
 <TableHead>Type</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {loadingProfiles ? (
 <TableRow>
 <TableCell colSpan={4} className="text-center py-8">
 <Loader2 className="h-5 w-5 animate-spin mx-auto" />
 </TableCell>
 </TableRow>
 ) : filteredProfiles.length === 0 ? (
 <TableRow>
 <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
 No users found
 </TableCell>
 </TableRow>
 ) : (
 filteredProfiles.map((profile) => (
 <TableRow key={profile.id}>
 <TableCell>
 <Checkbox
 checked={selectedEmails.includes(profile.email)}
 onCheckedChange={(checked) =>
 handleSelectEmail(profile.email, checked as boolean)
 }
 />
 </TableCell>
 <TableCell className="font-medium">
 {profile.full_name ||"—"}
 </TableCell>
 <TableCell className="text-sm text-muted-foreground">
 {profile.email}
 </TableCell>
 <TableCell>
 <Badge variant={profile.user_type ==="merchant" ?"default" :"secondary"}>
 {profile.user_type}
 </Badge>
 </TableCell>
 </TableRow>
 ))
 )}
 </TableBody>
 </Table>
 </ScrollArea>
 </div>
 )}
 </div>

 {/* Right Column - Email Content */}
 <div className="space-y-4">
 <div>
 <Label htmlFor="subject">Subject</Label>
 <Input
 id="subject"
 placeholder="Enter email subject..."
 value={subject}
 onChange={(e) => setSubject(e.target.value)}
 />
 </div>

 <div>
 <Label htmlFor="content">Email Content (HTML supported)</Label>
 <Textarea
 id="content"
 placeholder="Enter your message here... HTML is supported for formatting."
 value={htmlContent}
 onChange={(e) => setHtmlContent(e.target.value)}
 className="min-h-[300px] font-mono text-sm"
 />
 <p className="text-xs text-muted-foreground mt-1">
 Tip: Use &lt;h2&gt;, &lt;p&gt;, &lt;strong&gt;, &lt;a href=""&gt; for formatting
 </p>
 </div>

 <div className="bg-muted rounded-lg p-4">
 <h4 className="font-medium mb-2">Preview</h4>
 <div
 className="bg-background rounded border p-4 prose prose-sm max-w-none"
 dangerouslySetInnerHTML={{ 
 __html: DOMPurify.sanitize(
 htmlContent ||"<p class='text-muted-foreground'>Your content will appear here...</p>",
 { 
 ALLOWED_TAGS: ['h1','h2','h3','h4','h5','h6','p','br','strong','b','em','i','u','ul','ol','li','a','span','div','blockquote','hr'],
 ALLOWED_ATTR: ['href','class'],
 ADD_URI_SAFE_ATTR: ['href'],
 ALLOW_DATA_ATTR: false
 }
 )
 }}
 />
 </div>

 <Button
 onClick={handleSendEmail}
 disabled={sending || getRecipientCount() === 0}
 className="w-full"
 >
 {sending ? (
 <>
 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
 Sending...
 </>
 ) : (
 <>
 <Send className="h-4 w-4 mr-2" />
 Send Email to {getRecipientCount()} {getRecipientCount() === 1 ?"User" :"Users"}
 </>
 )}
 </Button>
 </div>
 </div>
 </div>
 );
}
