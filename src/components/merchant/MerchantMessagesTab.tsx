import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import { toast } from "sonner";
import { SecureAttachment } from "@/components/shared/SecureAttachment";

// Brand palette (matches Merchant Workspace teal system)
const C = {
  teal: "#12a8b3",
  tealDark: "#0a8f9a",
  tealPale: "#e8f9fa",
  ink: "#0f172a",
  muted: "#475569",
  mutedLight: "#94a3b8",
  border: "#e8edf2",
  borderLight: "#f1f5f9",
  white: "#ffffff",
  bg: "#f8f9fa",
  green: "#16a34a",
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
  user_id: string;
  is_read: boolean;
  read_at: string | null;
  attachments?: Attachment[];
};

type Tier = "Free" | "PawPass" | "PawPass+";

type Conversation = {
  user_id: string;
  customer_name: string;
  avatar: string;
  tier: Tier;
  tierColor: string;
  unread_count: number;
  last_message_at: string;
  last_message_preview: string;
};

type PastCustomer = {
  user_id: string;
  full_name: string;
  avatar: string;
  tier: Tier;
  tierColor: string;
};

type Props = { merchantId: string };

const tierColor = (tier: Tier) =>
  tier === "PawPass+" ? "#6d28d9" : tier === "PawPass" ? C.tealDark : C.mutedLight;

const initialsOf = (name: string) =>
  (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || "")
    .join("") || "?";

const fmtListTime = (iso: string) => {
  const d = parseISO(iso);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d");
};

const fmtBubbleTime = (iso: string) => format(parseISO(iso), "h:mm a");

const fmtDateDivider = (iso: string) => {
  const d = parseISO(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d, yyyy");
};

// ── Avatar ──────────────────────────────────────────────────────────────────
const Avatar = ({ initials, size = 38 }: { initials: string; size?: number }) => (
  <div style={{ position: "relative", flexShrink: 0 }}>
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#f1f5f9",
        color: C.muted,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.36,
        fontWeight: 600,
      }}
    >
      {initials}
    </div>
  </div>
);

