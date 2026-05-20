import { useState } from"react";
import { useQuery, useMutation, useQueryClient } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Textarea } from"@/components/ui/textarea";
import { GradientCard } from"@/components/ui/gradient-card";
import { Badge } from"@/components/ui/badge";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
} from"@/components/ui/dialog";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
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
import { Dog, DollarSign, Edit, Library, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from"sonner";
import {
  BREED_LIBRARY,
  searchBreeds,
  findBreedReference,
  recommendGrooming,
  type BreedReference,
} from"@/lib/groomingBreedLibrary";

const SIZE_CATEGORIES = [
 { value:"small", label:"Small (under 25 lbs)" },
 { value:"medium", label:"Medium (25–50 lbs)" },
 { value:"large", label:"Large (50–90 lbs)" },
 { value:"giant", label:"Giant (90+ lbs)" },
];

const COAT_TYPES = [
 { value:"smooth", label:"Smooth / Short" },
 { value:"double", label:"Double Coat" },
 { value:"curly", label:"Curly / Wool" },
 { value:"wire", label:"Wire / Rough" },
 { value:"long", label:"Long / Silky" },
 { value:"hairless", label:"Hairless" },
];

const SIZE_COLORS: Record<string, string> = {
 small:"bg-info/10 text-info border-info/20",
 medium:"bg-success/10 text-success border-success/20",
 large:"bg-warning/10 text-warning border-warning/20",
 giant:"bg-destructive/10 text-destructive border-destructive/20",
};

interface BreedProfile {
 id: string;
 merchant_id: string;
 breed_name: string;
 size_category: string;
 coat_type: string;
 duration_minutes_override: number | null;
 price_override: number | null;
 grooming_notes: string | null;
 is_active: boolean;
}

interface GroomingBreedManagerProps {
 merchantId: string;
}

export function GroomingBreedManager({ merchantId }: GroomingBreedManagerProps) {
 const queryClient = useQueryClient();
 const [dialogOpen, setDialogOpen] = useState(false);
 const [editing, setEditing] = useState<BreedProfile | null>(null);
 const [deleteId, setDeleteId] = useState<string | null>(null);
  const [seedDialogOpen, setSeedDialogOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

 const [form, setForm] = useState({
 breed_name:"",
 size_category:"medium",
 coat_type:"smooth",
 duration_minutes_override:"",
 price_override:"",
 grooming_notes:"",
 });

 const { data: breeds = [], isLoading } = useQuery({
 queryKey: ["grooming-breeds", merchantId],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("grooming_breed_profiles")
 .select("*")
 .eq("merchant_id", merchantId)
 .order("breed_name");
 if (error) throw error;
 return data as BreedProfile[];
 },
 });

 const saveMutation = useMutation({
 mutationFn: async () => {
 const payload = {
 merchant_id: merchantId,
 breed_name: form.breed_name.trim(),
 size_category: form.size_category,
 coat_type: form.coat_type,
 duration_minutes_override: form.duration_minutes_override ? parseInt(form.duration_minutes_override) : null,
 price_override: form.price_override ? parseFloat(form.price_override) : null,
 grooming_notes: form.grooming_notes || null,
 };

 if (editing) {
 const { error } = await supabase
 .from("grooming_breed_profiles")
 .update(payload)
 .eq("id", editing.id);
 if (error) throw error;
 } else {
 const { error } = await supabase
 .from("grooming_breed_profiles")
 .insert(payload);
 if (error) throw error;
 }
 },
 onSuccess: () => {
 toast.success(editing ?"Breed profile updated!" :"Breed profile added!");
 queryClient.invalidateQueries({ queryKey: ["grooming-breeds", merchantId] });
 closeDialog();
 },
 onError: (e: any) => {
 if (e?.code ==="23505") {
 toast.error("This breed already exists. Edit the existing one instead.");
 } else {
 toast.error("Failed to save breed profile");
 }
 },
 });

 const deleteMutation = useMutation({
 mutationFn: async (id: string) => {
 const { error } = await supabase.from("grooming_breed_profiles").delete().eq("id", id);
 if (error) throw error;
 },
 onSuccess: () => {
 toast.success("Breed profile deleted");
 queryClient.invalidateQueries({ queryKey: ["grooming-breeds", merchantId] });
 setDeleteId(null);
 },
 });

  const seedMutation = useMutation({
    mutationFn: async (refs: BreedReference[]) => {
      const existing = new Set(breeds.map((b) => b.breed_name.toLowerCase()));
      const rows = refs
        .filter((r) => !existing.has(r.name.toLowerCase()))
        .map((r) => {
          const rec = recommendGrooming(r.size, r.coat);
          return {
            merchant_id: merchantId,
            breed_name: r.name,
            size_category: r.size,
            coat_type: r.coat,
            duration_minutes_override: rec.durationMinutes,
            price_override: rec.priceUsd,
            grooming_notes: r.notes || null,
          };
        });
      if (rows.length === 0) return { inserted: 0, skipped: refs.length };
      const { error } = await supabase.from("grooming_breed_profiles").insert(rows);
      if (error) throw error;
      return { inserted: rows.length, skipped: refs.length - rows.length };
    },
    onSuccess: ({ inserted, skipped }) => {
      if (inserted === 0) {
        toast.info("All selected breeds were already in your library");
      } else {
        toast.success(
          `Added ${inserted} breed${inserted === 1 ? "" : "s"}` +
            (skipped > 0 ? ` (${skipped} skipped — already exist)` : "")
        );
      }
      queryClient.invalidateQueries({ queryKey: ["grooming-breeds", merchantId] });
      setSeedDialogOpen(false);
    },
    onError: () => toast.error("Failed to seed breed library"),
  });

  // Autocomplete suggestions while typing breed name
  const suggestions = showSuggestions ? searchBreeds(form.breed_name) : [];

  const applySuggestion = (ref: BreedReference) => {
    const rec = recommendGrooming(ref.size, ref.coat);
    setForm({
      ...form,
      breed_name: ref.name,
      size_category: ref.size,
      coat_type: ref.coat,
      duration_minutes_override: rec.durationMinutes.toString(),
      price_override: rec.priceUsd.toString(),
      grooming_notes: ref.notes || form.grooming_notes,
    });
    setShowSuggestions(false);
  };

  const suggestDefaults = () => {
    // Try to match the typed name first; otherwise use current size+coat
    const matched = findBreedReference(form.breed_name);
    const size = (matched?.size || form.size_category) as any;
    const coat = (matched?.coat || form.coat_type) as any;
    const rec = recommendGrooming(size, coat);
    setForm({
      ...form,
      size_category: size,
      coat_type: coat,
      duration_minutes_override: rec.durationMinutes.toString(),
      price_override: rec.priceUsd.toString(),
      grooming_notes: matched?.notes || form.grooming_notes,
    });
    toast.success(
      matched
        ? `Applied recommended defaults for ${matched.name}`
        : `Applied defaults for ${size} / ${coat} coat`
    );
  };

 const openNew = () => {
 setEditing(null);
 setForm({ breed_name:"", size_category:"medium", coat_type:"smooth", duration_minutes_override:"", price_override:"", grooming_notes:"" });
 setDialogOpen(true);
 };

 const openEdit = (bp: BreedProfile) => {
 setEditing(bp);
 setForm({
 breed_name: bp.breed_name,
 size_category: bp.size_category,
 coat_type: bp.coat_type,
 duration_minutes_override: bp.duration_minutes_override?.toString() ||"",
 price_override: bp.price_override?.toString() ||"",
 grooming_notes: bp.grooming_notes ||"",
 });
 setDialogOpen(true);
 };

 const closeDialog = () => {
 setDialogOpen(false);
 setEditing(null);
 };

 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h3 className="text-lg font-semibold flex items-center gap-2">
 <Dog className="w-5 h-5 text-primary" />
 Breed Profiles
 </h3>
 <p className="text-sm text-muted-foreground">
 Set breed-specific durations, pricing, and coat type info
 </p>
 </div>
        <div className="flex gap-2">
          <Button onClick={() => setSeedDialogOpen(true)} size="sm" variant="outline">
            <Library className="w-4 h-4 mr-1" /> Seed Common Breeds
          </Button>
          <Button onClick={openNew} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Add Breed
          </Button>
        </div>
 </div>

 {isLoading ? (
 <div className="flex justify-center py-8">
 <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
 </div>
 ) : breeds.length === 0 ? (
 <GradientCard className="p-8 text-center">
 <Dog className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
 <h4 className="font-semibold mb-1">No Breed Profiles Yet</h4>
 <p className="text-sm text-muted-foreground mb-4">
 Add breed-specific grooming times and prices so appointments auto-adjust based on the pet's breed.
 </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => setSeedDialogOpen(true)} size="sm" variant="outline">
              <Library className="w-4 h-4 mr-1" /> Seed Common Breeds
            </Button>
            <Button onClick={openNew} size="sm">
              <Plus className="w-4 h-4 mr-1" /> Add First Breed
            </Button>
          </div>
 </GradientCard>
 ) : (
 <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
 {breeds.map((bp) => (
 <GradientCard key={bp.id} className="p-4">
 <div className="flex items-start justify-between mb-2">
 <div>
 <h4 className="font-semibold">{bp.breed_name}</h4>
 <div className="flex gap-1.5 mt-1 flex-wrap">
 <Badge variant="outline" className={`text-xs ${SIZE_COLORS[bp.size_category] ||""}`}>
 {bp.size_category}
 </Badge>
 <Badge variant="secondary" className="text-xs capitalize">
 {bp.coat_type.replace(/_/g, " ")}
 </Badge>
 </div>
 </div>
 <div className="flex gap-1">
 <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(bp)}>
 <Edit className="w-3.5 h-3.5" />
 </Button>
 <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(bp.id)}>
 <Trash2 className="w-3.5 h-3.5" />
 </Button>
 </div>
 </div>
 <div className="flex gap-3 text-sm text-muted-foreground">
 {bp.duration_minutes_override && (
 <span className="flex items-center gap-1">
 <span className="w-3.5 h-3.5" aria-hidden="true">⏰</span> {bp.duration_minutes_override} min
 </span>
 )}
 {bp.price_override && (
 <span className="flex items-center gap-1">
 <DollarSign className="w-3.5 h-3.5" /> ${bp.price_override}
 </span>
 )}
 </div>
 {bp.grooming_notes && (
 <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{bp.grooming_notes}</p>
 )}
 </GradientCard>
 ))}
 </div>
 )}

 {/* Add/Edit Dialog */}
 <Dialog open={dialogOpen} onOpenChange={closeDialog}>
 <DialogContent className="sm:max-w-[450px]">
 <DialogHeader>
 <DialogTitle>{editing ?"Edit Breed Profile" :"Add Breed Profile"}</DialogTitle>
 </DialogHeader>
 <div className="space-y-4">
 <div>
 <Label>Breed Name *</Label>
              <div className="relative">
                <Input
                  value={form.breed_name}
                  onChange={(e) => {
                    setForm({ ...form, breed_name: e.target.value });
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="Start typing — e.g., Golden Retriever"
                  autoComplete="off"
                />
                {suggestions.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-md max-h-56 overflow-y-auto">
                    {suggestions.map((s) => {
                      const rec = recommendGrooming(s.size, s.coat);
                      return (
                        <button
                          type="button"
                          key={s.name}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applySuggestion(s)}
                          className="w-full text-left px-3 py-2 hover:bg-accent/10 flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="font-medium">{s.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {rec.durationMinutes}m · ${rec.priceUsd}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1 h-7 px-2 text-xs text-primary"
                onClick={suggestDefaults}
                disabled={!form.breed_name.trim() && !form.size_category}
              >
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                Suggest defaults
              </Button>
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <Label>Size Category</Label>
 <Select value={form.size_category} onValueChange={(v) => setForm({ ...form, size_category: v })}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 {SIZE_CATEGORIES.map((s) => (
 <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label>Coat Type</Label>
 <Select value={form.coat_type} onValueChange={(v) => setForm({ ...form, coat_type: v })}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 {COAT_TYPES.map((c) => (
 <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <Label>Duration Override (min)</Label>
 <Input
 type="number"
 value={form.duration_minutes_override}
 onChange={(e) => setForm({ ...form, duration_minutes_override: e.target.value })}
 placeholder="e.g., 90"
 />
 </div>
 <div>
 <Label>Price Override ($)</Label>
 <Input
 type="number"
 step="0.01"
 value={form.price_override}
 onChange={(e) => setForm({ ...form, price_override: e.target.value })}
 placeholder="e.g., 85.00"
 />
 </div>
 </div>
 <div>
 <Label>Grooming Notes</Label>
 <Textarea
 value={form.grooming_notes}
 onChange={(e) => setForm({ ...form, grooming_notes: e.target.value })}
 placeholder="e.g., Requires de-matting brush, double coat blow-out..."
 rows={2}
 />
 </div>
 <Button
 className="w-full"
 onClick={() => saveMutation.mutate()}
 disabled={!form.breed_name.trim() || saveMutation.isPending}
 >
 {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
 {editing ?"Update" :"Add"} Breed Profile
 </Button>
 </div>
 </DialogContent>
 </Dialog>

      {/* Seed Common Breeds Dialog */}
      <Dialog open={seedDialogOpen} onOpenChange={setSeedDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Library className="w-5 h-5 text-primary" />
              Seed Common Breeds
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Bulk-add popular breeds with recommended durations and prices based on size and coat type.
            Already-added breeds will be skipped. You can edit any value afterward.
          </p>
          <div className="flex-1 overflow-y-auto border border-border rounded-md divide-y">
            {(["small", "medium", "large", "giant"] as const).map((size) => (
              <div key={size} className="p-3">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                  {size}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {BREED_LIBRARY.filter((b) => b.size === size).map((b) => {
                    const rec = recommendGrooming(b.size, b.coat);
                    const exists = breeds.some(
                      (e) => e.breed_name.toLowerCase() === b.name.toLowerCase()
                    );
                    return (
                      <div
                        key={b.name}
                        className={`flex items-center justify-between text-xs px-2 py-1.5 rounded ${
                          exists ? "opacity-50" : "bg-muted/30"
                        }`}
                      >
                        <span className="truncate">
                          {b.name}
                          {exists && (
                            <span className="ml-1 text-[10px] text-success">added</span>
                          )}
                        </span>
                        <span className="text-muted-foreground whitespace-nowrap ml-2">
                          {rec.durationMinutes}m · ${rec.priceUsd}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setSeedDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => seedMutation.mutate(BREED_LIBRARY)}
              disabled={seedMutation.isPending}
            >
              {seedMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              Add All ({BREED_LIBRARY.length})
            </Button>
          </div>
        </DialogContent>
      </Dialog>

 {/* Delete Confirmation */}
 <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
 <AlertDialogContent>
 <AlertDialogHeader>
 <AlertDialogTitle>Delete Breed Profile?</AlertDialogTitle>
 <AlertDialogDescription>This will remove the breed-specific settings permanently.</AlertDialogDescription>
 </AlertDialogHeader>
 <AlertDialogFooter>
 <AlertDialogCancel>Cancel</AlertDialogCancel>
 <AlertDialogAction
 onClick={() => deleteId && deleteMutation.mutate(deleteId)}
 className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
 >
 Delete
 </AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>
 </div>
 );
}
