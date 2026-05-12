import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Separator } from"@/components/ui/separator";
import { Palette } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import type { BrandCampaign, TargetingRules } from"@/services/api/brandCampaigns.service";

import { Formatters } from "@/utils/formatters";
interface Props {
 campaign: BrandCampaign & {
 creative_headline?: string | null;
 creative_subtext?: string | null;
 creative_cta?: string | null;
 };
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
 return (
 <div>
 <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
 <p className="text-sm font-medium mt-0.5 break-words">{value || <span className="text-muted-foreground italic">Not provided</span>}</p>
 </div>
 );
}

function ChipList({ items }: { items?: string[] | null }) {
 if (!items || items.length === 0) return <span className="text-muted-foreground italic text-sm">Any</span>;
 return (
 <div className="flex flex-wrap gap-1 mt-1">
 {items.map((i) => (
 <Badge key={i} variant="secondary" className="capitalize text-xs">{i.replace(/_/g," ")}</Badge>
 ))}
 </div>
 );
}

export function CampaignBriefCard({ campaign }: Props) {
 const t: TargetingRules = (campaign.targeting_rules as TargetingRules) || {};
 const c = campaign as any;

 const startDate = campaign.start_date ? new Date(campaign.start_date).toLocaleDateString() : null;
 const endDate = campaign.end_date ? new Date(campaign.end_date).toLocaleDateString() : null;
 const fundedDate = campaign.funded_at ? new Date(campaign.funded_at).toLocaleString() : null;
 const createdDate = new Date(campaign.created_at).toLocaleString();

 const usdPerCheckin = Formatters.money((campaign.pawbucks_per_checkin / 1000));
 const estimatedCheckins = campaign.pawbucks_per_checkin > 0
 ? Math.floor(campaign.pawbucks_pool / campaign.pawbucks_per_checkin)
 : 0;

 return (
 <Card className="border-primary/30">
 <CardHeader className="pb-3">
 <CardTitle className="text-lg flex items-center gap-2">
 <span className="h-5 w-5 text-primary" aria-hidden="true">📄</span>
 Campaign Brief
 </CardTitle>
 <CardDescription>
 Everything the brand captured at creation — use this to dial in execution.
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-6">
 {/* Overview */}
 <section>
 <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
 <Sparkles className="h-3.5 w-3.5" /> Overview
 </h4>
 <div className="grid sm:grid-cols-2 gap-4">
 <Field label="Campaign Name" value={campaign.name} />
 <Field label="Status" value={<Badge className="capitalize">{campaign.status.replace(/_/g," ")}</Badge>} />
 <div className="sm:col-span-2">
 <Field label="Description / Goal" value={campaign.description} />
 </div>
 {campaign.targeting_notes && (
 <div className="sm:col-span-2">
 <Field label="Targeting Notes (from brand)" value={campaign.targeting_notes} />
 </div>
 )}
 </div>
 </section>

 <Separator />

 {/* Creative */}
 <section>
 <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
 <Palette className="h-3.5 w-3.5" /> Creative
 </h4>
 <div className="grid sm:grid-cols-2 gap-4">
 <Field label="Headline" value={c.creative_headline} />
 <Field label="Call to Action" value={c.creative_cta} />
 <div className="sm:col-span-2">
 <Field label="Subtext" value={c.creative_subtext} />
 </div>
 <Field
 label="Brand Color"
 value={
 campaign.campaign_color ? (
 <span className="flex items-center gap-2">
 <span
 className="inline-block h-4 w-4 rounded border"
 style={{ backgroundColor: campaign.campaign_color }}
 />
 <code className="text-xs">{campaign.campaign_color}</code>
 </span>
 ) : null
 }
 />
 <Field
 label="Logo"
 value={
 campaign.campaign_logo_url ? (
 <a href={campaign.campaign_logo_url} target="_blank" rel="noreferrer" className="text-primary underline text-xs break-all">
 {campaign.campaign_logo_url}
 </a>
 ) : null
 }
 />
 </div>
 </section>

 <Separator />

 {/* Budget & Economics */}
 <section>
 <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
 <span className="h-3.5 w-3.5" aria-hidden="true">💵</span> Budget & Economics
 </h4>
 <div className="grid sm:grid-cols-3 gap-4">
 <Field label="Budget" value={`$${Number(campaign.budget_usd).toLocaleString()}`} />
 <Field label="PawBucks Pool" value={`${campaign.pawbucks_pool.toLocaleString()} PB`} />
 <Field label="Per Check-in" value={`${campaign.pawbucks_per_checkin.toLocaleString()} PB ($${usdPerCheckin})`} />
 <Field label="Estimated Check-ins" value={estimatedCheckins.toLocaleString()} />
 <Field label="Daily Spend Cap" value={campaign.daily_spend_cap ? `$${campaign.daily_spend_cap.toLocaleString()}` :"No cap"} />
 <Field label="Funding Method" value={<Badge variant="outline" className="capitalize">{(campaign.funding_method ||"self_serve").replace("_", " ")}</Badge>} />
 </div>
 </section>

 <Separator />

 {/* Guardrails */}
 <section>
 <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
 <span className="h-3.5 w-3.5" aria-hidden="true">🛡️</span> Guardrails & Auto-Replenish
 </h4>
 <div className="grid sm:grid-cols-2 gap-4">
 <Field
 label="Auto-Pause Threshold"
 value={campaign.auto_pause_threshold_pct ? `${campaign.auto_pause_threshold_pct}% of daily cap` :"Disabled"}
 />
 <Field
 label="Auto-Replenish"
 value={
 campaign.auto_replenish_enabled ? (
 <span>
 <Badge className="bg-success/10 text-success">Enabled</Badge>
 <span className="block text-xs text-muted-foreground mt-1">
 Trigger at {campaign.auto_replenish_threshold?.toLocaleString() ||"—"} PB → top up ${campaign.auto_replenish_amount_usd?.toLocaleString() ||"—"}
 </span>
 </span>
 ) : (
 <Badge variant="secondary">Disabled</Badge>
 )
 }
 />
 </div>
 </section>

 <Separator />

 {/* Targeting */}
 <section>
 <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
 <span className="h-3.5 w-3.5" aria-hidden="true">🎯</span> Audience Targeting
 </h4>
 <div className="grid sm:grid-cols-2 gap-4">
 <div>
 <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1">
 <span className="h-3 w-3" aria-hidden="true">📍</span> Geography
 </p>
 {t.center_zip || t.zip_radius_miles ? (
 <p className="text-sm font-medium mt-0.5">
 {t.zip_radius_miles ? `${t.zip_radius_miles} mi` :"—"} around{""}
 <code className="text-xs">{t.center_zip ||"—"}</code>
 </p>
 ) : (
 <span className="text-muted-foreground italic text-sm">Any location</span>
 )}
 {t.zip_codes && t.zip_codes.length > 0 && (
 <div className="mt-1">
 <p className="text-xs text-muted-foreground">Specific ZIPs:</p>
 <ChipList items={t.zip_codes} />
 </div>
 )}
 </div>
 <div>
 <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1">
 <span className="h-3 w-3" aria-hidden="true">🐕</span> Pet Species
 </p>
 <ChipList items={t.species} />
 </div>
 <div>
 <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Pet Age</p>
 <p className="text-sm font-medium mt-0.5">
 {t.age_min_years || t.age_max_years
 ? `${t.age_min_years ?? 0} – ${t.age_max_years ??"∞"} years`
 : <span className="text-muted-foreground italic">Any age</span>}
 </p>
 </div>
 <div>
 <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Breeds</p>
 <ChipList items={t.breeds} />
 </div>
 <div>
 <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1">
 <span className="h-3 w-3" aria-hidden="true">👑</span> Consumer Tier
 </p>
 <ChipList items={t.consumer_tiers} />
 </div>
 <div>
 <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Subscription Tier</p>
 <ChipList items={t.subscription_tiers} />
 </div>
 <Field
 label="Min Completed Purchases"
 value={t.min_purchases ? t.min_purchases.toString() :"Any"}
 />
 <Field
 label="Recently Active (days)"
 value={t.recent_active_days ? `${t.recent_active_days} days` :"Any"}
 />
 </div>
 </section>

 <Separator />

 {/* Schedule & Funding */}
 <section>
 <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
 <span className="h-3.5 w-3.5" aria-hidden="true">📅</span> Schedule & Funding Status
 </h4>
 <div className="grid sm:grid-cols-2 gap-4">
 <Field label="Start Date" value={startDate} />
 <Field label="End Date" value={endDate} />
 <Field label="Created" value={createdDate} />
 <Field
 label="Funded At"
 value={
 fundedDate ? (
 <span className="flex items-center gap-1">
 <span className="h-3.5 w-3.5 text-success" aria-hidden="true">💳</span>
 {fundedDate}
 </span>
 ) : (
 <Badge variant="outline">Not yet funded</Badge>
 )
 }
 />
 {campaign.stripe_payment_intent_id && (
 <div className="sm:col-span-2">
 <Field
 label="Stripe Payment Intent"
 value={<code className="text-xs break-all">{campaign.stripe_payment_intent_id}</code>}
 />
 </div>
 )}
 {campaign.admin_invoice_id && (
 <div className="sm:col-span-2">
 <Field
 label="Admin Invoice"
 value={<code className="text-xs break-all">{campaign.admin_invoice_id}</code>}
 />
 </div>
 )}
 </div>
 </section>
 </CardContent>
 </Card>
 );
}
