import {
 AlertDialog,
 AlertDialogContent,
 AlertDialogHeader,
 AlertDialogTitle,
 AlertDialogDescription,
 AlertDialogFooter,
 AlertDialogCancel,
} from"@/components/ui/alert-dialog";
import { Button } from"@/components/ui/button";
import { Trash2, CalendarX, AlertTriangle } from"lucide-react";

export type RecurringDeleteChoice ="this_only" |"all_future" | null;

interface DeleteRecurringInvoiceDialogProps {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 onChoice: (choice: RecurringDeleteChoice) => void;
 invoiceNumber?: string;
 isDeleting?: boolean;
}

export function DeleteRecurringInvoiceDialog({
 open,
 onOpenChange,
 onChoice,
 invoiceNumber,
 isDeleting = false,
}: DeleteRecurringInvoiceDialogProps) {
 return (
 <AlertDialog open={open} onOpenChange={onOpenChange}>
 <AlertDialogContent className="max-w-md">
 <AlertDialogHeader>
 <div className="flex items-center gap-3 mb-1">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
 <AlertTriangle className="h-5 w-5 text-destructive" />
 </div>
 <AlertDialogTitle className="text-base">
 Delete Recurring Invoice
 </AlertDialogTitle>
 </div>
 <AlertDialogDescription className="text-sm text-muted-foreground pt-1">
 This is a recurring invoice{invoiceNumber ? ` (${invoiceNumber})` :""}. How would you like to proceed?
 </AlertDialogDescription>
 </AlertDialogHeader>

 <div className="flex flex-col gap-2 py-2">
 <Button
 variant="outline"
 className="justify-start gap-3 h-auto py-3 px-4 text-left"
 disabled={isDeleting}
 onClick={() => onChoice("this_only")}
 >
 <Trash2 className="h-4 w-4 shrink-0 text-muted-foreground" />
 <div>
 <p className="font-medium text-sm">This Invoice Only</p>
 <p className="text-xs text-muted-foreground font-normal">
 Delete this invoice and keep all future invoices
 </p>
 </div>
 </Button>

 <Button
 variant="outline"
 className="justify-start gap-3 h-auto py-3 px-4 text-left border-destructive/30 hover:bg-destructive/5"
 disabled={isDeleting}
 onClick={() => onChoice("all_future")}
 >
 <CalendarX className="h-4 w-4 shrink-0 text-destructive" />
 <div>
 <p className="font-medium text-sm text-destructive">All Future Invoices</p>
 <p className="text-xs text-muted-foreground font-normal">
 Delete this and all upcoming recurring invoices
 </p>
 </div>
 </Button>
 </div>

 <AlertDialogFooter>
 <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>
 );
}
