import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GradientCard } from "@/components/ui/gradient-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarClock, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  BOOKING_PROVIDERS,
  type BookingProvider,
  type MerchantBookingIntegration,
} from "./externalBookingProviders";

interface Props {
  merchantId: string;
}

export function ExternalCalendarSettings({ merchantId }: Props) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<MerchantBookingIntegration | null>(null);

  const [provider, setProvider] = useState<BookingProvider>("calendly");
  const [bookingUrl, setBookingUrl] = useState("");
  const [displayLabel, setDisplayLabel] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [replaceInApp, setReplaceInApp] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("merchant_booking_integrations")
        .select("id, merchant_id, provider, booking_url, display_label, is_enabled, replace_in_app_booking")
        .eq("merchant_id", merchantId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("Failed to load calendar integration:", error);
      } else if (data) {
        const row = data as MerchantBookingIntegration;
        setExisting(row);
        setProvider(row.provider);
        setBookingUrl(row.booking_url);
        setDisplayLabel(row.display_label || "");
        setIsEnabled(row.is_enabled);
        setReplaceInApp(row.replace_in_app_booking);
      }
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [merchantId]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["merchant-booking-integration", merchantId] });
  };

  const handleSave = async () => {
    const url = bookingUrl.trim();
    if (!/^https:\/\/.+\..+/i.test(url)) {
      toast.error("Enter a full secure booking link starting with https://");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        merchant_id: merchantId,
        provider,
        booking_url: url,
        display_label: displayLabel.trim() || null,
        is_enabled: isEnabled,
        replace_in_app_booking: replaceInApp,
      };

      const { data, error } = await supabase
        .from("merchant_booking_integrations")
        .upsert(payload, { onConflict: "merchant_id" })
        .select("id, merchant_id, provider, booking_url, display_label, is_enabled, replace_in_app_booking")
        .single();

      if (error) throw error;
      setExisting(data as MerchantBookingIntegration);
      invalidate();
      toast.success("Calendar connected");
    } catch (error) {
      console.error("Failed to save calendar integration:", error);
      toast.error("Failed to save calendar link");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!existing) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("merchant_booking_integrations")
        .delete()
        .eq("id", existing.id);
      if (error) throw error;
      setExisting(null);
      setBookingUrl("");
      setDisplayLabel("");
      setIsEnabled(true);
      setReplaceInApp(false);
      invalidate();
      toast.success("Calendar disconnected");
    } catch (error) {
      console.error("Failed to remove calendar integration:", error);
      toast.error("Failed to disconnect calendar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <GradientCard className="p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </GradientCard>
    );
  }

  const meta = BOOKING_PROVIDERS[provider];

  return (
    <div className="space-y-4">
      <GradientCard className="p-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <CalendarClock className="w-4 h-4" aria-hidden="true" />
              Connect your scheduling tool
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              Already take bookings on Calendly, Cal.com, Acuity or PetDesk? Add your booking link
              and pet owners will see a button that opens your calendar directly. Your in-app
              services, availability and PawBucks rewards keep working exactly as they do today.
            </p>
          </div>
          {existing && (
            <Badge variant={existing.is_enabled ? "secondary" : "outline"}>
              {existing.is_enabled ? "Live" : "Hidden"}
            </Badge>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Scheduling provider</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as BookingProvider)}>
              <SelectTrigger className="sm:w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(BOOKING_PROVIDERS) as BookingProvider[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {BOOKING_PROVIDERS[key].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-2 block">Booking link</Label>
            <Input
              type="url"
              inputMode="url"
              placeholder={meta.example}
              value={bookingUrl}
              onChange={(e) => setBookingUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">{meta.hint}</p>
          </div>

          <div>
            <Label className="mb-2 block">Button label (optional)</Label>
            <Input
              placeholder={`Book on ${meta.label}`}
              maxLength={40}
              value={displayLabel}
              onChange={(e) => setDisplayLabel(e.target.value)}
            />
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} id="external-cal-enabled" />
            <div>
              <Label htmlFor="external-cal-enabled" className="text-sm font-medium">
                Show this booking link to pet owners
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Turn off to hide the button without deleting your link.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
            <Switch
              checked={replaceInApp}
              onCheckedChange={setReplaceInApp}
              id="external-cal-replace"
            />
            <div>
              <Label htmlFor="external-cal-replace" className="text-sm font-medium">
                Use my calendar instead of in-app booking
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pet owners will only see your external calendar. Leave this off to offer both.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {existing ? "Save changes" : "Connect calendar"}
            </Button>
            {bookingUrl.trim().startsWith("https://") && (
              <Button variant="outline" asChild>
                <a href={bookingUrl.trim()} target="_blank" rel="noopener noreferrer">
                  Preview link
                  <ExternalLink className="w-3.5 h-3.5 ml-1.5" aria-hidden="true" />
                </a>
              </Button>
            )}
            {existing && (
              <Button variant="ghost" onClick={handleRemove} disabled={saving}>
                <Trash2 className="w-4 h-4 mr-2" aria-hidden="true" />
                Disconnect
              </Button>
            )}
          </div>
        </div>
      </GradientCard>
    </div>
  );
}