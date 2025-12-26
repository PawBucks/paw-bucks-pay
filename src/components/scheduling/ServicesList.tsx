import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreVertical, Edit, Trash2, Clock, DollarSign, Users } from "lucide-react";
import { useState } from "react";
import { type MerchantService, CATEGORY_LABELS } from "@/services/api/scheduling.service";

interface ServicesListProps {
  services: MerchantService[];
  onEdit: (service: MerchantService) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  daycare: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  boarding: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  grooming: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  walking: 'bg-green-500/10 text-green-500 border-green-500/20',
  training: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  veterinary: 'bg-red-500/10 text-red-500 border-red-500/20',
  pet_sitting: 'bg-teal-500/10 text-teal-500 border-teal-500/20',
  other: 'bg-muted text-muted-foreground border-border',
};

export function ServicesList({ services, onEdit, onDelete, onToggleActive }: ServicesListProps) {
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
            <Clock className="w-8 h-8 text-primary" />
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
        {services.map((service) => (
          <GradientCard key={service.id} className="p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold truncate">{service.name}</h3>
                  {!service.is_active && (
                    <Badge variant="secondary" className="text-xs">Inactive</Badge>
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

            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-4">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{service.duration_minutes} min</span>
              </div>
              <div className="flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                <span>${service.price.toFixed(2)}</span>
              </div>
              {service.max_capacity > 1 && (
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>Up to {service.max_capacity}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border/50">
              <span className="text-sm text-muted-foreground">Active</span>
              <Switch
                checked={service.is_active}
                onCheckedChange={(checked) => onToggleActive(service.id, checked)}
              />
            </div>
          </GradientCard>
        ))}
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
