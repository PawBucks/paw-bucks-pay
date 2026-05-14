import { useState } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Textarea } from"@/components/ui/textarea";
import { Badge } from"@/components/ui/badge";
import { AlertTriangle, Ban, Shield } from "lucide-react";
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
import { toast } from"sonner";

interface BanUserCardProps {
 userId: string;
 isBanned: boolean;
 bannedAt: string | null;
 bannedReason: string | null;
 onChange: () => void;
}

export function BanUserCard({ userId, isBanned, bannedAt, bannedReason, onChange }: BanUserCardProps) {
 const [reason, setReason] = useState("");
 const [open, setOpen] = useState(false);
 const [loading, setLoading] = useState(false);

 const handleToggleBan = async () => {
 setLoading(true);
 try {
 const { data, error } = await supabase.rpc("admin_set_user_ban", {
 _target_user_id: userId,
 _banned: !isBanned,
 _reason: !isBanned ? reason || null : null,
 });
 if (error) throw error;
 const result = data as { success?: boolean } | null;
 if (!result?.success) throw new Error("Action failed");

 toast.success(isBanned ?"User unbanned" :"User banned");
 setOpen(false);
 setReason("");
 onChange();
 } catch (err) {
 const msg = err instanceof Error ? err.message :"Failed to update ban status";
 toast.error(msg);
 } finally {
 setLoading(false);
 }
 };

 return (
 <Card className={isBanned ?"border-destructive" :""}>
 <CardHeader>
 <CardTitle className="flex items-center gap-2 text-lg">
 {isBanned ? (
 <>
 <Ban className="w-5 h-5 text-destructive" />
 Account Restricted
 </>
 ) : (
 <>
 <Shield className="w-5 h-5 text-success" aria-hidden="true" />
 Account Status
 </>
 )}
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 {isBanned ? (
 <div className="space-y-2">
 <Badge variant="destructive" className="gap-1">
 <Ban className="w-3 h-3" />
 Banned
 </Badge>
 {bannedAt && (
 <p className="text-sm text-muted-foreground">
 Banned on {new Date(bannedAt).toLocaleString()}
 </p>
 )}
 {bannedReason && (
 <div className="rounded-md border bg-muted p-3">
 <p className="text-xs font-medium text-muted-foreground mb-1">Reason</p>
 <p className="text-sm">{bannedReason}</p>
 </div>
 )}
 </div>
 ) : (
 <p className="text-sm text-muted-foreground">
 This account is active and can sign in normally.
 </p>
 )}

 <Button
 variant={isBanned ?"default" :"destructive"}
 onClick={() => (isBanned ? handleToggleBan() : setOpen(true))}
 disabled={loading}
 className="w-full"
 >
 {isBanned ? (
 <>
 <Shield className="w-4 h-4 mr-2" aria-hidden="true" />
 Unban User
 </>
 ) : (
 <>
 <Ban className="w-4 h-4 mr-2" />
 Ban User
 </>
 )}
 </Button>
 </CardContent>

 <AlertDialog open={open} onOpenChange={setOpen}>
 <AlertDialogContent>
 <AlertDialogHeader>
 <AlertDialogTitle className="flex items-center gap-2">
 <AlertTriangle className="w-5 h-5 text-destructive" />
 Ban this user?
 </AlertDialogTitle>
 <AlertDialogDescription>
 The user will be immediately signed out and blocked from signing in again.
 Their data is preserved and the action can be reversed.
 </AlertDialogDescription>
 </AlertDialogHeader>
 <div className="space-y-2">
 <label className="text-sm font-medium">Reason (optional)</label>
 <Textarea
 value={reason}
 onChange={(e) => setReason(e.target.value)}
 placeholder="e.g. Fraudulent activity, terms-of-service violation…"
 rows={3}
 />
 </div>
 <AlertDialogFooter>
 <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
 <AlertDialogAction
 onClick={(e) => {
 e.preventDefault();
 handleToggleBan();
 }}
 disabled={loading}
 className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
 >
 {loading ?"Banning…" :"Confirm Ban"}
 </AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>
 </Card>
 );
}