const ReadReceipt = ({ read }: { read: boolean }) => (
  <svg width="14" height="10" viewBox="0 0 14 10" fill="none" style={{ flexShrink: 0, opacity: read ? 1 : 0.5 }}>
    <path d="M1 5l3 3 5-7" stroke={read ? "#a5f3fc" : "rgba(255,255,255,0.6)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 5l3 3 5-7" stroke={read ? "#a5f3fc" : "rgba(255,255,255,0.6)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ── New Message Modal ──────────────────────────────────────────────────────
const NewMessageModal = ({
  onClose,
  onSelect,
  customers,
}: {
  onClose: () => void;
  onSelect: (id: string, name: string, tier: Tier) => void;
  customers: PastCustomer[];
}) => {
  const [search, setSearch] = useState("");
  const filtered = customers.filter((t) => t.full_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.45)",
        backdropFilter: "blur(4px)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: C.white, borderRadius: 16, width: "100%", maxWidth: 420, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "18px 20px 12px", borderBottom: `1px solid ${C.borderLight}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>New Message</div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: "#f1f5f9", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }} aria-label="Close">×</button>
        </div>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.borderLight}` }}>
          <div style={{ position: "relative" }}>
            <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: C.mutedLight }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customers…"
              style={{ width: "100%", padding: "9px 12px 9px 34px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
            />
          </div>
        </div>
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          {filtered.map((c) => (
            <div
              key={c.user_id}
              onClick={() => { onSelect(c.user_id, c.full_name, c.tier); onClose(); }}
              style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.tealPale)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Avatar initials={c.avatar} size={40} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{c.full_name}</div>
                <div style={{ fontSize: 11, color: c.tierColor, fontWeight: 500 }}>{c.tier}</div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: "32px 16px", textAlign: "center", color: C.mutedLight, fontSize: 13 }}>No customers found</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Thread List ─────────────────────────────────────────────────────────────
const ThreadList = ({
  threads,
  activeId,
  onSelect,
  search,
  onSearch,
  onNewMessage,
}: {
  threads: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearch: (s: string) => void;
  onNewMessage: () => void;
}) => (
  <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.white }}>
    <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${C.borderLight}`, flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Messages</span>
        <button
          onClick={onNewMessage}
          style={{ display: "flex", alignItems: "center", gap: 5, background: C.teal, color: "#fff", padding: "6px 12px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          New Message
        </button>
      </div>
      <div style={{ position: "relative" }}>
        <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: C.mutedLight }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search conversations..."
          style={{ width: "100%", padding: "8px 12px 8px 32px", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontFamily: "inherit", color: C.ink, background: C.bg, outline: "none", boxSizing: "border-box" }}
        />
      </div>
    </div>

    <div style={{ flex: 1, overflowY: "auto" }}>
      {threads.length === 0 && (
        <div style={{ padding: "32px 16px", textAlign: "center", color: C.mutedLight, fontSize: 13 }}>
          No conversations yet.
        </div>
      )}
      {threads.map((t) => {
        const active = t.user_id === activeId;
        return (
          <div
            key={t.user_id}
            onClick={() => onSelect(t.user_id)}
            style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", background: active ? C.teal : "transparent", borderBottom: `1px solid ${active ? "transparent" : C.borderLight}`, transition: "background 0.12s" }}
            onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLDivElement).style.background = C.tealPale; }}
            onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
          >
            <Avatar initials={t.avatar} size={42} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: t.unread_count > 0 ? 700 : 500, color: active ? "#fff" : C.ink }}>{t.customer_name}</span>
                <span style={{ fontSize: 11, color: active ? "rgba(255,255,255,0.75)" : C.mutedLight, whiteSpace: "nowrap", marginLeft: 8 }}>{fmtListTime(t.last_message_at)}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <span style={{ fontSize: 12, color: active ? "rgba(255,255,255,0.85)" : C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.last_message_preview}</span>
                {t.unread_count > 0 && !active && (
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: C.teal, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{t.unread_count}</div>
                )}
              </div>
              <div style={{ fontSize: 10, color: active ? "rgba(255,255,255,0.7)" : t.tierColor, fontWeight: 500, marginTop: 2 }}>{t.tier}</div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// ── Conversation View ──────────────────────────────────────────────────────
const ConversationView = ({
  thread,
  messages,
  onBack,
  isMobile,
  onSend,
  onAttach,
  isSending,
  isUploading,
}: {
  thread: Conversation;
  messages: Message[];
  onBack: () => void;
  isMobile: boolean;
  onSend: (text: string) => void;
  onAttach: (file: File) => void;
  isSending: boolean;
  isUploading: boolean;
}) => {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, thread.user_id]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput("");
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group by date
  const grouped = useMemo(() => {
    const out: Record<string, Message[]> = {};
    messages.forEach((m) => {
      const key = fmtDateDivider(m.created_at);
      (out[key] ||= []).push(m);
    });
    return out;
  }, [messages]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg }}>
      {/* Header */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        {isMobile && (
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: C.teal, padding: "4px 8px 4px 0", display: "flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 500, fontFamily: "inherit" }} aria-label="Back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
        )}
        <Avatar initials={thread.avatar} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{thread.customer_name}</div>
          <div style={{ fontSize: 11 }}>
            <span style={{ color: thread.tierColor, fontWeight: 500 }}>{thread.tier}</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: C.mutedLight, fontSize: 13, padding: "32px 16px" }}>
            No messages yet. Start the conversation!
          </div>
        )}
        {Object.entries(grouped).map(([date, msgs]) => (
          <div key={date}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 14px" }}>
              <div style={{ flex: 1, height: 1, background: C.border }} />
              <span style={{ fontSize: 11, color: C.mutedLight, fontWeight: 500, whiteSpace: "nowrap" }}>{date}</span>
              <div style={{ flex: 1, height: 1, background: C.border }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {msgs.map((msg, idx) => {
                const mine = msg.sender_type === "merchant";
                const isLast = idx === msgs.length - 1;
                const nextMine = msgs[idx + 1] ? msgs[idx + 1].sender_type === "merchant" : null;
                const showTail = isLast || mine !== nextMine;
                return (
                  <div key={msg.id} style={{ display: "flex", flexDirection: mine ? "row-reverse" : "row", alignItems: "flex-end", gap: 6 }}>
                    {!mine && (
                      <div style={{ width: 28, flexShrink: 0 }}>
                        {showTail && <Avatar initials={thread.avatar} size={28} />}
                      </div>
                    )}
                    <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
                      <div style={{
                        padding: "9px 13px",
                        borderRadius: mine
                          ? showTail ? "18px 18px 4px 18px" : "18px"
                          : showTail ? "18px 18px 18px 4px" : "18px",
                        background: mine ? C.teal : C.white,
                        color: mine ? "#fff" : C.ink,
                        border: mine ? "none" : `1px solid ${C.border}`,
                        fontSize: 13,
                        lineHeight: 1.45,
                        wordBreak: "break-word",
                        boxShadow: mine ? "none" : "0 1px 3px rgba(0,0,0,0.05)",
                      }}>
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div style={{ marginBottom: msg.message ? 8 : 0, display: "flex", flexDirection: "column", gap: 6 }}>
                            {msg.attachments.map((att) => (
                              <SecureAttachment key={att.id} fileUrl={att.file_url} fileType={att.file_type} fileName={att.file_name} />
                            ))}
                          </div>
                        )}
                        {msg.message && <div style={{ whiteSpace: "pre-wrap" }}>{msg.message}</div>}
                      </div>
                      {showTail && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3, padding: "0 2px" }}>
                          <span style={{ fontSize: 10, color: C.mutedLight }}>{fmtBubbleTime(msg.created_at)}</span>
                          {mine && <ReadReceipt read={msg.is_read} />}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ background: C.white, borderTop: `1px solid ${C.border}`, padding: "10px 14px", display: "flex", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.txt"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onAttach(f);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
          style={{ display: "none" }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, cursor: isUploading ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.mutedLight, flexShrink: 0 }}
          aria-label="Attach"
        >
          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
          )}
        </button>
        <div style={{ flex: 1 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type your message..."
            rows={1}
            style={{
              width: "100%",
              padding: "9px 14px",
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              fontSize: 13,
              fontFamily: "inherit",
              color: C.ink,
              background: C.bg,
              outline: "none",
              resize: "none",
              lineHeight: 1.4,
              maxHeight: 100,
              overflowY: "auto",
              boxSizing: "border-box",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => (e.target.style.borderColor = C.teal)}
            onBlur={(e) => (e.target.style.borderColor = C.border)}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!input.trim() || isSending}
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: input.trim() && !isSending ? C.teal : C.border,
            border: "none",
            cursor: input.trim() && !isSending ? "pointer" : "default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "background 0.15s",
          }}
          aria-label="Send"
        >
          {isSending ? <Loader2 className="w-4 h-4 animate-spin" color="#fff" /> : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
          )}
        </button>
      </div>
    </div>
  );
};

