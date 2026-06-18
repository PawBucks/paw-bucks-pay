import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { SEO } from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

// ────────────────────────────────────────────────────────────────────────────
// Community Resources Forum — pet owners + merchants only.
// Pet-owner-style surface, emojis allowed by design decision.
// ────────────────────────────────────────────────────────────────────────────

const C = {
  teal: "#12a8b3", tealDark: "#0a8f9a", tealPale: "#e8f9fa", tealBorder: "#99f0ea",
  ink: "#0f172a", muted: "#475569", mutedLight: "#94a3b8",
  border: "#e8edf2", borderLight: "#f1f5f9",
  white: "#fff", bg: "#f8f9fa",
  red: "#ef4444", green: "#16a34a", amber: "#d97706",
};

type CommunityCategory = "health" | "events" | "lostfound" | "training" | "general";
type AuthorRole = "pet_owner" | "merchant";

interface PostRow {
  id: string;
  author_id: string;
  author_name: string;
  author_role: AuthorRole;
  author_photo_url: string | null;
  category: CommunityCategory;
  text: string;
  media_url: string | null;
  media_type: "image" | "video" | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
}

interface CommentRow {
  id: string;
  post_id: string;
  author_id: string;
  author_name: string;
  author_role: AuthorRole;
  author_photo_url: string | null;
  text: string;
  created_at: string;
}

const CATEGORIES: { id: "all" | CommunityCategory; label: string; emoji: string }[] = [
  { id: "all",       label: "All Posts",    emoji: "🏠" },
  { id: "health",    label: "Health",       emoji: "🩺" },
  { id: "events",    label: "Local Events", emoji: "📅" },
  { id: "lostfound", label: "Lost & Found", emoji: "🐾" },
  { id: "training",  label: "Training",     emoji: "🎓" },
  { id: "general",   label: "General Chat", emoji: "💬" },
];

const initials = (name: string) =>
  name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
const fmtCount = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n));
const ago = (iso: string) => {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: false }) + " ago"; }
  catch { return ""; }
};

