import {
  format,
  isSameDay,
  parseISO,
  getHours,
  getMinutes,
} from "date-fns";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

const EVENT_COLORS = {
  indigo: "bg-indigo-500/15 border-indigo-500/30 text-indigo-700 dark:text-indigo-300",
  emerald: "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
  amber: "bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300",
  sky: "bg-sky-500/15 border-sky-500/30 text-sky-700 dark:text-sky-300",
  rose: "bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300",
  violet: "bg-violet-500/15 border-violet-500/30 text-violet-700 dark:text-violet-300",
};

const GRID_START = 7;
const GRID_END = 21;
const HOUR_HEIGHT = 64;
const HOURS = Array.from({ length: GRID_END - GRID_START }, (_, i) => i + GRID_START);

export function CalendarDayView({ currentDate, events, onTimeSlotClick, onEventClick }) {
  const dayEvents = events.filter(
    (e) => e.start_time && isSameDay(parseISO(e.start_time), currentDate)
  );

  const getEventPosition = (event) => {
    const start = parseISO(event.start_time);
    const end = parseISO(event.end_time);
    const startH = getHours(start) + getMinutes(start) / 60;
    const endH = getHours(end) + getMinutes(end) / 60;
    const top = (Math.max(startH, GRID_START) - GRID_START) * HOUR_HEIGHT;
    const height = (Math.min(endH, GRID_END) - Math.max(startH, GRID_START)) * HOUR_HEIGHT;
    return { top, height: Math.max(height, 24) };
  };

  return (
    <div className="flex flex-col h-full" data-testid="calendar-day-view">
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-[60px_1fr] relative">
          {/* Time labels */}
          <div>
            {HOURS.map((hour) => (
              <div key={hour} className="h-16 flex items-start justify-end pr-3 -mt-2">
                <span className="text-[11px] text-muted-foreground font-medium">
                  {format(new Date(2000, 0, 1, hour), "h a")}
                </span>
              </div>
            ))}
          </div>

          {/* Day column */}
          <div className="relative border-l border-border">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="h-16 border-b border-border/50 cursor-pointer hover:bg-accent/30 transition-colors"
                onClick={() => onTimeSlotClick(currentDate, hour)}
              />
            ))}

            {/* Events */}
            {dayEvents.map((event) => {
              const { top, height } = getEventPosition(event);
              return (
                <div
                  key={event.event_id}
                  data-testid={`day-event-${event.event_id}`}
                  className={cn(
                    "absolute left-1 right-4 rounded-lg px-3 py-2 border cursor-pointer transition-opacity hover:opacity-80",
                    EVENT_COLORS[event.color] || EVENT_COLORS.indigo
                  )}
                  style={{ top: `${top}px`, height: `${height}px` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick(event);
                  }}
                >
                  <div className="text-sm font-semibold truncate">{event.title}</div>
                  {height > 40 && (
                    <div className="text-xs opacity-80 mt-0.5">
                      {format(parseISO(event.start_time), "h:mm a")} -{" "}
                      {format(parseISO(event.end_time), "h:mm a")}
                    </div>
                  )}
                  {height > 60 && event.description && (
                    <div className="text-xs opacity-60 mt-1 truncate">{event.description}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
