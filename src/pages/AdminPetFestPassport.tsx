import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Printer, QrCode, Stamp, Trash2 } from "lucide-react";
import { SEO } from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { buildAppUrl } from "@/lib/url";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AdminBooth {
  id: string;
  name: string;
  booth_number: string;
  sponsor_name: string;
  description: string;
  pawbucks_reward: number;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  qr_token: string;
  stamp_count: number;
}

const emptyBooth = {
  id: "",
  name: "",
  booth_number: "",
  sponsor_name: "",
  description: "",
  pawbucks_reward: 1000,
  is_required: true,
  is_active: true,
  sort_order: 0,
};

const boothUrl = (token: string) => buildAppUrl(`/petfest/passport?stamp=${token}`);

const AdminPetFestPassport = () => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<typeof emptyBooth | null>(null);
  const [saving, setSaving] = useState(false);
  const [awardEmail, setAwardEmail] = useState("");
  const [awardBoothId, setAwardBoothId] = useState("");
  const [awarding, setAwarding] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["admin-petfest-passport-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("petfest_passport_settings")
        .select("event_label, required_stamps, completion_bonus_pawbucks, is_live")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [settingsDraft, setSettingsDraft] = useState<null | {
    event_label: string;
    required_stamps: number;
    completion_bonus_pawbucks: number;
    is_live: boolean;
  }>(null);

  const currentSettings = settingsDraft ?? {
    event_label: settings?.event_label ?? "PetFest 2027",
    required_stamps: settings?.required_stamps ?? 6,
    completion_bonus_pawbucks: settings?.completion_bonus_pawbucks ?? 5000,
    is_live: settings?.is_live ?? false,
  };

  const { data: booths = [], isLoading } = useQuery({
    queryKey: ["admin-petfest-passport-booths"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_petfest_passport_booths_admin");
      if (error) throw error;
      return (data || []) as AdminBooth[];
    },
  });

  const { data: completions = 0 } = useQuery({
    queryKey: ["admin-petfest-passport-completions"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("petfest_passport_completions")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const totals = useMemo(() => {
    const stamps = booths.reduce((sum, b) => sum + Number(b.stamp_count || 0), 0);
    const pawbucks = booths.reduce((sum, b) => sum + Number(b.stamp_count || 0) * b.pawbucks_reward, 0);
    return { stamps, pawbucks };
  }, [booths]);

  const saveSettings = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("petfest_passport_settings")
      .update(currentSettings)
      .eq("id", true);
    setSaving(false);
    if (error) {
      toast.error("Could not save passport settings.");
      return;
    }
    toast.success("Passport settings saved.");
    setSettingsDraft(null);
    queryClient.invalidateQueries({ queryKey: ["admin-petfest-passport-settings"] });
    queryClient.invalidateQueries({ queryKey: ["petfest-passport-settings"] });
  };

  const saveBooth = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast.error("Booth name is required.");
      return;
    }
    setSaving(true);
    const payload = {
      name: editing.name.trim(),
      booth_number: editing.booth_number.trim(),
      sponsor_name: editing.sponsor_name.trim(),
      description: editing.description.trim(),
      pawbucks_reward: Math.max(0, Math.round(editing.pawbucks_reward || 0)),
      is_required: editing.is_required,
      is_active: editing.is_active,
      sort_order: Math.round(editing.sort_order || 0),
    };
    const { error } = editing.id
      ? await supabase.from("petfest_passport_booths").update(payload).eq("id", editing.id)
      : await supabase.from("petfest_passport_booths").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Could not save this booth.");
      return;
    }
    toast.success(editing.id ? "Booth updated." : "Booth created.");
    setEditing(null);
    queryClient.invalidateQueries({ queryKey: ["admin-petfest-passport-booths"] });
    queryClient.invalidateQueries({ queryKey: ["petfest-passport-booths"] });
  };

  const deleteBooth = async (booth: AdminBooth) => {
    if (!window.confirm(`Delete "${booth.name}"? Collected stamps for this booth are removed too.`)) return;
    const { error } = await supabase.from("petfest_passport_booths").delete().eq("id", booth.id);
    if (error) {
      toast.error("Could not delete this booth.");
      return;
    }
    toast.success("Booth deleted.");
    queryClient.invalidateQueries({ queryKey: ["admin-petfest-passport-booths"] });
    queryClient.invalidateQueries({ queryKey: ["petfest-passport-booths"] });
  };

  const awardManualStamp = async () => {
    if (!awardEmail.trim() || !awardBoothId) {
      toast.error("Pick a booth and enter the attendee's account email.");
      return;
    }
    setAwarding(true);
    try {
      const { data, error } = await supabase.functions.invoke("petfest-passport-scan", {
        body: { action: "manual_award", boothId: awardBoothId, email: awardEmail.trim() },
      });
      if (error) throw error;
      if (!data?.success) {
        const reasons: Record<string, string> = {
          user_not_found: "No PawBucks account found for that email.",
          not_authorized: "Admin access required.",
        };
        toast.error(reasons[data?.reason] || "Could not award that stamp.");
        return;
      }
      toast.success(
        data.alreadyStamped
          ? "That booth was already stamped for this attendee."
          : `Stamp awarded — ${(data.awarded || 0).toLocaleString()} PawBucks credited${data.bonusAwarded ? ` plus a ${data.bonusAwarded.toLocaleString()} completion bonus` : ""}.`,
      );
      setAwardEmail("");
      queryClient.invalidateQueries({ queryKey: ["admin-petfest-passport-booths"] });
      queryClient.invalidateQueries({ queryKey: ["admin-petfest-passport-completions"] });
    } catch {
      toast.error("Could not award that stamp.");
    } finally {
      setAwarding(false);
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 space-y-6">
      <SEO title="PetFest Passport Admin" description="Manage PetFest Passport booths, QR codes and rewards." noIndex />

      <header className="space-y-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Stamp className="h-6 w-6 text-primary" aria-hidden />
          PetFest Passport
        </h1>
        <p className="text-muted-foreground text-sm">
          Create participating booths, print their scan codes and track stamp activity.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Booths", value: booths.length },
          { label: "Stamps collected", value: totals.stamps },
          { label: "PawBucks from stamps", value: totals.pawbucks.toLocaleString() },
          { label: "Passports completed", value: completions },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Passport settings</CardTitle>
          <CardDescription>Stamps required to complete the passport and the completion bonus.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="event_label">Event label</Label>
            <Input
              id="event_label"
              value={currentSettings.event_label}
              onChange={(e) => setSettingsDraft({ ...currentSettings, event_label: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="required_stamps">Stamps required</Label>
            <Input
              id="required_stamps"
              type="number"
              min={1}
              value={currentSettings.required_stamps}
              onChange={(e) => setSettingsDraft({ ...currentSettings, required_stamps: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="completion_bonus">Completion bonus (PawBucks)</Label>
            <Input
              id="completion_bonus"
              type="number"
              min={0}
              value={currentSettings.completion_bonus_pawbucks}
              onChange={(e) =>
                setSettingsDraft({ ...currentSettings, completion_bonus_pawbucks: Number(e.target.value) })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="is_live">Passport live</Label>
            <div className="flex items-center gap-3 h-10">
              <Switch
                id="is_live"
                checked={currentSettings.is_live}
                onCheckedChange={(v) => setSettingsDraft({ ...currentSettings, is_live: v })}
              />
              <span className="text-sm text-muted-foreground">
                {currentSettings.is_live ? "Scanning enabled" : "Scanning closed"}
              </span>
            </div>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button onClick={saveSettings} disabled={saving || !settingsDraft}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save settings
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Booths &amp; scan codes</CardTitle>
            <CardDescription>Print the QR code and place it at the booth. Each scan pays PawBucks.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" aria-hidden />
              Print QR sheet
            </Button>
            <Button onClick={() => setEditing({ ...emptyBooth, sort_order: booths.length })}>
              <Plus className="h-4 w-4 mr-2" aria-hidden />
              Add booth
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : booths.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No booths yet. Add your first participating booth to generate its scan code.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {booths.map((booth) => (
                <div key={booth.id} className="rounded-lg border p-4 flex gap-4 break-inside-avoid">
                  <div className="bg-background p-2 rounded border shrink-0">
                    <QRCodeCanvas value={boothUrl(booth.qr_token)} size={104} includeMargin={false} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold truncate">{booth.name}</p>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {booth.is_active ? "Active" : "Off"}
                      </span>
                    </div>
                    {booth.booth_number && (
                      <p className="text-xs text-muted-foreground">Booth {booth.booth_number}</p>
                    )}
                    {booth.sponsor_name && <p className="text-xs text-muted-foreground">{booth.sponsor_name}</p>}
                    <p className="text-sm font-medium text-primary">
                      {booth.pawbucks_reward.toLocaleString()} PawBucks per stamp
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {Number(booth.stamp_count || 0).toLocaleString()} stamps collected
                    </p>
                    <p className="text-[11px] text-muted-foreground break-all flex items-start gap-1">
                      <QrCode className="h-3 w-3 mt-0.5 shrink-0" aria-hidden />
                      {booth.qr_token}
                    </p>
                    <div className="flex gap-2 pt-1 print:hidden">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setEditing({
                            id: booth.id,
                            name: booth.name,
                            booth_number: booth.booth_number || "",
                            sponsor_name: booth.sponsor_name || "",
                            description: booth.description || "",
                            pawbucks_reward: booth.pawbucks_reward,
                            is_required: booth.is_required,
                            is_active: booth.is_active,
                            sort_order: booth.sort_order,
                          })
                        }
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" aria-hidden />
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteBooth(booth)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1 text-destructive" aria-hidden />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="text-lg">Paper passport turn-in</CardTitle>
          <CardDescription>
            Credit a stamp for an attendee who collected it on a printed passport at PawBucks HQ.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3 items-end">
          <div className="space-y-2">
            <Label htmlFor="award_email">Attendee account email</Label>
            <Input
              id="award_email"
              type="email"
              value={awardEmail}
              onChange={(e) => setAwardEmail(e.target.value)}
              placeholder="attendee@email.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="award_booth">Booth</Label>
            <select
              id="award_booth"
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={awardBoothId}
              onChange={(e) => setAwardBoothId(e.target.value)}
            >
              <option value="">Select a booth</option>
              {booths.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={awardManualStamp} disabled={awarding}>
            {awarding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Award stamp
          </Button>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit booth" : "Add booth"}</DialogTitle>
            <DialogDescription>Booths appear on the attendee passport in sort order.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="booth_name">Booth name</Label>
                <Input
                  id="booth_name"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="booth_number">Booth number</Label>
                  <Input
                    id="booth_number"
                    value={editing.booth_number}
                    onChange={(e) => setEditing({ ...editing, booth_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="booth_sponsor">Sponsor / business</Label>
                  <Input
                    id="booth_sponsor"
                    value={editing.sponsor_name}
                    onChange={(e) => setEditing({ ...editing, sponsor_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="booth_description">Description</Label>
                <Textarea
                  id="booth_description"
                  rows={2}
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="booth_reward">PawBucks per stamp</Label>
                  <Input
                    id="booth_reward"
                    type="number"
                    min={0}
                    value={editing.pawbucks_reward}
                    onChange={(e) => setEditing({ ...editing, pawbucks_reward: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="booth_sort">Sort order</Label>
                  <Input
                    id="booth_sort"
                    type="number"
                    value={editing.sort_order}
                    onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    id="booth_active"
                    checked={editing.is_active}
                    onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                  />
                  <Label htmlFor="booth_active">Active</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="booth_required"
                    checked={editing.is_required}
                    onCheckedChange={(v) => setEditing({ ...editing, is_required: v })}
                  />
                  <Label htmlFor="booth_required">Required for completion</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveBooth} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save booth
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPetFestPassport;
