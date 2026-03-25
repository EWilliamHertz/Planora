import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, X, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function NotificationCenter() {
  const { authFetch } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const [notifRes, unreadRes] = await Promise.all([
          authFetch("/api/notifications"),
          authFetch("/api/notifications/unread"),
        ]);
        if (notifRes.ok) setNotifications(await notifRes.json());
        if (unreadRes.ok) {
          const data = await unreadRes.json();
          setUnreadCount(data.unread);
        }
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      }
    };

    if (open) {
      fetchNotifications();
      // Refresh every 10 seconds when open
      const interval = setInterval(fetchNotifications, 10000);
      return () => clearInterval(interval);
    }
  }, [open, authFetch]);

  const handleMarkAsRead = async (notificationId) => {
    try {
      await authFetch(`/api/notifications/${notificationId}/read`, {
        method: "PUT",
      });
      setNotifications((prev) =>
        prev.map((n) => (n.notification_id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      await authFetch(`/api/notifications/${notificationId}`, { method: "DELETE" });
      setNotifications((prev) => prev.filter((n) => n.notification_id !== notificationId));
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await authFetch("/api/notifications/mark-all-read", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        onClick={() => setOpen(!open)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </Badge>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-background border border-border rounded-lg shadow-lg z-50">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <CheckCheck className="h-3 w-3" /> Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No notifications yet
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.notification_id}
                  className={`px-4 py-3 border-b border-border hover:bg-accent/50 transition-colors ${
                    !notif.read ? "bg-accent/20" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{notif.title}</p>
                        {!notif.read && (
                          <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{notif.message}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {new Date(notif.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!notif.read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleMarkAsRead(notif.notification_id)}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleDelete(notif.notification_id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
