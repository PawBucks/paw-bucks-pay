import { useState } from"react";
import { useAuth } from"@/hooks/useAuth";
import { useMutation, useQueryClient } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Textarea } from"@/components/ui/textarea";
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogFooter,
 DialogHeader,
 DialogTitle,
} from"@/components/ui/dialog";
import { Bell, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from"sonner";
import { format, addDays } from"date-fns";

interface WaitlistButtonProps {
 merchantId: string;
 serviceId: string;
 serviceName: string;
 date: Date;
}

export function WaitlistButton({ merchantId, serviceId, serviceName, date }: WaitlistButtonProps) {
 const { user } = useAuth();
 const queryClient = useQueryClient();
 const [dialogOpen, setDialogOpen] = useState(false);
 const [preferredStart, setPreferredStart] = useState("09:00");
 const [preferredEnd, setPreferredEnd] = useState("17:00");
 const [notes, setNotes] = useState("");
 const [joined, setJoined] = useState(false);

 const joinWaitlist = useMutation({
 mutationFn: async () => {
 if (!user) throw new Error("Must be logged in");
 const { error } = await supabase.from("booking_waitlist").insert({
 merchant_id: merchantId,
 service_id: serviceId,
 user_id: user.id,
 preferred_date: format(date,"yyyy-MM-dd"),
 preferred_time_start: preferredStart +":00",
 preferred_time_end: preferredEnd +":00",
 notes: notes || null,
 expires_at: addDays(date, 1).toISOString(),
 });
 if (error) throw error;
 },
 onSuccess: () => {
 setJoined(true);
 setDialogOpen(false);
 toast.success("Added to waitlist!", {
 description:"We'll notify you if a slot opens up.",
 });
 },
 onError: () => toast.error("Failed to join waitlist"),
 });

 if (joined) {
 return (
 <div className="flex items-center gap-2 text-sm text-chart-1">
 <CheckCircle2 className="w-4 h-4" />
 On the waitlist
 </div>
 );
 }

 return (
 <>
 <Button
 variant="outline"
 size="sm"
 className="gap-1.5"
 onClick={() => setDialogOpen(true)}
 >
 <Bell className="w-3.5 h-3.5" />
 Join Waitlist
 </Button>

 <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Join Waitlist</DialogTitle>
 <DialogDescription>
 No slots available for {serviceName} on {format(date,"MMM d, yyyy")}.
 We'll notify you if one opens up.
 </DialogDescription>
 </DialogHeader>

 <div className="space-y-4">
 <div className="grid grid-cols-2 gap-3">
 <div>
 <Label>Preferred Start</Label>
 <Input
 type="time"
 value={preferredStart}
 onChange={(e) => setPreferredStart(e.target.value)}
 />
 </div>
 <div>
 <Label>Preferred End</Label>
 <Input
 type="time"
 value={preferredEnd}
 onChange={(e) => setPreferredEnd(e.target.value)}
 />
 </div>
 </div>
 <div>
 <Label>Notes (optional)</Label>
 <Textarea
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 placeholder="Any flexibility or preferences..."
 rows={2}
 />
 </div>
 </div>

 <DialogFooter>
 <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
 <Button onClick={() => joinWaitlist.mutate()} disabled={joinWaitlist.isPending}>
 {joinWaitlist.isPending ? (
 <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Joining...</>
 ) : (
 <><Bell className="w-4 h-4 mr-2" /> Join Waitlist</>
 )}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </>
 );
}
