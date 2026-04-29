import { useState, useMemo } from"react";
import { useQuery, useMutation, useQueryClient } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Textarea } from"@/components/ui/textarea";
import { Badge } from"@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
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
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogHeader,
 DialogTitle,
 DialogTrigger,
 DialogFooter,
} from"@/components/ui/dialog";
import { 
 MessageSquare, 
 Send, 
 Loader2, 
 Users, 
 Store, 
 Search, 
 X, 
 Phone,
 Clock,
 CheckCircle,
 XCircle,
 AlertCircle,
 Plus,
 History,
 BarChart3
} from"lucide-react";
import { toast } from"sonner";
import { format } from"date-fns";

type RecipientType ="all" |"merchants" |"pet_owners" |"individual";

interface Profile {
 id: string;
 email: string;
 full_name: string | null;
 phone: string | null;
 user_type: string;
}

interface TextCampaign {
 id: string;
 title: string;
 message: string;
 recipient_type: string;
 recipient_count: number;
 sent_count: number;
 failed_count: number;
 status: string;
 scheduled_at: string | null;
 sent_at: string | null;
 created_at: string;
}

export function TextCampaignsTab() {
 const queryClient = useQueryClient();
 const [activeView, setActiveView] = useState<"compose" |"history" |"analytics">("compose");
 const [recipientType, setRecipientType] = useState<RecipientType>("all");
 const [selectedPhones, setSelectedPhones] = useState<{ phone: string; userId: string; name: string }[]>([]);
 const [campaignTitle, setCampaignTitle] = useState("");
 const [message, setMessage] = useState("");
 const [sending, setSending] = useState(false);
 const [searchTerm, setSearchTerm] = useState("");
 const [showConfirmDialog, setShowConfirmDialog] = useState(false);

 // Fetch users with phone numbers
 const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
 queryKey: ["admin-text-profiles"],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("profiles")
 .select("id, email, full_name, phone, user_type")
 .not("phone","is", null)
 .neq("phone","")
 .order("full_name");

 if (error) throw error;
 return data as Profile[];
 },
 });

 // Fetch campaign history
 const { data: campaigns = [], isLoading: loadingCampaigns } = useQuery({
 queryKey: ["text-campaigns"],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("text_campaigns")
 .select("*")
 .order("created_at", { ascending: false })
 .limit(50);

 if (error) throw error;
 return data as TextCampaign[];
 },
 });

 // Filter profiles based on search and recipient type
 const filteredProfiles = useMemo(() => {
 return profiles.filter((profile) => {
 const matchesSearch =
 profile.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
 profile.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
 profile.email?.toLowerCase().includes(searchTerm.toLowerCase());
 
 if (recipientType ==="merchants") {
 return matchesSearch && profile.user_type ==="merchant";
 } else if (recipientType ==="pet_owners") {
 return matchesSearch && profile.user_type ==="pet_owner";
 }
 return matchesSearch;
 });
 }, [profiles, searchTerm, recipientType]);

 // Get recipient list based on type
 const getRecipientList = useMemo(() => {
 if (recipientType ==="individual") {
 return selectedPhones;
 }
 
 let targetProfiles = profiles;
 if (recipientType ==="merchants") {
 targetProfiles = profiles.filter(p => p.user_type ==="merchant");
 } else if (recipientType ==="pet_owners") {
 targetProfiles = profiles.filter(p => p.user_type ==="pet_owner");
 }
 
 return targetProfiles.map(p => ({
 phone: p.phone!,
 userId: p.id,
 name: p.full_name || p.email
 }));
 }, [recipientType, selectedPhones, profiles]);

 const recipientCount = getRecipientList.length;

 const handleSelectPhone = (profile: Profile, checked: boolean) => {
 if (checked) {
 setSelectedPhones(prev => [...prev, {
 phone: profile.phone!,
 userId: profile.id,
 name: profile.full_name || profile.email
 }]);
 } else {
 setSelectedPhones(prev => prev.filter(p => p.userId !== profile.id));
 }
 };

 const handleSelectAll = (checked: boolean) => {
 if (checked) {
 setSelectedPhones(filteredProfiles.map(p => ({
 phone: p.phone!,
 userId: p.id,
 name: p.full_name || p.email
 })));
 } else {
 setSelectedPhones([]);
 }
 };

 const removeSelectedPhone = (userId: string) => {
 setSelectedPhones(prev => prev.filter(p => p.userId !== userId));
 };

 const characterCount = message.length;
 const segmentCount = Math.ceil(characterCount / 160) || 1;

 const handleSendCampaign = async () => {
 if (!campaignTitle.trim()) {
 toast.error("Please enter a campaign title");
 return;
 }

 if (!message.trim()) {
 toast.error("Please enter a message");
 return;
 }

 if (recipientCount === 0) {
 toast.error("No recipients with valid phone numbers");
 return;
 }

 setShowConfirmDialog(true);
 };

 const confirmSendCampaign = async () => {
 setShowConfirmDialog(false);
 setSending(true);

 try {
 const { data, error } = await supabase.functions.invoke("admin-send-text-campaign", {
 body: {
 title: campaignTitle,
 message,
 recipientType,
 recipients: getRecipientList,
 },
 });

 if (error) throw error;

 if (data.success) {
 toast.success(`Campaign sent! ${data.sent} messages delivered, ${data.failed} failed`);
 setCampaignTitle("");
 setMessage("");
 setSelectedPhones([]);
 queryClient.invalidateQueries({ queryKey: ["text-campaigns"] });
 setActiveView("history");
 } else {
 throw new Error(data.error ||"Failed to send campaign");
 }
 } catch (error: any) {
 console.error("Error sending text campaign:", error);
 toast.error(error.message ||"Failed to send text campaign");
 } finally {
 setSending(false);
 }
 };

 const getStatusBadge = (status: string) => {
 switch (status) {
 case"sent":
 return <Badge className="bg-success/10 text-success border-success/20"><CheckCircle className="w-3 h-3 mr-1" />Sent</Badge>;
 case"failed":
 return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
 case"partial":
 return <Badge className="bg-warning/10 text-warning border-warning/20"><AlertCircle className="w-3 h-3 mr-1" />Partial</Badge>;
 case"scheduled":
 return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Scheduled</Badge>;
 default:
 return <Badge variant="outline">{status}</Badge>;
 }
 };

 // Analytics calculations
 const analytics = useMemo(() => {
 const totalCampaigns = campaigns.length;
 const totalSent = campaigns.reduce((sum, c) => sum + c.sent_count, 0);
 const totalFailed = campaigns.reduce((sum, c) => sum + c.failed_count, 0);
 const successRate = totalSent + totalFailed > 0 
 ? ((totalSent / (totalSent + totalFailed)) * 100).toFixed(1)
 :"0";
 
 return { totalCampaigns, totalSent, totalFailed, successRate };
 }, [campaigns]);

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <MessageSquare className="h-5 w-5 text-primary" />
 <h2 className="text-xl font-semibold">Text Campaigns</h2>
 </div>
 <div className="flex gap-2">
 <Button
 variant={activeView ==="compose" ?"default" :"outline"}
 size="sm"
 onClick={() => setActiveView("compose")}
 >
 <Plus className="h-4 w-4 mr-1" />
 New Campaign
 </Button>
 <Button
 variant={activeView ==="history" ?"default" :"outline"}
 size="sm"
 onClick={() => setActiveView("history")}
 >
 <History className="h-4 w-4 mr-1" />
 History
 </Button>
 <Button
 variant={activeView ==="analytics" ?"default" :"outline"}
 size="sm"
 onClick={() => setActiveView("analytics")}
 >
 <BarChart3 className="h-4 w-4 mr-1" />
 Analytics
 </Button>
 </div>
 </div>

 {activeView ==="compose" && (
 <div className="grid gap-6 lg:grid-cols-2">
 {/* Left Column - Recipients */}
 <Card>
 <CardHeader>
 <CardTitle className="text-base">Recipients</CardTitle>
 <CardDescription>Select who will receive this text message</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div>
 <Label htmlFor="recipientType">Recipient Type</Label>
 <Select
 value={recipientType}
 onValueChange={(value) => {
 setRecipientType(value as RecipientType);
 setSelectedPhones([]);
 }}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select recipient type" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">
 <div className="flex items-center gap-2">
 <Users className="h-4 w-4" />
 All Users with Phone
 </div>
 </SelectItem>
 <SelectItem value="merchants">
 <div className="flex items-center gap-2">
 <Store className="h-4 w-4" />
 Merchants Only
 </div>
 </SelectItem>
 <SelectItem value="pet_owners">
 <div className="flex items-center gap-2">
 <Users className="h-4 w-4" />
 Pet Owners Only
 </div>
 </SelectItem>
 <SelectItem value="individual">
 <div className="flex items-center gap-2">
 <Phone className="h-4 w-4" />
 Individual Selection
 </div>
 </SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="bg-muted rounded-lg p-3 flex items-center justify-between">
 <p className="text-sm text-muted-foreground">
 Recipients: <span className="font-medium text-foreground">{recipientCount}</span>
 </p>
 <Badge variant="outline" className="text-xs">
 <Phone className="h-3 w-3 mr-1" />
 Phone numbers only
 </Badge>
 </div>

 {recipientType ==="individual" && (
 <div className="space-y-3">
 {selectedPhones.length > 0 && (
 <div className="flex flex-wrap gap-2">
 {selectedPhones.slice(0, 5).map((recipient) => (
 <Badge key={recipient.userId} variant="secondary" className="gap-1">
 {recipient.name}
 <button onClick={() => removeSelectedPhone(recipient.userId)}>
 <X className="h-3 w-3" />
 </button>
 </Badge>
 ))}
 {selectedPhones.length > 5 && (
 <Badge variant="outline">+{selectedPhones.length - 5} more</Badge>
 )}
 </div>
 )}

 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input
 placeholder="Search by name, email, or phone..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="pl-9"
 />
 </div>

 <ScrollArea className="h-[280px] border rounded-lg">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead className="w-10">
 <Checkbox
 checked={
 filteredProfiles.length > 0 &&
 filteredProfiles.every((p) => 
 selectedPhones.some(s => s.userId === p.id)
 )
 }
 onCheckedChange={handleSelectAll}
 />
 </TableHead>
 <TableHead>Name</TableHead>
 <TableHead>Phone</TableHead>
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
 No users with phone numbers found
 </TableCell>
 </TableRow>
 ) : (
 filteredProfiles.map((profile) => (
 <TableRow key={profile.id}>
 <TableCell>
 <Checkbox
 checked={selectedPhones.some(s => s.userId === profile.id)}
 onCheckedChange={(checked) =>
 handleSelectPhone(profile, checked as boolean)
 }
 />
 </TableCell>
 <TableCell className="font-medium">
 {profile.full_name ||"—"}
 </TableCell>
 <TableCell className="text-sm text-muted-foreground font-mono">
 {profile.phone}
 </TableCell>
 <TableCell>
 <Badge variant={profile.user_type ==="merchant" ?"default" :"secondary"} className="text-xs">
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
 </CardContent>
 </Card>

 {/* Right Column - Message Content */}
 <Card>
 <CardHeader>
 <CardTitle className="text-base">Message Content</CardTitle>
 <CardDescription>Compose your text message (160 chars per segment)</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div>
 <Label htmlFor="title">Campaign Title (internal use)</Label>
 <Input
 id="title"
 placeholder="e.g., January Promo, Flash Sale Alert..."
 value={campaignTitle}
 onChange={(e) => setCampaignTitle(e.target.value)}
 />
 </div>

 <div>
 <div className="flex justify-between items-center mb-1">
 <Label htmlFor="message">Message</Label>
 <span className={`text-xs ${characterCount > 160 ?'text-warning' :'text-muted-foreground'}`}>
 {characterCount}/160 ({segmentCount} segment{segmentCount !== 1 ?'s' :''})
 </span>
 </div>
 <Textarea
 id="message"
 placeholder="Enter your text message..."
 value={message}
 onChange={(e) => setMessage(e.target.value)}
 className="min-h-[150px] resize-none"
 maxLength={480}
 />
 <p className="text-xs text-muted-foreground mt-1">
 Keep messages concise. Standard SMS is 160 characters.
 </p>
 </div>

 {/* Message Preview */}
 <div className="bg-muted rounded-lg p-4">
 <h4 className="font-medium mb-2 text-sm">Preview</h4>
 <div className="bg-background rounded-xl border p-3 max-w-[280px] mx-auto">
 <div className="bg-primary/10 text-primary-foreground rounded-lg p-3 text-sm">
 {message ||"Your message will appear here..."}
 </div>
 <p className="text-xs text-muted-foreground mt-2 text-center">
 PawBucks
 </p>
 </div>
 </div>

 <Button
 onClick={handleSendCampaign}
 disabled={sending || recipientCount === 0}
 className="w-full"
 size="lg"
 >
 {sending ? (
 <>
 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
 Sending...
 </>
 ) : (
 <>
 <Send className="h-4 w-4 mr-2" />
 Send to {recipientCount} {recipientCount === 1 ?"Recipient" :"Recipients"}
 </>
 )}
 </Button>
 </CardContent>
 </Card>
 </div>
 )}

 {activeView ==="history" && (
 <Card>
 <CardHeader>
 <CardTitle className="text-base">Campaign History</CardTitle>
 <CardDescription>View all past text campaigns</CardDescription>
 </CardHeader>
 <CardContent>
 {loadingCampaigns ? (
 <div className="flex justify-center py-8">
 <Loader2 className="h-6 w-6 animate-spin" />
 </div>
 ) : campaigns.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
 <p>No campaigns yet</p>
 <Button variant="link" onClick={() => setActiveView("compose")}>
 Create your first campaign
 </Button>
 </div>
 ) : (
 <ScrollArea className="h-[400px]">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Title</TableHead>
 <TableHead>Recipients</TableHead>
 <TableHead>Sent / Failed</TableHead>
 <TableHead>Status</TableHead>
 <TableHead>Date</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {campaigns.map((campaign) => (
 <TableRow key={campaign.id}>
 <TableCell>
 <div>
 <p className="font-medium">{campaign.title}</p>
 <p className="text-xs text-muted-foreground truncate max-w-[200px]">
 {campaign.message}
 </p>
 </div>
 </TableCell>
 <TableCell>
 <Badge variant="outline" className="text-xs">
 {campaign.recipient_type}
 </Badge>
 <span className="text-sm ml-2">{campaign.recipient_count}</span>
 </TableCell>
 <TableCell>
 <span className="text-success">{campaign.sent_count}</span>
 {" /"}
 <span className="text-destructive">{campaign.failed_count}</span>
 </TableCell>
 <TableCell>{getStatusBadge(campaign.status)}</TableCell>
 <TableCell className="text-sm text-muted-foreground">
 {format(new Date(campaign.created_at),"MMM d, yyyy h:mm a")}
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </ScrollArea>
 )}
 </CardContent>
 </Card>
 )}

 {activeView ==="analytics" && (
 <div className="grid gap-4 md:grid-cols-4">
 <Card>
 <CardHeader className="pb-2">
 <CardDescription>Total Campaigns</CardDescription>
 <CardTitle className="text-3xl">{analytics.totalCampaigns}</CardTitle>
 </CardHeader>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardDescription>Messages Sent</CardDescription>
 <CardTitle className="text-3xl text-success">{analytics.totalSent}</CardTitle>
 </CardHeader>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardDescription>Messages Failed</CardDescription>
 <CardTitle className="text-3xl text-destructive">{analytics.totalFailed}</CardTitle>
 </CardHeader>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardDescription>Success Rate</CardDescription>
 <CardTitle className="text-3xl">{analytics.successRate}%</CardTitle>
 </CardHeader>
 </Card>
 </div>
 )}

 {/* Confirmation Dialog */}
 <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Confirm Send Campaign</DialogTitle>
 <DialogDescription>
 You are about to send a text message to {recipientCount} recipient{recipientCount !== 1 ?'s' :''}.
 </DialogDescription>
 </DialogHeader>
 <div className="space-y-3 py-4">
 <div className="bg-muted rounded-lg p-3">
 <p className="text-sm font-medium">Campaign: {campaignTitle}</p>
 <p className="text-sm text-muted-foreground mt-1">{message}</p>
 </div>
 <p className="text-sm text-muted-foreground">
 This action cannot be undone. Standard SMS rates may apply.
 </p>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
 Cancel
 </Button>
 <Button onClick={confirmSendCampaign}>
 <Send className="h-4 w-4 mr-2" />
 Send Campaign
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 );
}
