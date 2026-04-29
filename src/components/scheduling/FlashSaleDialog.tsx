import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogDescription,
} from"@/components/ui/dialog";
import { FlashSaleSection } from"./FlashSaleSection";
import { type MerchantService } from"@/services/api/scheduling.service";

interface FlashSaleDialogProps {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 service: MerchantService | null;
 onUpdate: (id: string, data: Partial<MerchantService>) => Promise<void>;
}

export function FlashSaleDialog({ 
 open, 
 onOpenChange, 
 service, 
 onUpdate 
}: FlashSaleDialogProps) {
 if (!service) return null;

 const handleUpdate = async (data: Partial<MerchantService>) => {
 await onUpdate(service.id, data);
 onOpenChange(false);
 };

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-lg">
 <DialogHeader>
 <DialogTitle>Flash Sale Settings</DialogTitle>
 <DialogDescription>
 Configure promotional PawBucks pricing for {service.name}
 </DialogDescription>
 </DialogHeader>
 
 <FlashSaleSection 
 service={service} 
 onUpdate={handleUpdate}
 />
 </DialogContent>
 </Dialog>
 );
}
