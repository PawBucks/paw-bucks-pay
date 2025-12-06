import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MessageCircle, Send, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type PartnerVetPublic = {
  id: string;
  name: string;
  location: string;
};

type Message = {
  id: string;
  message: string;
  sender_type: string;
  created_at: string;
  vet_id: string;
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

  // Load partner vets
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

  // Load messages for selected vet
  useEffect(() => {
    if (!selectedVetId) return;

    const loadMessages = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("vet_messages")
          .select("*")
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

    // Subscribe to new messages
    const channel = supabase
      .channel(`vet_messages_${selectedVetId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "vet_messages",
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

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedVetId) return;

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("vet_messages").insert({
        user_id: user.id,
        vet_id: selectedVetId,
        pet_id: petId || null,
        sender_type: "owner",
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

  if (vets.length === 0) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
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
                className={`flex ${msg.sender_type === "owner" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    msg.sender_type === "owner"
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
