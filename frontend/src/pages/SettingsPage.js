import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Settings, Sun, Moon, Monitor, Link2, Copy, Loader2, RefreshCw,
  Unplug, CalendarDays, CheckCircle2, Download, Users, Trash2, Share2, Mail,
  MailCheck,
} from "lucide-react";
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

  const [shareEmail, setShareEmail] = useState("");
  const [sharePermission, setSharePermission] = useState("view");
  const [sharing, setSharing] = useState(false);
  const [shares, setShares] = useState({ shared_by_me: [], shared_with_me: [] });
  const [sharesLoading, setSharesLoading] = useState(true);

  const [digestEnabled, setDigestEnabled] = useState(false);
  const [digestLoading, setDigestLoading] = useState(false);
  const [sendingDigest, setSendingDigest] = useState(false);

  const bookingLink = `${window.location.origin}/book/${user?.user_id}`;

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [gcalRes, sharesRes, prefsRes] = await Promise.all([
          fetch(`${API_URL}/api/gcal/status`, { credentials: "include" }),
          fetch(`${API_URL}/api/calendar/shares`, { credentials: "include" }),
          fetch(`${API_URL}/api/user/preferences`, { credentials: "include" }),
        ]);
        if (gcalRes.ok) { const d = await gcalRes.json(); setGcalConnected(d.connected); }
        if (sharesRes.ok) setShares(await sharesRes.json());
        if (prefsRes.ok) { const d = await prefsRes.json(); setDigestEnabled(d.email_digest || false); }
      } catch (e) {
        console.error(e);
      }
      setGcalLoading(false);
      setSharesLoading(false);
    };
    fetchAll();

    if (searchParams.get("gcal") === "connected") {
      toast.success("Google Calendar connected!");
      setGcalConnected(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectGoogleCalendar = async () => {
    try {
      const res = await fetch(`${API_URL}/api/gcal/connect`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.authorization_url;
      } else toast.error("Google Calendar is not configured");
    } catch { toast.error("Failed to connect"); }
  };

  const syncGoogleCalendar = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${API_URL}/api/gcal/sync`, { method: "POST", credentials: "include" });
      if (res.ok) { const d = await res.json(); toast.success(d.message || "Sync completed!"); }
      else toast.error("Sync failed");
    } catch { toast.error("Sync failed"); }
    setSyncing(false);
  };

  const disconnectGoogleCalendar = async () => {
    try {
      const res = await fetch(`${API_URL}/api/gcal/disconnect`, { method: "POST", credentials: "include" });
      if (res.ok) { setGcalConnected(false); toast.success("Google Calendar disconnected"); }
    } catch { toast.error("Failed to disconnect"); }
  };

  const copyBookingLink = () => {
    navigator.clipboard.writeText(bookingLink);
    toast.success("Booking link copied!");
  };

  const shareCalendar = async () => {
    if (!shareEmail.trim()) return;
    setSharing(true);
    try {
      const res = await fetch(`${API_URL}/api/calendar/share`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ email: shareEmail.trim(), permission: sharePermission }),
      });
      if (res.ok) {
        const share = await res.json();
        setShares((prev) => ({ ...prev, shared_by_me: [...prev.shared_by_me, share] }));
        setShareEmail("");
        toast.success("Calendar shared!");
      } else { const err = await res.json(); toast.error(err.detail || "Failed to share"); }
    } catch { toast.error("Failed to share"); }
    setSharing(false);
  };

  const revokeShare = async (shareId) => {
    try {
      const res = await fetch(`${API_URL}/api/calendar/shares/${shareId}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        setShares((prev) => ({ ...prev, shared_by_me: prev.shared_by_me.filter((s) => s.share_id !== shareId) }));
        toast.success("Share revoked");
      }
    } catch { toast.error("Failed to revoke share"); }
  };

  const toggleDigest = async (enabled) => {
    setDigestLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/user/preferences/digest`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        setDigestEnabled(enabled);
        toast.success(enabled ? "Weekly digest enabled" : "Weekly digest disabled");
      }
    } catch { toast.error("Failed to update preference"); }
    setDigestLoading(false);
  };

  const sendDigestNow = async () => {
    setSendingDigest(true);
    try {
      const res = await fetch(`${API_URL}/api/digest/send`, { method: "POST", credentials: "include" });
      if (res.ok) { const d = await res.json(); toast.success(`Digest sent to ${d.email}`); }
      else { const err = await res.json(); toast.error(err.detail || "Failed to send digest"); }
    } catch { toast.error("Failed to send digest"); }
    setSendingDigest(false);
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
          Manage your profile, integrations, sharing, and preferences.
        </p>
      </div>

      {/* Profile */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Profile</h2>
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user?.picture} className="object-cover" />
            <AvatarFallback className="text-lg font-bold">{user?.name?.[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-lg font-bold tracking-tight">{user?.name}</h3>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Email Digest */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6" data-testid="digest-section">
        <div className="flex items-center gap-2 mb-4">
          <MailCheck className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Weekly Email Digest</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Get a weekly summary of your upcoming events, completed tasks, and pending items delivered to your inbox.
        </p>
        <div className="flex items-center justify-between mb-4">
          <Label htmlFor="digest-toggle" className="text-sm font-medium">Enable weekly digest</Label>
          <Switch id="digest-toggle" data-testid="digest-toggle" checked={digestEnabled} onCheckedChange={toggleDigest} disabled={digestLoading} />
        </div>
        <Button data-testid="send-digest-now-btn" variant="outline" size="sm" onClick={sendDigestNow} disabled={sendingDigest}>
          {sendingDigest ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
          Send Digest Now
        </Button>
      </div>

      {/* Theme */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Appearance</h2>
        <div className="flex gap-3">
          {themes.map((t) => (
            <button
              key={t.value}
              data-testid={`theme-${t.value}`}
              className={cn(
                "flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors",
                theme === t.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30 hover:bg-accent/50"
              )}
              onClick={() => setTheme(t.value)}
            >
              <t.icon className={cn("h-5 w-5", theme === t.value ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("text-sm font-medium", theme === t.value ? "text-primary" : "text-muted-foreground")}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Sharing */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6" data-testid="calendar-sharing-section">
        <div className="flex items-center gap-2 mb-4">
          <Share2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Calendar Sharing</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Share your calendar with others so they can view or edit your events.</p>
        <div className="flex gap-2 mb-4">
          <Input data-testid="share-email-input" type="email" value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} placeholder="colleague@example.com" className="flex-1" />
          <select data-testid="share-permission-select" value={sharePermission} onChange={(e) => setSharePermission(e.target.value)} className="h-9 px-3 rounded-md border border-border bg-background text-sm">
            <option value="view">View</option>
            <option value="edit">Edit</option>
          </select>
          <Button data-testid="share-calendar-btn" size="sm" onClick={shareCalendar} disabled={sharing || !shareEmail.trim()}>
            {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4 mr-1" />} Share
          </Button>
        </div>
        {shares.shared_by_me.length > 0 && (
          <div className="space-y-2 mb-4">
            <Label className="text-xs text-muted-foreground">Shared by you</Label>
            {shares.shared_by_me.map((share) => (
              <div key={share.share_id} data-testid={`share-item-${share.share_id}`} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">{share.shared_with_name || share.shared_with_email}</span>
                  <span className="text-xs text-muted-foreground">{share.shared_with_email}</span>
                </div>
                <Badge variant="outline" className="text-[10px] capitalize">{share.permission}</Badge>
                <Button data-testid={`revoke-share-${share.share_id}`} variant="ghost" size="icon" className="h-7 w-7" onClick={() => revokeShare(share.share_id)}>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
        {shares.shared_with_me.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Shared with you</Label>
            {shares.shared_with_me.map((share) => (
              <div key={share.share_id} data-testid={`shared-with-me-${share.share_id}`} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
                <CalendarDays className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">{share.owner_name}</span>
                  <span className="text-xs text-muted-foreground">{share.owner_email}</span>
                </div>
                <Badge variant="outline" className="text-[10px] capitalize">{share.permission}</Badge>
              </div>
            ))}
          </div>
        )}
        {sharesLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading shares...</div>
        )}
      </div>

      {/* Google Calendar */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6" data-testid="gcal-section">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Google Calendar</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Sync your Planora events with Google Calendar for two-way integration.</p>
        {gcalLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking connection...</div>
        ) : gcalConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Connected</span>
            </div>
            <div className="flex gap-2">
              <Button data-testid="gcal-sync-btn" variant="outline" size="sm" onClick={syncGoogleCalendar} disabled={syncing}>
                {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />} Sync Now
              </Button>
              <Button data-testid="gcal-disconnect-btn" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={disconnectGoogleCalendar}>
                <Unplug className="h-4 w-4 mr-2" /> Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <Button data-testid="gcal-connect-btn" variant="outline" onClick={connectGoogleCalendar}>
            <CalendarDays className="h-4 w-4 mr-2" /> Connect Google Calendar
          </Button>
        )}
      </div>

      {/* Booking Link */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Booking Link</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-3">Share this link so others can book meetings with you.</p>
        <div className="flex gap-2">
          <Input data-testid="booking-link-input" readOnly value={bookingLink} className="font-mono text-xs" />
          <Button data-testid="copy-booking-link-btn" variant="outline" size="icon" onClick={copyBookingLink}><Copy className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Export */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Download className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Export Calendar</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-3">Download your events as an .ics file.</p>
        <Button
          data-testid="export-ical-btn"
          variant="outline"
          onClick={async () => {
            try {
              const res = await fetch(`${API_URL}/api/export/ical`, { credentials: "include" });
              if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = "planora-calendar.ics"; a.click();
                window.URL.revokeObjectURL(url);
                toast.success("Calendar exported!");
              } else toast.error("Export failed");
            } catch { toast.error("Export failed"); }
          }}
        >
          <Download className="h-4 w-4 mr-2" /> Download .ics File
        </Button>
      </div>
    </div>
  );
}
