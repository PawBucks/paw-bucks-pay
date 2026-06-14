import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Formatters } from "@/utils/formatters";
import { cn } from "@/lib/utils";

interface Props {
  transactionId: string;
  className?: string;
  /** When true, hides the panel entirely if no items found. Defaults to false (shows empty hint). */
  hideIfEmpty?: boolean;
}

type Row = {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  source_type: string;
};

export const TransactionItemsPanel = ({ transactionId, className, hideIfEmpty }: Props) => {
  const { data, isLoading } = useQuery({
    queryKey: ["transaction-items", transactionId],
    queryFn: async (): Promise<Row[]> => {
      const { data } = await supabase
        .from("transaction_items")
        .select("id, name, description, sku, quantity, unit_price, total, source_type")
        .eq("transaction_id", transactionId)
        .order("created_at", { ascending: true });
      return (data ?? []) as Row[];
    },
    enabled: !!transactionId,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className={cn("text-xs text-muted-foreground", className)}>
        Loading items…
      </div>
    );
  }

  if (!data || data.length === 0) {
    if (hideIfEmpty) return null;
    return (
      <div className={cn("text-xs text-muted-foreground italic", className)}>
        No itemized details for this transaction.
      </div>
    );
  }

  return (
    <div className={cn("rounded-md border border-border/60 bg-background overflow-hidden", className)}>
      <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/40 border-b border-border/60">
        <Package className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Items ({data.length})
        </span>
      </div>
      <table className="w-full text-sm">
        <thead className="text-[11px] text-muted-foreground uppercase">
          <tr className="border-b border-border/40">
            <th className="text-left font-medium px-3 py-1.5">Item</th>
            <th className="text-center font-medium px-2 py-1.5 w-12">Qty</th>
            <th className="text-right font-medium px-2 py-1.5 w-20">Price</th>
            <th className="text-right font-medium px-3 py-1.5 w-20">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id} className="border-b last:border-b-0 border-border/30">
              <td className="px-3 py-1.5">
                <div className="font-medium text-foreground">{row.name}</div>
                {(row.sku || row.description) && (
                  <div className="text-[11px] text-muted-foreground truncate max-w-[260px]">
                    {row.sku ? <span className="font-mono">{row.sku}</span> : null}
                    {row.sku && row.description ? " · " : null}
                    {row.description}
                  </div>
                )}
              </td>
              <td className="text-center px-2 py-1.5 tabular-nums">
                {Number(row.quantity)}
              </td>
              <td className="text-right px-2 py-1.5 tabular-nums">
                {Formatters.currency(Number(row.unit_price))}
              </td>
              <td className="text-right px-3 py-1.5 tabular-nums font-medium">
                {Formatters.currency(Number(row.total))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};