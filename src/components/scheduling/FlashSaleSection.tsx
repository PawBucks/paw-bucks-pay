import { useState, useEffect } from"react";
import { useForm } from"react-hook-form";
import { zodResolver } from"@hookform/resolvers/zod";
import { z } from"zod";
import { Switch } from"@/components/ui/switch";
import { Input } from"@/components/ui/input";
import { Button } from"@/components/ui/button";
import { Label } from"@/components/ui/label";
import { Badge } from"@/components/ui/badge";
import {
 Form,
 FormControl,
 FormDescription,
 FormField,
 FormItem,
 FormLabel,
 FormMessage,
} from"@/components/ui/form";
import {
 Collapsible,
 CollapsibleContent,
 CollapsibleTrigger,
} from"@/components/ui/collapsible";
import { Bell, ChevronDown, ChevronUp, Clock, TrendingDown, Zap } from "lucide-react";
import { format } from"date-fns";
import { 
 type MerchantService,
 calculateRegularPawbucksPrice,
 calculateFlashSaleSavings,
 isFlashSaleActive
} from"@/services/api/scheduling.service";

import { Formatters } from "@/utils/formatters";
const flashSaleSchema = z.object({
 is_flash_sale: z.boolean(),
 flash_sale_pawbucks_price: z.coerce.number().min(1,"Price must be at least 1 PB").optional().nullable(),
 flash_sale_start_at: z.string().optional().nullable(),
 flash_sale_end_at: z.string().optional().nullable(),
});

type FlashSaleFormData = z.infer<typeof flashSaleSchema>;

interface FlashSaleSectionProps {
 service: MerchantService;
 onUpdate: (data: Partial<MerchantService>) => Promise<void>;
}

