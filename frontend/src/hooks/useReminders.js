import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

const API_URL = process.env.REACT_APP_BACKEND_URL;
const CHECK_INTERVAL = 60000; // check every 60s

export function useReminders() {
  const notifiedRef = useRef(new Set());
  const permissionRef = useRef(Notification?.permission || "default");

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") {
      permissionRef.current = "granted";
      return true;
    }
    if (Notification.permission !== "denied") {
      const result = await Notification.requestPermission();
      permissionRef.current = result;
      return result === "granted";
    }
    return false;
  }, []);

  const checkReminders = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/reminders/upcoming`, { credentials: "include" });
      if (!res.ok) return;
      const reminders = await res.json();

      for (const r of reminders) {
        if (notifiedRef.current.has(r.event_id)) continue;
        notifiedRef.current.add(r.event_id);

        const message = r.minutes_until <= 0
          ? `"${r.title}" is starting now!`
          : `"${r.title}" starts in ${r.minutes_until} min`;

        // In-app toast
        toast.info(message, { duration: 8000 });

        // Browser notification
        if (permissionRef.current === "granted") {
          try {
            new Notification("Planora Reminder", {
              body: message,
              icon: "/favicon.ico",
              tag: r.event_id,
            });
          } catch (e) {
            // Notification API may fail in some contexts
          }
        }
      }
    } catch (e) {
      // silently fail
    }
  }, []);

  useEffect(() => {
    requestPermission();
    checkReminders();
    const interval = setInterval(checkReminders, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [requestPermission, checkReminders]);

  return { requestPermission };
}
