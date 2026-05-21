import { useState, useEffect } from"react";
import { Button } from"@/components/ui/button";
import { GradientCard } from"@/components/ui/gradient-card";
import { Badge } from"@/components/ui/badge";
import { Switch } from"@/components/ui/switch";
import { 
 DropdownMenu, 
 DropdownMenuContent, 
 DropdownMenuItem, 
 DropdownMenuTrigger 
} from"@/components/ui/dropdown-menu";
import {
 AlertDialog,
 AlertDialogAction,
 AlertDialogCancel,
 AlertDialogContent,
 AlertDialogDescription,
 AlertDialogFooter,
 AlertDialogHeader,
 AlertDialogTitle,
} from"@/components/ui/alert-dialog";
import { Clock, DollarSign, Edit, MoreVertical, Timer, Trash2, Users, Zap } from "lucide-react";
import { 
 type MerchantService, 
 CATEGORY_LABELS,
 calculateRegularPawbucksPrice,
 calculateFlashSaleSavings,
 isFlashSaleActive
} from"@/services/api/scheduling.service";

import { Formatters } from "@/utils/formatters";
// Flash Sale Countdown component
function FlashSaleCountdown({ endAt }: { endAt: string }) {
 const [timeRemaining, setTimeRemaining] = useState<string>("");

 useEffect(() => {
 const updateCountdown = () => {
 const now = new Date();
 const end = new Date(endAt);
 const diff = end.getTime() - now.getTime();
 
 if (diff <= 0) {
 setTimeRemaining("Ended");
 return;
 }
 
 const hours = Math.floor(diff / (1000 * 60 * 60));
 const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
 
 if (hours > 24) {
 const days = Math.floor(hours / 24);
 setTimeRemaining(`${days}d ${hours % 24}h left`);
 } else if (hours > 0) {
 setTimeRemaining(`${hours}h ${minutes}m left`);
 } else {
 setTimeRemaining(`${minutes}m left`);
 }
 };
 
 updateCountdown();
 const interval = setInterval(updateCountdown, 60000);
 
 return () => clearInterval(interval);
 }, [endAt]);

 if (!timeRemaining) return null;

 return (
 <div className="flex items-center gap-1 text-warning text-xs">
 <Timer className="w-3 h-3" />
 <span>{timeRemaining}</span>
 </div>
 );
}

interface ServicesListProps {
 services: MerchantService[];
 onEdit: (service: MerchantService) => void;
 onDelete: (id: string) => void;
 onToggleActive: (id: string, active: boolean) => void;
 onManageFlashSale?: (service: MerchantService) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
 daycare:'bg-info/10 text-info border-info/20',
 boarding:'bg-accent/10 text-accent border-accent/20',
 grooming:'bg-accent/10 text-accent border-accent/20',
 walking:'bg-success/10 text-success border-success/20',
 training:'bg-warning/10 text-warning border-warning/20',
 veterinary:'bg-destructive/10 text-destructive border-destructive/20',
 pet_sitting:'bg-success/10 text-success border-success/20',
 other:'bg-muted text-muted-foreground border-border',
};

// Helper function to format duration based on category
const formatDuration = (minutes: number, category: string): string => {
 if (category ==='boarding') {
 const nights = Math.round(minutes / 1440);
 return nights === 1 ?'1 night' : `${nights} nights`;
 }
 if (category ==='daycare') {
 if (minutes <= 360) return'Half Day';
 if (minutes <= 720) return'Full Day';
 return `${Math.round(minutes / 60)}h`;
 }
 // Standard format for other categories
 if (minutes >= 60) {
 const hours = Math.floor(minutes / 60);
 const remainingMins = minutes % 60;
 return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
 }
 return `${minutes} min`;
};

