import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, BellRing, Settings, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format } from "date-fns";
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
  category?: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationPrefs {
  delivery_method: "in_app" | "browser";
}

const requestNotificationPermission = async (): Promise<{ granted: boolean; alreadyDenied: boolean }> => {
  if (!("Notification" in window)) {
    console.log("This browser does not support notifications");
    return { granted: false, alreadyDenied: false };
  }

  if (Notification.permission === "granted") {
    return { granted: true, alreadyDenied: false };
  }

  if (Notification.permission === "denied") {
    // Permission was previously denied - user needs to manually enable in browser settings
    return { granted: false, alreadyDenied: true };
  }

  // Permission is "default" - we can request it
  const permission = await Notification.requestPermission();
  return { granted: permission === "granted", alreadyDenied: false };
};

const showBrowserNotification = (title: string, message: string) => {
  if (Notification.permission === "granted") {
    const notification = new Notification(title, {
      body: message,
      icon: "/logo.png",
      badge: "/logo.png",
      tag: "pawbucks-notification",
      requireInteraction: false,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);
  }
};

export const NotificationsDropdown = ({ userId }: { userId: string }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [userPrefersBrowser, setUserPrefersBrowser] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const enableNotifications = useCallback(async () => {
    // Browser notifications only work when the app runs in a top-level, secure context
    if (typeof window !== "undefined") {
      if (window.self !== window.top) {
        toast.error("Notifications unavailable in preview", {
          description:
            "Open the PawBucks app directly in its own tab or installed PWA to enable browser notifications.",
          duration: 8000,
        });
        return;
      }

      if (!("Notification" in window)) {
        toast.error("Browser does not support notifications", {
          description: "Use a modern browser over HTTPS to enable notifications.",
          duration: 8000,
        });
        return;
      }
    }

    const result = await requestNotificationPermission();
    setNotificationsEnabled(result.granted);
    
    if (result.granted) {
      toast.success("Browser notifications enabled!");
    } else if (result.alreadyDenied) {
      toast.error("Notifications blocked by browser", {
        description:
          "To enable notifications, click the lock/info icon in your browser's address bar and allow notifications for this site, then refresh the page.",
        duration: 8000,
      });
    } else {
      toast.error("Notifications not enabled", {
        description: "You can enable notifications later by clicking the bell icon.",
      });
    }
  }, []);

  useEffect(() => {
    // Check existing permission on mount
    if ("Notification" in window && Notification.permission === "granted") {
      setNotificationsEnabled(true);
    }
    
    // Fetch user's notification preferences
    const fetchPreferences = async () => {
      if (!userId) return;
      const { data } = await supabase
        .from("notification_preferences")
        .select("delivery_method")
        .eq("user_id", userId)
        .maybeSingle();
      
      if (data) {
        setUserPrefersBrowser((data as NotificationPrefs).delivery_method === "browser");
      }
    };
    
    fetchPreferences();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!error && data) {
        setNotifications(data);
        setUnreadCount(data.filter((n) => !n.is_read).length);
      }
    };

    fetchNotifications();

    // Subscribe to new notifications
    const channel = supabase
      .channel("notifications-channel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications((prev) => [newNotification, ...prev].slice(0, 10));
          setUnreadCount((prev) => prev + 1);

          // Show browser notification if enabled AND user prefers browser notifications
          if (notificationsEnabled && userPrefersBrowser) {
            showBrowserNotification(newNotification.title, newNotification.message);
          }

          // Also show in-app toast
          toast.info(newNotification.title, {
            description: newNotification.message,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, notificationsEnabled, userPrefersBrowser]);

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleNotificationClick = async (notification: Notification, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    setDropdownOpen(false);
    setSelectedNotification(notification);
  };

  const NotificationDetailContent = () => {
    if (!selectedNotification) return null;
    
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          {selectedNotification.category && (
            <Badge variant="outline" className="text-xs capitalize">
              {selectedNotification.category}
            </Badge>
          )}
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

  return (
    <>
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative min-h-[44px] min-w-[44px]">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="font-semibold">Notifications</span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/notification-preferences")}
              className="text-xs h-7 gap-1"
              title="Notification preferences"
            >
              <Settings className="h-3 w-3" />
            </Button>
            {!notificationsEnabled && userPrefersBrowser && (
              <Button
                variant="ghost"
                size="sm"
                onClick={enableNotifications}
                className="text-xs h-7 gap-1"
                title="Enable browser notifications"
              >
                <BellRing className="h-3 w-3" />
                Enable
              </Button>
            )}
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs h-7">
                Mark all read
              </Button>
            )}
          </div>
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="px-3 py-6 text-center text-muted-foreground text-sm">
            No notifications yet
          </div>
        ) : (
          notifications.slice(0, 5).map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              className={`flex flex-col items-start gap-1 p-3 cursor-pointer ${
                !notification.is_read ? "bg-accent/50" : ""
              }`}
              onClick={(e) => handleNotificationClick(notification, e)}
            >
              <div className="flex items-start justify-between w-full gap-2">
                <span className="font-medium text-sm">{notification.title}</span>
                {!notification.is_read && (
                  <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
              <span className="text-xs text-muted-foreground/70">
                {formatDistanceToNow(new Date(notification.created_at!), { addSuffix: true })}
              </span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="flex items-center justify-center gap-2 py-3 cursor-pointer"
          onClick={() => navigate("/notifications")}
        >
          <History className="h-4 w-4" />
          <span className="text-sm">View all notifications</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

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
  </>
  );
};
