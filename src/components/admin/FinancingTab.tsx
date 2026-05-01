import { useEffect, useState } from'react';
import { supabase } from'@/integrations/supabase/client';
import { Button } from'@/components/ui/button';
import { Badge } from'@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from'@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from'@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from'@/components/ui/dialog';
import { Label } from'@/components/ui/label';
import { Input } from'@/components/ui/input';
import { Textarea } from'@/components/ui/textarea';
import { Separator } from'@/components/ui/separator';
import { Progress } from'@/components/ui/progress';
import { toast } from'sonner';
import {
 TrendingUp, DollarSign, Users, Calendar, Building2, MapPin, Phone, Mail,
 Globe, CheckCircle2, XCircle, AlertTriangle, Clock, BarChart3, Briefcase,
 Shield, Star, ArrowRight, ChevronRight, ExternalLink, Activity, CreditCard,
 Landmark, FileText, ShoppingBag, BadgeCheck, CircleDot
} from'lucide-react';
import { UnderwritingSignalsCard } from'./UnderwritingSignalsCard';
import { format, formatDistanceToNow, differenceInDays } from'date-fns';

import { Formatters } from "@/utils/formatters";
// ─── Types ────────────────────────────────────────────────────────────────────

type FundingApplicant = {
 // funding_requests
 id: string;
 merchant_id: string;
 requested_amount: number;
 reason: string;
 estimated_monthly_sales: number;
 status: string;
 created_at: string;
 // merchants join
 business_name: string;
 business_type: string;
 entity_type: string | null;
 description: string | null;
 address: string | null;
 phone: string | null;
 email: string | null;
 owner_name: string | null;
 contact_person: string | null;
 approval_status: string;
 merchant_since: string;
 stripe_account_status: string | null;
 cashback_rate: number;
 accepts_pawbucks: boolean;
 website_url: string | null;
 facebook_url: string | null;
 instagram_url: string | null;
 linkedin_url: string | null;
 state_of_incorporation: string | null;
 country: string | null;
 // computed analytics
 total_transactions: number;
 total_revenue: number;
 revenue_90d: number;
 revenue_30d: number;
 unique_customers: number;
 existing_deals: number;
 total_funded_to_date: number;
};

