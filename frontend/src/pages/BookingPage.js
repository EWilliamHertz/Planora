import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, Check, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, subDays, isBefore, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function BookingPage() {
  const { userId } = useParams();
  const [hostName, setHostName] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booked, setBooked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchHost = async () => {
      try {
        const res = await fetch(`${API_URL}/api/bookings/user/${userId}`);
        if (res.ok) {
          const data = await res.json();
          setHostName(data.name);
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    fetchHost();
  }, [userId]);

  useEffect(() => {
    const fetchSlots = async () => {
      setLoadingSlots(true);
      try {
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        const res = await fetch(`${API_URL}/api/bookings/available/${userId}?date=${dateStr}`);
        if (res.ok) {
          setSlots(await res.json());
        }
      } catch (e) {
        console.error(e);
      }
      setLoadingSlots(false);
      setSelectedSlot(null);
    };
    if (userId) fetchSlots();
  }, [userId, selectedDate]);

  const handleBook = async () => {
    if (!selectedSlot || !guestName.trim() || !guestEmail.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host_user_id: userId,
          guest_name: guestName.trim(),
          guest_email: guestEmail.trim(),
          start_time: selectedSlot.start_time,
          end_time: selectedSlot.end_time,
        }),
      });
      if (res.ok) {
        setBooked(true);
        toast.success("Meeting booked successfully!");
      }
    } catch (e) {
      toast.error("Booking failed");
    }
    setSubmitting(false);
  };

  const isPastDate = isBefore(startOfDay(selectedDate), startOfDay(new Date()));
  const dates = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (booked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" data-testid="booking-confirmed">
        <div className="text-center animate-fadeIn max-w-md">
          <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-6">
            <Check className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Meeting Booked!</h1>
          <p className="text-muted-foreground">
            Your meeting with <strong>{hostName}</strong> is confirmed for{" "}
            <strong>{format(new Date(selectedSlot.start_time), "EEEE, MMMM d 'at' h:mm a")}</strong>.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            A confirmation will be sent to {guestEmail}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" data-testid="booking-page">
      <div className="w-full max-w-lg animate-fadeIn">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
              <CalendarDays className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">Planora</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">
            Book a meeting with {hostName || "..."}
          </h1>
          <p className="text-sm text-muted-foreground">
            Select a date and time that works for you
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          {/* Date picker */}
          <div className="mb-5">
            <Label className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3 block">
              Select Date
            </Label>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {dates.map((date) => (
                <button
                  key={date.toISOString()}
                  data-testid={`booking-date-${format(date, "yyyy-MM-dd")}`}
                  className={cn(
                    "flex flex-col items-center px-3.5 py-2.5 rounded-xl border transition-colors min-w-[60px]",
                    format(date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd")
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-accent"
                  )}
                  onClick={() => setSelectedDate(date)}
                >
                  <span className="text-[10px] font-medium uppercase">{format(date, "EEE")}</span>
                  <span className="text-lg font-bold">{format(date, "d")}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Time slots */}
          <div className="mb-5">
            <Label className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3 block">
              Available Times
            </Label>
            {loadingSlots ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : slots.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {isPastDate ? "Past dates cannot be booked" : "No available slots for this date"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.start_time}
                    data-testid={`booking-slot-${slot.start_time}`}
                    className={cn(
                      "py-2 px-2.5 rounded-lg border text-sm font-medium transition-colors",
                      selectedSlot?.start_time === slot.start_time
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:bg-accent hover:border-primary/30"
                    )}
                    onClick={() => setSelectedSlot(slot)}
                  >
                    {format(new Date(slot.start_time), "h:mm a")}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Booking form */}
          {selectedSlot && (
            <div className="space-y-4 pt-4 border-t border-border animate-fadeIn">
              <div className="space-y-2">
                <Label htmlFor="guest-name">Your Name</Label>
                <Input
                  data-testid="booking-guest-name"
                  id="guest-name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest-email">Your Email</Label>
                <Input
                  data-testid="booking-guest-email"
                  id="guest-email"
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="john@example.com"
                />
              </div>
              <Button
                data-testid="booking-confirm-btn"
                className="w-full h-11"
                onClick={handleBook}
                disabled={!guestName.trim() || !guestEmail.trim() || submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Confirm Booking
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
