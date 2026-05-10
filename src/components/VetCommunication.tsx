import { useEffect, useState, useRef } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Textarea } from"@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from"@/components/ui/select";
import { Label } from"@/components/ui/label";
import { Send, Loader2, Check, CheckCheck } from "lucide-react";
import { format, parseISO } from"date-fns";
import { toast } from"sonner";

type PartnerVetPublic = {
 id: string;
 name: string;
 location: string;
};

type Attachment = {
 id: string;
 file_url: string;
 file_type: string;
 file_name: string | null;
};

type Message = {
 id: string;
 message: string;
 sender_type: string;
 created_at: string;
 vet_id: string;
 is_read: boolean;
 attachments?: Attachment[];
};

type VetCommunicationProps = {
 petId?: string;
};

export const VetCommunication = ({ petId }: VetCommunicationProps) => {
 const [vets, setVets] = useState<PartnerVetPublic[]>([]);
 const [selectedVetId, setSelectedVetId] = useState<string>("");
 const [messages, setMessages] = useState<Message[]>([]);
 const [newMessage, setNewMessage] = useState("");
 const [isLoading, setIsLoading] = useState(false);
 const [isSending, setIsSending] = useState(false);
 const [isUploading, setIsUploading] = useState(false);
 const fileInputRef = useRef<HTMLInputElement>(null);
 const messagesEndRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
 const loadVets = async () => {
 const { data, error } = await supabase
 .from("partner_vets_public")
 .select("id, name, location")
 .order("name");

 if (!error && data) {
 setVets(data);
 if (data.length > 0 && !selectedVetId) {
 setSelectedVetId(data[0].id);
 }
 }
 };

 loadVets();
 }, []);

 useEffect(() => {
 if (!selectedVetId) return;

 const loadMessages = async () => {
 setIsLoading(true);
 try {
 const { data, error } = await supabase
 .from("vet_messages")
 .select(`
 *,
 attachments:vet_message_attachments(*)
 `)
 .eq("vet_id", selectedVetId)
 .order("created_at", { ascending: true });

 if (error) throw error;
 setMessages(data || []);
 } catch (error) {
 console.error("Error loading messages:", error);
 toast.error("Failed to load messages");
 } finally {
 setIsLoading(false);
 }
 };

 loadMessages();

 const channel = supabase
 .channel(`vet_messages_${selectedVetId}`)
 .on(
"postgres_changes",
 {
 event:"INSERT",
 schema:"public",
 table:"vet_messages",
 filter: `vet_id=eq.${selectedVetId}`,
 },
 (payload) => {
 setMessages((prev) => [...prev, payload.new as Message]);
 }
 )
 .subscribe();

 return () => {
 supabase.removeChannel(channel);
 };
 }, [selectedVetId]);

 useEffect(() => {
 messagesEndRef.current?.scrollIntoView({ behavior:"smooth" });
 }, [messages]);

 const handleSendMessage = async (attachmentUrl?: string) => {
 if (!newMessage.trim() && !attachmentUrl) return;
 if (!selectedVetId) return;

 setIsSending(true);
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) throw new Error("Not authenticated");

 const { data: messageData, error } = await supabase.from("vet_messages").insert({
 user_id: user.id,
 vet_id: selectedVetId,
 pet_id: petId || null,
 sender_type:"owner",
 message: newMessage.trim() || (attachmentUrl ?"Sent a photo" :""),
 }).select().single();

 if (error) throw error;

 if (attachmentUrl && messageData) {
 await supabase.from("vet_message_attachments").insert({
 message_id: messageData.id,
 file_url: attachmentUrl,
 file_type:"image",
 file_name:"attachment",
 });
 }

 setNewMessage("");
 toast.success("Message sent");
 } catch (error: any) {
 console.error("Error sending message:", error);
 toast.error(error.message ||"Failed to send message");
 } finally {
 setIsSending(false);
 }
 };

 const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;

 if (!file.type.startsWith("image/")) {
 toast.error("Please select an image file");
 return;
 }

 if (file.size > 5 * 1024 * 1024) {
 toast.error("File size must be less than 5MB");
 return;
 }

 setIsUploading(true);
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) throw new Error("Not authenticated");

 const fileName = `${Date.now()}-${file.name}`;
 const { data, error } = await supabase.storage
 .from("medical-records")
 .upload(`messages/${user.id}/${fileName}`, file);

 if (error) throw error;

 const { data: { publicUrl } } = supabase.storage
 .from("medical-records")
 .getPublicUrl(data.path);

 await handleSendMessage(publicUrl);
 } catch (error: any) {
 console.error("Error uploading file:", error);
 toast.error(error.message ||"Failed to upload file");
 } finally {
 setIsUploading(false);
 if (fileInputRef.current) {
 fileInputRef.current.value ="";
 }
 }
 };

 if (vets.length === 0) {
 return (
 <Card className="p-6 text-center text-muted-foreground">
 <span className="w-12 h-12 mx-auto mb-2 opacity-50" aria-hidden="true">💬</span>
 <p>No partner vets available at this time.</p>
 </Card>
 );
 }

 const selectedVet = vets.find((v) => v.id === selectedVetId);

 return (
 <div className="space-y-4">
 <div className="space-y-2">
 <Label>Select Vet</Label>
 <Select value={selectedVetId} onValueChange={setSelectedVetId}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {vets.map((vet) => (
 <SelectItem key={vet.id} value={vet.id}>
 {vet.name} - {vet.location}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 {selectedVet && (
 <Card className="p-4 bg-muted/30">
 <p className="text-sm text-muted-foreground">
 You're messaging <strong>{selectedVet.name}</strong> in {selectedVet.location}
 </p>
 <p className="text-xs text-muted-foreground mt-1">
 This is a secure, HIPAA-compliant messaging channel. You can share photos of your pet's condition.
 </p>
 </Card>
 )}

 <Card className="p-4 h-96 flex flex-col">
 <div className="flex-1 overflow-y-auto space-y-3 mb-4">
 {isLoading ? (
 <div className="text-center py-8 text-muted-foreground">Loading messages...</div>
 ) : messages.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 No messages yet. Start a conversation with your vet!
 </div>
 ) : (
 messages.map((msg) => (
 <div
 key={msg.id}
 className={`flex ${msg.sender_type ==="owner" ?"justify-end" :"justify-start"}`}
 >
 <div
 className={`max-w-[80%] rounded-lg p-3 ${
 msg.sender_type ==="owner"
 ?"bg-primary text-primary-foreground"
 :"bg-muted"
 }`}
 >
 {msg.attachments && msg.attachments.length > 0 && (
 <div className="mb-2">
 {msg.attachments.map((att) => (
 <a
 key={att.id}
 href={att.file_url}
 target="_blank"
 rel="noopener noreferrer"
 className="block"
 >
 <img
 src={att.file_url}
 alt="Attachment"
 className="max-w-full rounded-md max-h-48 object-cover"
 />
 </a>
 ))}
 </div>
 )}
 <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
 <div className="flex items-center justify-end gap-1 mt-1">
 <p className="text-xs opacity-70">
 {format(parseISO(msg.created_at),"MMM d, h:mm a")}
 </p>
 {msg.sender_type ==="owner" && (
 msg.is_read ? (
 <CheckCheck className="w-3 h-3 opacity-70" />
 ) : (
 <Check className="w-3 h-3 opacity-70" />
 )
 )}
 </div>
 </div>
 </div>
 ))
 )}
 <div ref={messagesEndRef} />
 </div>

 <div className="flex gap-2">
 <input
 ref={fileInputRef}
 type="file"
 accept="image/*"
 onChange={handleFileUpload}
 className="hidden"
 />
 <Button
 variant="outline"
 size="icon"
 onClick={() => fileInputRef.current?.click()}
 disabled={isUploading}
 title="Send a photo"
 >
 {isUploading ? (
 <Loader2 className="w-4 h-4 animate-spin" />
 ) : (
 <span className="w-4 h-4" aria-hidden="true">🖼️</span>
 )}
 </Button>
 <Textarea
 value={newMessage}
 onChange={(e) => setNewMessage(e.target.value)}
 placeholder="Type your message..."
 rows={2}
 className="flex-1"
 onKeyDown={(e) => {
 if (e.key ==="Enter" && !e.shiftKey) {
 e.preventDefault();
 handleSendMessage();
 }
 }}
 />
 <Button
 onClick={() => handleSendMessage()}
 disabled={!newMessage.trim() || isSending}
 size="icon"
 className="h-auto"
 >
 {isSending ? (
 <Loader2 className="w-4 h-4 animate-spin" />
 ) : (
 <Send className="w-4 h-4" />
 )}
 </Button>
 </div>
 </Card>
 </div>
 );
};
