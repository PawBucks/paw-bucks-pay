import { useState, useMemo, useEffect } from"react";
import { useMutation, useQueryClient } from"@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from"@/components/ui/dialog";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Textarea } from"@/components/ui/textarea";
import { Slider } from"@/components/ui/slider";
import { Separator } from"@/components/ui/separator";
import { Progress } from"@/components/ui/progress";
import { Badge } from"@/components/ui/badge";
import { ArrowLeft, ArrowRight, CheckCircle2, DollarSign, Eye, Gift, Heart, Loader2, Megaphone, Palette, Repeat, Rocket, Target, Zap } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { toast } from"sonner";
import {
 createBrandCampaign,
 calculatePawbucksFromBudget,
 calculateEstimatedReach,
 type TargetingRules,
 type BrandCampaign,
} from"@/services/api/brandCampaigns.service";
import { TargetingRulesEditor } from"./TargetingRulesEditor";
import { BrandedCheckinPreview } from"./BrandedCheckinPreview";

interface CampaignWizardProps {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 brandId: string;
 brandName: string;
 brandLogoUrl?: string | null;
 onCreated?: (campaign: BrandCampaign) => void;
}

const STEPS = [
 { key:"basics", label:"Basics", icon: Megaphone },
 { key:"audience", label:"Audience", icon: Target },
 { key:"creative", label:"Creative", icon: Palette },
 { key:"budget", label:"Budget & Guardrails", icon: DollarSign },
 { key:"review", label:"Review & Launch", icon: CheckCircle2 },
] as const;

const TEMPLATES: Array<{
 key: string;
 Icon: typeof Rocket;
 name: string;
 description: string;
 preset: {
 headline: string;
 subtext: string;
 cta: string;
 color: string;
 pawbucks_per_checkin: number;
 budget_usd: number;
 };
}> = [
 {
 key:"new_product_launch",
 Icon: Rocket,
 name:"New Product Launch",
 description:"Drive trial of a new SKU with high reward per check-in.",
 preset: { headline:"Try Our Newest Treat!", subtext:"Earn bonus PawBucks when you check in.", cta:"Claim Bonus", color:"#6366f1", pawbucks_per_checkin: 1000, budget_usd: 2500 },
 },
 {
 key:"seasonal_promo",
 Icon: Gift,
 name:"Seasonal Promotion",
 description:"Holiday or seasonal awareness across many merchants.",
 preset: { headline:"Holiday PawBucks Bonus!", subtext:"Limited-time rewards from your favorite brand.", cta:"Get Bonus PB", color:"#ef4444", pawbucks_per_checkin: 500, budget_usd: 5000 },
 },
 {
 key:"loyalty_winback",
 Icon: Heart,
 name:"Loyalty Win-Back",
 description:"Re-engage lapsed pet owners with a generous reward.",
 preset: { headline:"We Miss Your Pet!", subtext:"Welcome back — enjoy bonus PawBucks.", cta:"Welcome Back", color:"#10b981", pawbucks_per_checkin: 2000, budget_usd: 1500 },
 },
 {
 key:"always_on",
 Icon: Repeat,
 name:"Always-On Awareness",
 description:"Steady, low-budget brand presence with auto-replenish.",
 preset: { headline:"Brand Bonus PawBucks", subtext:"Earn extra rewards every visit.", cta:"Earn Now", color:"#0ea5e9", pawbucks_per_checkin: 250, budget_usd: 1000 },
 },
];

const initialForm = {
 name:"",
 description:"",
 budget_usd: 500,
 pawbucks_per_checkin: 500,
 start_date:"",
 end_date:"",
 campaign_color:"#6366f1",
 campaign_logo_url:"",
 creative_headline:"",
 creative_subtext:"",
 creative_cta:"",
 targeting_notes:"",
 targeting_rules: {} as TargetingRules,
 daily_spend_cap: 0,
 auto_replenish_enabled: false,
 auto_replenish_threshold: 10,
 auto_replenish_amount_usd: 250,
 trigger_type:"checkin" as"checkin" |"checkout" |"both",
 min_purchase_usd: 0,
};

