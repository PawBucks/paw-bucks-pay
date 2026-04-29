import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Loader2, Image, Paperclip, Check, CheckCheck, Search } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

type Message = {
  id: string;
  message: string;
  sender_type: string;
  created_at: string;
  user_id: string;
  is_read: boolean;
  read_at: string | null;
  attachments?: Attachment[];
};

type Attachment = {
  id: string;
  file_url: string;
  file_type: string;
  file_name: string | null;
};

type Conversation = {
  user_id: string;
  owner_name: string;
  owner_phone: string | null;
  pet_name: string | null;
  unread_count: number;
  last_message_at: string;
};

type SecureMessagingTabProps = {
  vetId: string;
};

export const SecureMessagingTab = ({ vetId }: SecureMessagingTabProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
  }, [vetId]);

  useEffect(() => {
    if (!selectedUserId) return;

    loadMessages();
    markMessagesAsRead();

    // Subscribe to new messages
    const channel = supabase
      .channel(`vet_messages_${vetId}_${selectedUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "vet_messages",
          filter: `vet_id=eq.${vetId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.user_id === selectedUserId) {
            setMessages((prev) => [...prev, newMsg]);
            if (newMsg.sender_type === "owner") {
              markMessagesAsRead();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedUserId, vetId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const { data: messagesData, error } = await supabase
        .from("vet_messages")
        .select(`
          user_id,
          created_at,
          is_read,
          sender_type
        `)
        .eq("vet_id", vetId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group by user and get stats
      const userMap = new Map<string, { last_message_at: string; unread_count: number }>();
      messagesData?.forEach((msg) => {
        const existing = userMap.get(msg.user_id);
        if (!existing) {
          userMap.set(msg.user_id, {
            last_message_at: msg.created_at,
            unread_count: msg.sender_type === "owner" && !msg.is_read ? 1 : 0,
          });
        } else if (msg.sender_type === "owner" && !msg.is_read) {
          existing.unread_count++;
        }
      });

      // Get user profiles
      const userIds = Array.from(userMap.keys());
      if (userIds.length === 0) {
        setIsLoading(false);
        return;
      }

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", userIds);

      // Get pet info for each user
      const { data: petsData } = await supabase
        .from("pet_profiles")
        .select("user_id, name")
        .in("user_id", userIds);

      const petMap = new Map(petsData?.map(p => [p.user_id, p.name]));

      const convList: Conversation[] = profilesData?.map((profile) => {
        const stats = userMap.get(profile.id)!;
        return {
          user_id: profile.id,
          owner_name: profile.full_name || "Unknown",
          owner_phone: profile.phone,
          pet_name: petMap.get(profile.id) || null,
          unread_count: stats.unread_count,
          last_message_at: stats.last_message_at,
        };
      }).sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()) || [];

      setConversations(convList);
      if (convList.length > 0 && !selectedUserId) {
        setSelectedUserId(convList[0].user_id);
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
      toast.error("Failed to load conversations");
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("vet_messages")
        .select(`
          *,
          attachments:vet_message_attachments(*)
        `)
        .eq("vet_id", vetId)
        .eq("user_id", selectedUserId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error("Error loading messages:", error);
      toast.error("Failed to load messages");
    }
  };

  const markMessagesAsRead = async () => {
    try {
      await supabase
        .from("vet_messages")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("vet_id", vetId)
        .eq("user_id", selectedUserId)
        .eq("sender_type", "owner")
        .eq("is_read", false);

      // Update local conversation list
      setConversations((prev) =>
        prev.map((c) =>
          c.user_id === selectedUserId ? { ...c, unread_count: 0 } : c
        )
      );
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  };

  const handleSendMessage = async (attachmentUrl?: string) => {
    if (!newMessage.trim() && !attachmentUrl) return;

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: messageData, error } = await supabase
        .from("vet_messages")
        .insert({
          user_id: selectedUserId,
          vet_id: vetId,
          sender_type: "vet",
          message: newMessage.trim() || (attachmentUrl ? "Sent an attachment" : ""),
          is_read: false,
        })
        .select()
        .single();

      if (error) throw error;

      // If there's an attachment, add it
      if (attachmentUrl && messageData) {
        await supabase.from("vet_message_attachments").insert({
          message_id: messageData.id,
          file_url: attachmentUrl,
          file_type: "image",
          file_name: "attachment",
        });
      }

      setNewMessage("");
      loadMessages();
      loadConversations();
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast.error(error.message || "Failed to send message");
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
      const fileName = `${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from("vet-imaging")
        .upload(`messages/${vetId}/${fileName}`, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from("vet-imaging")
        .getPublicUrl(data.path);

      await handleSendMessage(publicUrl);
    } catch (error: any) {
      console.error("Error uploading file:", error);
      toast.error(error.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const filteredConversations = conversations.filter(
    (c) =>
      c.owner_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.pet_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedConversation = conversations.find((c) => c.user_id === selectedUserId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Secure Messaging
        </h2>
        <p className="text-sm text-muted-foreground">
          HIPAA-compliant communication with pet owners
        </p>
      </div>

      {conversations.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No conversations yet.</p>
          <p className="text-sm mt-1">Messages from pet owners will appear here.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
          {/* Conversation List */}
          <Card className="p-4 overflow-hidden flex flex-col">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-2">
                {filteredConversations.map((conv) => (
                  <div
                    key={conv.user_id}
                    onClick={() => setSelectedUserId(conv.user_id)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedUserId === conv.user_id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{conv.owner_name}</span>
                      {conv.unread_count > 0 && (
                        <Badge className="bg-destructive text-white">{conv.unread_count}</Badge>
                      )}
                    </div>
                    {conv.pet_name && (
                      <p className={`text-sm truncate ${
                        selectedUserId === conv.user_id ? "text-primary-foreground/80" : "text-muted-foreground"
                      }`}>
                        Pet: {conv.pet_name}
                      </p>
                    )}
                    <p className={`text-xs ${
                      selectedUserId === conv.user_id ? "text-primary-foreground/60" : "text-muted-foreground"
                    }`}>
                      {format(parseISO(conv.last_message_at), "MMM d, h:mm a")}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>

          {/* Messages Panel */}
          <Card className="md:col-span-2 p-4 flex flex-col overflow-hidden">
            {selectedConversation && (
              <div className="pb-3 border-b mb-3">
                <h3 className="font-medium">{selectedConversation.owner_name}</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedConversation.pet_name && `Pet: ${selectedConversation.pet_name}`}
                </p>
              </div>
            )}

            <ScrollArea className="flex-1 mb-4">
              <div className="space-y-3 pr-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender_type === "vet" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        msg.sender_type === "vet"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
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
                          {format(parseISO(msg.created_at), "h:mm a")}
                        </p>
                        {msg.sender_type === "vet" && (
                          msg.is_read ? (
                            <CheckCheck className="w-3 h-3 opacity-70" />
                          ) : (
                            <Check className="w-3 h-3 opacity-70" />
                          )
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

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
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Image className="w-4 h-4" />
                )}
              </Button>
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                rows={2}
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
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
      )}
    </div>
  );
};
