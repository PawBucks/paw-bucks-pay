import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { parseLocalDate } from "@/utils/formatters";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  CalendarPlus,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  CalendarCheck,
  CalendarX,
  MapPin,
  User as UserIcon,
  Store,
} from "lucide-react";
import { Formatters } from "@/utils/formatters";
import { cn } from "@/lib/utils";

type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed" | "no_show";

const STATUS_CONFIG: Record<BookingStatus, { label: string; color: string; icon: any }> = {
  pending: { label: "Pending", color: "bg-warning/10 text-warning border-warning/20", icon: Clock },
  confirmed: { label: "Confirmed", color: "bg-chart-1/10 text-chart-1 border-chart-1/20", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "bg-muted text-muted-foreground border-border", icon: XCircle },
  completed: { label: "Completed", color: "bg-success/10 text-success border-success/20", icon: CalendarCheck },
  no_show: { label: "No Show", color: "bg-destructive/10 text-destructive border-destructive/20", icon: AlertTriangle },
};

function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${period}`;
}

function formatStamp(value: string | null | undefined) {
  if (!value) return null;
  try {
    return format(new Date(value), "MMM d, yyyy 'at' h:mm a");
  } catch {
    return null;
  }
}

type TimelineEntry = {
  key: string;
  label: string;
  description: string;
  at: string | null;
  state: "done" | "current" | "pending" | "skipped";
  icon: any;
  tone: "default" | "success" | "warning" | "destructive" | "muted";
};

export default function BookingStatus() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [viewerRole, setViewerRole] = useState<"customer" | "merchant" | "unknown">("unknown");

  const { data: booking, isLoading, error } = useQuery({
    queryKey: ["booking-status", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("service_bookings")
        .select(`
          *,
          merchant_services (
            name, duration_minutes, category, price,
            merchants!inner (id, business_name, address, logo_url, storefront_slug, user_id)
          ),
          pet_profiles (id, name, type)
        `)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (!booking || !user) return;
    if (booking.user_id === user.id) setViewerRole("customer");
    else if (booking.merchant_services?.merchants?.user_id === user.id) setViewerRole("merchant");
    else setViewerRole("unknown");
  }, [booking, user]);

  const timeline: TimelineEntry[] = useMemo(() => {
    if (!booking) return [];
    const status = booking.status as BookingStatus;
    const isCancelled = status === "cancelled";
    const isNoShow = status === "no_show";
    const isCompleted = status === "completed";
    const isConfirmed = status === "confirmed" || isCompleted;

    return [
      {
        key: "created",
        label: "Booking requested",
        description: "Request submitted by the pet owner.",
        at: booking.created_at,
        state: "done",
        icon: CalendarPlus,
        tone: "default",
      },
      {
        key: "confirmed",
        label: "Confirmed by business",
        description: "The business confirmed the appointment.",
        at: booking.confirmed_at,
        state: isConfirmed
          ? "done"
          : isCancelled
          ? "skipped"
          : status === "pending"
          ? "current"
          : "pending",
        icon: CheckCircle2,
        tone: "success",
      },
      isCancelled
        ? {
            key: "cancelled",
            label: "Cancelled",
            description: booking.cancellation_reason
              ? `Reason: ${booking.cancellation_reason}`
              : "This appointment was cancelled.",
            at: booking.cancelled_at,
            state: "done",
            icon: CalendarX,
            tone: "destructive",
          }
        : isNoShow
        ? {
            key: "no_show",
            label: "Marked as no-show",
            description: "The appointment was marked as a no-show.",
            at: booking.no_show_at,
            state: "done",
            icon: AlertTriangle,
            tone: "destructive",
          }
        : {
            key: "completed",
            label: "Completed",
            description: "Appointment finished successfully.",
            at: booking.completed_at,
            state: isCompleted ? "done" : "pending",
            icon: CalendarCheck,
            tone: "success",
          },
    ];
  }, [booking]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-3">
            <AlertTriangle className="w-10 h-10 mx-auto text-muted-foreground" />
            <h1 className="text-lg font-semibold">Booking not found</h1>
            <p className="text-sm text-muted-foreground">
              It may have been removed, or you don't have access to view it.
            </p>
            <Button variant="outline" onClick={() => navigate(-1)}>Go back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = booking.status as BookingStatus;
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;
  const merchant = booking.merchant_services?.merchants;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6 pb-24 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate">Booking Status</h1>
            <p className="text-sm text-muted-foreground">
              Reference #{booking.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
        </div>

        {/* Summary card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {merchant?.logo_url ? (
                  <img src={merchant.logo_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Store className="w-5 h-5 text-primary" />
                  </div>
                )}
                <div className="min-w-0">
                  <CardTitle className="text-base truncate">
                    {booking.merchant_services?.name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground truncate">
                    {merchant?.business_name}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className={cn("text-xs gap-1 flex-shrink-0", config.color)}>
                <StatusIcon className="w-3 h-3" />
                {config.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="font-medium">
                  {format(parseLocalDate(booking.booking_date), "EEEE, MMM d, yyyy")}
                </p>
                <p className="text-muted-foreground">
                  {formatTime(booking.start_time)} – {formatTime(booking.end_time)}
                </p>
              </div>
            </div>
            {booking.pet_profiles && (
              <div className="flex items-start gap-2">
                <UserIcon className="w-4 h-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{booking.pet_profiles.name}</p>
                  <p className="text-muted-foreground capitalize">{booking.pet_profiles.type}</p>
                </div>
              </div>
            )}
            {merchant?.address && (
              <div className="flex items-start gap-2 sm:col-span-2">
                <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
                <p className="text-muted-foreground">{merchant.address}</p>
              </div>
            )}
            <div className="sm:col-span-2 flex items-center justify-between pt-3 border-t">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold text-primary">
                {Formatters.currency(booking.total_price)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Status timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="relative space-y-6">
              {timeline.map((entry, idx) => {
                const Icon = entry.icon;
                const isLast = idx === timeline.length - 1;
                const dotTone =
                  entry.state === "skipped"
                    ? "bg-muted text-muted-foreground border-border"
                    : entry.tone === "success"
                    ? "bg-success/15 text-success border-success/30"
                    : entry.tone === "destructive"
                    ? "bg-destructive/15 text-destructive border-destructive/30"
                    : entry.tone === "warning"
                    ? "bg-warning/15 text-warning border-warning/30"
                    : "bg-primary/15 text-primary border-primary/30";
                const stamp = formatStamp(entry.at);
                return (
                  <li key={entry.key} className="relative pl-12">
                    <span
                      className={cn(
                        "absolute left-0 top-0 w-9 h-9 rounded-full border flex items-center justify-center",
                        dotTone,
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    {!isLast && (
                      <span className="absolute left-[17px] top-9 bottom-[-1.5rem] w-px bg-border" />
                    )}
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p
                        className={cn(
                          "font-medium",
                          entry.state === "skipped" && "text-muted-foreground line-through",
                        )}
                      >
                        {entry.label}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {stamp ?? (entry.state === "current" ? "Awaiting" : entry.state === "skipped" ? "Skipped" : "Pending")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{entry.description}</p>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 justify-end">
          {viewerRole === "customer" && (
            <Button variant="outline" onClick={() => navigate("/my-bookings")}>
              Back to My Bookings
            </Button>
          )}
          {viewerRole === "merchant" && (
            <Button variant="outline" onClick={() => navigate("/merchant/scheduling")}>
              Back to Calendar
            </Button>
          )}
          {status === "completed" && merchant?.storefront_slug && viewerRole === "customer" && (
            <Button onClick={() => navigate(`/book/${merchant.storefront_slug}`)}>
              Rebook this service
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}