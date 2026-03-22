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
} from "date-fns";
import { cn } from "@/lib/utils";

const EVENT_COLORS = {
  indigo: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  sky: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  rose: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  violet: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarMonthView({ currentDate, events, tasks, onDayClick, onEventClick }) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

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

      {/* Day cells */}
      <div className="grid grid-cols-7 flex-1 border-t border-l border-border rounded-lg overflow-hidden">
        {days.map((day, i) => {
          const dayEvents = events.filter(
            (e) => e.start_time && isSameDay(parseISO(e.start_time), day)
          );
          const dayTasks = tasks.filter(
            (t) => t.due_date && !t.completed && isSameDay(parseISO(t.due_date), day)
          );
          const totalItems = dayEvents.length + dayTasks.length;
          const maxShow = 2;

          return (
            <div
              key={day.toISOString()}
              data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
              className={cn(
                "min-h-[90px] sm:min-h-[110px] border-r border-b border-border p-1.5 cursor-pointer transition-colors",
                "hover:bg-accent/50",
                !isSameMonth(day, currentDate) && "opacity-40 bg-muted/30",
                isToday(day) && "bg-primary/[0.03]"
              )}
              onClick={() => onDayClick(day)}
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

              <div className="space-y-0.5 mt-0.5">
                {dayEvents.slice(0, maxShow).map((event) => (
                  <div
                    key={event.event_id}
                    data-testid={`event-pill-${event.event_id}`}
                    className={cn(
                      "text-[10px] sm:text-xs px-1.5 py-0.5 rounded-md truncate font-medium cursor-pointer transition-opacity hover:opacity-80",
                      EVENT_COLORS[event.color] || EVENT_COLORS.indigo
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                  >
                    {event.title}
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
                {totalItems > maxShow && (
                  <div className="text-[10px] text-muted-foreground px-1.5 font-medium">
                    +{totalItems - maxShow} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