type VetLoanApplicant = {
 id: string;
 user_id: string;
 vet_id: string;
 invoice_amount: number;
 requested_amount: number;
 status: string;
 term_months: number;
 purpose: string | null;
 invoice_url: string | null;
 created_at: string;
 // vet join
 clinic_name: string | null;
 name: string | null;
 practice_type: string | null;
 license_number: string | null;
 license_state: string | null;
 npi_number: string | null;
 clinic_phone: string | null;
 contact_email: string | null;
 location: string | null;
 is_verified: boolean;
 approval_status: string;
 accreditations: string[] | null;
 services_provided: string[] | null;
 subscription_tier: string | null;
 // patient join
 patient_name: string | null;
 patient_email: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRiskScore(a: FundingApplicant): { score: number; label: string; color: string } {
 let score = 0;
 // Revenue coverage: can 90-day revenue cover the ask?
 const coverage = a.revenue_90d / (a.requested_amount || 1);
 if (coverage >= 3) score += 35;
 else if (coverage >= 1.5) score += 20;
 else if (coverage >= 0.8) score += 10;

 // Transaction volume
 if (a.total_transactions >= 50) score += 20;
 else if (a.total_transactions >= 20) score += 12;
 else if (a.total_transactions >= 5) score += 5;

 // Customer diversity
 if (a.unique_customers >= 20) score += 15;
 else if (a.unique_customers >= 10) score += 8;
 else if (a.unique_customers >= 3) score += 3;

 // Platform tenure
 const daysSince = differenceInDays(new Date(), new Date(a.merchant_since));
 if (daysSince >= 180) score += 15;
 else if (daysSince >= 90) score += 8;
 else if (daysSince >= 30) score += 3;

 // Stripe connected
 if (a.stripe_account_status ==='active') score += 15;

 if (score >= 75) return { score, label:'Low Risk', color:'text-success' };
 if (score >= 50) return { score, label:'Moderate Risk', color:'text-warning' };
 if (score >= 25) return { score, label:'Elevated Risk', color:'text-warning' };
 return { score, label:'High Risk', color:'text-destructive' };
}

function getRepaymentProjection(amount: number, monthlyRevenue: number) {
 const rate = 0.1; // 10% of revenue per month
 const monthlyPayment = monthlyRevenue * rate;
 if (monthlyPayment <= 0) return null;
 const months = Math.ceil(amount / monthlyPayment);
 return { monthlyPayment, months };
}

function StatusBadge({ status }: { status: string }) {
 const map: Record<string, { label: string; variant:'default' |'secondary' |'destructive' |'outline' }> = {
 pending: { label:'Pending Review', variant:'secondary' },
 approved: { label:'Approved', variant:'default' },
 funded: { label:'Funded', variant:'default' },
 denied: { label:'Denied', variant:'destructive' },
 active: { label:'Active', variant:'default' },
 };
 const cfg = map[status] ?? { label: status, variant:'outline' };
 return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

// ─── Deal Card (pipeline list) ────────────────────────────────────────────────

function DealCard({ applicant, selected, onSelect }: {
 applicant: FundingApplicant;
 selected: boolean;
 onSelect: () => void;
}) {
 const risk = getRiskScore(applicant);
 const coverage = applicant.revenue_90d / (applicant.requested_amount || 1);
 const daysSince = differenceInDays(new Date(), new Date(applicant.merchant_since));

 return (
 <button
 onClick={onSelect}
 className={`w-full text-left p-4 rounded-md border-2 transition-all hover:shadow-md ${
 selected
 ?'border-primary bg-primary/5 shadow-md'
 :'border-border bg-card hover:border-primary/40'
 }`}
 >
 <div className="flex items-start justify-between gap-2 mb-3">
 <div>
 <p className="font-semibold text-foreground leading-tight">{applicant.business_name}</p>
 <p className="text-xs text-muted-foreground mt-0.5 capitalize">{applicant.business_type}</p>
 </div>
 <StatusBadge status={applicant.status} />
 </div>
 <div className="flex items-center justify-between mb-2">
 <span className="text-lg font-bold text-foreground">
 ${applicant.requested_amount.toLocaleString()}
 </span>
 <span className={`text-xs font-medium ${risk.color}`}>{risk.label}</span>
 </div>
 <div className="grid grid-cols-3 gap-1 text-xs text-muted-foreground">
 <span>⬆ ${Formatters.decimal((applicant.revenue_30d / 1000), 1)}k / 30d</span>
 <span>📦 {applicant.total_transactions} txns</span>
 <span>🕐 {daysSince}d old</span>
 </div>
 {selected && (
 <div className="mt-2 flex items-center gap-1 text-xs text-primary font-medium">
 <ChevronRight className="w-3 h-3" /> Reviewing
 </div>
 )}
 </button>
 );
}

// ─── Metric Widget ─────────────────────────────────────────────────────────────

function Metric({ icon: Icon, label, value, sub, accent = false }: {
 icon: any; label: string; value: string; sub?: string; accent?: boolean;
}) {
 return (
 <div className={`rounded-md p-4 border ${accent ?'bg-primary/5 border-primary/20' :'bg-muted/30 border-border'}`}>
 <div className="flex items-center gap-2 mb-1">
 <Icon className={`w-4 h-4 ${accent ?'text-primary' :'text-muted-foreground'}`} />
 <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
 </div>
 <p className={`text-xl font-bold ${accent ?'text-primary' :'text-foreground'}`}>{value}</p>
 {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
 </div>
 );
}

// ─── Merchant Detail Panel ─────────────────────────────────────────────────────

function MerchantDetailPanel({
 applicant,
 onApprove,
 onDeny,
 onMarkFunded,
}: {
 applicant: FundingApplicant;
 onApprove: () => void;
 onDeny: () => void;
 onMarkFunded: () => void;
}) {
 const risk = getRiskScore(applicant);
 const projection = getRepaymentProjection(applicant.requested_amount, applicant.revenue_30d);
 const coverage = applicant.revenue_90d / (applicant.requested_amount || 1);
 const eligibilityDays = differenceInDays(new Date(), new Date(applicant.merchant_since));
 const maxEligible = applicant.revenue_90d * 0.8;

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-start justify-between">
 <div>
 <h2 className="text-2xl font-bold text-foreground">{applicant.business_name}</h2>
 <div className="flex items-center gap-2 mt-1 flex-wrap">
 <Badge variant="outline" className="capitalize">{applicant.business_type}</Badge>
 {applicant.entity_type && <Badge variant="outline">{applicant.entity_type}</Badge>}
 <Badge variant="outline">{applicant.country ??'US'}</Badge>
 <StatusBadge status={applicant.status} />
 </div>
 </div>
 <div className="text-right">
 <p className="text-xs text-muted-foreground">Applied</p>
 <p className="text-sm font-medium">{format(new Date(applicant.created_at),'MMM d, yyyy')}</p>
 <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(applicant.created_at), { addSuffix: true })}</p>
 </div>
 </div>

 {/* Risk + Ask Summary */}
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 <Metric icon={DollarSign} label="Amount Requested" value={`$${applicant.requested_amount.toLocaleString()}`} accent />
 <Metric icon={Shield} label="Risk Score" value={`${risk.score}/100`} sub={risk.label} />
 <Metric icon={TrendingUp} label="Max Eligible" value={`$${maxEligible.toLocaleString('en', { maximumFractionDigits: 0 })}`} sub="80% of 90d revenue" />
 <Metric icon={Activity} label="Revenue Coverage" value={`${Formatters.decimal(coverage, 1)}x`} sub="90d rev / ask" />
 </div>

 {/* Financial Performance */}
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <BarChart3 className="w-4 h-4 text-primary" /> Revenue Performance
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 <Metric icon={DollarSign} label="30-Day Revenue" value={`$${applicant.revenue_30d.toLocaleString()}`} />
 <Metric icon={DollarSign} label="90-Day Revenue" value={`$${applicant.revenue_90d.toLocaleString()}`} />
 <Metric icon={DollarSign} label="Total Revenue" value={`$${applicant.total_revenue.toLocaleString()}`} />
 <Metric icon={DollarSign} label="Self-Reported Monthly" value={`$${applicant.estimated_monthly_sales.toLocaleString()}`} sub="Applicant claim" />
 </div>

 {/* Revenue trend bar */}
 <div className="mt-4 space-y-2">
 <div className="flex justify-between text-xs text-muted-foreground">
 <span>Revenue vs. Requested Amount</span>
 <span>{Formatters.number(Math.round((coverage * 100)))}% covered</span>
 </div>
 <Progress value={Math.min(coverage * 33, 100)} className="h-2" />
 <div className="flex justify-between text-xs text-muted-foreground">
 <span>Platform Revenue (verified)</span>
 <span>Applicant Estimate</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="flex-1 h-6 rounded bg-muted overflow-hidden">
 <div
 className="h-full bg-primary/60 rounded flex items-center pl-2 text-xs text-white font-medium"
 style={{ width: `${Math.min((applicant.revenue_90d / (applicant.estimated_monthly_sales * 3 || 1)) * 100, 100)}%` }}
 >
 ${applicant.revenue_90d.toLocaleString()}
 </div>
 </div>
 <span className="text-xs font-medium text-muted-foreground">
 ${(applicant.estimated_monthly_sales * 3).toLocaleString()} est.
 </span>
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Transaction Health */}
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <Activity className="w-4 h-4 text-primary" /> Transaction Health
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 <Metric icon={ShoppingBag} label="Total Transactions" value={applicant.total_transactions.toString()} />
 <Metric icon={Users} label="Unique Customers" value={applicant.unique_customers.toString()} />
 <Metric icon={DollarSign} label="Avg Transaction" value={
 applicant.total_transactions > 0
 ? `${Formatters.currency((applicant.total_revenue / applicant.total_transactions))}`
 :'N/A'
 } />
 <Metric icon={CreditCard} label="Stripe Status" value={applicant.stripe_account_status ??'N/A'} />
 </div>
 </CardContent>
 </Card>

 {/* Repayment Projection */}
 {projection && (
 <Card className="border-primary/20 bg-primary/5">
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2 text-primary">
 <Landmark className="w-4 h-4" /> Repayment Projection (10% of Revenue)
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-3 gap-3">
 <Metric icon={DollarSign} label="Est. Monthly Payment" value={`$${Formatters.number(Math.round(projection.monthlyPayment))}`} sub="10% of 30d revenue" accent />
 <Metric icon={Calendar} label="Est. Payoff Period" value={`${projection.months} months`} accent />
 <Metric icon={TrendingUp} label="Effective Rate" value="10% of revenue" sub="Revenue-based" accent />
 </div>
 </CardContent>
 </Card>
 )}

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 {/* Business Profile */}
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <Building2 className="w-4 h-4 text-primary" /> Business Profile
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-3 text-sm">
 {applicant.owner_name && (
 <div className="flex items-center gap-2">
 <Briefcase className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
 <span className="text-muted-foreground">Owner:</span>
 <span className="font-medium">{applicant.owner_name}</span>
 </div>
 )}
 {applicant.contact_person && applicant.contact_person !== applicant.owner_name && (
 <div className="flex items-center gap-2">
 <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
 <span className="text-muted-foreground">Contact:</span>
 <span className="font-medium">{applicant.contact_person}</span>
 </div>
 )}
 {applicant.address && (
 <div className="flex items-start gap-2">
 <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
 <span>{applicant.address}</span>
 </div>
 )}
 {applicant.phone && (
 <div className="flex items-center gap-2">
 <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
 <span>{applicant.phone}</span>
 </div>
 )}
 {applicant.email && (
 <div className="flex items-center gap-2">
 <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
 <span className="truncate">{applicant.email}</span>
 </div>
 )}
 {applicant.website_url && (
 <div className="flex items-center gap-2">
 <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
 <a href={applicant.website_url} target="_blank" rel="noopener noreferrer"
 className="text-primary hover:underline truncate flex items-center gap-1">
 {applicant.website_url.replace(/^https?:\/\//,'')}
 <ExternalLink className="w-3 h-3" />
 </a>
 </div>
 )}
 <Separator />
 <div className="flex items-center gap-2">
 <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
 <span className="text-muted-foreground">On platform since:</span>
 <span className="font-medium">{format(new Date(applicant.merchant_since),'MMM d, yyyy')}</span>
 </div>
 <div className="flex items-center gap-2">
 <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
 <span className="text-muted-foreground">Tenure:</span>
 <span className="font-medium">{eligibilityDays} days</span>
 {eligibilityDays < 90 && (
 <Badge variant="destructive" className="text-xs">Under 90-day min</Badge>
 )}
 </div>
 {applicant.state_of_incorporation && (
 <div className="flex items-center gap-2">
 <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
 <span className="text-muted-foreground">Incorporated:</span>
 <span className="font-medium">{applicant.state_of_incorporation}, {applicant.country}</span>
 </div>
 )}
 </CardContent>
 </Card>

 {/* Eligibility Checklist */}
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <BadgeCheck className="w-4 h-4 text-primary" /> Eligibility Checklist
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-3 text-sm">
 {[
 {
 check: eligibilityDays >= 90,
 label:'90+ days on platform',
 detail: `${eligibilityDays} days`,
 },
 {
 check: applicant.approval_status ==='approved',
 label:'Account approved',
 detail: applicant.approval_status,
 },
 {
 check: applicant.stripe_account_status ==='active',
 label:'Stripe payout active',
 detail: applicant.stripe_account_status ??'not connected',
 },
 {
 check: applicant.total_transactions >= 5,
 label:'5+ completed transactions',
 detail: `${applicant.total_transactions} transactions`,
 },
 {
 check: applicant.requested_amount <= maxEligible,
 label:'Ask ≤ 80% of 90d revenue',
 detail: `Max: $${maxEligible.toLocaleString('en', { maximumFractionDigits: 0 })}`,
 },
 {
 check: applicant.existing_deals === 0,
 label:'No existing funding deals',
 detail: applicant.existing_deals > 0 ? `${applicant.existing_deals} active deal(s)` :'Clean',
 },
 {
 check: applicant.accepts_pawbucks,
 label:'Accepts PawBucks',
 detail: applicant.accepts_pawbucks ?'Yes' :'No',
 },
 ].map(({ check, label, detail }) => (
 <div key={label} className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 {check
 ? <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
 : <XCircle className="w-4 h-4 text-destructive shrink-0" />
 }
 <span className={check ?'text-foreground' :'text-muted-foreground'}>{label}</span>
 </div>
 <span className="text-xs text-muted-foreground">{detail}</span>
 </div>
 ))}
 </CardContent>
 </Card>
 </div>

 {/* Use of Funds */}
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <FileText className="w-4 h-4 text-primary" /> Use of Funds
 </CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-sm bg-muted/40 rounded-lg p-3 italic text-foreground">
"{applicant.reason}"
 </p>
 </CardContent>
 </Card>

 {/* Business Description */}
 {applicant.description && (
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <Briefcase className="w-4 h-4 text-primary" /> Business Description
 </CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-sm text-muted-foreground leading-relaxed">{applicant.description}</p>
 </CardContent>
 </Card>
 )}

 {/* Underwriting Signals */}
 <UnderwritingSignalsCard merchantId={applicant.merchant_id} />

 {/* Social Presence */}
 {(applicant.linkedin_url || applicant.instagram_url || applicant.facebook_url) && (
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <Star className="w-4 h-4 text-primary" /> Online Presence
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="flex flex-wrap gap-2">
 {applicant.linkedin_url && (
 <a href={applicant.linkedin_url} target="_blank" rel="noopener noreferrer">
 <Badge variant="outline" className="hover:bg-primary/10 cursor-pointer gap-1">
 LinkedIn <ExternalLink className="w-3 h-3" />
 </Badge>
 </a>
 )}
 {applicant.instagram_url && (
 <a href={applicant.instagram_url} target="_blank" rel="noopener noreferrer">
 <Badge variant="outline" className="hover:bg-primary/10 cursor-pointer gap-1">
 Instagram <ExternalLink className="w-3 h-3" />
 </Badge>
 </a>
 )}
 {applicant.facebook_url && (
 <a href={applicant.facebook_url} target="_blank" rel="noopener noreferrer">
 <Badge variant="outline" className="hover:bg-primary/10 cursor-pointer gap-1">
 Facebook <ExternalLink className="w-3 h-3" />
 </Badge>
 </a>
 )}
 </div>
 </CardContent>
 </Card>
 )}

 {/* CTA */}
 {applicant.status ==='pending' && (
 <div className="flex gap-3 pt-2">
 <Button className="flex-1 gap-2" onClick={onApprove}>
 <CheckCircle2 className="w-4 h-4" /> Approve Funding
 </Button>
 <Button variant="destructive" className="flex-1 gap-2" onClick={onDeny}>
 <XCircle className="w-4 h-4" /> Deny Request
 </Button>
 </div>
 )}
 {applicant.status ==='approved' && (
 <div className="flex gap-3 pt-2">
 <Button className="flex-1 gap-2 bg-info hover:bg-info text-white" onClick={onMarkFunded}>
 <DollarSign className="w-4 h-4" /> Mark as Funded
 </Button>
 </div>
 )}
 </div>
 );
}

// ─── Vet Loan Panel ────────────────────────────────────────────────────────────

function VetLoanDetailPanel({
 loan,
 onApprove,
 onDeny,
 onMarkFunded,
}: {
 loan: VetLoanApplicant;
 onApprove: () => void;
 onDeny: () => void;
 onMarkFunded: () => void;
}) {
 return (
 <div className="space-y-6">
 <div className="flex items-start justify-between">
 <div>
 <h2 className="text-2xl font-bold text-foreground">{loan.clinic_name || loan.name ||'Vet Clinic'}</h2>
 <div className="flex items-center gap-2 mt-1 flex-wrap">
 {loan.practice_type && <Badge variant="outline" className="capitalize">{loan.practice_type.replace(/_/g,'')}</Badge>}
 {loan.is_verified && <Badge variant="default" className="gap-1"><BadgeCheck className="w-3 h-3" /> Verified</Badge>}
 {loan.subscription_tier && <Badge variant="outline">Tier: {loan.subscription_tier}</Badge>}
 <StatusBadge status={loan.status} />
 </div>
 </div>
 <div className="text-right">
 <p className="text-xs text-muted-foreground">Applied</p>
 <p className="text-sm font-medium">{format(new Date(loan.created_at),'MMM d, yyyy')}</p>
 </div>
 </div>

 {/* Financials */}
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 <Metric icon={DollarSign} label="Requested" value={`$${loan.requested_amount.toLocaleString()}`} accent />
 <Metric icon={FileText} label="Invoice Amount" value={`$${loan.invoice_amount.toLocaleString()}`} />
 <Metric icon={Calendar} label="Term" value={`${loan.term_months} months`} />
 <Metric icon={DollarSign} label="Monthly Payment" value={`$${Formatters.number(Math.round((loan.requested_amount / loan.term_months)))}`} />
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 {/* Clinic Profile */}
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <Building2 className="w-4 h-4 text-primary" /> Clinic Profile
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-3 text-sm">
 {loan.location && (
 <div className="flex items-start gap-2">
 <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
 <span>{loan.location}</span>
 </div>
 )}
 {loan.clinic_phone && (
 <div className="flex items-center gap-2">
 <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
 <span>{loan.clinic_phone}</span>
 </div>
 )}
 {loan.contact_email && (
 <div className="flex items-center gap-2">
 <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
 <span>{loan.contact_email}</span>
 </div>
 )}
 {loan.license_number && (
 <div className="flex items-center gap-2">
 <Shield className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
 <span className="text-muted-foreground">License:</span>
 <span className="font-medium font-mono text-xs">{loan.license_number} ({loan.license_state})</span>
 </div>
 )}
 {loan.npi_number && (
 <div className="flex items-center gap-2">
 <CircleDot className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
 <span className="text-muted-foreground">NPI:</span>
 <span className="font-medium font-mono text-xs">{loan.npi_number}</span>
 </div>
 )}
 </CardContent>
 </Card>

 {/* Patient / Purpose */}
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <FileText className="w-4 h-4 text-primary" /> Loan Details
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-3 text-sm">
 {loan.patient_name && (
 <div className="flex items-center gap-2">
 <Users className="w-3.5 h-3.5 text-muted-foreground" />
 <span className="text-muted-foreground">Borrower:</span>
 <span className="font-medium">{loan.patient_name}</span>
 </div>
 )}
 {loan.patient_email && (
 <div className="flex items-center gap-2">
 <Mail className="w-3.5 h-3.5 text-muted-foreground" />
 <span>{loan.patient_email}</span>
 </div>
 )}
 {loan.purpose && (
 <div className="pt-1">
 <p className="text-muted-foreground mb-1">Purpose:</p>
 <p className="bg-muted/40 rounded p-2 italic">{loan.purpose}</p>
 </div>
 )}
 {loan.invoice_url && (
 <a href={loan.invoice_url} target="_blank" rel="noopener noreferrer"
 className="flex items-center gap-1 text-primary hover:underline text-xs">
 <ExternalLink className="w-3 h-3" /> View Invoice
 </a>
 )}
 </CardContent>
 </Card>
 </div>

 {/* Accreditations */}
 {loan.accreditations && loan.accreditations.length > 0 && (
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-base flex items-center gap-2">
 <BadgeCheck className="w-4 h-4 text-primary" /> Accreditations
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="flex flex-wrap gap-2">
 {loan.accreditations.map(a => (
 <Badge key={a} variant="secondary">{a}</Badge>
 ))}
 </div>
 </CardContent>
 </Card>
 )}

 {loan.status ==='pending' && (
 <div className="flex gap-3 pt-2">
 <Button className="flex-1 gap-2" onClick={onApprove}>
 <CheckCircle2 className="w-4 h-4" /> Approve Loan
 </Button>
 <Button variant="destructive" className="flex-1 gap-2" onClick={onDeny}>
 <XCircle className="w-4 h-4" /> Deny Loan
 </Button>
 </div>
 )}
 {loan.status ==='approved' && (
 <div className="flex gap-3 pt-2">
 <Button className="flex-1 gap-2 bg-info hover:bg-info text-white" onClick={onMarkFunded}>
 <DollarSign className="w-4 h-4" /> Mark as Funded
 </Button>
 </div>
 )}
 </div>
 );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function FinancingTab() {
 const [fundingApplicants, setFundingApplicants] = useState<FundingApplicant[]>([]);
 const [vetLoans, setVetLoans] = useState<VetLoanApplicant[]>([]);
 const [selectedMerchant, setSelectedMerchant] = useState<FundingApplicant | null>(null);
 const [selectedVetLoan, setSelectedVetLoan] = useState<VetLoanApplicant | null>(null);
 const [approveDialogOpen, setApproveDialogOpen] = useState(false);
 const [denyDialogOpen, setDenyDialogOpen] = useState(false);
 const [fundingAmount, setFundingAmount] = useState('');
 const [repaymentRate, setRepaymentRate] = useState('10');
 const [denyReason, setDenyReason] = useState('');
 const [loading, setLoading] = useState(false);
 const [tab, setTab] = useState('merchant');

 useEffect(() => { loadData(); }, []);

 const loadData = async () => {
 // Merchant funding requests with full merchant join + computed analytics
 const { data: requests } = await supabase
 .from('funding_requests')
 .select(`
 *,
 merchants!inner(
 business_name, business_type, entity_type, description, address, phone, email,
 owner_name, contact_person, approval_status, created_at, stripe_account_status,
 cashback_rate, accepts_pawbucks, website_url, facebook_url, instagram_url,
 linkedin_url, state_of_incorporation, country
 )
 `)
 .order('created_at', { ascending: false });

 if (requests) {
 // Enrich with analytics per merchant
 const enriched = await Promise.all(requests.map(async (r: any) => {
 const m = r.merchants;
 // transaction metrics
 const [txResult, dealsResult] = await Promise.all([
 supabase.rpc('get_merchant_analytics', { p_merchant_id: r.merchant_id }),
 supabase.from('funding_deals').select('amount_funded').eq('merchant_id', r.merchant_id),
 ]);
 const tx = txResult.data;
 // 30d and 90d revenue via separate queries
 const [rev30, rev90] = await Promise.all([
 supabase.from('transactions').select('amount').eq('merchant_id', r.merchant_id).eq('status','completed').gte('created_at', new Date(Date.now() - 30 * 864e5).toISOString()),
 supabase.from('transactions').select('amount').eq('merchant_id', r.merchant_id).eq('status','completed').gte('created_at', new Date(Date.now() - 90 * 864e5).toISOString()),
 ]);
 const revenue_30d = (rev30.data || []).reduce((s: number, t: any) => s + Number(t.amount), 0);
 const revenue_90d = (rev90.data || []).reduce((s: number, t: any) => s + Number(t.amount), 0);
 const total_funded_to_date = (dealsResult.data || []).reduce((s: number, d: any) => s + Number(d.amount_funded), 0);

 return {
 id: r.id,
 merchant_id: r.merchant_id,
 requested_amount: Number(r.requested_amount),
 reason: r.reason,
 estimated_monthly_sales: Number(r.estimated_monthly_sales),
 status: r.status,
 created_at: r.created_at,
 ...m,
 merchant_since: m.created_at,
 total_transactions: Number(tx?.[0]?.transaction_count ?? 0),
 total_revenue: Number(tx?.[0]?.total_sales ?? 0),
 revenue_30d,
 revenue_90d,
 unique_customers: Number(tx?.[0]?.total_customers ?? 0),
 existing_deals: dealsResult.data?.length ?? 0,
 total_funded_to_date,
 } as FundingApplicant;
 }));
 setFundingApplicants(enriched);
 if (enriched.length > 0 && !selectedMerchant) setSelectedMerchant(enriched[0]);
 }

 // Vet loans
 const { data: loans } = await supabase
 .from('vet_loans')
 .select(`
 *,
 partner_vets!inner(
 name, clinic_name, clinic_phone, contact_email, location,
 practice_type, license_number, license_state, npi_number,
 is_verified, approval_status, accreditations, services_provided, subscription_tier
 ),
 profiles(full_name, email)
 `)
 .order('created_at', { ascending: false });

 if (loans) {
 const mappedLoans: VetLoanApplicant[] = loans.map((l: any) => ({
 id: l.id,
 user_id: l.user_id,
 vet_id: l.vet_id,
 invoice_amount: l.invoice_amount,
 requested_amount: l.requested_amount,
 status: l.status,
 term_months: l.term_months,
 purpose: l.purpose,
 invoice_url: l.invoice_url,
 created_at: l.created_at,
 // vet data
 clinic_name: l.partner_vets?.clinic_name ?? null,
 name: l.partner_vets?.name ?? null,
 practice_type: l.partner_vets?.practice_type ?? null,
 license_number: l.partner_vets?.license_number ?? null,
 license_state: l.partner_vets?.license_state ?? null,
 npi_number: l.partner_vets?.npi_number ?? null,
 clinic_phone: l.partner_vets?.clinic_phone ?? null,
 contact_email: l.partner_vets?.contact_email ?? null,
 location: l.partner_vets?.location ?? null,
 is_verified: l.partner_vets?.is_verified ?? false,
 approval_status: l.partner_vets?.approval_status ??'pending',
 accreditations: l.partner_vets?.accreditations ?? null,
 services_provided: l.partner_vets?.services_provided ?? null,
 subscription_tier: l.partner_vets?.subscription_tier ?? null,
 // patient data
 patient_name: l.profiles?.full_name ?? null,
 patient_email: l.profiles?.email ?? null,
 }));
 setVetLoans(mappedLoans);
 if (mappedLoans.length > 0 && !selectedVetLoan) setSelectedVetLoan(mappedLoans[0]);
 }
 };

 const handleApproveMerchant = async () => {
 if (!selectedMerchant || !fundingAmount) return;
 setLoading(true);
 try {
 await supabase.from('funding_requests').update({ status:'approved' }).eq('id', selectedMerchant.id);
 await supabase.from('funding_deals').insert([{
 merchant_id: selectedMerchant.merchant_id,
 amount_funded: parseFloat(fundingAmount),
 repayment_rate: parseFloat(repaymentRate),
 }]);
 await supabase.rpc('log_admin_action', {
 _action:'APPROVE_FUNDING',
 _entity_type:'funding_request',
 _entity_id: selectedMerchant.id,
 _changes: { amount: fundingAmount, rate: repaymentRate },
 });
 toast.success('Funding approved');
 setApproveDialogOpen(false);
 setSelectedMerchant(null);
 loadData();
 } catch (e: any) { toast.error(e.message); }
 finally { setLoading(false); }
 };

 const handleDenyMerchant = async () => {
 if (!selectedMerchant) return;
 setLoading(true);
 try {
 await supabase.from('funding_requests').update({ status:'denied' }).eq('id', selectedMerchant.id);
 await supabase.rpc('log_admin_action', {
 _action:'DENY_FUNDING',
 _entity_type:'funding_request',
 _entity_id: selectedMerchant.id,
 _changes: { reason: denyReason },
 });
 toast.success('Request denied');
 setDenyDialogOpen(false);
 setDenyReason('');
 setSelectedMerchant(null);
 loadData();
 } catch (e: any) { toast.error(e.message); }
 finally { setLoading(false); }
 };

 const handleApproveVetLoan = async () => {
 if (!selectedVetLoan) return;
 setLoading(true);
 try {
 await supabase.from('vet_loans').update({ status:'approved' }).eq('id', selectedVetLoan.id);
 toast.success('Vet loan approved');
 setApproveDialogOpen(false);
 loadData();
 } catch (e: any) { toast.error(e.message); }
 finally { setLoading(false); }
 };

 const handleDenyVetLoan = async () => {
 if (!selectedVetLoan) return;
 setLoading(true);
 try {
 await supabase.from('vet_loans').update({ status:'denied' }).eq('id', selectedVetLoan.id);
 toast.success('Vet loan denied');
 setDenyDialogOpen(false);
 setDenyReason('');
 loadData();
 } catch (e: any) { toast.error(e.message); }
 finally { setLoading(false); }
 };

 const handleMarkFundedMerchant = async () => {
 if (!selectedMerchant) return;
 setLoading(true);
 try {
 const { data, error } = await supabase.functions.invoke('admin-update-funding-request', {
 body: { requestId: selectedMerchant.id, status:'funded', entityType:'merchant' },
 });
 if (error) throw error;
 if (data?.error) throw new Error(data.error);
 toast.success('Merchant marked as funded — notification sent');
 setSelectedMerchant(null);
 loadData();
 } catch (e: any) { toast.error(e.message); }
 finally { setLoading(false); }
 };

 const handleMarkFundedVetLoan = async () => {
 if (!selectedVetLoan) return;
 setLoading(true);
 try {
 const { data, error } = await supabase.functions.invoke('admin-update-funding-request', {
 body: { requestId: selectedVetLoan.id, status:'funded', entityType:'vet' },
 });
 if (error) throw error;
 if (data?.error) throw new Error(data.error);
 toast.success('Vet loan marked as funded — notification sent');
 loadData();
 } catch (e: any) { toast.error(e.message); }
 finally { setLoading(false); }
 };

 const pendingMerchants = fundingApplicants.filter(a => a.status ==='pending');
 const reviewedMerchants = fundingApplicants.filter(a => a.status !=='pending');
 const pendingVetLoans = vetLoans.filter(l => l.status ==='pending');

 return (
 <div className="space-y-6">
 {/* Page Header */}
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-3xl font-bold">Financing & Loans</h2>
 <p className="text-muted-foreground">VC-style deal room — review applicant profiles and make funding decisions</p>
 </div>
 <div className="flex gap-2">
 {pendingMerchants.length > 0 && (
 <Badge variant="secondary" className="gap-1">
 <AlertTriangle className="w-3 h-3" /> {pendingMerchants.length} merchant pending
 </Badge>
 )}
 {pendingVetLoans.length > 0 && (
 <Badge variant="secondary" className="gap-1">
 <AlertTriangle className="w-3 h-3" /> {pendingVetLoans.length} vet loan pending
 </Badge>
 )}
 </div>
 </div>

 <Tabs value={tab} onValueChange={setTab}>
 <TabsList>
 <TabsTrigger value="merchant" className="gap-1.5">
 <Building2 className="w-4 h-4" /> Merchant Financing
 {pendingMerchants.length > 0 && (
 <Badge variant="destructive" className="ml-1 text-xs px-1.5 py-0">{pendingMerchants.length}</Badge>
 )}
 </TabsTrigger>
 <TabsTrigger value="vet" className="gap-1.5">
 <Shield className="w-4 h-4" /> Vet Loans
 {pendingVetLoans.length > 0 && (
 <Badge variant="destructive" className="ml-1 text-xs px-1.5 py-0">{pendingVetLoans.length}</Badge>
 )}
 </TabsTrigger>
 </TabsList>

 {/* ── Merchant Financing ── */}
 <TabsContent value="merchant" className="mt-6">
 {fundingApplicants.length === 0 ? (
 <Card className="p-12 text-center">
 <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
 <p className="text-muted-foreground">No merchant financing requests</p>
 </Card>
 ) : (
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Left: Pipeline */}
 <div className="space-y-3">
 <div className="flex items-center justify-between mb-1">
 <p className="text-sm font-semibold text-foreground uppercase tracking-wide">
 Pending ({pendingMerchants.length})
 </p>
 </div>
 {pendingMerchants.map(a => (
 <DealCard key={a.id} applicant={a} selected={selectedMerchant?.id === a.id} onSelect={() => setSelectedMerchant(a)} />
 ))}
 {reviewedMerchants.length > 0 && (
 <>
 <Separator />
 <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
 Reviewed ({reviewedMerchants.length})
 </p>
 {reviewedMerchants.map(a => (
 <DealCard key={a.id} applicant={a} selected={selectedMerchant?.id === a.id} onSelect={() => setSelectedMerchant(a)} />
 ))}
 </>
 )}
 </div>

 {/* Right: Detail */}
 <div className="lg:col-span-2">
 {selectedMerchant ? (
 <MerchantDetailPanel
 applicant={selectedMerchant}
 onApprove={() => {
 setFundingAmount(selectedMerchant.requested_amount.toString());
 setApproveDialogOpen(true);
 }}
 onDeny={() => setDenyDialogOpen(true)}
 onMarkFunded={handleMarkFundedMerchant}
 />
 ) : (
 <Card className="p-12 text-center h-full flex items-center justify-center">
 <div>
 <ArrowRight className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
 <p className="text-muted-foreground">Select an applicant to review</p>
 </div>
 </Card>
 )}
 </div>
 </div>
 )}
 </TabsContent>

 {/* ── Vet Loans ── */}
 <TabsContent value="vet" className="mt-6">
 {vetLoans.length === 0 ? (
 <Card className="p-12 text-center">
 <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
 <p className="text-muted-foreground">No vet loan applications</p>
 </Card>
 ) : (
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Left: Pipeline */}
 <div className="space-y-3">
 <p className="text-sm font-semibold text-foreground uppercase tracking-wide">
 Applications ({vetLoans.length})
 </p>
 {vetLoans.map(loan => (
 <button
 key={loan.id}
 onClick={() => setSelectedVetLoan(loan)}
 className={`w-full text-left p-4 rounded-md border-2 transition-all hover:shadow-md ${
 selectedVetLoan?.id === loan.id
 ?'border-primary bg-primary/5 shadow-md'
 :'border-border bg-card hover:border-primary/40'
 }`}
 >
 <div className="flex items-start justify-between gap-2 mb-2">
 <p className="font-semibold leading-tight">{loan.clinic_name || loan.name ||'Vet Clinic'}</p>
 <StatusBadge status={loan.status} />
 </div>
 <div className="flex justify-between text-sm">
 <span className="font-bold">${loan.requested_amount.toLocaleString()}</span>
 <span className="text-muted-foreground">{loan.term_months}mo</span>
 </div>
 <p className="text-xs text-muted-foreground mt-1">
 {loan.practice_type?.replace(/_/g,'') ||'Veterinary Clinic'}
 </p>
 </button>
 ))}
 </div>

 {/* Right: Detail */}
 <div className="lg:col-span-2">
 {selectedVetLoan ? (
 <VetLoanDetailPanel
 loan={selectedVetLoan}
 onApprove={() => setApproveDialogOpen(true)}
 onDeny={() => setDenyDialogOpen(true)}
 onMarkFunded={handleMarkFundedVetLoan}
 />
 ) : (
 <Card className="p-12 text-center h-full flex items-center justify-center">
 <div>
 <ArrowRight className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
 <p className="text-muted-foreground">Select an application to review</p>
 </div>
 </Card>
 )}
 </div>
 </div>
 )}
 </TabsContent>
 </Tabs>

 {/* Approve Dialog */}
 <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
 <DialogContent className="max-w-md">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2 text-success">
 <CheckCircle2 className="w-5 h-5" />
 {tab ==='merchant' ?'Approve Merchant Funding' :'Approve Vet Loan'}
 </DialogTitle>
 <DialogDescription>
 {tab ==='merchant'
 ? `Confirm funding details for ${selectedMerchant?.business_name}`
 : `Confirm loan for ${selectedVetLoan?.clinic_name || selectedVetLoan?.name}`}
 </DialogDescription>
 </DialogHeader>
 {tab ==='merchant' && (
 <div className="space-y-4">
 <div className="space-y-2">
 <Label>Approved Funding Amount ($)</Label>
 <Input type="number" value={fundingAmount} onChange={e => setFundingAmount(e.target.value)} />
 {selectedMerchant && (
 <p className="text-xs text-muted-foreground">
 Requested: ${selectedMerchant.requested_amount.toLocaleString()} · Max eligible: ${(selectedMerchant.revenue_90d * 0.8).toLocaleString('en', { maximumFractionDigits: 0 })}
 </p>
 )}
 </div>
 <div className="space-y-2">
 <Label>Revenue Repayment Rate (%)</Label>
 <Input type="number" step="0.5" value={repaymentRate} onChange={e => setRepaymentRate(e.target.value)} />
 <p className="text-xs text-muted-foreground">% of monthly revenue deducted until repaid</p>
 </div>
 </div>
 )}
 {tab ==='vet' && selectedVetLoan && (
 <div className="bg-muted/30 rounded-lg p-3 space-y-1 text-sm">
 <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-bold">${selectedVetLoan.requested_amount.toLocaleString()}</span></div>
 <div className="flex justify-between"><span className="text-muted-foreground">Term</span><span>{selectedVetLoan.term_months} months</span></div>
 <div className="flex justify-between"><span className="text-muted-foreground">Monthly payment</span><span>${Formatters.number(Math.round((selectedVetLoan.requested_amount / selectedVetLoan.term_months)))}</span></div>
 </div>
 )}
 <div className="flex gap-3 pt-2">
 <Button variant="outline" className="flex-1" onClick={() => setApproveDialogOpen(false)}>Cancel</Button>
 <Button
 className="flex-1 gap-2 bg-success hover:bg-success text-white"
 disabled={loading || (tab ==='merchant' && !fundingAmount)}
 onClick={tab ==='merchant' ? handleApproveMerchant : handleApproveVetLoan}
 >
 <CheckCircle2 className="w-4 h-4" />
 {loading ?'Processing…' :'Confirm Approval'}
 </Button>
 </div>
 </DialogContent>
 </Dialog>

 {/* Deny Dialog */}
 <Dialog open={denyDialogOpen} onOpenChange={setDenyDialogOpen}>
 <DialogContent className="max-w-md">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2 text-destructive">
 <XCircle className="w-5 h-5" />
 Deny {tab ==='merchant' ?'Funding Request' :'Vet Loan'}
 </DialogTitle>
 <DialogDescription>
 Provide a reason for the denial. This will be logged for audit.
 </DialogDescription>
 </DialogHeader>
 <div className="space-y-2">
 <Label>Denial Reason</Label>
 <Textarea
 rows={3}
 placeholder="e.g. Insufficient revenue history, amount exceeds eligibility limit..."
 value={denyReason}
 onChange={e => setDenyReason(e.target.value)}
 />
 </div>
 <div className="flex gap-3 pt-2">
 <Button variant="outline" className="flex-1" onClick={() => setDenyDialogOpen(false)}>Cancel</Button>
 <Button
 variant="destructive"
 className="flex-1 gap-2"
 disabled={loading}
 onClick={tab ==='merchant' ? handleDenyMerchant : handleDenyVetLoan}
 >
 <XCircle className="w-4 h-4" />
 {loading ?'Processing…' :'Confirm Denial'}
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 </div>
 );
}
