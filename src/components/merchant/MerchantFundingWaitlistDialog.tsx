import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2, Sparkles } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  merchantId: string | null;
  defaults?: {
    business_name?: string | null;
    contact_name?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
  };
  existing?: any | null;
  onJoined?: (entry: any) => void;
}

const REVENUE_RANGES = [
  "Under $5,000/mo",
  "$5,000 – $15,000/mo",
  "$15,000 – $50,000/mo",
  "$50,000 – $150,000/mo",
  "$150,000 – $500,000/mo",
  "$500,000+/mo",
];

const TIME_IN_BUSINESS = [
  "Less than 6 months",
  "6–12 months",
  "1–2 years",
  "2–5 years",
  "5+ years",
];

const USE_OF_FUNDS = [
  "Inventory / supplies",
  "Equipment purchase",
  "Hiring / payroll",
  "Marketing & customer acquisition",
  "Expansion / new location",
  "Renovation / build-out",
  "Working capital / cash flow",
  "Refinance existing debt",
  "Other",
];

const URGENCY = [
  { value: "asap", label: "ASAP — within 30 days" },
  { value: "soon", label: "Soon — within 60–90 days" },
  { value: "flexible", label: "Flexible — exploring options" },
];

export function MerchantFundingWaitlistDialog({
  open,
  onOpenChange,
  merchantId,
  defaults,
  existing,
  onJoined,
}: Props) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    business_name: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    monthly_revenue_range: "",
    requested_amount_usd: "",
    use_of_funds: "",
    use_of_funds_details: "",
    time_in_business: "",
    urgency: "flexible",
    additional_notes: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      business_name: existing?.business_name ?? defaults?.business_name ?? "",
      contact_name: existing?.contact_name ?? defaults?.contact_name ?? "",
      contact_email:
        existing?.contact_email ?? defaults?.contact_email ?? user?.email ?? "",
      contact_phone: existing?.contact_phone ?? defaults?.contact_phone ?? "",
      monthly_revenue_range: existing?.monthly_revenue_range ?? "",
      requested_amount_usd:
        existing?.requested_amount_usd != null
          ? String(existing.requested_amount_usd)
          : "",
      use_of_funds: existing?.use_of_funds ?? "",
      use_of_funds_details: existing?.use_of_funds_details ?? "",
      time_in_business: existing?.time_in_business ?? "",
      urgency: existing?.urgency ?? "flexible",
      additional_notes: existing?.additional_notes ?? "",
    });
  }, [open, existing, defaults, user?.email]);

  const isEdit = !!existing?.id;

  const submit = async () => {
    if (!user || !merchantId) {
      toast.error("You must be signed in as a merchant to join the waitlist.");
      return;
    }
    if (!form.business_name.trim()) return toast.error("Business name is required");
    if (!form.contact_email.trim()) return toast.error("Contact email is required");
    if (!form.monthly_revenue_range) return toast.error("Select your monthly revenue range");
    if (!form.time_in_business) return toast.error("Select time in business");
    if (!form.use_of_funds) return toast.error("Select what you would use funds for");
    const amt = Number(form.requested_amount_usd);
    if (!Number.isFinite(amt) || amt < 1000) {
      return toast.error("Enter a requested amount of at least $1,000");
    }

    setSubmitting(true);
    try {
      const payload = {
        merchant_id: merchantId,
        user_id: user.id,
        business_name: form.business_name.trim(),
        contact_name: form.contact_name.trim() || null,
        contact_email: form.contact_email.trim(),
        contact_phone: form.contact_phone.trim() || null,
        monthly_revenue_range: form.monthly_revenue_range,
        requested_amount_usd: amt,
        use_of_funds: form.use_of_funds,
        use_of_funds_details: form.use_of_funds_details.trim() || null,
        time_in_business: form.time_in_business,
        urgency: form.urgency,
        additional_notes: form.additional_notes.trim() || null,
      };

      let data: any = null;
      if (isEdit) {
        const { data: row, error } = await supabase
          .from("merchant_funding_waitlist")
          .update(payload)
          .eq("id", existing.id)
          .select()
          .maybeSingle();
        if (error) throw error;
        data = row;
        toast.success("Waitlist details updated");
      } else {
        const { data: row, error } = await supabase
          .from("merchant_funding_waitlist")
          .insert(payload)
          .select()
          .maybeSingle();
        if (error) throw error;
        data = row;
        toast.success("You're on the Merchant Funding waitlist!", {
          description: "We'll reach out as soon as funding is available in your area.",
        });
      }

      onJoined?.(data);
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to join waitlist");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {isEdit ? "Update Funding Waitlist Details" : "Join Merchant Funding Waitlist"}
          </DialogTitle>
          <DialogDescription>
            PawBucks is rolling out working-capital funding to qualified merchants — no equity,
            no lengthy applications. Tell us about your business and we'll prioritize early access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label>Business name *</Label>
              <Input
                value={form.business_name}
                onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                placeholder="Your business name"
              />
            </div>
            <div>
              <Label>Contact name</Label>
              <Input
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                placeholder="Owner / point of contact"
              />
            </div>
            <div>
              <Label>Contact phone</Label>
              <Input
                type="tel"
                value={form.contact_phone}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                placeholder="(555) 555-5555"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Contact email *</Label>
              <Input
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                placeholder="you@business.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Time in business *</Label>
              <Select
                value={form.time_in_business}
                onValueChange={(v) => setForm({ ...form, time_in_business: v })}
              >
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {TIME_IN_BUSINESS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Monthly revenue *</Label>
              <Select
                value={form.monthly_revenue_range}
                onValueChange={(v) => setForm({ ...form, monthly_revenue_range: v })}
              >
                <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
                <SelectContent>
                  {REVENUE_RANGES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Requested amount (USD) *</Label>
              <Input
                type="number"
                min={1000}
                step={500}
                value={form.requested_amount_usd}
                onChange={(e) => setForm({ ...form, requested_amount_usd: e.target.value })}
                placeholder="25000"
              />
            </div>
            <div>
              <Label>Funding urgency</Label>
              <Select
                value={form.urgency}
                onValueChange={(v) => setForm({ ...form, urgency: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {URGENCY.map((u) => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Primary use of funds *</Label>
            <Select
              value={form.use_of_funds}
              onValueChange={(v) => setForm({ ...form, use_of_funds: v })}
            >
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {USE_OF_FUNDS.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Use of funds — details</Label>
            <Textarea
              rows={2}
              value={form.use_of_funds_details}
              onChange={(e) => setForm({ ...form, use_of_funds_details: e.target.value })}
              placeholder="Briefly describe what the funding will help you accomplish."
            />
          </div>

          <div>
            <Label>Anything else we should know?</Label>
            <Textarea
              rows={2}
              value={form.additional_notes}
              onChange={(e) => setForm({ ...form, additional_notes: e.target.value })}
              placeholder="Optional notes for the PawBucks funding team."
            />
          </div>

          <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p>
              Joining the waitlist is not a credit application and has no impact on your credit
              score. We'll contact you with eligibility details once Merchant Funding launches.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting…</>
            ) : isEdit ? (
              "Save changes"
            ) : (
              "Join Waitlist"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}