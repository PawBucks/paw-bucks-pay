import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

type Table = "guide_places" | "guide_events" | "guide_faqs";

const FIELDS: Record<Table, { key: string; label: string; type: "text" | "textarea" | "number" | "switch" | "section" }[]> = {
  guide_places: [
    { key: "section", label: "Section", type: "section" },
    { key: "name", label: "Name", type: "text" },
    { key: "area", label: "Area / Neighborhood", type: "text" },
    { key: "description", label: "Description", type: "textarea" },
    { key: "tag", label: "Tag (off-leash, leashed, partner, monthly)", type: "text" },
    { key: "tag_label", label: "Tag Label", type: "text" },
    { key: "tip", label: "Tip (optional)", type: "textarea" },
    { key: "tip_icon", label: "Tip Icon (emoji)", type: "text" },
    { key: "sort_order", label: "Sort Order", type: "number" },
    { key: "is_active", label: "Active", type: "switch" },
  ],
  guide_events: [
    { key: "name", label: "Name", type: "text" },
    { key: "area", label: "Area", type: "text" },
    { key: "description", label: "Description", type: "textarea" },
    { key: "tag", label: "Tag", type: "text" },
    { key: "tag_label", label: "Tag Label", type: "text" },
    { key: "tip", label: "Tip (optional)", type: "textarea" },
    { key: "tip_icon", label: "Tip Icon (emoji)", type: "text" },
    { key: "sort_order", label: "Sort Order", type: "number" },
    { key: "is_active", label: "Active", type: "switch" },
  ],
  guide_faqs: [
    { key: "question", label: "Question", type: "text" },
    { key: "answer", label: "Answer", type: "textarea" },
    { key: "sort_order", label: "Sort Order", type: "number" },
    { key: "is_active", label: "Active", type: "switch" },
  ],
};

const emptyRow = (table: Table, guideSlug: string): Record<string, any> => {
  const base: Record<string, any> = { guide_slug: guideSlug, sort_order: 0, is_active: true };
  if (table === "guide_places") base.section = "parks";
  for (const f of FIELDS[table]) if (!(f.key in base)) base[f.key] = f.type === "switch" ? true : f.type === "number" ? 0 : "";
  return base;
};

function RowEditor({
  open,
  onOpenChange,
  table,
  row,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  table: Table;
  row: Record<string, any> | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setForm(row ?? {});
  }, [row]);

  const save = async () => {
    setSaving(true);
    const payload: Record<string, any> = { ...form };
    // normalize empty strings for nullable fields
    for (const k of ["tag", "tag_label", "tip", "tip_icon"]) if (payload[k] === "") payload[k] = null;
    let error;
    if (payload.id) {
      const { id, created_at, updated_at, ...rest } = payload;
      ({ error } = await (supabase.from(table) as any).update(rest).eq("id", id));
    } else {
      ({ error } = await (supabase.from(table) as any).insert(payload));
    }
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saved");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form?.id ? "Edit entry" : "Add entry"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {FIELDS[table].map((f) => (
            <div key={f.key} className="space-y-1">
              <Label htmlFor={f.key}>{f.label}</Label>
              {f.type === "textarea" ? (
                <Textarea
                  id={f.key}
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  rows={3}
                />
              ) : f.type === "switch" ? (
                <div>
                  <Switch checked={!!form[f.key]} onCheckedChange={(v) => setForm({ ...form, [f.key]: v })} />
                </div>
              ) : f.type === "number" ? (
                <Input
                  id={f.key}
                  type="number"
                  value={form[f.key] ?? 0}
                  onChange={(e) => setForm({ ...form, [f.key]: Number(e.target.value) })}
                />
              ) : f.type === "section" ? (
                <Select value={form.section ?? "parks"} onValueChange={(v) => setForm({ ...form, section: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="parks">Dog Parks</SelectItem>
                    <SelectItem value="beaches">Beaches &amp; Trails</SelectItem>
                    <SelectItem value="cafes">Cafes &amp; Patios</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input id={f.key} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GuideTableManager({ table, guideSlug }: { table: Table; guideSlug: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from(table).select("*").eq("guide_slug", guideSlug).order("sort_order");
    if (error) toast.error(error.message);
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, guideSlug]);

  const remove = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(emptyRow(table, guideSlug)); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Add entry
        </Button>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No entries yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.id} className={r.is_active ? "" : "opacity-60"}>
              <CardContent className="p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {r.name ?? r.question}
                    {table === "guide_places" && <span className="ml-2 text-xs text-muted-foreground">[{r.section}]</span>}
                    {!r.is_active && <span className="ml-2 text-xs">(hidden)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.area ? `${r.area} · ` : ""}sort: {r.sort_order}
                  </div>
                  <div className="text-xs mt-1 line-clamp-2">{r.description ?? r.answer}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <RowEditor open={open} onOpenChange={setOpen} table={table} row={editing} onSaved={load} />
    </div>
  );
}

export default function AdminGuides() {
  const [guideSlug, setGuideSlug] = useState("pet-friendly-los-angeles");
  const [customSlug, setCustomSlug] = useState("");

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/dashboard"><ArrowLeft className="w-4 h-4 mr-1" /> Admin</Link>
        </Button>
        <h1 className="text-2xl font-semibold">City Guides</h1>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <Label>Guide slug</Label>
            <Input value={guideSlug} onChange={(e) => setGuideSlug(e.target.value)} placeholder="pet-friendly-los-angeles" />
          </div>
          <div className="flex-1 min-w-[220px]">
            <Label>Create new guide slug</Label>
            <div className="flex gap-2">
              <Input value={customSlug} onChange={(e) => setCustomSlug(e.target.value)} placeholder="pet-friendly-austin" />
              <Button variant="outline" onClick={() => { if (customSlug.trim()) { setGuideSlug(customSlug.trim()); setCustomSlug(""); } }}>Use</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="places">
        <TabsList>
          <TabsTrigger value="places">Places</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="faqs">FAQs</TabsTrigger>
        </TabsList>
        <TabsContent value="places" className="mt-4">
          <GuideTableManager table="guide_places" guideSlug={guideSlug} />
        </TabsContent>
        <TabsContent value="events" className="mt-4">
          <GuideTableManager table="guide_events" guideSlug={guideSlug} />
        </TabsContent>
        <TabsContent value="faqs" className="mt-4">
          <GuideTableManager table="guide_faqs" guideSlug={guideSlug} />
        </TabsContent>
      </Tabs>
    </div>
  );
}