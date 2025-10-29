import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Send, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type Message = {
  id: string;
  message: string;
  sender_type: string;
  created_at: string;
  user_id: string;
};

type Conversation = {
  user_id: string;
  owner_name: string;
};

type VetMessagesPanelProps = {
  vetId: string;
};

export const VetMessagesPanel = ({ vetId }: VetMessagesPanelProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    loadConversations();
  }, [vetId]);

  useEffect(() => {
    if (!selectedUserId) return;

    loadMessages();

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
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedUserId, vetId]);

  const loadConversations = async () => {
    try {
      const { data: messages, error } = await supabase
        .from("vet_messages")
        .select(`
          user_id,
          profiles:user_id (
            full_name
          )
        `)
        .eq("vet_id", vetId);

      if (error) throw error;

      // Deduplicate conversations
      const uniqueConversations = new Map<string, Conversation>();
      messages?.forEach((msg: any) => {
        if (msg.profiles && !uniqueConversations.has(msg.user_id)) {
          uniqueConversations.set(msg.user_id, {
            user_id: msg.user_id,
            owner_name: msg.profiles.full_name,
          });
        }
      });

      const convList = Array.from(uniqueConversations.values());
      setConversations(convList);
      if (convList.length > 0 && !selectedUserId) {
        setSelectedUserId(convList[0].user_id);
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
      toast.error("Failed to load conversations");
    }
  };

  const loadMessages = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("vet_messages")
        .select("*")
        .eq("vet_id", vetId)
        .eq("user_id", selectedUserId)
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

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedUserId) return;

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("vet_messages").insert({
        user_id: selectedUserId,
        vet_id: vetId,
        sender_type: "vet",
        message: newMessage.trim(),
      });

      if (error) throw error;

      setNewMessage("");
      toast.success("Message sent");
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast.error(error.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  if (conversations.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        <p>No conversations yet. Wait for pet owners to message you.</p>
      </Card>
    );
  }

  const selectedConversation = conversations.find((c) => c.user_id === selectedUserId);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Select Conversation</Label>
        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {conversations.map((conv) => (
              <SelectItem key={conv.user_id} value={conv.user_id}>
                {conv.owner_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedConversation && (
        <Card className="p-4 bg-muted/30">
          <p className="text-sm text-muted-foreground">
            Chatting with <strong>{selectedConversation.owner_name}</strong>
          </p>
        </Card>
      )}

      <Card className="p-4 h-96 flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-3 mb-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No messages yet.
            </div>
          ) : (
            messages.map((msg) => (
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
                  <p className="text-sm">{msg.message}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {format(new Date(msg.created_at), "MMM d, h:mm a")}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex gap-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <Button
            onClick={handleSendMessage}
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
