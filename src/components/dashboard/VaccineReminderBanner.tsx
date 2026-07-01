import { useEffect, useState, useCallback } from"react";
import { useNavigate } from"react-router-dom";
import { motion, AnimatePresence } from"framer-motion";
import { Syringe, X, ChevronRight, CheckCheck } from"lucide-react";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { supabase } from"@/integrations/supabase/client";
import { formatDistanceToNow } from"date-fns";
import { cn } from"@/lib/utils";

interface VaccineNotification {
 id: string;
 title: string;
 message: string;
 is_read: boolean;
 created_at: string;
 link_url: string | null;
}

interface Props {
 userId: string;
}

export const VaccineReminderBanner = ({ userId }: Props) => {
 const navigate = useNavigate();
 const [items, setItems] = useState<VaccineNotification[]>([]);
 const [expanded, setExpanded] = useState(false);

 const load = useCallback(async () => {
 const { data } = await supabase
 .from("notifications")
 .select("id, title, message, is_read, created_at, link_url")
 .eq("user_id", userId)
 .eq("category","vaccine_reminder")
 .order("created_at", { ascending: false })
 .limit(10);
 if (data) setItems(data as VaccineNotification[]);
 }, [userId]);

 useEffect(() => {
 if (!userId) return;
 load();
 const channel = supabase
 .channel(`vaccine-reminders-${userId}`)
 .on(
"postgres_changes",
 { event:"*", schema:"public", table:"notifications", filter: `user_id=eq.${userId}` },
 () => load(),
 )
 .subscribe();
 return () => {
 supabase.removeChannel(channel);
 };
 }, [userId, load]);

 const unread = items.filter((i) => !i.is_read);
 if (items.length === 0) return null;

 const markRead = async (id: string) => {
 await supabase.from("notifications").update({ is_read: true }).eq("id", id);
 setItems((prev) => prev.map((i) => (i.id === id ? { ...i, is_read: true } : i)));
 };

 const markAllRead = async () => {
 const ids = unread.map((i) => i.id);
 if (ids.length === 0) return;
 await supabase.from("notifications").update({ is_read: true }).in("id", ids);
 setItems((prev) => prev.map((i) => ({ ...i, is_read: true })));
 };

 const open = async (n: VaccineNotification) => {
 if (!n.is_read) await markRead(n.id);
 if (n.link_url) navigate(n.link_url);
 };

 const visible = expanded ? items : items.slice(0, 2);

 return (
 <div className="space-y-2">
 {unread.length > 0 && (
 <div className="flex items-center justify-between px-1">
 <div className="flex items-center gap-2">
 <Syringe className="w-4 h-4 text-primary" />
 <span className="text-sm font-semibold">Vaccine reminders</span>
 <Badge variant="destructive" className="h-5 px-1.5 text-xs">{unread.length} new</Badge>
 </div>
 <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
 <CheckCheck className="w-3 h-3 mr-1" /> Mark all read
 </Button>
 </div>
 )}

 <AnimatePresence initial={false}>
 {visible.map((n) => (
 <motion.div
 key={n.id}
 initial={{ opacity: 0, y: -6, height: 0 }}
 animate={{ opacity: 1, y: 0, height:"auto" }}
 exit={{ opacity: 0, y: -6, height: 0 }}
 className={cn(
"flex items-start gap-3 rounded-md border p-3 transition-colors",
 n.is_read ?"bg-card border-border" :"bg-primary/5 border-primary/30",
 )}
 >
 <div className={cn("mt-0.5 rounded-full p-2", n.is_read ?"bg-muted" :"bg-primary/15")}>
 <Syringe className={cn("w-4 h-4", n.is_read ?"text-muted-foreground" :"text-primary")} />
 </div>
 <button
 type="button"
 onClick={() => open(n)}
 className="flex-1 min-w-0 text-left"
 >
 <div className="flex items-center gap-2">
 <p className={cn("text-sm truncate", n.is_read ?"text-foreground/80" :"font-semibold text-foreground")}>
 {n.title}
 </p>
 {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
 </div>
 <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
 <p className="text-[11px] text-muted-foreground mt-1">
 {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
 </p>
 </button>
 <div className="flex flex-col items-end gap-1">
 {n.link_url && (
 <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => open(n)}>
 View ID <ChevronRight className="w-3 h-3 ml-0.5" />
 </Button>
 )}
 <Button
 size="sm"
 variant="ghost"
 className="h-7 w-7 p-0 text-muted-foreground"
 onClick={() => markRead(n.id)}
 aria-label="Dismiss"
 >
 <X className="w-3.5 h-3.5" />
 </Button>
 </div>
 </motion.div>
 ))}
 </AnimatePresence>

 {items.length > 2 && (
 <button
 type="button"
 onClick={() => setExpanded((v) => !v)}
 className="w-full text-xs text-muted-foreground hover:text-foreground py-1"
 >
 {expanded ?"Show less" : `Show ${items.length - 2} more`}
 </button>
 )}
 </div>
 );
};