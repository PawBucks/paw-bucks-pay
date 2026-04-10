import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Loader2, Image, Paperclip, Check, CheckCheck, Search, UserPlus } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SecureAttachment } from "@/components/shared/SecureAttachment";

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
  customer_name: string;
  unread_count: number;
  last_message_at: string;
  last_message_preview: string;
};

type PastCustomer = {
  user_id: string;
  full_name: string;
};

type MerchantMessagesTabProps = {
  merchantId: string;
};

export const MerchantMessagesTab = ({ merchantId }: MerchantMessagesTabProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [showNewConvoDialog, setShowNewConvoDialog] = useState(false);
  const [pastCustomers, setPastCustomers] = useState<PastCustomer[]>([]);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
  }, [merchantId]);

  useEffect(() => {
    if (!selectedUserId) return;
    loadMessages();
    markMessagesAsRead();

    const channel = supabase
      .channel(`merchant_messages_${merchantId}_${selectedUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "merchant_messages",
          filter: `merchant_id=eq.${merchantId}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          if (newMsg.user_id === selectedUserId) {
            setMessages((prev) => [...prev, newMsg]);
            if (newMsg.sender_type === "customer") {
              markMessagesAsRead();
            }
          }
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedUserId, merchantId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const { data: messagesData, error } = await supabase
        .from("merchant_messages")
        .select("user_id, created_at, is_read, sender_type, message")
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const userMap = new Map<string, { last_message_at: string; unread_count: number; last_message_preview: string }>();
      messagesData?.forEach((msg) => {
        const existing = userMap.get(msg.user_id);
        if (!existing) {
          userMap.set(msg.user_id, {
            last_message_at: msg.created_at,
            unread_count: msg.sender_type === "customer" && !msg.is_read ? 1 : 0,
            last_message_preview: msg.message.substring(0, 50),
          });
        } else if (msg.sender_type === "customer" && !msg.is_read) {
          existing.unread_count++;
        }
      });

      const userIds = Array.from(userMap.keys());
      if (userIds.length === 0) {
        setConversations([]);
        setIsLoading(false);
        return;
      }

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const convList: Conversation[] = profilesData?.map((profile) => {
        const stats = userMap.get(profile.id)!;
        return {
          user_id: profile.id,
          customer_name: profile.full_name || "Customer",
          unread_count: stats.unread_count,
          last_message_at: stats.last_message_at,
          last_message_preview: stats.last_message_preview,
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
        .from("merchant_messages")
        .select("*, attachments:merchant_message_attachments(*)")
        .eq("merchant_id", merchantId)
        .eq("user_id", selectedUserId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages((data as any) || []);
    } catch (error) {
      console.error("Error loading messages:", error);
      toast.error("Failed to load messages");
    }
  };

  const markMessagesAsRead = async () => {
    try {
      await supabase
        .from("merchant_messages")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("merchant_id", merchantId)
        .eq("user_id", selectedUserId)
        .eq("sender_type", "customer")
        .eq("is_read", false);

      setConversations((prev) =>
        prev.map((c) =>
          c.user_id === selectedUserId ? { ...c, unread_count: 0 } : c
        )
      );
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  };

  const handleSendMessage = async (attachmentUrl?: string, attachmentName?: string, attachmentType?: string) => {
    if (!newMessage.trim() && !attachmentUrl) return;

    setIsSending(true);
    try {
      const { data: messageData, error } = await supabase
        .from("merchant_messages")
        .insert({
          user_id: selectedUserId,
          merchant_id: merchantId,
          sender_type: "merchant",
          message: newMessage.trim() || (attachmentUrl ? "Sent an attachment" : ""),
          is_read: false,
        })
        .select()
        .single();

      if (error) throw error;

      if (attachmentUrl && messageData) {
        await supabase.from("merchant_message_attachments").insert({
          message_id: messageData.id,
          file_url: attachmentUrl,
          file_type: attachmentType || "file",
          file_name: attachmentName || "attachment",
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

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setIsUploading(true);
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from("merchant-messages")
        .upload(`${merchantId}/${fileName}`, file);

      if (error) throw error;

      // Store the path; signed URLs will be generated at display time
      const storagePath = data.path;

      const fileType = file.type.startsWith("image/") ? "image" : "file";
      await handleSendMessage(storagePath, file.name, fileType);
    } catch (error: any) {
      console.error("Error uploading file:", error);
      toast.error(error.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const loadPastCustomers = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("transactions")
        .select("user_id")
        .eq("merchant_id", merchantId)
        .eq("status", "completed")
        .not("user_id", "is", null);

      if (!data) return;

      const uniqueIds = [...new Set(data.map((t) => t.user_id).filter(Boolean))] as string[];
      const existingConvoIds = new Set(conversations.map((c) => c.user_id));
      const newCustomerIds = uniqueIds.filter((id) => !existingConvoIds.has(id));

      if (newCustomerIds.length === 0) {
        setPastCustomers([]);
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", newCustomerIds);

      setPastCustomers(
        profiles?.map((p) => ({ user_id: p.id, full_name: p.full_name || "Customer" })) || []
      );
    } catch (error) {
      console.error("Error loading past customers:", error);
    }
  }, [merchantId, conversations]);

  const startNewConversation = async (customerId: string, customerName: string) => {
    setSelectedUserId(customerId);
    setShowNewConvoDialog(false);
    // Add to conversations list if not already there
    if (!conversations.find((c) => c.user_id === customerId)) {
      setConversations((prev) => [
        {
          user_id: customerId,
          customer_name: customerName,
          unread_count: 0,
          last_message_at: new Date().toISOString(),
          last_message_preview: "",
        },
        ...prev,
      ]);
    }
  };

  const filteredConversations = conversations.filter((c) =>
    c.customer_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPastCustomers = pastCustomers.filter((c) =>
    c.full_name.toLowerCase().includes(customerSearchQuery.toLowerCase())
  );

  const selectedConversation = conversations.find((c) => c.user_id === selectedUserId);
  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Customer Messages
            {totalUnread > 0 && (
              <Badge variant="destructive">{totalUnread}</Badge>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            Communicate with your customers
          </p>
        </div>
        <Dialog open={showNewConvoDialog} onOpenChange={(open) => {
          setShowNewConvoDialog(open);
          if (open) loadPastCustomers();
        }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <UserPlus className="w-4 h-4 mr-2" />
              New Message
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Message a Customer</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Search customers..."
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
              />
              <ScrollArea className="h-64">
                {filteredPastCustomers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    No additional customers found.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredPastCustomers.map((customer) => (
                      <Button
                        key={customer.user_id}
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => startNewConversation(customer.user_id, customer.full_name)}
                      >
                        {customer.full_name}
                      </Button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {conversations.length === 0 && !selectedUserId ? (
        <Card className="p-8 text-center text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No conversations yet.</p>
          <p className="text-sm mt-1">Messages from customers will appear here, or start a new conversation.</p>
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
                      <span className="font-medium truncate">{conv.customer_name}</span>
                      {conv.unread_count > 0 && (
                        <Badge className="bg-destructive text-destructive-foreground">{conv.unread_count}</Badge>
                      )}
                    </div>
                    <p className={`text-sm truncate ${
                      selectedUserId === conv.user_id ? "text-primary-foreground/80" : "text-muted-foreground"
                    }`}>
                      {conv.last_message_preview}
                    </p>
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
                <h3 className="font-medium">{selectedConversation.customer_name}</h3>
              </div>
            )}

            <ScrollArea className="flex-1 mb-4">
              <div className="space-y-3 pr-4">
                {messages.length === 0 && (
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    No messages yet. Start the conversation!
                  </p>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender_type === "merchant" ? "justify-end" : "justify-start"}`}
                  >
                    <div className="max-w-[80%]">
                      <p className={`text-xs mb-1 font-medium ${msg.sender_type === "merchant" ? "text-right text-muted-foreground" : "text-left text-muted-foreground"}`}>
                        {msg.sender_type === "merchant" ? "You" : selectedConversation?.customer_name || "Customer"}
                      </p>
                      <div
                        className={`rounded-lg p-3 ${
                          msg.sender_type === "merchant"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mb-2 space-y-2">
                          {msg.attachments.map((att) => (
                            <SecureAttachment
                              key={att.id}
                              fileUrl={att.file_url}
                              fileType={att.file_type}
                              fileName={att.file_name}
                            />
                          ))}
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <p className="text-xs opacity-70">
                          {format(parseISO(msg.created_at), "h:mm a")}
                        </p>
                        {msg.sender_type === "merchant" && (
                          msg.is_read ? (
                            <CheckCheck className="w-3 h-3 opacity-70" />
                          ) : (
                            <Check className="w-3 h-3 opacity-70" />
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {selectedUserId && (
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.txt"
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
                    <Paperclip className="w-4 h-4" />
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
            )}
          </Card>
        </div>
      )}
    </div>
  );
};
