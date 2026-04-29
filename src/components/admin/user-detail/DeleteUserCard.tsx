import { useState } from"react";
import { useNavigate } from"react-router-dom";
import { supabase } from"@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Trash2, AlertTriangle } from"lucide-react";
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

interface DeleteUserCardProps {
 userId: string;
 userEmail: string;
}

export function DeleteUserCard({ userId, userEmail }: DeleteUserCardProps) {
 const navigate = useNavigate();
 const [open, setOpen] = useState(false);
 const [confirmText, setConfirmText] = useState("");
 const [loading, setLoading] = useState(false);

 const handleDelete = async () => {
 setLoading(true);
 try {
 const { data, error } = await supabase.functions.invoke("admin-delete-user", {
 body: { user_id: userId },
 });
 if (error) throw error;
 if (data?.error) throw new Error(data.error);

 toast.success("User deleted permanently");
 setOpen(false);
 navigate("/admin/dashboard");
 } catch (err) {
 const msg = err instanceof Error ? err.message :"Failed to delete user";
 toast.error(msg);
 } finally {
 setLoading(false);
 }
 };

 return (
 <Card className="border-destructive/50">
 <CardHeader>
 <CardTitle className="flex items-center gap-2 text-lg">
 <Trash2 className="w-5 h-5 text-destructive" />
 Danger Zone
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <p className="text-sm text-muted-foreground">
 Permanently delete this user account and all associated authentication data.
 This action cannot be undone.
 </p>
 <Button
 variant="destructive"
 onClick={() => setOpen(true)}
 disabled={loading}
 className="w-full"
 >
 <Trash2 className="w-4 h-4 mr-2" />
 Delete User
 </Button>
 </CardContent>

 <AlertDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setConfirmText(""); }}>
 <AlertDialogContent>
 <AlertDialogHeader>
 <AlertDialogTitle className="flex items-center gap-2">
 <AlertTriangle className="w-5 h-5 text-destructive" />
 Delete this user permanently?
 </AlertDialogTitle>
 <AlertDialogDescription>
 This will permanently delete <strong>{userEmail}</strong> and their
 authentication record. This action cannot be undone. Type{""}
 <strong>DELETE</strong> below to confirm.
 </AlertDialogDescription>
 </AlertDialogHeader>
 <Input
 value={confirmText}
 onChange={(e) => setConfirmText(e.target.value)}
 placeholder="Type DELETE to confirm"
 autoFocus
 />
 <AlertDialogFooter>
 <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
 <AlertDialogAction
 onClick={(e) => { e.preventDefault(); handleDelete(); }}
 disabled={loading || confirmText !=="DELETE"}
 className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
 >
 {loading ?"Deleting…" :"Permanently Delete"}
 </AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>
 </Card>
 );
}
