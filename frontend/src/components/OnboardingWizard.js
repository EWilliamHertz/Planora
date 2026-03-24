import { useState } from "react";
import { useAuth, authFetch } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  CalendarDays, Clock, Link2, Copy, ChevronRight, Check, Sparkles,
} from "lucide-react";
import { format } from "date-fns";

const API_URL = process.env.REACT_APP_BACKEND_URL;

const DAYS = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
];

export function OnboardingWizard({ onComplete }) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1: Availability
  const [schedule, setSchedule] = useState(() => {
    const s = {};
    for (const d of DAYS) {
      s[d.key] = { enabled: ["saturday", "sunday"].indexOf(d.key) === -1, start: "09:00", end: "17:00" };
    }
    return s;
  });
  const [slotDuration, setSlotDuration] = useState(30);

  // Step 2: First event
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return format(d, "yyyy-MM-dd'T'HH:mm");
  });
  const [eventEndDate, setEventEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(11, 0, 0, 0);
    return format(d, "yyyy-MM-dd'T'HH:mm");
  });

  const bookingLink = `${window.location.origin}/book/${user?.user_id}`;

  const saveAvailability = async () => {
    setSaving(true);
    try {
      const res = await authFetch(`${API_URL}/api/availability`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule, slot_duration: slotDuration }),
      });
      if (res.ok) {
        toast.success("Availability saved!");
      }
      setStep(1);
    } catch (e) {
      toast.error("Failed to save");
    }
    setSaving(false);
  };

  const createFirstEvent = async () => {
    if (!eventTitle.trim()) {
      setStep(2);
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch(`${API_URL}/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: eventTitle.trim(),
          start_time: new Date(eventDate).toISOString(),
          end_time: new Date(eventEndDate).toISOString(),
          color: "indigo",
        }),
      });
      if (res.ok) {
        toast.success("Event created!");
      } else {
        toast.error("Failed to create event");
      }
      setStep(2);
    } catch (e) {
      toast.error("Failed to create event");
    }
    setSaving(false);
  };

  const finishOnboarding = () => {
    localStorage.setItem("planora_onboarded", "true");
    onComplete();
  };

  const steps = [
    { label: "Availability", icon: Clock },
    { label: "First Event", icon: CalendarDays },
    { label: "Share", icon: Link2 },
  ];

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-8" data-testid="onboarding-wizard">
      <div className="w-full max-w-lg animate-slideUp">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                  i < step
                    ? "bg-primary text-primary-foreground"
                    : i === step
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={cn("w-12 h-0.5 rounded-full", i < step ? "bg-primary" : "bg-border")} />
              )}
            </div>
          ))}
        </div>

        {/* Welcome header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">
            {step === 0 && "Set your availability"}
            {step === 1 && "Create your first event"}
            {step === 2 && "Share your booking link"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {step === 0 && "When are you free for meetings?"}
            {step === 1 && "Add an event to your calendar (or skip this step)"}
            {step === 2 && "Let people book time with you"}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          {/* Step 1: Availability */}
          {step === 0 && (
            <div className="space-y-5">
              {/* Duration */}
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">
                  Meeting Duration
                </Label>
                <div className="flex gap-2">
                  {[15, 30, 60].map((d) => (
                    <button
                      key={d}
                      data-testid={`onboard-duration-${d}`}
                      className={cn(
                        "flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-colors",
                        slotDuration === d
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      )}
                      onClick={() => setSlotDuration(d)}
                    >
                      {d} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Days */}
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">
                  Working Days
                </Label>
                <div className="space-y-2">
                  {DAYS.map((day) => {
                    const d = schedule[day.key];
                    return (
                      <div key={day.key} className="flex items-center gap-3 py-1.5">
                        <Switch
                          data-testid={`onboard-day-${day.key}`}
                          checked={d.enabled}
                          onCheckedChange={(checked) =>
                            setSchedule((prev) => ({ ...prev, [day.key]: { ...prev[day.key], enabled: checked } }))
                          }
                        />
                        <span className="text-sm font-medium w-10">{day.label}</span>
                        {d.enabled && (
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Input
                              type="time"
                              value={d.start}
                              onChange={(e) =>
                                setSchedule((prev) => ({ ...prev, [day.key]: { ...prev[day.key], start: e.target.value } }))
                              }
                              className="w-28 h-8 text-xs"
                            />
                            <span>-</span>
                            <Input
                              type="time"
                              value={d.end}
                              onChange={(e) =>
                                setSchedule((prev) => ({ ...prev, [day.key]: { ...prev[day.key], end: e.target.value } }))
                              }
                              className="w-28 h-8 text-xs"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <Button
                data-testid="onboard-save-availability"
                className="w-full h-11"
                onClick={saveAvailability}
                disabled={saving}
              >
                Continue
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}

          {/* Step 2: First Event */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Event Title</Label>
                <Input
                  data-testid="onboard-event-title"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="e.g. Team Standup, Focus Time, Lunch..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Start</Label>
                  <Input
                    data-testid="onboard-event-start"
                    type="datetime-local"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End</Label>
                  <Input
                    data-testid="onboard-event-end"
                    type="datetime-local"
                    value={eventEndDate}
                    onChange={(e) => setEventEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  data-testid="onboard-skip-event"
                  variant="outline"
                  className="flex-1 h-11"
                  onClick={() => setStep(2)}
                >
                  Skip
                </Button>
                <Button
                  data-testid="onboard-create-event"
                  className="flex-1 h-11"
                  onClick={createFirstEvent}
                  disabled={saving}
                >
                  {eventTitle.trim() ? "Create & Continue" : "Skip"}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Share booking link */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="text-center py-4">
                <div className="h-14 w-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
                  <Check className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-lg font-bold tracking-tight mb-1">You're all set!</p>
                <p className="text-sm text-muted-foreground">
                  Share this link to let people book meetings with you
                </p>
              </div>

              <div className="flex gap-2">
                <Input
                  data-testid="onboard-booking-link"
                  readOnly
                  value={bookingLink}
                  className="font-mono text-xs"
                />
                <Button
                  data-testid="onboard-copy-link"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(bookingLink);
                    toast.success("Link copied!");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>

              <Button
                data-testid="onboard-finish"
                className="w-full h-11"
                onClick={finishOnboarding}
              >
                Go to Dashboard
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
