import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Package, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { Formatters } from "@/utils/formatters";

export type LineItem = {
  key: string; // local
  source_type: "catalog_item" | "pet_store_item" | "merchant_service" | "custom";
  source_id?: string | null;
  name: string;
  sku?: string | null;
  quantity: number;
  unit_price: number;
  /** Set for items pulled from the merchant's catalog — name/price are fixed by the merchant. */
  locked?: boolean;
};

type CatalogSource = {
  id: string;
  name: string;
  unit_price: number;
  sku?: string | null;
  source_type: LineItem["source_type"];
  group: string;
};

interface Props {
  merchantId: string;
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
}

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export const ManualChargeItemsEditor = ({ merchantId, items, onChange }: Props) => {
  const [open, setOpen] = useState(items.length > 0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (items.length > 0 && !open) setOpen(true);
  }, [items.length, open]);

  const { data: catalog = [] } = useQuery({
    queryKey: ["manual-charge-catalog", merchantId],
    queryFn: async (): Promise<CatalogSource[]> => {
      const [{ data: invItems }, { data: services }, { data: storeItems }] = await Promise.all([
        supabase
          .from("invoice_catalog_items_public" as any)
          .select("id, name, unit_price, sku, category")
          .eq("merchant_id", merchantId)
          .order("name"),
        supabase
          .from("merchant_services")
          .select("id, name, price")
          .eq("merchant_id", merchantId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("pet_store_items")
          .select("id, name, price, stock_quantity")
          .eq("merchant_id", merchantId)
          .eq("is_active", true)
          .order("name"),
      ]);

      // Stripe storefront products (live products the merchant sells online)
      let storefront: any[] = [];
      try {
        const { data: sf } = await supabase.functions.invoke("list-connect-products", {
          body: { merchantId },
        });
        storefront = Array.isArray(sf?.products) ? sf.products : [];
      } catch (_e) {
        storefront = [];
      }

      const list: CatalogSource[] = [];
      (invItems ?? []).forEach((it: any) =>
        list.push({
          id: it.id,
          name: it.name,
          unit_price: Number(it.unit_price ?? 0),
          sku: it.sku ?? null,
          source_type: "catalog_item",
          group: it.category || "Catalog",
        }),
      );
      (services ?? []).forEach((s: any) =>
        list.push({
          id: s.id,
          name: s.name,
          unit_price: Number(s.price ?? 0),
          source_type: "merchant_service",
          group: "Services",
        }),
      );
      (storeItems ?? []).forEach((p: any) =>
        list.push({
          id: p.id,
          name: p.name,
          unit_price: Number(p.price ?? 0),
          sku: null,
          source_type: "pet_store_item",
          group: "Store",
        }),
      );
      storefront.forEach((p: any) => {
        const cents = p?.price?.unit_amount;
        if (typeof cents !== "number") return;
        list.push({
          id: p.id,
          name: p.name,
          unit_price: cents / 100,
          // Stripe product ids aren't uuids, so they travel as the sku reference.
          sku: p.id,
          source_type: "custom",
          group: "Storefront",
        });
      });
      return list;
    },
    enabled: !!merchantId && open,
    staleTime: 60_000,
  });

  const grouped = useMemo(() => {
    const lower = search.trim().toLowerCase();
    const groups: Record<string, CatalogSource[]> = {};
    for (const it of catalog) {
      if (lower && !it.name.toLowerCase().includes(lower)) continue;
      (groups[it.group] ??= []).push(it);
    }
    return groups;
  }, [catalog, search]);

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.quantity * i.unit_price, 0),
    [items],
  );

  const addFromCatalog = (src: CatalogSource) => {
    onChange([
      ...items,
      {
        key: newKey(),
        source_type: src.source_type,
        source_id: src.source_type === "custom" ? null : src.id,
        name: src.name,
        sku: src.sku ?? null,
        quantity: 1,
        unit_price: src.unit_price,
        locked: true,
      },
    ]);
    setPickerOpen(false);
    setSearch("");
  };

  const addCustom = () => {
    onChange([
      ...items,
      {
        key: newKey(),
        source_type: "custom",
        name: "",
        quantity: 1,
        unit_price: 0,
      },
    ]);
  };

  const updateItem = (key: string, patch: Partial<LineItem>) => {
    onChange(items.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  };

  const removeItem = (key: string) => {
    onChange(items.filter((i) => i.key !== key));
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-left text-sm font-medium text-foreground hover:text-primary transition-colors"
      >
        <span className="flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" />
          Itemize this sale
          <span className="text-xs font-normal text-muted-foreground">
            ({items.length > 0 ? `${items.length} item${items.length === 1 ? "" : "s"}` : "optional"})
          </span>
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="space-y-2">
          {items.length > 0 && (
            <div className="space-y-2">
              {items.map((it) => (
                <div
                  key={it.key}
                  className="grid grid-cols-[1fr_64px_84px_28px] gap-2 items-center bg-muted/40 border border-border/60 rounded-md p-2"
                >
                  {it.locked ? (
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{it.name}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Merchant price
                      </p>
                    </div>
                  ) : (
                    <Input
                      value={it.name}
                      placeholder="Item name"
                      onChange={(e) => updateItem(it.key, { name: e.target.value })}
                      className="h-8 text-sm"
                    />
                  )}
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={it.quantity}
                    onChange={(e) =>
                      updateItem(it.key, {
                        quantity: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                    className="h-8 text-sm text-center"
                  />
                  {it.locked ? (
                    <div className="h-8 flex items-center justify-end px-2 text-sm font-medium tabular-nums text-foreground">
                      {Formatters.currency(it.unit_price)}
                    </div>
                  ) : (
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={it.unit_price}
                      onChange={(e) =>
                        updateItem(it.key, {
                          unit_price: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="h-8 text-sm text-right"
                    />
                  )}
                  <button
                    type="button"
                    aria-label="Remove item"
                    onClick={() => removeItem(it.key)}
                    className="h-8 w-7 inline-flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="flex justify-between text-xs text-muted-foreground px-1">
                <span>Items subtotal</span>
                <span className="font-medium text-foreground">
                  {Formatters.currency(subtotal)}
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="gap-2">
                  <Package className="w-4 h-4" />
                  Add from catalog
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search items, services, products..."
                    value={search}
                    onValueChange={setSearch}
                  />
                  <CommandList className="max-h-64">
                    <CommandEmpty>
                      <div className="py-4 text-center text-muted-foreground text-sm">
                        {catalog.length === 0
                          ? "No catalog items yet. Add a custom line below."
                          : "No matches"}
                      </div>
                    </CommandEmpty>
                    {Object.entries(grouped).map(([group, list]) => (
                      <CommandGroup key={group} heading={group}>
                        {list.map((it) => (
                          <CommandItem
                            key={`${it.source_type}-${it.id}`}
                            value={`${it.source_type}-${it.id}`}
                            onSelect={() => addFromCatalog(it)}
                            className="flex items-center justify-between cursor-pointer"
                          >
                            <span className="truncate">{it.name}</span>
                            <span className="text-xs font-semibold text-primary ml-2">
                              {Formatters.currency(it.unit_price)}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={addCustom}>
              <Plus className="w-4 h-4" />
              Custom line
            </Button>
          </div>

          {items.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              The amount above auto-syncs with these items. Clear all items to type a custom total.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export const itemsToPayload = (items: LineItem[]) =>
  items
    .filter((i) => i.name.trim() && i.quantity > 0 && i.unit_price >= 0)
    .map(({ key: _key, locked: _locked, ...rest }) => rest);