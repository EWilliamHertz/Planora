import { useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  isBefore,
  parseISO,
  startOfDay,
  differenceInCalendarDays,
  addDays,
} from "date-fns";
import { cn } from "@/lib/utils";
import { Repeat, CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

const EVENT_COLORS = {
  indigo: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  sky: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  rose: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  violet: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
};

const SPAN_COLORS = {
  indigo: "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
  emerald: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  amber: "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30",
  sky: "bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/30",
  rose: "bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30",
  violet: "bg-violet-500/20 text-violet-700 dark:text-violet-300 border-violet-500/30",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarMonthView({ currentDate, events, tasks, onDayClick, onEventClick, onEventDrop }) {
  const [dragOverDay, setDragOverDay] = useState(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const totalWeeks = Math.ceil(days.length / 7);

  // Separate single-day and multi-day events
  const singleDayEvents = [];
  const multiDayEvents = [];
  events.forEach((event) => {
    if (!event.start_time || !event.end_time) return;
    const start = startOfDay(parseISO(event.start_time));
    const end = startOfDay(parseISO(event.end_time));
    const span = differenceInCalendarDays(end, start);
    if (span >= 1) {
      multiDayEvents.push({ ...event, _startDay: start, _endDay: end, _span: span });
    } else {
      singleDayEvents.push(event);
    }
  });

  // Build multi-day event rows per week
  const weekRows = [];
  for (let w = 0; w < totalWeeks; w++) {
    const weekStart = days[w * 7];
    const weekEnd = days[w * 7 + 6];
    const rowSlots = []; // each slot: { event, startCol, spanCols }
    multiDayEvents.forEach((evt) => {
      const evtStart = evt._startDay;
      const evtEnd = evt._endDay;
      if (evtEnd < weekStart || evtStart > weekEnd) return;
      const clippedStart = evtStart < weekStart ? weekStart : evtStart;
      const clippedEnd = evtEnd > weekEnd ? weekEnd : evtEnd;
      const startCol = differenceInCalendarDays(clippedStart, weekStart);
      const spanCols = differenceInCalendarDays(clippedEnd, clippedStart) + 1;
      const isStart = isSameDay(evtStart, clippedStart);
      const isEnd = isSameDay(evtEnd, clippedEnd);
      rowSlots.push({ event: evt, startCol, spanCols: Math.min(spanCols, 7 - startCol), isStart, isEnd });
    });
    weekRows.push(rowSlots);
  }

  const handleDragStart = (e, event) => {
    if (event.is_recurring_instance) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("application/json", JSON.stringify({
      event_id: event.event_id,
      start_time: event.start_time,
      end_time: event.end_time,
    }));
    e.dataTransfer.effectAllowed = "move";
    e.currentTarget.style.opacity = "0.4";
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = "1";
    setDragOverDay(null);
  };

  const handleDragOver = (e, day) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverDay(format(day, "yyyy-MM-dd"));
  };

  const handleDragLeave = () => {
    setDragOverDay(null);
  };

  const handleDrop = (e, targetDay) => {
    e.preventDefault();
    setDragOverDay(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      const oldStart = parseISO(data.start_time);
      const oldEnd = parseISO(data.end_time);
      const duration = oldEnd.getTime() - oldStart.getTime();

      const newStart = new Date(targetDay);
      newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0);
      const newEnd = new Date(newStart.getTime() + duration);

      onEventDrop(data.event_id, {
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
      });
    } catch (err) {
      console.error("Drop failed:", err);
    }
  };

  const hasAnyContent = events.length > 0 || tasks.filter((t) => !t.completed).length > 0;

  return (
    <div className="flex flex-col h-full" data-testid="calendar-month-view">
      {/* Day headers */}
      <div className="grid grid-cols-7">
        {DAYS.map((day) => (
          <div
            key={day}
            className="py-2.5 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day cells with multi-day events */}
      <div className="grid grid-cols-7 flex-1 border-t border-l border-border rounded-lg overflow-hidden">
        {days.map((day, idx) => {
          const dayKey = format(day, "yyyy-MM-dd");
          const weekIdx = Math.floor(idx / 7);
          const colIdx = idx % 7;

          const dayEvents = singleDayEvents.filter(
            (e) => e.start_time && isSameDay(parseISO(e.start_time), day)
          );
          const dayTasks = tasks.filter(
            (t) => t.due_date && !t.completed && isSameDay(parseISO(t.due_date), day)
          );

          // Count multi-day events covering this day for spacing
          const multiDayCount = weekRows[weekIdx]?.filter(
            (slot) => colIdx >= slot.startCol && colIdx < slot.startCol + slot.spanCols
          ).length || 0;

          const totalItems = dayEvents.length + dayTasks.length;
          const maxShow = Math.max(0, 2 - multiDayCount);

          return (
            <div
              key={day.toISOString()}
              data-testid={`calendar-day-${dayKey}`}
              className={cn(
                "relative min-h-[90px] sm:min-h-[110px] border-r border-b border-border p-1.5 cursor-pointer transition-all",
                "hover:bg-accent/50",
                !isSameMonth(day, currentDate) && "opacity-40 bg-muted/30",
                isToday(day) && "bg-primary/[0.03]",
                dragOverDay === dayKey && "bg-primary/10 ring-2 ring-inset ring-primary/30"
              )}
              onClick={() => onDayClick(day)}
              onDragOver={(e) => handleDragOver(e, day)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, day)}
            >
              <span
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium",
                  isToday(day) && "bg-primary text-primary-foreground",
                  isBefore(startOfDay(day), startOfDay(new Date())) &&
                    !isToday(day) &&
                    "text-muted-foreground"
                )}
              >
                {format(day, "d")}
              </span>

              {/* Multi-day event bars */}
              {colIdx === 0 && weekRows[weekIdx] && weekRows[weekIdx].map((slot, si) => (
                <div
                  key={`${slot.event.event_id}-${weekIdx}-${si}`}
                  data-testid={`multiday-event-${slot.event.event_id}`}
                  className={cn(
                    "absolute z-10 h-5 text-[10px] font-semibold flex items-center px-1.5 truncate cursor-pointer border transition-opacity hover:opacity-80",
                    SPAN_COLORS[slot.event.color] || SPAN_COLORS.indigo,
                    slot.isStart ? "rounded-l-md" : "border-l-0",
                    slot.isEnd ? "rounded-r-md" : "border-r-0",
                  )}
                  style={{
                    top: `${30 + si * 22}px`,
                    left: `${(slot.startCol / 7) * 100}%`,
                    width: `${(slot.spanCols / 7) * 100}%`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick(slot.event);
                  }}
                >
                  {slot.isStart && <span className="truncate">{slot.event.title}</span>}
                </div>
              ))}

              <div className="space-y-0.5 mt-0.5" style={{ marginTop: multiDayCount > 0 ? `${multiDayCount * 22 + 4}px` : undefined }}>
                {dayEvents.slice(0, maxShow).map((event) => (
                  <div
                    key={event.event_id}
                    data-testid={`event-pill-${event.event_id}`}
                    draggable={!event.is_recurring_instance}
                    onDragStart={(e) => handleDragStart(e, event)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "text-[10px] sm:text-xs px-1.5 py-0.5 rounded-md truncate font-medium cursor-pointer transition-opacity hover:opacity-80 flex items-center gap-0.5",
                      EVENT_COLORS[event.color] || EVENT_COLORS.indigo,
                      !event.is_recurring_instance && "cursor-grab active:cursor-grabbing"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                  >
                    {(event.recurrence?.type && event.recurrence.type !== "none") || event.is_recurring_instance ? (
                      <Repeat className="h-2.5 w-2.5 shrink-0 opacity-70" />
                    ) : null}
                    <span className="truncate">{event.title}</span>
                  </div>
                ))}
                {dayTasks.slice(0, Math.max(0, maxShow - dayEvents.length)).map((task) => (
                  <div
                    key={task.task_id}
                    className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded-md truncate font-medium bg-muted text-muted-foreground"
                  >
                    {task.title}
                  </div>
                ))}
                {totalItems > maxShow && maxShow > 0 && (
                  <div className="text-[10px] text-muted-foreground px-1.5 font-medium">
                    +{totalItems - maxShow} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state overlay */}
      {!hasAnyContent && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <EmptyState
            icon={CalendarDays}
            title="Your calendar is empty"
            description="Click any day to create your first event, or use the + Event button above."
            className="pointer-events-auto"
          />
        </div>
      )}
    </div>
  );
}
