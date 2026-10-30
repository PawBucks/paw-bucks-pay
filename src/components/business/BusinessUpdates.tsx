import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, ArrowUpRight } from "lucide-react";

const fmt = (s: string) => new Date(s).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" });

/** Active updates from one business (profile) or recent updates from all businesses (feed). */
export function BusinessUpdates({ merchantId, limit = 3, title = "Latest updates" }: { merchantId?: string; limit?: number; title?: string }) {
  const { data = [] } = useQuery({
    queryKey: ["business-updates", merchantId ?? "all", limit],
    queryFn: async () => {
      let q = supabase.from("merchant_updates").select("id, title, body, link_url, created_at, merchant_id, merchants(business_name)").eq("is_hidden", false).order("created_at", { ascending: false }).limit(limit);
      if (merchantId) q = q.eq("merchant_id", merchantId);
      const { data } = await q;
      return (data ?? []) as any[];
    },
  });
  if (!data.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-sm flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary" />{title}</h2>
      {data.map(u => (
        <article key={u.id} className="rounded-lg border bg-card p-3 text-sm">
          {!merchantId && <Link to={`/merchant/${u.merchant_id}`} className="text-xs text-primary font-medium">{u.merchants?.business_name}</Link>}
          <p className="font-medium break-words">{u.title}</p>
          <p className="text-muted-foreground whitespace-pre-line break-words mt-1">{u.body}</p>
          <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
            <span>{fmt(u.created_at)}</span>
            {u.link_url && <a href={u.link_url} target="_blank" rel="noopener noreferrer nofollow" className="text-primary inline-flex items-center gap-1">Learn more<ArrowUpRight className="h-3 w-3" /></a>}
          </div>
        </article>
      ))}
    </section>
  );
}