const I = ({ d, size = 16, stroke = 2, color = "currentColor", fill = "none" }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color}
    strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const Avatar = ({ name, photo, size = 40, role }: { name: string; photo?: string | null; size?: number; role?: AuthorRole }) => (
  <div style={{ position: "relative", flexShrink: 0 }}>
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: role === "merchant"
        ? `linear-gradient(135deg, ${C.teal}, ${C.tealDark})`
        : `linear-gradient(135deg, #94a3b8, #64748b)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 700, fontSize: size * 0.36, overflow: "hidden",
    }}>
      {photo ? <img src={photo} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(name)}
    </div>
    {role === "merchant" && (
      <div style={{ position: "absolute", bottom: -2, right: -2, width: size * 0.42, height: size * 0.42, borderRadius: "50%", background: C.teal, border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width={size * 0.22} height={size * 0.22} viewBox="0 0 24 24" fill="#fff" stroke="none">
          <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    )}
  </div>
);

const MerchantBadge = () => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 999, background: C.tealPale, border: `1px solid ${C.tealBorder}`, color: C.tealDark, fontSize: 10, fontWeight: 700 }}>
    🏪 Merchant
  </span>
);

const CategoryTag = ({ id }: { id: CommunityCategory }) => {
  const cat = CATEGORIES.find((c) => c.id === id);
  if (!cat) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 999, background: "#f1f5f9", color: C.muted, fontSize: 11, fontWeight: 500 }}>
      {cat.emoji} {cat.label}
    </span>
  );
};

// ── Composer ────────────────────────────────────────────────────────────────
const Composer = ({
  authorName, authorRole, authorPhoto, onPosted,
}: {
  authorName: string; authorRole: AuthorRole; authorPhoto: string | null;
  onPosted: () => void;
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [category, setCategory] = useState<CommunityCategory>("general");
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const submit = async () => {
    if (!text.trim() || !user) return;
    setSubmitting(true);
    const { error } = await supabase.from("community_posts").insert({
      author_id: user.id,
      author_name: authorName,
      author_role: authorRole,
      author_photo_url: authorPhoto,
      category,
      text: text.trim(),
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Couldn't post", description: error.message, variant: "destructive" });
      return;
    }
    setText(""); setExpanded(false); setCategory("general");
    onPosted();
  };

  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <Avatar name={authorName} photo={authorPhoto} role={authorRole} size={38} />
        <div style={{ flex: 1 }}>
          <textarea
            ref={taRef}
            value={text}
            maxLength={4000}
            onChange={(e) => { setText(e.target.value); setExpanded(true); }}
            onFocus={() => setExpanded(true)}
            placeholder={authorRole === "merchant"
              ? "Share an update, tip, or event with the community..."
              : "What's on your mind? Ask a question, share a moment..."}
            style={{ width: "100%", border: "none", outline: "none", resize: "none", fontFamily: "inherit", fontSize: 14, color: C.ink, minHeight: expanded ? 70 : 38, padding: "8px 0", transition: "min-height 0.15s", background: "transparent" }}
          />
          {expanded && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: C.mutedLight, fontWeight: 500 }}>Category:</span>
                {CATEGORIES.filter((c) => c.id !== "all").map((c) => (
                  <button key={c.id} type="button" onClick={() => setCategory(c.id as CommunityCategory)}
                    style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", border: "none", background: category === c.id ? C.teal : "#f1f5f9", color: category === c.id ? "#fff" : C.muted }}>
                    {c.emoji} {c.label}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" onClick={() => { setExpanded(false); setText(""); }}
                  style={{ padding: "8px 14px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.white, color: C.muted, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                  Cancel
                </button>
                <button type="button" onClick={submit} disabled={!text.trim() || submitting}
                  style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: text.trim() && !submitting ? C.teal : "#cbd5e1", color: "#fff", fontSize: 12, fontWeight: 600, cursor: text.trim() && !submitting ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                  {submitting ? "Posting..." : "Post"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Comments ────────────────────────────────────────────────────────────────
const CommentSection = ({
  postId, authorName, authorRole, authorPhoto,
}: {
  postId: string; authorName: string; authorRole: AuthorRole; authorPhoto: string | null;
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data, error } = await supabase
        .from("community_comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (!cancel) {
        if (!error && data) setComments(data as CommentRow[]);
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [postId]);

  const submit = async () => {
    if (!input.trim() || !user) return;
    const txt = input.trim();
    setInput("");
    const { data, error } = await supabase.from("community_comments").insert({
      post_id: postId,
      author_id: user.id,
      author_name: authorName,
      author_role: authorRole,
      author_photo_url: authorPhoto,
      text: txt,
    }).select().single();
    if (error) {
      toast({ title: "Couldn't comment", description: error.message, variant: "destructive" });
      setInput(txt);
      return;
    }
    if (data) setComments((c) => [...c, data as CommentRow]);
  };

  return (
    <div style={{ borderTop: `1px solid ${C.borderLight}`, padding: "12px 14px" }}>
      {loading && <div style={{ fontSize: 11, color: C.mutedLight }}>Loading comments…</div>}
      {!loading && comments.length === 0 && (
        <div style={{ fontSize: 11, color: C.mutedLight, marginBottom: 10 }}>No comments yet — be the first.</div>
      )}
      {comments.map((c) => (
        <div key={c.id} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <Avatar name={c.author_name} photo={c.author_photo_url} size={28} role={c.author_role} />
          <div style={{ flex: 1, background: C.bg, borderRadius: 10, padding: "7px 11px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 1 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{c.author_name}</span>
              {c.author_role === "merchant" && <MerchantBadge />}
              <span style={{ fontSize: 10, color: C.mutedLight, marginLeft: "auto" }}>{ago(c.created_at)}</span>
            </div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.text}</div>
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Avatar name={authorName} photo={authorPhoto} size={28} role={authorRole} />
        <input
          value={input}
          maxLength={2000}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder="Write a comment..."
          style={{ flex: 1, padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 999, fontSize: 12, fontFamily: "inherit", outline: "none" }}
        />
      </div>
    </div>
  );
};

// ── Post card ────────────────────────────────────────────────────────────────
const PostCard = ({
  post, liked, saved, onToggleLike, onToggleSave,
  authorName, authorRole, authorPhoto,
  currentUserId, onEdit, onDelete,
}: {
  post: PostRow;
  liked: boolean;
  saved: boolean;
  onToggleLike: (id: string) => void;
  onToggleSave: (id: string) => void;
  authorName: string; authorRole: AuthorRole; authorPhoto: string | null;
  currentUserId?: string;
  onEdit: (id: string, text: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}) => {
  const [showComments, setShowComments] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(post.text);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const isOwner = !!currentUserId && currentUserId === post.author_id;

  const copyLink = async () => {
    const url = `https://pawbucks.app/community#${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied" });
    } catch {
      toast({ title: "Link", description: url });
    }
  };

  return (
    <div id={post.id} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, marginBottom: 14, overflow: "hidden" }}>
      <div style={{ padding: "14px 14px 0", display: "flex", alignItems: "flex-start", gap: 10 }}>
        <Avatar name={post.author_name} photo={post.author_photo_url} role={post.author_role} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{post.author_name}</span>
            {post.author_role === "merchant" && <MerchantBadge />}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
            <span style={{ fontSize: 11, color: C.mutedLight }}>{ago(post.created_at)}</span>
            {post.category !== "general" && (<><span style={{ color: C.borderLight }}>·</span><CategoryTag id={post.category} /></>)}
          </div>
        </div>
        {isOwner && (
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setShowMenu((s) => !s)}
              aria-label="Post options"
              style={{ background: "none", border: "none", cursor: "pointer", color: C.mutedLight, padding: 4, borderRadius: 6, fontFamily: "inherit" }}
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
            </button>
            {showMenu && (
              <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: "0 4px 16px rgba(15,23,42,0.08)", zIndex: 5, minWidth: 130, overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => { setShowMenu(false); setIsEditing(true); setEditText(post.text); }}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, color: C.ink }}
                >
                  ✏️ Edit
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setShowMenu(false);
                    if (!confirm("Delete this post? This cannot be undone.")) return;
                    setBusy(true);
                    await onDelete(post.id);
                    setBusy(false);
                  }}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, color: C.red, borderTop: `1px solid ${C.borderLight}` }}
                >
                  🗑 Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {isEditing ? (
        <div style={{ padding: "10px 14px 0" }}>
          <textarea
            value={editText}
            maxLength={4000}
            onChange={(e) => setEditText(e.target.value)}
            style={{ width: "100%", minHeight: 80, padding: 10, border: `1px solid ${C.border}`, borderRadius: 10, fontFamily: "inherit", fontSize: 13.5, color: C.ink, outline: "none", resize: "vertical" }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button type="button" onClick={() => { setIsEditing(false); setEditText(post.text); }}
              style={{ padding: "7px 13px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.white, color: C.muted, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            <button type="button" disabled={busy || !editText.trim() || editText.trim() === post.text}
              onClick={async () => { setBusy(true); await onEdit(post.id, editText.trim()); setBusy(false); setIsEditing(false); }}
              style={{ padding: "7px 14px", borderRadius: 9, border: "none", background: editText.trim() && editText.trim() !== post.text && !busy ? C.teal : "#cbd5e1", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ padding: "10px 14px 0", fontSize: 13.5, color: C.ink, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{post.text}</div>
      )}

      {post.media_url && (
        <div style={{ margin: "12px 14px 0", borderRadius: 10, overflow: "hidden", border: `1px solid ${C.tealBorder}` }}>
          {post.media_type === "video" ? (
            <video src={post.media_url} controls style={{ width: "100%", display: "block" }} />
          ) : (
            <img src={post.media_url} alt="" style={{ width: "100%", display: "block" }} />
          )}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px 8px", fontSize: 11, color: C.mutedLight }}>
        <span>{post.likes_count > 0 ? `${fmtCount(post.likes_count)} likes` : ""}</span>
        <span>{post.comments_count > 0 ? `${post.comments_count} comments` : ""}</span>
      </div>

      <div style={{ display: "flex", borderTop: `1px solid ${C.borderLight}`, padding: "4px 4px" }}>
        {[
          { key: "like",    label: liked ? "Liked" : "Like", icon: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z", active: liked, color: C.red, onClick: () => onToggleLike(post.id), fillWhenActive: C.red },
          { key: "comment", label: "Comment", icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", active: showComments, color: C.teal, onClick: () => setShowComments((s) => !s), fillWhenActive: "none" },
          { key: "share",   label: "Share",   icon: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13", active: showShareMenu, color: C.teal, onClick: () => setShowShareMenu((s) => !s), fillWhenActive: "none" },
          { key: "save",    label: saved ? "Saved" : "Save", icon: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z", active: saved, color: C.amber, onClick: () => onToggleSave(post.id), fillWhenActive: C.amber },
        ].map((btn) => (
          <button key={btn.key} type="button" onClick={btn.onClick}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", color: btn.active ? btn.color : C.muted, borderRadius: 8 }}>
            <I d={btn.icon} size={15} fill={btn.active ? btn.fillWhenActive : "none"} color={btn.active ? btn.color : "currentColor"} />
            <span style={{ fontSize: 12, fontWeight: 500 }}>{btn.label}</span>
          </button>
        ))}
      </div>

      {showShareMenu && (
        <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.borderLight}`, background: C.bg, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={copyLink} style={{ padding: "6px 12px", borderRadius: 999, border: `1px solid ${C.border}`, background: C.white, fontSize: 11, fontWeight: 500, color: C.muted, cursor: "pointer", fontFamily: "inherit" }}>🔗 Copy Link</button>
          <a href={`sms:?body=${encodeURIComponent(`https://pawbucks.app/community#${post.id}`)}`} style={{ padding: "6px 12px", borderRadius: 999, border: `1px solid ${C.border}`, background: C.white, fontSize: 11, fontWeight: 500, color: C.muted, textDecoration: "none" }}>💬 SMS</a>
          <a href={`mailto:?subject=PawBucks%20Community&body=${encodeURIComponent(`https://pawbucks.app/community#${post.id}`)}`} style={{ padding: "6px 12px", borderRadius: 999, border: `1px solid ${C.border}`, background: C.white, fontSize: 11, fontWeight: 500, color: C.muted, textDecoration: "none" }}>📧 Email</a>
        </div>
      )}

      {showComments && (
        <CommentSection
          postId={post.id}
          authorName={authorName}
          authorRole={authorRole}
          authorPhoto={authorPhoto}
        />
      )}
    </div>
  );
};

// ── Page ─────────────────────────────────────────────────────────────────────
const Community = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [category, setCategory] = useState<"all" | CommunityCategory>("all");
  const [sort, setSort] = useState<"recent" | "popular">("recent");

  // Current user profile (for posting identity)
  const { data: me } = useQuery({
    queryKey: ["community-me", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, user_type")
        .eq("id", user!.id)
        .maybeSingle();
      let name = profile?.full_name || user!.email || "Member";
      let role: AuthorRole = profile?.user_type === "merchant" ? "merchant" : "pet_owner";
      const photo = profile?.avatar_url ?? null;
      if (role === "merchant") {
        const { data: m } = await supabase
          .from("merchants")
          .select("business_name")
          .eq("user_id", user!.id)
          .maybeSingle();
        if (m?.business_name) name = m.business_name;
      }
      return { name, role, photo };
    },
  });

  const PAGE_SIZE = 20;
  const {
    data: postsPages,
    refetch,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["community-posts", category, sort],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const from = (pageParam as number) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let q = supabase.from("community_posts").select("*").range(from, to);
      if (category !== "all") q = q.eq("category", category);
      q = sort === "popular"
        ? q.order("likes_count", { ascending: false }).order("created_at", { ascending: false })
        : q.order("created_at", { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as PostRow[];
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < PAGE_SIZE ? undefined : allPages.length,
  });
  const posts = useMemo(() => (postsPages?.pages.flat() ?? []) as PostRow[], [postsPages]);

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage();
    }, { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const updatePost = async (postId: string, text: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("community_posts")
      .update({ text })
      .eq("id", postId)
      .eq("author_id", user.id);
    if (error) {
      toast({ title: "Couldn't update", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.setQueryData<any>(["community-posts", category, sort], (prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        pages: prev.pages.map((page: PostRow[]) =>
          page.map((p) => (p.id === postId ? { ...p, text } : p))
        ),
      };
    });
    toast({ title: "Post updated" });
  };

  const deletePost = async (postId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("community_posts")
      .delete()
      .eq("id", postId)
      .eq("author_id", user.id);
    if (error) {
      toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.setQueryData<any>(["community-posts", category, sort], (prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        pages: prev.pages.map((page: PostRow[]) => page.filter((p) => p.id !== postId)),
      };
    });
    toast({ title: "Post deleted" });
  };

  const { data: likedSet = new Set<string>() } = useQuery({
    queryKey: ["community-likes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("community_likes")
        .select("post_id")
        .eq("user_id", user!.id);
      return new Set<string>((data || []).map((r: any) => r.post_id));
    },
  });

  const { data: savedSet = new Set<string>() } = useQuery({
    queryKey: ["community-saves", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("community_saves")
        .select("post_id")
        .eq("user_id", user!.id);
      return new Set<string>((data || []).map((r: any) => r.post_id));
    },
  });

  const toggleLike = async (postId: string) => {
    if (!user) return;
    const isLiked = likedSet.has(postId);
    // Optimistic
    queryClient.setQueryData<Set<string>>(["community-likes", user.id], (prev) => {
      const next = new Set(prev || []);
      isLiked ? next.delete(postId) : next.add(postId);
      return next;
    });
    queryClient.setQueryData<any>(["community-posts", category, sort], (prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        pages: prev.pages.map((page: PostRow[]) =>
          page.map((p) => (p.id === postId ? { ...p, likes_count: p.likes_count + (isLiked ? -1 : 1) } : p))
        ),
      };
    });
    const { error } = isLiked
      ? await supabase.from("community_likes").delete().eq("post_id", postId).eq("user_id", user.id)
      : await supabase.from("community_likes").insert({ post_id: postId, user_id: user.id });
    if (error) {
      toast({ title: "Couldn't update like", description: error.message, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["community-likes", user.id] });
      queryClient.invalidateQueries({ queryKey: ["community-posts"] });
    }
  };

  const toggleSave = async (postId: string) => {
    if (!user) return;
    const isSaved = savedSet.has(postId);
    queryClient.setQueryData<Set<string>>(["community-saves", user.id], (prev) => {
      const next = new Set(prev || []);
      isSaved ? next.delete(postId) : next.add(postId);
      return next;
    });
    const { error } = isSaved
      ? await supabase.from("community_saves").delete().eq("post_id", postId).eq("user_id", user.id)
      : await supabase.from("community_saves").insert({ post_id: postId, user_id: user.id });
    if (error) {
      toast({ title: "Couldn't update save", description: error.message, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["community-saves", user.id] });
    }
  };

  const sorted = posts;

  const author = me ?? { name: "Member", role: "pet_owner" as AuthorRole, photo: null };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", paddingBottom: 80 }}>
      <SEO
        title="Community Resources | PawBucks"
        description="Connect with pet owners and merchants near you. Ask questions, share moments, and discover local pet care tips."
      />
      <Header
        isAuthenticated={!!user}
        onLogout={signOut}
        userId={user?.id}
        variant={author.role === "merchant" ? "merchant" : "petowner"}
      />

      {/* Page header */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: "16px 16px 0" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: C.teal, marginBottom: 4 }}>COMMUNITY RESOURCES</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: C.ink, letterSpacing: "-0.02em", marginBottom: 4 }}>Connect with pet owners and merchants near you</div>
          <div style={{ fontSize: 12, color: C.mutedLight, marginBottom: 14 }}>Ask questions, share moments, and discover local pet care tips.</div>

          <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 12 }}>
            {CATEGORIES.map((c) => (
              <button key={c.id} type="button" onClick={() => setCategory(c.id)}
                style={{ padding: "6px 13px", borderRadius: 999, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", border: "none", whiteSpace: "nowrap", flexShrink: 0, background: category === c.id ? C.teal : C.white, color: category === c.id ? "#fff" : C.muted, boxShadow: category === c.id ? "none" : `inset 0 0 0 1px ${C.border}` }}>
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sort bar */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: "8px 16px", display: "flex", gap: 14, justifyContent: "center" }}>
        {[["recent", "Most Recent"], ["popular", "Most Popular"]].map(([id, label]) => (
          <button key={id} type="button" onClick={() => setSort(id as any)}
            style={{ background: "none", border: "none", fontSize: 12, fontWeight: sort === id ? 600 : 400, color: sort === id ? C.teal : C.muted, cursor: "pointer", fontFamily: "inherit", padding: "4px 0", borderBottom: `2px solid ${sort === id ? C.teal : "transparent"}` }}>
            {label}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div style={{ padding: "16px 16px 80px", maxWidth: 600, margin: "0 auto" }}>
        {user && (
          <Composer
            authorName={author.name}
            authorRole={author.role}
            authorPhoto={author.photo}
            onPosted={() => refetch()}
          />
        )}

        {isLoading ? (
          <div style={{ textAlign: "center", padding: 40, color: C.mutedLight, fontSize: 13 }}>Loading…</div>
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", color: C.mutedLight }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.muted }}>No posts in this category yet</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Be the first to start a conversation</div>
          </div>
        ) : (
          sorted.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              liked={likedSet.has(post.id)}
              saved={savedSet.has(post.id)}
              onToggleLike={toggleLike}
              onToggleSave={toggleSave}
              authorName={author.name}
              authorRole={author.role}
              authorPhoto={author.photo}
              currentUserId={user?.id}
              onEdit={updatePost}
              onDelete={deletePost}
            />
          ))
        )}

        {/* Infinite scroll sentinel + status */}
        {!isLoading && sorted.length > 0 && (
          <div ref={sentinelRef} style={{ textAlign: "center", padding: 20, color: C.mutedLight, fontSize: 12 }}>
            {isFetchingNextPage ? "Loading more…" : hasNextPage ? "" : "You're all caught up 🎉"}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Community;