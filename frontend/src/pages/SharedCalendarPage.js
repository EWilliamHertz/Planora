import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarMonthView } from "@/components/CalendarMonthView";
import { CalendarWeekView } from "@/components/CalendarWeekView";
import { CalendarDayView } from "@/components/CalendarDayView";
import { EventModal } from "@/components/EventModal";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import {
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  parseISO,
  startOfMonth,
  endOfMonth,
} from "date-fns";

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function SharedCalendarPage() {
  const { userId } = useParams();
  const [events, setEvents] = useState([]);
  const [ownerName, setOwnerName] = useState("");
  const [calendarView, setCalendarView] = useState("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [viewingEvent, setViewingEvent] = useState(null);

  useEffect(() => {
    const fetchSharedEvents = async () => {
      try {
        const res = await fetch(`${API_URL}/api/calendar/shared/${userId}/events`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setEvents(data);
        }
        // Get owner name from shares
        const sharesRes = await fetch(`${API_URL}/api/calendar/shares`, { credentials: "include" });
        if (sharesRes.ok) {
          const shares = await sharesRes.json();
          const share = shares.shared_with_me?.find((s) => s.owner_user_id === userId);
          if (share) setOwnerName(share.owner_name || share.owner_email);
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    fetchSharedEvents();
  }, [userId]);

  const displayEvents = useMemo(() => {
    const viewStart = subMonths(startOfMonth(currentDate), 1);
    const viewEnd = addMonths(startOfMonth(currentDate), 2);
    const expanded = [];

    events.forEach((event) => {
      expanded.push(event);
      const rec = event.recurrence;
      if (!rec || !rec.type || rec.type === "none") return;
      const eventStart = parseISO(event.start_time);
      const eventEnd = parseISO(event.end_time);
      const duration = eventEnd.getTime() - eventStart.getTime();
      const recEnd = rec.end_date ? parseISO(rec.end_date) : addMonths(eventStart, 3);
      let current = new Date(eventStart);
      let safety = 0;
      while (safety < 400) {
        safety++;
        if (rec.type === "daily") current = addDays(current, 1);
        else if (rec.type === "weekly") current = addWeeks(current, 1);
        else if (rec.type === "monthly") current = addMonths(current, 1);
        else break;
        if (current > recEnd || current > viewEnd) break;
        if (current >= viewStart) {
          expanded.push({
            ...event,
            event_id: `${event.event_id}_${format(current, "yyyyMMddHHmm")}`,
            start_time: current.toISOString(),
            end_time: new Date(current.getTime() + duration).toISOString(),
            is_recurring_instance: true,
            original_event_id: event.event_id,
          });
        }
      }
    });
    return expanded;
  }, [events, currentDate]);

  const goToPrev = () => {
    if (calendarView === "month") setCurrentDate((d) => subMonths(d, 1));
    else if (calendarView === "week") setCurrentDate((d) => subWeeks(d, 1));
    else setCurrentDate((d) => subDays(d, 1));
  };

  const goToNext = () => {
    if (calendarView === "month") setCurrentDate((d) => addMonths(d, 1));
    else if (calendarView === "week") setCurrentDate((d) => addWeeks(d, 1));
    else setCurrentDate((d) => addDays(d, 1));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="shared-calendar-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-4 border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-10 gap-3">
        <div className="flex items-center gap-3">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="shared-calendar-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{ownerName}'s Calendar</h1>
            <p className="text-sm text-muted-foreground">Shared calendar (read-only)</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs font-medium" onClick={() => setCurrentDate(new Date())}>
              Today
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Tabs value={calendarView} onValueChange={setCalendarView}>
            <TabsList className="h-8">
              <TabsTrigger value="month" className="text-xs px-3 h-6">Month</TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-3 h-6">Week</TabsTrigger>
              <TabsTrigger value="day" className="text-xs px-3 h-6">Day</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {calendarView === "month" && (
          <CalendarMonthView
            currentDate={currentDate}
            events={displayEvents}
            tasks={[]}
            onDayClick={() => {}}
            onEventClick={(e) => setViewingEvent(e)}
            onEventDrop={() => {}}
          />
        )}
        {calendarView === "week" && (
          <CalendarWeekView
            currentDate={currentDate}
            events={displayEvents}
            onTimeSlotClick={() => {}}
            onEventClick={(e) => setViewingEvent(e)}
            onEventDrop={() => {}}
          />
        )}
        {calendarView === "day" && (
          <CalendarDayView
            currentDate={currentDate}
            events={displayEvents}
            onTimeSlotClick={() => {}}
            onEventClick={(e) => setViewingEvent(e)}
            onEventDrop={() => {}}
          />
        )}
      </div>

      {/* View-only event detail */}
      {viewingEvent && (
        <EventModal
          open={!!viewingEvent}
          onClose={() => setViewingEvent(null)}
          event={viewingEvent}
          selectedDate={null}
          onCreate={() => {}}
          onUpdate={() => {}}
          onDelete={() => {}}
        />
      )}
    </div>
  );
}