export function FlashSaleSection({ service, onUpdate }: FlashSaleSectionProps) {
 const [isOpen, setIsOpen] = useState(service.is_flash_sale);
 const [isUpdating, setIsUpdating] = useState(false);
 
 const regularPawbucksPrice = calculateRegularPawbucksPrice(service.price);
 const isActive = isFlashSaleActive(service);
 const savingsPercent = calculateFlashSaleSavings(service);
 
 const form = useForm<FlashSaleFormData>({
 resolver: zodResolver(flashSaleSchema),
 defaultValues: {
 is_flash_sale: service.is_flash_sale,
 flash_sale_pawbucks_price: service.flash_sale_pawbucks_price || null,
 flash_sale_start_at: service.flash_sale_start_at 
 ? format(new Date(service.flash_sale_start_at),"yyyy-MM-dd'T'HH:mm")
 : null,
 flash_sale_end_at: service.flash_sale_end_at 
 ? format(new Date(service.flash_sale_end_at),"yyyy-MM-dd'T'HH:mm")
 : null,
 },
 });

 const watchFlashSale = form.watch("is_flash_sale");
 const watchPrice = form.watch("flash_sale_pawbucks_price");

 useEffect(() => {
 if (watchFlashSale !== isOpen) {
 setIsOpen(watchFlashSale);
 }
 }, [watchFlashSale]);

 const handleSubmit = async (data: FlashSaleFormData) => {
 setIsUpdating(true);
 try {
 await onUpdate({
 is_flash_sale: data.is_flash_sale,
 flash_sale_pawbucks_price: data.is_flash_sale ? data.flash_sale_pawbucks_price : null,
 flash_sale_start_at: data.is_flash_sale && data.flash_sale_start_at 
 ? new Date(data.flash_sale_start_at).toISOString() 
 : null,
 flash_sale_end_at: data.is_flash_sale && data.flash_sale_end_at 
 ? new Date(data.flash_sale_end_at).toISOString() 
 : null,
 });
 } finally {
 setIsUpdating(false);
 }
 };

 // Calculate preview savings
 const previewSavings = watchPrice && watchPrice > 0
 ? Math.round((1 - watchPrice / regularPawbucksPrice) * 100)
 : 0;

 return (
 <Collapsible open={isOpen} onOpenChange={setIsOpen}>
 <div className="rounded-lg border border-warning/30 bg-gradient-to-r from-warning/5 to-warning/5 p-4">
 <CollapsibleTrigger className="w-full">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-warning/10 rounded-lg">
 <Zap className="w-5 h-5 text-warning" />
 </div>
 <div className="text-left">
 <div className="flex items-center gap-2">
 <h4 className="font-semibold">Flash Sale</h4>
 {isActive && (
 <Badge className="bg-success/10 text-success border-success/30">
 Live
 </Badge>
 )}
 {service.is_flash_sale && !isActive && (
 <Badge className="bg-warning/10 text-warning border-warning/30">
 Scheduled
 </Badge>
 )}
 </div>
 <p className="text-sm text-muted-foreground">
 Offer discounted PawBucks pricing for limited time
 </p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 {isOpen ? (
 <ChevronUp className="w-5 h-5 text-muted-foreground" />
 ) : (
 <ChevronDown className="w-5 h-5 text-muted-foreground" />
 )}
 </div>
 </div>
 </CollapsibleTrigger>

 <CollapsibleContent className="pt-4">
 <Form {...form}>
 <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
 <FormField
 control={form.control}
 name="is_flash_sale"
 render={({ field }) => (
 <FormItem className="flex items-center justify-between rounded-lg border p-3 bg-background">
 <div className="space-y-0.5">
 <FormLabel>Enable Flash Sale</FormLabel>
 <FormDescription>
 Activate promotional PawBucks pricing
 </FormDescription>
 </div>
 <FormControl>
 <Switch checked={field.value} onCheckedChange={field.onChange} />
 </FormControl>
 </FormItem>
 )}
 />

 {watchFlashSale && (
 <>
 {/* Price Preview */}
 <div className="p-3 rounded-lg bg-muted border">
 <div className="flex items-center justify-between mb-2">
 <span className="text-sm text-muted-foreground">Regular Price</span>
 <span className="font-medium">{regularPawbucksPrice.toLocaleString()} PB</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-sm text-muted-foreground">USD Value</span>
 <span className="font-medium">{Formatters.currency(service.price)}</span>
 </div>
 </div>

 <FormField
 control={form.control}
 name="flash_sale_pawbucks_price"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Promotional PawBucks Price</FormLabel>
 <FormControl>
 <div className="relative">
 <Input
 type="number"
 min="1"
 max={regularPawbucksPrice - 1}
 placeholder={`e.g., ${Math.floor(regularPawbucksPrice * 0.5)}`}
 {...field}
 value={field.value ||""}
 onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
 />
 <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
 PB
 </span>
 </div>
 </FormControl>
 {previewSavings > 0 && (
 <div className="flex items-center gap-2 mt-2">
 <TrendingDown className="w-4 h-4 text-success" aria-hidden />
 <span className="text-sm text-success font-medium">
 {previewSavings}% off with PawBucks!
 </span>
 </div>
 )}
 <FormMessage />
 </FormItem>
 )}
 />

 <div className="grid grid-cols-2 gap-4">
 <FormField
 control={form.control}
 name="flash_sale_start_at"
 render={({ field }) => (
 <FormItem>
 <FormLabel className="flex items-center gap-1">
 <Clock className="w-3.5 h-3.5" aria-hidden="true" />
 Start Time
 </FormLabel>
 <FormControl>
 <Input
 type="datetime-local"
 {...field}
 value={field.value ||""}
 onChange={(e) => field.onChange(e.target.value || null)}
 />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />

 <FormField
 control={form.control}
 name="flash_sale_end_at"
 render={({ field }) => (
 <FormItem>
 <FormLabel className="flex items-center gap-1">
 <Clock className="w-3.5 h-3.5" aria-hidden="true" />
 End Time
 </FormLabel>
 <FormControl>
 <Input
 type="datetime-local"
 {...field}
 value={field.value ||""}
 onChange={(e) => field.onChange(e.target.value || null)}
 />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 </div>

 <div className="p-3 rounded-lg bg-info/10 border border-info/20">
 <div className="flex items-start gap-2">
 <Bell className="w-4 h-4 text-info mt-0.5" />
 <div className="text-sm">
 <p className="font-medium text-info">
 Push Notification
 </p>
 <p className="text-muted-foreground">
 Pet owners will be notified when your flash sale goes live.
 </p>
 </div>
 </div>
 </div>
 </>
 )}

 <Button type="submit" className="w-full" disabled={isUpdating}>
 {isUpdating ?"Saving..." :"Save Flash Sale Settings"}
 </Button>
 </form>
 </Form>
 </CollapsibleContent>
 </div>
 </Collapsible>
 );
}
