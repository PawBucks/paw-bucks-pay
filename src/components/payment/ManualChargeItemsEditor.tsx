import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Package, ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useIsMobile } from "@/hooks/use-mobile";
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
  const isMobile = useIsMobile();

  useEffect(() => {
    if (items.length > 0 && !open) setOpen(true);
  }, [items.length, open]);

  const { data: catalog = [] } = useQuery({
    queryKey: ["manual-charge-catalog", merchantId],
    queryFn: async (): Promise<CatalogSource[]> => {
      const { data, error } = await supabase.functions.invoke("list-connect-products", {
        body: { merchantId },
      });
      if (error) throw error;

      return Array.isArray(data?.catalogItems) ? data.catalogItems : [];
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

  const catalogPicker = (
    <Command shouldFilter={false} className="flex flex-col h-full min-h-0 bg-transparent">
      <div className="flex items-center border-b border-border/60 px-2 shrink-0 bg-background">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <CommandInput
          placeholder="Search catalog…"
          value={search}
          onValueChange={setSearch}
          className="h-11 border-0 ring-0 focus-visible:ring-0 placeholder:text-muted-foreground/70"
        />
        {search && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setSearch("")}
            className="shrink-0 rounded-sm p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <CommandList
        className="flex-1 min-h-0 max-h-none overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        {catalog.length === 0 && (
          <div className="py-6 px-4 text-center text-muted-foreground text-sm">
            No catalog items yet.
            <br />
            Add a custom line instead.
          </div>
        )}
        <CommandEmpty>
          <div className="py-6 text-center text-muted-foreground text-sm">No matches</div>
        </CommandEmpty>
        {Object.entries(grouped).map(([group, list]) => (
          <CommandGroup
            key={group}
            heading={group}
            className="[&_[cmdk-group-heading]]:sticky [&_[cmdk-group-heading]]:top-0 [&_[cmdk-group-heading]]:z-[1] [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:bg-background"
          >
            {list.map((it) => (
              <CommandItem
                key={`${it.source_type}-${it.id}`}
                value={`${it.source_type}-${it.id}`}
                onSelect={() => addFromCatalog(it)}
                className="flex items-center justify-between gap-2 cursor-pointer py-3 px-2 min-h-[48px] aria-selected:bg-primary/10"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{it.name}</p>
                  {it.sku && (
                    <p className="text-[10px] text-muted-foreground/80 truncate">{it.sku}</p>
                  )}
                </div>
                <span className="text-xs font-semibold text-primary shrink-0">
                  {Formatters.currency(it.unit_price)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  );

  const triggerButton = (
    <Button type="button" variant="outline" size="sm" className="gap-2">
      <Package className="w-4 h-4" />
      Add from catalog
    </Button>
  );

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
              <PopoverContent
                className="w-[min(92vw,22rem)] p-0 max-h-[min(80vh,30rem)]"
                align="start"
                sideOffset={4}
                avoidCollisions={false}
              >
                <Command shouldFilter={false} className="flex flex-col max-h-[min(80vh,30rem)]">
                  <div className="flex items-center border-b border-border/60 px-2 shrink-0 bg-background z-10">
                    <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <CommandInput
                      placeholder="Search catalog…"
                      value={search}
                      onValueChange={setSearch}
                      className="h-9 border-0 ring-0 focus-visible:ring-0 placeholder:text-muted-foreground/70"
                    />
                    {search && (
                      <button
                        type="button"
                        aria-label="Clear search"
                        onClick={() => setSearch("")}
                        className="shrink-0 rounded-sm p-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <CommandList
                    className="flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-smooth"
                    style={{
                      WebkitOverflowScrolling: "touch",
                      overscrollBehavior: "contain",
                      scrollPaddingTop: "8px",
                      scrollPaddingBottom: "8px",
                    }}
                  >
                    {catalog.length === 0 && (
                      <div className="py-6 text-center text-muted-foreground text-sm">
                        No catalog items yet.
                        <br />
                        Add a custom line below.
                      </div>
                    )}
                    <CommandEmpty>
                      <div className="py-6 text-center text-muted-foreground text-sm">
                        No matches
                      </div>
                    </CommandEmpty>
                    {Object.entries(grouped).map(([group, list]) => (
                      <CommandGroup key={group} heading={group} className="[&_[cmdk-group-heading]]:sticky [&_[cmdk-group-heading]]:top-0 [&_[cmdk-group-heading]]:z-[1] [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:bg-muted/80 [&_[cmdk-group-heading]]:backdrop-blur-sm">
                        {list.map((it) => (
                          <CommandItem
                            key={`${it.source_type}-${it.id}`}
                            value={`${it.source_type}-${it.id}`}
                            onSelect={() => addFromCatalog(it)}
                            className="flex items-center justify-between gap-2 cursor-pointer py-3 px-2 min-h-[44px] aria-selected:bg-primary/10"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground truncate">{it.name}</p>
                              {it.sku && (
                                <p className="text-[10px] text-muted-foreground/80 truncate">
                                  {it.sku}
                                </p>
                              )}
                            </div>
                            <span className="text-xs font-semibold text-primary shrink-0">
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