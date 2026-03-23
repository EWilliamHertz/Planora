import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Settings, Sun, Moon, Monitor, Link2, Copy, Loader2, RefreshCw, Unplug, CalendarDays, CheckCircle2, XCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [searchParams] = useSearchParams();
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalLoading, setGcalLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const bookingLink = `${window.location.origin}/book/${user?.user_id}`;

  useEffect(() => {
    const checkGcalStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/api/gcal/status`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setGcalConnected(data.connected);
        }
      } catch (e) {
        console.error("Failed to check gcal status:", e);
      }
      setGcalLoading(false);
    };
    checkGcalStatus();

    if (searchParams.get("gcal") === "connected") {
      toast.success("Google Calendar connected!");
      setGcalConnected(true);
    }
  }, [searchParams]);

  const connectGoogleCalendar = async () => {
    try {
      const res = await fetch(`${API_URL}/api/gcal/connect`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.authorization_url;
      } else {
        toast.error("Google Calendar is not configured");
      }
    } catch (e) {
      toast.error("Failed to connect");
    }
  };

  const syncGoogleCalendar = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${API_URL}/api/gcal/sync`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || "Sync completed!");
      } else {
        toast.error("Sync failed");
      }
    } catch (e) {
      toast.error("Sync failed");
    }
    setSyncing(false);
  };

  const disconnectGoogleCalendar = async () => {
    try {
      const res = await fetch(`${API_URL}/api/gcal/disconnect`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        setGcalConnected(false);
        toast.success("Google Calendar disconnected");
      }
    } catch (e) {
      toast.error("Failed to disconnect");
    }
  };

  const copyBookingLink = () => {
    navigator.clipboard.writeText(bookingLink);
    toast.success("Booking link copied!");
  };

  const themes = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  return (
    <div className="max-w-2xl mx-auto p-6 sm:p-8 animate-fadeIn" data-testid="settings-page">
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-2">
          <Settings className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage your profile, integrations, and booking link.
        </p>
      </div>

      {/* Profile Section */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">
          Profile
        </h2>
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user?.picture} className="object-cover" />
            <AvatarFallback className="text-lg font-bold">
              {user?.name?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-lg font-bold tracking-tight">{user?.name}</h3>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Theme Section */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">
          Appearance
        </h2>
        <div className="flex gap-3">
          {themes.map((t) => (
            <button
              key={t.value}
              data-testid={`theme-${t.value}`}
              className={cn(
                "flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors",
                theme === t.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/30 hover:bg-accent/50"
              )}
              onClick={() => setTheme(t.value)}
            >
              <t.icon className={cn(
                "h-5 w-5",
                theme === t.value ? "text-primary" : "text-muted-foreground"
              )} />
              <span className={cn(
                "text-sm font-medium",
                theme === t.value ? "text-primary" : "text-muted-foreground"
              )}>
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Google Calendar Section */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6" data-testid="gcal-section">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Google Calendar
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Sync your Planora events with Google Calendar for two-way integration.
        </p>

        {gcalLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking connection...
          </div>
        ) : gcalConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Connected</span>
            </div>
            <div className="flex gap-2">
              <Button
                data-testid="gcal-sync-btn"
                variant="outline"
                size="sm"
                onClick={syncGoogleCalendar}
                disabled={syncing}
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync Now
              </Button>
              <Button
                data-testid="gcal-disconnect-btn"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={disconnectGoogleCalendar}
              >
                <Unplug className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <Button
            data-testid="gcal-connect-btn"
            variant="outline"
            onClick={connectGoogleCalendar}
          >
            <CalendarDays className="h-4 w-4 mr-2" />
            Connect Google Calendar
          </Button>
        )}
      </div>

      {/* Booking Link Section */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Booking Link
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Share this link so others can book meetings with you during your available hours.
        </p>
        <div className="flex gap-2">
          <Input
            data-testid="booking-link-input"
            readOnly
            value={bookingLink}
            className="font-mono text-xs"
          />
          <Button
            data-testid="copy-booking-link-btn"
            variant="outline"
            size="icon"
            onClick={copyBookingLink}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Export Calendar */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Download className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Export Calendar
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Download your events as an .ics file to import into Apple Calendar, Outlook, or other apps.
        </p>
        <Button
          data-testid="export-ical-btn"
          variant="outline"
          onClick={async () => {
            try {
              const res = await fetch(`${API_URL}/api/export/ical`, { credentials: "include" });
              if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "planora-calendar.ics";
                a.click();
                window.URL.revokeObjectURL(url);
                toast.success("Calendar exported!");
              } else {
                toast.error("Export failed");
              }
            } catch (e) {
              toast.error("Export failed");
            }
          }}
        >
          <Download className="h-4 w-4 mr-2" />
          Download .ics File
        </Button>
      </div>
    </div>
  );
}
