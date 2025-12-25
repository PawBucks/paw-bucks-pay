import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Bell, Calendar as CalendarIcon, Filter, Check, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface Notification {
  id: string;
  title: string;
  message: string;
  category: string;
  is_read: boolean;
  created_at: string;
}
const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "general", label: "General" },
  { value: "security", label: "Security Alerts" },
  { value: "marketing", label: "Marketing" },
  { value: "transactional", label: "Transactional" },
];

const DATE_PRESETS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "week", label: "Last 7 Days" },
  { value: "month", label: "Last 30 Days" },
  { value: "custom", label: "Custom Range" },
];

export default function NotificationHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [category, setCategory] = useState("all");
  const [datePreset, setDatePreset] = useState("all");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const { data: notifications, isLoading, refetch } = useQuery({
    queryKey: ["notification-history", user?.id, category, datePreset, dateRange],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (category !== "all") {
        query = query.eq("category", category);
      }

      // Apply date filtering
      let startDate: Date | null = null;
      let endDate: Date | null = null;

      if (datePreset === "today") {
        startDate = startOfDay(new Date());
        endDate = endOfDay(new Date());
      } else if (datePreset === "week") {
        startDate = startOfDay(subDays(new Date(), 7));
        endDate = endOfDay(new Date());
      } else if (datePreset === "month") {
        startDate = startOfDay(subDays(new Date(), 30));
        endDate = endOfDay(new Date());
      } else if (datePreset === "custom" && dateRange.from) {
        startDate = startOfDay(dateRange.from);
        endDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(new Date());
      }

      if (startDate) {
        query = query.gte("created_at", startDate.toISOString());
      }
      if (endDate) {
        query = query.lte("created_at", endDate.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const handleMarkAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    if (error) {
      toast.error("Failed to mark notification as read");
    } else {
      refetch();
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.id) return;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (error) {
      toast.error("Failed to mark all as read");
    } else {
      toast.success("All notifications marked as read");
      refetch();
    }
  };

  const getCategoryBadgeColor = (cat: string) => {
    switch (cat) {
      case "security":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "marketing":
        return "bg-primary/10 text-primary border-primary/20";
      case "transactional":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    setSelectedNotification(notification);
    if (!notification.is_read) {
      await handleMarkAsRead(notification.id);
    }
  };

  const NotificationDetailContent = () => {
    if (!selectedNotification) return null;
    
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className={cn(
              "text-xs capitalize",
              getCategoryBadgeColor(selectedNotification.category)
            )}
          >
            {selectedNotification.category}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {format(
              new Date(selectedNotification.created_at),
              "MMM d, yyyy 'at' h:mm a"
            )}
          </span>
        </div>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <p className="text-foreground whitespace-pre-wrap leading-relaxed">
            {selectedNotification.message}
          </p>
        </div>
      </div>
    );
  };

  const unreadCount = notifications?.filter((n) => !n.is_read).length || 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Notification History</h1>
            <p className="text-muted-foreground text-sm">
              View and manage all your notifications
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllAsRead}>
              <Check className="h-4 w-4 mr-2" />
              Mark all as read
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filters:</span>
              </div>

              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={datePreset} onValueChange={setDatePreset}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Date range" />
                </SelectTrigger>
                <SelectContent>
                  {DATE_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {datePreset === "custom" && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      {dateRange.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "MMM d")} -{" "}
                            {format(dateRange.to, "MMM d")}
                          </>
                        ) : (
                          format(dateRange.from, "MMM d, yyyy")
                        )
                      ) : (
                        "Pick dates"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={{ from: dateRange.from, to: dateRange.to }}
                      onSelect={(range) =>
                        setDateRange({ from: range?.from, to: range?.to })
                      }
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              )}

              {(category !== "all" || datePreset !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCategory("all");
                    setDatePreset("all");
                    setDateRange({});
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Notifications List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
              {unreadCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {unreadCount} unread
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-muted rounded w-1/4 mb-2" />
                    <div className="h-3 bg-muted rounded w-3/4" />
                  </div>
                ))}
              </div>
            ) : notifications && notifications.length > 0 ? (
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={cn(
                        "w-full text-left p-4 rounded-lg border transition-colors hover:bg-accent/30 cursor-pointer",
                        notification.is_read
                          ? "bg-background border-border"
                          : "bg-accent/50 border-accent"
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4
                              className={cn(
                                "font-medium truncate",
                                !notification.is_read && "text-foreground"
                              )}
                            >
                              {notification.title}
                            </h4>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs capitalize",
                                getCategoryBadgeColor(notification.category)
                              )}
                            >
                              {notification.category}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {format(
                              new Date(notification.created_at),
                              "MMM d, yyyy 'at' h:mm a"
                            )}
                          </p>
                        </div>
                        {!notification.is_read && (
                          <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-12">
                <Bell className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium text-lg">No notifications found</h3>
                <p className="text-sm text-muted-foreground">
                  {category !== "all" || datePreset !== "all"
                    ? "Try adjusting your filters"
                    : "You're all caught up!"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notification Detail Dialog/Drawer */}
      {isDesktop ? (
        <Dialog open={!!selectedNotification} onOpenChange={(open) => !open && setSelectedNotification(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedNotification?.title}</DialogTitle>
            </DialogHeader>
            <NotificationDetailContent />
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={!!selectedNotification} onOpenChange={(open) => !open && setSelectedNotification(null)}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{selectedNotification?.title}</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-6">
              <NotificationDetailContent />
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}