// ── Empty State ─────────────────────────────────────────────────────────────
const EmptyState = ({ onNewMessage }: { onNewMessage: () => void }) => (
  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: C.bg, color: C.mutedLight, height: "100%" }}>
    <div style={{ width: 64, height: 64, borderRadius: "50%", background: C.tealPale, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth={1.5} strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
    </div>
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.ink, marginBottom: 4 }}>No conversation selected</div>
      <div style={{ fontSize: 13, color: C.mutedLight }}>Choose a conversation from the list, or start a new one.</div>
    </div>
    <button onClick={onNewMessage} style={{ background: C.teal, color: "#fff", padding: "9px 18px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}>
      Start a Conversation
    </button>
  </div>
);

// ── Main ────────────────────────────────────────────────────────────────────
export const MerchantMessagesTab = ({ merchantId }: Props) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [showNewMsg, setShowNewMsg] = useState(false);
  const [pastCustomers, setPastCustomers] = useState<PastCustomer[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "convo">("list");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Build tier maps from subscriptions
  const fetchTiers = async (userIds: string[]): Promise<Map<string, Tier>> => {
    const map = new Map<string, Tier>();
    if (userIds.length === 0) return map;
    const { data } = await supabase
      .from("subscriptions")
      .select("user_id, subscription_tier, status")
      .in("user_id", userIds)
      .eq("status", "active");
    data?.forEach((s: any) => {
      const t = (s.subscription_tier || "free").toLowerCase();
      const tier: Tier = t.includes("plus") || t === "pawpass+" ? "PawPass+" : t === "pawpass" || t === "premium" ? "PawPass" : "Free";
      map.set(s.user_id, tier);
    });
    return map;
  };

  const loadConversations = useCallback(async () => {
    try {
      const { data: messagesData, error } = await supabase
        .from("merchant_messages")
        .select("user_id, created_at, is_read, sender_type, message")
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userMap = new Map<string, { last_message_at: string; unread_count: number; last_message_preview: string }>();
      messagesData?.forEach((msg: any) => {
        const existing = userMap.get(msg.user_id);
        if (!existing) {
          userMap.set(msg.user_id, {
            last_message_at: msg.created_at,
            unread_count: msg.sender_type === "customer" && !msg.is_read ? 1 : 0,
            last_message_preview: (msg.message || "").substring(0, 60),
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

      const [{ data: profiles }, tiers] = await Promise.all([
        supabase.rpc("get_customer_profiles_for_merchant", { p_user_ids: userIds }),
        fetchTiers(userIds),
      ]);

      const list: Conversation[] = (profiles || [])
        .map((p: any) => {
          const stats = userMap.get(p.id)!;
          const tier = tiers.get(p.id) || "Free";
          return {
            user_id: p.id,
            customer_name: p.full_name || "Customer",
            avatar: initialsOf(p.full_name || "Customer"),
            tier,
            tierColor: tierColor(tier),
            unread_count: stats.unread_count,
            last_message_at: stats.last_message_at,
            last_message_preview: stats.last_message_preview,
          };
        })
        .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

      setConversations(list);
    } catch (e) {
      console.error("Error loading conversations:", e);
      toast.error("Failed to load conversations");
    } finally {
      setIsLoading(false);
    }
  }, [merchantId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const loadMessages = useCallback(async () => {
    if (!selectedUserId) return;
    const { data, error } = await supabase
      .from("merchant_messages")
      .select("*, attachments:merchant_message_attachments(*)")
      .eq("merchant_id", merchantId)
      .eq("user_id", selectedUserId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error(error);
      toast.error("Failed to load messages");
      return;
    }
    setMessages((data as any) || []);
  }, [merchantId, selectedUserId]);

  const markRead = useCallback(async () => {
    if (!selectedUserId) return;
    await supabase
      .from("merchant_messages")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("merchant_id", merchantId)
      .eq("user_id", selectedUserId)
      .eq("sender_type", "customer")
      .eq("is_read", false);
    setConversations((prev) => prev.map((c) => (c.user_id === selectedUserId ? { ...c, unread_count: 0 } : c)));
  }, [merchantId, selectedUserId]);

  useEffect(() => {
    if (!selectedUserId) return;
    loadMessages();
    markRead();
    const channel = supabase
      .channel(`merchant_messages_${merchantId}_${selectedUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "merchant_messages", filter: `merchant_id=eq.${merchantId}` },
        (payload) => {
          const newMsg = payload.new as any;
          if (newMsg.user_id === selectedUserId) {
            setMessages((prev) => (prev.find((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]));
            if (newMsg.sender_type === "customer") markRead();
          }
          loadConversations();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedUserId, merchantId, loadMessages, markRead, loadConversations]);

  const handleSelect = (id: string) => {
    setSelectedUserId(id);
    if (isMobile) setMobileView("convo");
  };

  const sendMessage = async (text: string, attachment?: { url: string; name: string; type: string }) => {
    if (!selectedUserId) return;
    setIsSending(true);
    try {
      const { data: messageData, error } = await supabase
        .from("merchant_messages")
        .insert({
          user_id: selectedUserId,
          merchant_id: merchantId,
          sender_type: "merchant",
          message: text || (attachment ? "Sent an attachment" : ""),
          is_read: false,
        })
        .select()
        .single();
      if (error) throw error;

      if (attachment && messageData) {
        await supabase.from("merchant_message_attachments").insert({
          message_id: messageData.id,
          file_url: attachment.url,
          file_type: attachment.type,
          file_name: attachment.name,
        });
      }
      await loadMessages();
      await loadConversations();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleAttach = async (file: File) => {
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
      const fileType = file.type.startsWith("image/") ? "image" : "file";
      await sendMessage("", { url: data.path, name: file.name, type: fileType });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const loadPastCustomers = useCallback(async () => {
    try {
      const { data: txns } = await supabase
        .from("transactions")
        .select("user_id")
        .eq("merchant_id", merchantId)
        .eq("status", "completed")
        .not("user_id", "is", null);
      const txnIds = [...new Set((txns || []).map((t: any) => t.user_id).filter(Boolean))] as string[];
      const convoIds = new Set(conversations.map((c) => c.user_id));
      const unionIds = Array.from(new Set([...txnIds, ...conversations.map((c) => c.user_id)]));
      if (unionIds.length === 0) {
        setPastCustomers([]);
        return;
      }
      const [{ data: profiles }, tiers] = await Promise.all([
        supabase.rpc("get_customer_profiles_for_merchant", { p_user_ids: unionIds }),
        fetchTiers(unionIds),
      ]);
      const list: PastCustomer[] = (profiles || []).map((p: any) => {
        const tier = tiers.get(p.id) || "Free";
        return {
          user_id: p.id,
          full_name: p.full_name || "Customer",
          avatar: initialsOf(p.full_name || "Customer"),
          tier,
          tierColor: tierColor(tier),
        };
      });
      // surface non-conversation customers first
      list.sort((a, b) => Number(convoIds.has(a.user_id)) - Number(convoIds.has(b.user_id)));
      setPastCustomers(list);
    } catch (e) {
      console.error(e);
    }
  }, [merchantId, conversations]);

  const filteredConvos = conversations.filter(
    (c) =>
      c.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      c.last_message_preview.toLowerCase().includes(search.toLowerCase())
  );

  const activeThread = conversations.find((c) => c.user_id === selectedUserId);
  const totalUnread = conversations.reduce((n, c) => n + c.unread_count, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div
      style={{
        fontFamily: "'Inter', system-ui, sans-serif",
        color: C.ink,
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        overflow: "hidden",
        height: "calc(100vh - 220px)",
        minHeight: 560,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Inner header with unread badge */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
          Inbox
          {totalUnread > 0 && (
            <span style={{ background: C.teal, color: "#fff", fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 999 }}>{totalUnread}</span>
          )}
        </div>
        {isMobile && mobileView === "list" && (
          <button
            onClick={() => { loadPastCustomers(); setShowNewMsg(true); }}
            style={{ background: C.teal, color: "#fff", padding: "7px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            New
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflow: "hidden", display: isMobile ? "block" : "grid", gridTemplateColumns: "320px 1fr" }}>
        {(!isMobile || mobileView === "list") && (
          <div style={{ height: "100%", borderRight: isMobile ? "none" : `1px solid ${C.border}` }}>
            <ThreadList
              threads={filteredConvos}
              activeId={selectedUserId}
              onSelect={handleSelect}
              search={search}
              onSearch={setSearch}
              onNewMessage={() => { loadPastCustomers(); setShowNewMsg(true); }}
            />
          </div>
        )}
        {(!isMobile || mobileView === "convo") && (
          <div style={{ height: "100%" }}>
            {activeThread ? (
              <ConversationView
                thread={activeThread}
                messages={messages}
                onBack={() => { setMobileView("list"); setSelectedUserId(null); }}
                isMobile={isMobile}
                onSend={(t) => sendMessage(t)}
                onAttach={handleAttach}
                isSending={isSending}
                isUploading={isUploading}
              />
            ) : (
              !isMobile && <EmptyState onNewMessage={() => { loadPastCustomers(); setShowNewMsg(true); }} />
            )}
          </div>
        )}
      </div>

      {showNewMsg && (
        <NewMessageModal
          customers={pastCustomers}
          onClose={() => setShowNewMsg(false)}
          onSelect={(id, name, tier) => {
            if (!conversations.find((c) => c.user_id === id)) {
              setConversations((prev) => [
                {
                  user_id: id,
                  customer_name: name,
                  avatar: initialsOf(name),
                  tier,
                  tierColor: tierColor(tier),
                  unread_count: 0,
                  last_message_at: new Date().toISOString(),
                  last_message_preview: "",
                },
                ...prev,
              ]);
            }
            handleSelect(id);
          }}
        />
      )}
    </div>
  );
};