export function CampaignWizard({ open, onOpenChange, brandId, brandName, brandLogoUrl, onCreated }: CampaignWizardProps) {
 const queryClient = useQueryClient();
 const [stepIdx, setStepIdx] = useState(0);
 const [form, setForm] = useState(initialForm);
 const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

 const pawbucksPool = useMemo(() => calculatePawbucksFromBudget(form.budget_usd), [form.budget_usd]);
 const estimatedReach = useMemo(() => calculateEstimatedReach(pawbucksPool, form.pawbucks_per_checkin), [pawbucksPool, form.pawbucks_per_checkin]);
 const step = STEPS[stepIdx];

 useEffect(() => {
 if (!open) {
 setStepIdx(0);
 setForm(initialForm);
 setSelectedTemplate(null);
 }
 }, [open]);

 const applyTemplate = (templateKey: string) => {
 const t = TEMPLATES.find((x) => x.key === templateKey);
 if (!t) return;
 setSelectedTemplate(templateKey);
 setForm((f) => ({
 ...f,
 campaign_color: t.preset.color,
 pawbucks_per_checkin: t.preset.pawbucks_per_checkin,
 budget_usd: t.preset.budget_usd,
 creative_headline: t.preset.headline,
 creative_subtext: t.preset.subtext,
 creative_cta: t.preset.cta,
 }));
 toast.success(`${t.name} template applied`);
 };

 const canProceed = useMemo(() => {
 if (step.key ==="basics") return form.name.trim().length >= 3;
 if (step.key ==="budget") return form.budget_usd >= 100 && form.pawbucks_per_checkin >= 100;
 return true;
 }, [step.key, form]);

 const createMutation = useMutation({
 mutationFn: async () => {
 return createBrandCampaign({
 brand_id: brandId,
 name: form.name,
 description: form.description || undefined,
 budget_usd: form.budget_usd,
 pawbucks_pool: pawbucksPool,
 pawbucks_per_checkin: form.pawbucks_per_checkin,
 start_date: form.start_date || undefined,
 end_date: form.end_date || undefined,
 campaign_color: form.campaign_color,
 targeting_notes: form.targeting_notes || undefined,
 targeting_rules: form.targeting_rules,
 daily_spend_cap: form.daily_spend_cap > 0 ? form.daily_spend_cap : undefined,
 auto_replenish_enabled: form.auto_replenish_enabled,
 auto_replenish_threshold: form.auto_replenish_threshold,
 auto_replenish_amount_usd: form.auto_replenish_amount_usd,
 trigger_type: form.trigger_type,
 min_purchase_usd: form.trigger_type ==="checkin" ? 0 : form.min_purchase_usd,
 });
 },
 onSuccess: (result) => {
 if (result.error || !result.data) {
 toast.error("Failed to create campaign");
 return;
 }
 toast.success("Campaign created! Choose how to fund it.");
 queryClient.invalidateQueries({ queryKey: ["brand-campaigns"] });
 onCreated?.(result.data);
 onOpenChange(false);
 },
 onError: (e: Error) => toast.error(e.message),
 });

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Sparkles className="h-5 w-5 text-primary" />
 Campaign Builder 2.0
 </DialogTitle>
 <DialogDescription>
 Step {stepIdx + 1} of {STEPS.length} — {step.label}
 </DialogDescription>
 </DialogHeader>

 {/* Step indicator */}
 <div className="flex items-center gap-2 pt-2 pb-3">
 {STEPS.map((s, i) => {
 const Icon = s.icon;
 const isDone = i < stepIdx;
 const isCurrent = i === stepIdx;
 return (
 <div key={s.key} className="flex items-center gap-2 flex-1 last:flex-none">
 <div
 className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
 isDone ?"bg-primary border-primary text-primary-foreground" :
 isCurrent ?"border-primary text-primary" :
"border-border text-muted-foreground"
 }`}
 >
 {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
 </div>
 {i < STEPS.length - 1 && (
 <div className={`flex-1 h-0.5 ${isDone ?"bg-primary" :"bg-border"}`} />
 )}
 </div>
 );
 })}
 </div>

 {/* Step content */}
 <div className="space-y-5 py-2">
 {step.key ==="basics" && (
 <>
 {/* Template library */}
 <div className="space-y-2">
 <Label className="flex items-center gap-1.5">
 <Sparkles className="h-3.5 w-3.5" /> Start with a template (optional)
 </Label>
 <div className="grid grid-cols-2 gap-2">
 {TEMPLATES.map((t) => (
 <button
 key={t.key}
 type="button"
 onClick={() => applyTemplate(t.key)}
 className={`text-left p-3 rounded-lg border-2 transition-all ${
 selectedTemplate === t.key
 ?"border-primary bg-primary/5"
 :"border-border hover:border-primary/40"
 }`}
 >
 <div className="flex items-center gap-2 mb-1">
  <t.Icon className="h-4 w-4 text-primary" aria-hidden />
 <span className="font-semibold text-sm">{t.name}</span>
 </div>
 <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
 </button>
 ))}
 </div>
 </div>

 <Separator />

 <div className="space-y-2">
 <Label>Campaign Name *</Label>
 <Input
 value={form.name}
 onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
 placeholder="Spring 2026 Promotion"
 />
 </div>
 <div className="space-y-2">
 <Label>Description (internal)</Label>
 <Textarea
 value={form.description}
 onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
 placeholder="Describe your campaign goals..."
 rows={3}
 />
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div className="space-y-2">
 <Label>Start Date</Label>
 <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
 </div>
 <div className="space-y-2">
 <Label>End Date</Label>
 <Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
 </div>
 </div>
 </>
 )}

 {step.key ==="audience" && (
 <>
 <TargetingRulesEditor
 value={form.targeting_rules}
 onChange={(rules) => setForm((f) => ({ ...f, targeting_rules: rules }))}
 />
 <div className="space-y-2">
 <Label>Free-form targeting notes</Label>
 <Textarea
 value={form.targeting_notes}
 onChange={(e) => setForm((f) => ({ ...f, targeting_notes: e.target.value }))}
 placeholder="Any specific targeting preferences our team should know about..."
 rows={3}
 />
 </div>
 <div className="p-3 rounded-lg bg-muted border text-sm text-muted-foreground">
 You'll invite specific merchants in the next step (Marketplace tab) — targeting rules apply at the pet-owner level.
 </div>
 </>
 )}

 {step.key ==="creative" && (
 <div className="grid md:grid-cols-2 gap-5">
 <div className="space-y-4">
 <div className="space-y-2">
 <Label>Headline</Label>
 <Input
 value={form.creative_headline}
 onChange={(e) => setForm((f) => ({ ...f, creative_headline: e.target.value }))}
 placeholder="Try Our Newest Treat!"
 maxLength={50}
 />
 <p className="text-xs text-muted-foreground">{form.creative_headline.length}/50</p>
 </div>
 <div className="space-y-2">
 <Label>Subtext</Label>
 <Textarea
 value={form.creative_subtext}
 onChange={(e) => setForm((f) => ({ ...f, creative_subtext: e.target.value }))}
 placeholder="Earn bonus PawBucks when you check in."
 rows={2}
 maxLength={120}
 />
 <p className="text-xs text-muted-foreground">{form.creative_subtext.length}/120</p>
 </div>
 <div className="space-y-2">
 <Label>Call-to-Action Button</Label>
 <Input
 value={form.creative_cta}
 onChange={(e) => setForm((f) => ({ ...f, creative_cta: e.target.value }))}
 placeholder="Claim Bonus"
 maxLength={20}
 />
 </div>
 <div className="space-y-2">
 <Label>Brand Color</Label>
 <div className="flex items-center gap-2">
 <input
 type="color"
 value={form.campaign_color}
 onChange={(e) => setForm((f) => ({ ...f, campaign_color: e.target.value }))}
 className="w-10 h-10 rounded cursor-pointer border"
 />
 <Input
 value={form.campaign_color}
 onChange={(e) => setForm((f) => ({ ...f, campaign_color: e.target.value }))}
 className="font-mono text-sm"
 />
 </div>
 </div>
 <div className="space-y-2">
 <Label>Logo URL (optional)</Label>
 <Input
 value={form.campaign_logo_url}
 onChange={(e) => setForm((f) => ({ ...f, campaign_logo_url: e.target.value }))}
 placeholder="https://..."
 />
 </div>
 </div>

 <div className="space-y-2">
 <Label className="flex items-center gap-1.5">
 <Eye className="h-3.5 w-3.5" /> Live Preview
 </Label>
 <BrandedCheckinPreview
 brandName={brandName}
 logoUrl={form.campaign_logo_url || brandLogoUrl || null}
 color={form.campaign_color}
 headline={form.creative_headline || `${brandName} Bonus!`}
 subtext={form.creative_subtext ||"Earn bonus PawBucks at this check-in."}
 cta={form.creative_cta ||"Claim"}
 pawbucksAmount={form.pawbucks_per_checkin}
 />
 </div>
 </div>
 )}

 {step.key ==="budget" && (
 <>
 <div className="space-y-3 p-4 rounded-lg bg-muted border">
 <h3 className="font-semibold flex items-center gap-2">
 <Zap className="h-4 w-4" /> When are PawBucks released?
 </h3>
 <div className="grid grid-cols-3 gap-2">
 {([
 { val:"checkin", label:"On Check-in", desc:"Reward when a pet owner checks in" },
 { val:"checkout", label:"On Checkout", desc:"Reward after they make a purchase" },
 { val:"both", label:"Both", desc:"Reward on either action (once/day each)" },
 ] as const).map((opt) => (
 <button
 key={opt.val}
 type="button"
 onClick={() => setForm((f) => ({ ...f, trigger_type: opt.val }))}
 className={`text-left p-3 rounded-lg border-2 transition-all ${
 form.trigger_type === opt.val
 ?"border-primary bg-primary/5"
 :"border-border hover:border-primary/40"
 }`}
 >
 <p className="font-semibold text-sm">{opt.label}</p>
 <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
 </button>
 ))}
 </div>
 {(form.trigger_type ==="checkout" || form.trigger_type ==="both") && (
 <div className="space-y-2 pt-2">
 <Label>Minimum purchase to earn (USD, 0 = none)</Label>
 <Input
 type="number"
 min={0}
 step={1}
 value={form.min_purchase_usd}
 onChange={(e) => setForm((f) => ({ ...f, min_purchase_usd: Math.max(0, Number(e.target.value)) }))}
 />
 <p className="text-xs text-muted-foreground">
 Only checkouts at or above this amount will earn branded PawBucks.
 </p>
 </div>
 )}
 </div>

 <div className="space-y-4 p-4 rounded-lg bg-muted border">
 <h3 className="font-semibold flex items-center gap-2">
 <DollarSign className="h-4 w-4" /> Budget Calculator
 </h3>
 <div className="space-y-2">
 <Label>Campaign Budget (USD)</Label>
 <div className="flex items-center gap-3">
 <span className="text-muted-foreground">$</span>
 <Input
 type="number"
 min={100}
 step={100}
 value={form.budget_usd}
 onChange={(e) => setForm((f) => ({ ...f, budget_usd: Math.max(100, Number(e.target.value)) }))}
 />
 </div>
 <Slider
 value={[form.budget_usd]}
 onValueChange={([v]) => setForm((f) => ({ ...f, budget_usd: v }))}
 min={100}
 max={50000}
 step={100}
 className="mt-2"
 />
 <div className="flex justify-between text-xs text-muted-foreground">
 <span>$100</span>
 <span>$50,000</span>
 </div>
 </div>
 <div className="space-y-2">
 <Label>PawBucks Per Check-in</Label>
 <Input
 type="number"
 min={100}
 step={100}
 value={form.pawbucks_per_checkin}
 onChange={(e) => setForm((f) => ({ ...f, pawbucks_per_checkin: Math.max(100, Number(e.target.value)) }))}
 />
 </div>
 <div className="grid grid-cols-2 gap-3 pt-2">
 <div className="p-3 rounded-lg bg-background border text-center">
 <p className="text-xs text-muted-foreground">Total PawBucks Pool</p>
 <p className="text-xl font-bold text-primary">{pawbucksPool.toLocaleString()}</p>
 </div>
 <div className="p-3 rounded-lg bg-background border text-center">
 <p className="text-xs text-muted-foreground">Est. Check-ins</p>
 <p className="text-xl font-bold text-primary">{estimatedReach.toLocaleString()}</p>
 </div>
 </div>
 </div>

 <div className="space-y-3 p-4 rounded-lg bg-muted border">
 <h3 className="font-semibold flex items-center gap-2">
 <Zap className="h-4 w-4" /> Guardrails
 </h3>
 <div className="space-y-2">
 <Label>Daily Spend Cap (USD, 0 = none)</Label>
 <Input
 type="number"
 min={0}
 value={form.daily_spend_cap}
 onChange={(e) => setForm((f) => ({ ...f, daily_spend_cap: Math.max(0, Number(e.target.value)) }))}
 />
 </div>
 <div className="flex items-center gap-2">
 <input
 type="checkbox"
 id="wiz-auto-replenish"
 checked={form.auto_replenish_enabled}
 onChange={(e) => setForm((f) => ({ ...f, auto_replenish_enabled: e.target.checked }))}
 />
 <Label htmlFor="wiz-auto-replenish" className="cursor-pointer">Auto-replenish when pool nearly empty</Label>
 </div>
 {form.auto_replenish_enabled && (
 <div className="grid grid-cols-2 gap-2 pl-6">
 <div>
 <Label className="text-xs">Trigger %</Label>
 <Input
 type="number"
 min={1}
 max={50}
 value={form.auto_replenish_threshold}
 onChange={(e) => setForm((f) => ({ ...f, auto_replenish_threshold: Number(e.target.value) }))}
 />
 </div>
 <div>
 <Label className="text-xs">Top-up amount ($)</Label>
 <Input
 type="number"
 min={50}
 value={form.auto_replenish_amount_usd}
 onChange={(e) => setForm((f) => ({ ...f, auto_replenish_amount_usd: Number(e.target.value) }))}
 />
 </div>
 </div>
 )}
 </div>
 </>
 )}

 {step.key ==="review" && (
 <div className="space-y-3">
 <div className="p-4 rounded-lg border bg-muted/30 space-y-2">
 <div className="flex items-center justify-between">
 <span className="text-sm text-muted-foreground">Campaign Name</span>
 <span className="font-semibold">{form.name}</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-sm text-muted-foreground">Budget</span>
 <span className="font-semibold">${form.budget_usd.toLocaleString()}</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-sm text-muted-foreground">Pool</span>
 <span className="font-semibold">{pawbucksPool.toLocaleString()} PB</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-sm text-muted-foreground">Est. Reach</span>
 <span className="font-semibold">{estimatedReach.toLocaleString()} check-ins</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-sm text-muted-foreground">Per Check-in</span>
 <span className="font-semibold">{form.pawbucks_per_checkin} PB</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-sm text-muted-foreground">Trigger</span>
 <span className="font-semibold capitalize">
 {form.trigger_type ==="both" ?"Check-in + Checkout" : form.trigger_type}
 {form.trigger_type !=="checkin" && form.min_purchase_usd > 0 && ` · min $${form.min_purchase_usd}`}
 </span>
 </div>
 {form.daily_spend_cap > 0 && (
 <div className="flex items-center justify-between">
 <span className="text-sm text-muted-foreground">Daily Cap</span>
 <span className="font-semibold">${form.daily_spend_cap}</span>
 </div>
 )}
 {form.auto_replenish_enabled && (
 <div className="flex items-center justify-between">
 <span className="text-sm text-muted-foreground">Auto-Replenish</span>
 <Badge variant="secondary">+${form.auto_replenish_amount_usd} at {form.auto_replenish_threshold}%</Badge>
 </div>
 )}
 </div>

 <BrandedCheckinPreview
 brandName={brandName}
 logoUrl={form.campaign_logo_url || brandLogoUrl || null}
 color={form.campaign_color}
 headline={form.creative_headline || `${brandName} Bonus!`}
 subtext={form.creative_subtext ||"Earn bonus PawBucks at this check-in."}
 cta={form.creative_cta ||"Claim"}
 pawbucksAmount={form.pawbucks_per_checkin}
 />

 <p className="text-xs text-center text-muted-foreground">
 After creation, choose how to fund: instant card payment or admin invoice.
 </p>
 </div>
 )}
 </div>

 {/* Footer nav */}
 <div className="flex items-center justify-between pt-3 border-t">
 <Button
 variant="ghost"
 onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
 disabled={stepIdx === 0}
 >
 <ArrowLeft className="h-4 w-4 mr-1" /> Back
 </Button>
 <Progress value={((stepIdx + 1) / STEPS.length) * 100} className="flex-1 mx-4 h-1" />
 {stepIdx < STEPS.length - 1 ? (
 <Button
 onClick={() => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1))}
 disabled={!canProceed}
 >
 Next <ArrowRight className="h-4 w-4 ml-1" />
 </Button>
 ) : (
 <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !canProceed}>
 {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
 Create Campaign
 </Button>
 )}
 </div>
 </DialogContent>
 </Dialog>
 );
}
