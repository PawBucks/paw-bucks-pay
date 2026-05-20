import { useState, useMemo, useEffect } from"react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from"@/components/ui/card";
import { Label } from"@/components/ui/label";
import { Input } from"@/components/ui/input";
import { Badge } from"@/components/ui/badge";
import { Checkbox } from"@/components/ui/checkbox";
import { Cat, Crown, Dog, Loader2, MapPin, Target, Users } from "lucide-react";
import { supabase } from"@/integrations/supabase/client";
import type { TargetingRules } from"@/services/api/brandCampaigns.service";

interface TargetingRulesEditorProps {
 value: TargetingRules;
 onChange: (rules: TargetingRules) => void;
}

const SPECIES = ["dog","cat","bird","rabbit","reptile","fish","other"];
const CONSUMER_TIERS = ["pup","dog","alpha"];
const SUB_TIERS = ["free","pawpass","pawpass_plus"];

export function TargetingRulesEditor({ value, onChange }: TargetingRulesEditorProps) {
 const [reach, setReach] = useState<number | null>(null);
 const [loading, setLoading] = useState(false);

 // Debounced reach estimation
 useEffect(() => {
 const handle = setTimeout(async () => {
 setLoading(true);
 try {
 const { data, error } = await supabase.functions.invoke("estimate-campaign-reach", { body: { rules: value } });
 if (!error && data) setReach(data.estimated_audience);
 } catch {
 // ignore
 } finally {
 setLoading(false);
 }
 }, 600);
 return () => clearTimeout(handle);
 }, [value]);

 const toggleArray = (field: keyof TargetingRules, item: string) => {
 const current = (value[field] as string[]) || [];
 const next = current.includes(item) ? current.filter((x) => x !== item) : [...current, item];
 onChange({ ...value, [field]: next.length ? next : undefined });
 };

 const setField = (field: keyof TargetingRules, val: any) => {
 const next = { ...value };
 if (val ==="" || val === null || val === undefined) delete next[field];
 else (next[field] as any) = val;
 onChange(next);
 };

 const activeFilters = useMemo(() => {
 return Object.entries(value).filter(([_, v]) => v !== undefined && v !== null && v !=="" && (Array.isArray(v) ? v.length > 0 : true)).length;
 }, [value]);

 return (
 <Card className="border-primary/20">
 <CardHeader className="pb-3">
 <div className="flex items-center justify-between">
 <div>
 <CardTitle className="text-base flex items-center gap-2">
 <Target className="h-4 w-4 text-primary" />
 Audience Targeting
 </CardTitle>
 <CardDescription>Reach the exact pet owners that matter to your brand</CardDescription>
 </div>
 <Badge variant={activeFilters > 0 ?"default" :"secondary"}>
 {activeFilters} filter{activeFilters === 1 ?"" :"s"}
 </Badge>
 </div>
 </CardHeader>
 <CardContent className="space-y-5">
 {/* Geo */}
 <div className="space-y-2">
 <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />Geography</Label>
 <div className="grid grid-cols-2 gap-2">
 <Input
 placeholder="Center ZIP (e.g. 10001)"
 value={value.center_zip ||""}
 onChange={(e) => setField("center_zip", e.target.value || undefined)}
 />
 <Input
 type="number"
 placeholder="Radius (miles)"
 value={value.zip_radius_miles ||""}
 onChange={(e) => setField("zip_radius_miles", e.target.value ? Number(e.target.value) : undefined)}
 />
 </div>
 <Input
 placeholder="Or specific ZIP codes (comma-separated)"
 value={(value.zip_codes || []).join(",")}
 onChange={(e) => {
 const list = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
 setField("zip_codes", list.length ? list : undefined);
 }}
 />
 </div>

 {/* Species */}
 <div className="space-y-2">
 <Label className="flex items-center gap-1.5"><Dog className="h-3.5 w-3.5" />Pet Species</Label>
 <div className="flex flex-wrap gap-1.5">
 {SPECIES.map((sp) => {
 const active = (value.species || []).includes(sp);
 return (
 <Badge
 key={sp}
 variant={active ?"default" :"outline"}
 className="cursor-pointer capitalize"
 onClick={() => toggleArray("species", sp)}
 >
 {sp ==="cat" ? <Cat className="h-3 w-3 mr-1" aria-hidden /> : <Dog className="h-3 w-3 mr-1" />}
 {sp}
 </Badge>
 );
 })}
 </div>
 </div>

 {/* Pet age */}
 <div className="space-y-2">
 <Label>Pet Age (years)</Label>
 <div className="grid grid-cols-2 gap-2">
 <Input
 type="number"
 placeholder="Min"
 value={value.age_min_years ??""}
 onChange={(e) => setField("age_min_years", e.target.value ? Number(e.target.value) : undefined)}
 />
 <Input
 type="number"
 placeholder="Max"
 value={value.age_max_years ??""}
 onChange={(e) => setField("age_max_years", e.target.value ? Number(e.target.value) : undefined)}
 />
 </div>
 </div>

 {/* Breeds (comma-separated) */}
 <div className="space-y-2">
 <Label>Breeds (optional, comma-separated)</Label>
 <Input
 placeholder="Golden Retriever, Maine Coon, ..."
 value={(value.breeds || []).join(",")}
 onChange={(e) => {
 const list = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
 setField("breeds", list.length ? list : undefined);
 }}
 />
 </div>

 {/* Consumer tier */}
 <div className="space-y-2">
 <Label className="flex items-center gap-1.5"><Crown className="h-3.5 w-3.5" />Consumer Tier</Label>
 <div className="flex flex-wrap gap-1.5">
 {CONSUMER_TIERS.map((t) => {
 const active = (value.consumer_tiers || []).includes(t);
 return (
 <Badge
 key={t}
 variant={active ?"default" :"outline"}
 className="cursor-pointer capitalize"
 onClick={() => toggleArray("consumer_tiers", t)}
 >{t}</Badge>
 );
 })}
 </div>
 </div>

 {/* Subscription tier */}
 <div className="space-y-2">
 <Label>Subscription Tier</Label>
 <div className="flex flex-wrap gap-1.5">
 {SUB_TIERS.map((t) => {
 const active = (value.subscription_tiers || []).includes(t);
 return (
 <Badge
 key={t}
 variant={active ?"default" :"outline"}
 className="cursor-pointer capitalize"
 onClick={() => toggleArray("subscription_tiers", t)}
 >{t.replace(/_/g, " ")}</Badge>
 );
 })}
 </div>
 </div>

 {/* Recent activity */}
 <div className="space-y-2">
 <Label>Min completed purchases</Label>
 <Input
 type="number"
 min={0}
 placeholder="0 = any"
 value={value.min_purchases ??""}
 onChange={(e) => setField("min_purchases", e.target.value ? Number(e.target.value) : undefined)}
 />
 </div>

 {/* Reach */}
 <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
 <Users className="h-5 w-5 text-primary" />
 <div className="flex-1">
 <p className="text-xs text-muted-foreground">Estimated Audience</p>
 {loading ? (
 <p className="text-lg font-bold flex items-center gap-2">
 <Loader2 className="h-4 w-4 animate-spin" />
 Calculating…
 </p>
 ) : (
 <p className="text-2xl font-bold tabular-nums text-primary">
 {(reach ?? 0).toLocaleString()} <span className="text-xs text-muted-foreground">pet owners</span>
 </p>
 )}
 </div>
 </div>
 </CardContent>
 </Card>
 );
}
