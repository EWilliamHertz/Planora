import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Settings, Sun, Moon, Monitor, Link2, Copy, User } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  const bookingLink = `${window.location.origin}/book/${user?.user_id}`;

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
          Manage your profile, preferences, and booking link.
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

      {/* Booking Link Section */}
      <div className="bg-card border border-border rounded-xl p-5">
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
    </div>
  );
}
