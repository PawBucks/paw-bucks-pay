import { useState, useMemo } from"react";
import { Package, Plus, Search } from "lucide-react";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import {
 Command,
 CommandEmpty,
 CommandGroup,
 CommandInput,
 CommandItem,
 CommandList,
} from"@/components/ui/command";
import {
 Popover,
 PopoverContent,
 PopoverTrigger,
} from"@/components/ui/popover";
import { Badge } from"@/components/ui/badge";
import { cn } from"@/lib/utils";
import { CatalogItem } from"./CatalogManager";

import { Formatters } from "@/utils/formatters";
interface CatalogItemPickerProps {
 items: CatalogItem[];
 onSelect: (item: CatalogItem) => void;
 className?: string;
}

export function CatalogItemPicker({ items, onSelect, className }: CatalogItemPickerProps) {
 const [open, setOpen] = useState(false);
 const [search, setSearch] = useState("");

 const filteredItems = useMemo(() => {
 if (!search) return items;
 const lower = search.toLowerCase();
 return items.filter(
 (item) =>
 item.name.toLowerCase().includes(lower) ||
 item.description?.toLowerCase().includes(lower) ||
 item.category?.toLowerCase().includes(lower)
 );
 }, [items, search]);

 // Group by category
 const groupedItems = useMemo(() => {
 const groups: Record<string, CatalogItem[]> = {};
 filteredItems.forEach((item) => {
 const category = item.category ||"Uncategorized";
 if (!groups[category]) groups[category] = [];
 groups[category].push(item);
 });
 return groups;
 }, [filteredItems]);

 const handleSelect = (item: CatalogItem) => {
 onSelect(item);
 setOpen(false);
 setSearch("");
 };

 if (items.length === 0) {
 return null;
 }

 return (
 <Popover open={open} onOpenChange={setOpen}>
 <PopoverTrigger asChild>
 <Button variant="outline" size="sm" className={cn("gap-2", className)}>
 <Package className="h-4 w-4" />
 Add from Catalog
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-80 p-0" align="start">
 <Command shouldFilter={false}>
 <CommandInput 
 placeholder="Search catalog..." 
 value={search}
 onValueChange={setSearch}
 />
 <CommandList className="max-h-64">
 <CommandEmpty>
 <div className="py-4 text-center text-muted-foreground">
 No items found
 </div>
 </CommandEmpty>
 {Object.entries(groupedItems).map(([category, categoryItems]) => (
 <CommandGroup key={category} heading={category}>
 {categoryItems.map((item) => (
 <CommandItem
 key={item.id}
 value={item.id}
 onSelect={() => handleSelect(item)}
 className="flex items-center justify-between py-2 cursor-pointer"
 >
 <div className="flex-1 min-w-0">
 <p className="font-medium truncate">{item.name}</p>
 {item.description && (
 <p className="text-xs text-muted-foreground truncate">
 {item.description}
 </p>
 )}
 </div>
 <div className="flex items-center gap-2 ml-2">
 <span className="text-sm font-semibold text-primary">
 {Formatters.currency(Number(item.unit_price))}
 </span>
 <Plus className="h-4 w-4 text-muted-foreground" />
 </div>
 </CommandItem>
 ))}
 </CommandGroup>
 ))}
 </CommandList>
 </Command>
 </PopoverContent>
 </Popover>
 );
}
