import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Clock, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const API_URL = process.env.REACT_APP_BACKEND_URL;

const DAYS = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

const DURATION_OPTIONS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "60 min" },
];

export default function AvailabilityPage() {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState({});
  const [slotDuration, setSlotDuration] = useState(30);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        const res = await fetch(`${API_URL}/api/availability`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setSchedule(data.schedule || {});
          setSlotDuration(data.slot_duration || 30);
        }
      } catch (e) {
        console.error("Failed to fetch availability:", e);
      }
      setLoading(false);
    };
    fetchAvailability();
  }, []);

  const updateDay = (dayKey, field, value) => {
    setSchedule((prev) => ({
      ...prev,
      [dayKey]: { ...prev[dayKey], [field]: value },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/availability`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ schedule, slot_duration: slotDuration }),
      });
      if (res.ok) {
        toast.success("Availability updated");
      }
    } catch (e) {
      toast.error("Failed to save");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 sm:p-8 animate-fadeIn" data-testid="availability-page">
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-2">
          <Clock className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">My Availability</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Set your working hours. Guests can book meetings during these time slots.
        </p>
      </div>

      {/* Slot Duration Selector */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 block">
          Meeting Duration
        </Label>
        <p className="text-sm text-muted-foreground mb-3">
          How long should each bookable slot be?
        </p>
        <div className="flex gap-2" data-testid="slot-duration-selector">
          {DURATION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              data-testid={`duration-${opt.value}`}
              className={cn(
                "flex-1 py-2.5 px-4 rounded-lg border-2 text-sm font-medium transition-colors",
                slotDuration === opt.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/30 hover:bg-accent/50 text-muted-foreground"
              )}
              onClick={() => setSlotDuration(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Weekly Schedule */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-1">
        {DAYS.map((day) => {
          const dayData = schedule[day.key] || { enabled: false, start: "09:00", end: "17:00" };
          return (
            <div
              key={day.key}
              data-testid={`availability-${day.key}`}
              className="flex items-center gap-4 py-3.5 px-3 rounded-lg hover:bg-accent/30 transition-colors"
            >
              <Switch
                data-testid={`availability-toggle-${day.key}`}
                checked={dayData.enabled}
                onCheckedChange={(checked) => updateDay(day.key, "enabled", checked)}
              />
              <span className="text-sm font-medium w-28">{day.label}</span>
              {dayData.enabled ? (
                <div className="flex items-center gap-2">
                  <Input
                    data-testid={`availability-start-${day.key}`}
                    type="time"
                    value={dayData.start}
                    onChange={(e) => updateDay(day.key, "start", e.target.value)}
                    className="w-32 h-9"
                  />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input
                    data-testid={`availability-end-${day.key}`}
                    type="time"
                    value={dayData.end}
                    onChange={(e) => updateDay(day.key, "end", e.target.value)}
                    className="w-32 h-9"
                  />
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Unavailable</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          data-testid="save-availability-btn"
          onClick={handleSave}
          disabled={saving}
          className="px-6"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
