import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageSquare, Send, Loader2, Check, CheckCheck, Paperclip } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

type Message = {
  id: string;
  message: string;
  sender_type: string;
  created_at: string;
  is_read: boolean;
  attachments?: { id: string; file_url: string; file_type: string; file_name: string | null }[];
};

type AskQuestionButtonProps = {
  merchantId: string;
  merchantName: string;
};

export const AskQuestionButton = ({ merchantId, merchantName }: AskQuestionButtonProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && user) {
      loadMessages();
      markAsRead();

      const channel = supabase
        .channel(`customer_merchant_msgs_${merchantId}_${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "merchant_messages",
            filter: `merchant_id=eq.${merchantId}`,
          },
          (payload) => {
            const msg = payload.new as any;
            if (msg.user_id === user.id) {
              setMessages((prev) => [...prev, msg]);
              if (msg.sender_type === "merchant") markAsRead();
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [open, user, merchantId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadMessages = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("merchant_messages")
        .select("*, attachments:merchant_message_attachments(*)")
        .eq("merchant_id", merchantId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages((data as any) || []);
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async () => {
    if (!user) return;
    await supabase
      .from("merchant_messages")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("merchant_id", merchantId)
      .eq("user_id", user.id)
      .eq("sender_type", "merchant")
      .eq("is_read", false);
  };

  const handleSend = async (attachmentUrl?: string, attachmentName?: string, attachmentType?: string) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!newMessage.trim() && !attachmentUrl) return;

    setIsSending(true);
    try {
      const { data: messageData, error } = await supabase
        .from("merchant_messages")
        .insert({
          user_id: user.id,
          merchant_id: merchantId,
          sender_type: "customer",
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
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast.error(error.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

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
      await handleSend(storagePath, file.name, fileType);
    } catch (error: any) {
      console.error("Error uploading file:", error);
      toast.error(error.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && !user) {
      toast.info("Please sign in to message this merchant");
      navigate("/auth");
      return;
    }
    setOpen(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <MessageSquare className="h-4 w-4" />
          Ask a Question
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Chat with {merchantName}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No messages yet.</p>
              <p className="text-xs mt-1">Ask anything about products, services, or availability!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_type === "customer" ? "justify-end" : "justify-start"}`}
                >
                  <div className="max-w-[80%]">
                    <p className={`text-xs mb-1 font-medium ${msg.sender_type === "customer" ? "text-right text-muted-foreground" : "text-left text-muted-foreground"}`}>
                      {msg.sender_type === "customer" ? "You" : merchantName}
                    </p>
                    <div
                      className={`rounded-lg p-3 ${
                        msg.sender_type === "customer"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mb-2 space-y-1">
                        {msg.attachments.map((att) => (
                          <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer" className="block">
                            {att.file_type === "image" ? (
                              <img src={att.file_url} alt={att.file_name || "Attachment"} className="max-w-full rounded-md max-h-40 object-cover" />
                            ) : (
                              <div className="flex items-center gap-2 text-sm underline">
                                <Paperclip className="w-3 h-3" />
                                {att.file_name || "Download"}
                              </div>
                            )}
                          </a>
                        ))}
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-xs opacity-70">
                        {format(parseISO(msg.created_at), "h:mm a")}
                      </span>
                      {msg.sender_type === "customer" && (
                        msg.is_read ? <CheckCheck className="w-3 h-3 opacity-70" /> : <Check className="w-3 h-3 opacity-70" />
                      )}
                    </div>
                  </div>
                </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        <div className="flex gap-2 pt-2 border-t">
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
            className="flex-shrink-0"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
          </Button>
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your question..."
            rows={2}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            onClick={() => handleSend()}
            disabled={!newMessage.trim() || isSending}
            size="icon"
            className="h-auto flex-shrink-0"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
