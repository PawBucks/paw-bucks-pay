import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { CalendarClock, ExternalLink } from "lucide-react";
import {
  providerLabel,
  type MerchantBookingIntegration,
} from "./externalBookingProviders";

interface ExternalBookingCardProps {
  integration: MerchantBookingIntegration;
  merchantName: string;
  /** When true, this is the only booking option available. */
  exclusive?: boolean;
}

export function ExternalBookingCard({
  integration,
  merchantName,
  exclusive = false,
}: ExternalBookingCardProps) {
  const label = integration.display_label?.trim() || `Book on ${providerLabel(integration.provider)}`;

  return (
    <GradientCard className="p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
          <CalendarClock className="w-5 h-5 text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm">
            {exclusive ? "Booking is handled on their calendar" : "Prefer their own calendar?"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {merchantName} schedules appointments through {providerLabel(integration.provider)}.
          </p>
          <Button asChild size="sm" className="mt-3">
            <a href={integration.booking_url} target="_blank" rel="noopener noreferrer">
              {label}
              <ExternalLink className="w-3.5 h-3.5 ml-1.5" aria-hidden="true" />
            </a>
          </Button>
        </div>
      </div>
    </GradientCard>
  );
}