export function ServicesList({ services, onEdit, onDelete, onToggleActive, onManageFlashSale }: ServicesListProps) {
 const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
 const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);

 const handleDeleteClick = (id: string) => {
 setServiceToDelete(id);
 setDeleteDialogOpen(true);
 };

 const confirmDelete = () => {
 if (serviceToDelete) {
 onDelete(serviceToDelete);
 setDeleteDialogOpen(false);
 setServiceToDelete(null);
 }
 };

 if (services.length === 0) {
 return (
 <GradientCard className="p-8 text-center">
 <div className="max-w-md mx-auto">
 <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
 <Clock className="w-8 h-8 text-primary" aria-hidden="true" />
 </div>
 <h3 className="text-lg font-semibold mb-2">No Services Yet</h3>
 <p className="text-muted-foreground mb-4">
 Create your first service to start accepting bookings from customers.
 </p>
 </div>
 </GradientCard>
 );
 }

 return (
 <>
 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
 {services.map((service) => {
 const isFlashActive = isFlashSaleActive(service);
 const regularPawbucksPrice = calculateRegularPawbucksPrice(service.price);
 const savingsPercent = calculateFlashSaleSavings(service);
 
 return (
 <GradientCard key={service.id} className={`p-4 ${isFlashActive ?'ring-2 ring-warning/50' :''}`}>
 <div className="flex items-start justify-between gap-3 mb-3">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 <h3 className="font-semibold truncate">{service.name}</h3>
 {!service.is_active && (
 <Badge variant="secondary" className="text-xs">Inactive</Badge>
 )}
 {isFlashActive && (
 <Badge className="bg-gradient-to-r from-warning to-warning text-white border-0 text-xs gap-0.5">
 <Zap className="w-3 h-3" />
 Flash Sale
 </Badge>
 )}
 {service.is_flash_sale && !isFlashActive && (
 <Badge variant="outline" className="text-xs text-warning border-warning/30">
 Scheduled
 </Badge>
 )}
 </div>
 <Badge 
 variant="outline" 
 className={`text-xs ${CATEGORY_COLORS[service.category]}`}
 >
 {CATEGORY_LABELS[service.category]}
 </Badge>
 </div>
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="ghost" size="icon" className="h-8 w-8">
 <MoreVertical className="w-4 h-4" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
 <DropdownMenuItem onClick={() => onEdit(service)}>
 <Edit className="w-4 h-4 mr-2" />
 Edit
 </DropdownMenuItem>
 {onManageFlashSale && (
 <DropdownMenuItem onClick={() => onManageFlashSale(service)}>
 <Zap className="w-4 h-4 mr-2" />
 Flash Sale
 </DropdownMenuItem>
 )}
 <DropdownMenuItem 
 onClick={() => handleDeleteClick(service.id)}
 className="text-destructive"
 >
 <Trash2 className="w-4 h-4 mr-2" />
 Delete
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 </div>

 {service.description && (
 <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
 {service.description}
 </p>
 )}

 <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-3">
 <div className="flex items-center gap-1">
 <Clock className="w-4 h-4" aria-hidden="true" />
 <span>{formatDuration(service.duration_minutes, service.category)}</span>
 </div>
 <div className="flex items-center gap-1">
 <DollarSign className="w-4 h-4" />
 <span>{Formatters.currency(service.price)}</span>
 </div>
 {service.max_capacity > 1 && (
 <div className="flex items-center gap-1">
 <Users className="w-4 h-4" />
 <span>Up to {service.max_capacity}</span>
 </div>
 )}
 </div>

 {/* Flash Sale Pricing Display */}
 {isFlashActive && service.flash_sale_pawbucks_price && (
 <div className="p-2 rounded-lg bg-gradient-to-r from-warning/10 to-warning/10 border border-warning/20 mb-3">
 <div className="flex items-center justify-between">
 <div>
 <div className="flex items-baseline gap-2">
 <span className="text-muted-foreground line-through text-xs">
 {regularPawbucksPrice.toLocaleString()} PB
 </span>
 <span className="font-bold text-success">
 {service.flash_sale_pawbucks_price.toLocaleString()} PB
 </span>
 </div>
 <span className="text-xs text-success font-medium">
 {savingsPercent}% off!
 </span>
 </div>
 {service.flash_sale_end_at && (
 <FlashSaleCountdown endAt={service.flash_sale_end_at} />
 )}
 </div>
 </div>
 )}

 <div className="flex items-center justify-between pt-3 border-t border-border/50">
 <span className="text-sm text-muted-foreground">Active</span>
 <Switch
 checked={service.is_active}
 onCheckedChange={(checked) => onToggleActive(service.id, checked)}
 />
 </div>
 </GradientCard>
 );
 })}
 </div>

 <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
 <AlertDialogContent>
 <AlertDialogHeader>
 <AlertDialogTitle>Delete Service?</AlertDialogTitle>
 <AlertDialogDescription>
 This will permanently delete this service and all associated bookings. This action cannot be undone.
 </AlertDialogDescription>
 </AlertDialogHeader>
 <AlertDialogFooter>
 <AlertDialogCancel>Cancel</AlertDialogCancel>
 <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
 Delete
 </AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>
 </>
 );
}
