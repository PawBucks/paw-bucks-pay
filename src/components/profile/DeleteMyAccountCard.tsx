import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GradientCard } from "@/components/ui/gradient-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, AlertTriangle } from "lucide-react";
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
import { toast } from "sonner";

export function DeleteMyAccountCard() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-my-account");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Your account has been deleted");
      setOpen(false);
      await signOut().catch(() => { /* session already invalid */ });
      navigate("/auth", { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete account";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <GradientCard className="border border-destructive/40">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-destructive" />
          <h3 className="text-base font-semibold">Delete Account</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Permanently delete your account. Your transaction history will be retained
          for our records and tax compliance, but your personal information will be removed.
          This action cannot be undone.
        </p>
        <Button
          variant="destructive"
          onClick={() => setOpen(true)}
          disabled={loading}
          className="w-full"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete My Account
        </Button>
      </div>

      <AlertDialog
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) setConfirmText(""); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete your account permanently?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your sign-in and personal information.
              For tax and compliance purposes, your transaction history will be
              retained but anonymized. This cannot be undone. Type{" "}
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
              disabled={loading || confirmText !== "DELETE"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "Deleting…" : "Permanently Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </GradientCard>
  );
}