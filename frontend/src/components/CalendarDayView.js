import { useState } from "react";
import {
  format,
  isSameDay,
  parseISO,
  getHours,
  getMinutes,
} from "date-fns";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Repeat } from "lucide-react";

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

// Calculate overlap columns for events
function layoutEvents(dayEvents) {
  if (dayEvents.length === 0) return [];

  const positioned = dayEvents.map((event) => {
    const start = parseISO(event.start_time);
    const end = parseISO(event.end_time);
    const startH = getHours(start) + getMinutes(start) / 60;
    const endH = getHours(end) + getMinutes(end) / 60;
    return { event, startH, endH, col: 0, totalCols: 1 };
  });

  positioned.sort((a, b) => a.startH - b.startH || a.endH - b.endH);

  const columns = [];
  for (const item of positioned) {
    let placed = false;
    for (let c = 0; c < columns.length; c++) {
      const lastInCol = columns[c][columns[c].length - 1];
      if (item.startH >= lastInCol.endH) {
        item.col = c;
        columns[c].push(item);
        placed = true;
        break;
      }
    }
    if (!placed) {
      item.col = columns.length;
      columns.push([item]);
    }
  }

  for (const item of positioned) {
    const overlapping = positioned.filter(
      (other) => other.startH < item.endH && other.endH > item.startH
    );
    const maxCol = Math.max(...overlapping.map((o) => o.col)) + 1;
    for (const o of overlapping) {
      o.totalCols = Math.max(o.totalCols, maxCol);
    }
  }

  return positioned;
}

export function CalendarDayView({ currentDate, events, onTimeSlotClick, onEventClick, onEventDrop }) {
  const [dragOverHour, setDragOverHour] = useState(null);

  const dayEvents = events.filter(
    (e) => e.start_time && isSameDay(parseISO(e.start_time), currentDate)
  );

  const positioned = layoutEvents(dayEvents);

  const handleDragStart = (e, event) => {
    if (event.is_recurring_instance) { e.preventDefault(); return; }
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
    setDragOverHour(null);
  };

  const handleSlotDragOver = (e, hour) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverHour(hour);
  };

  const handleSlotDrop = (e, hour) => {
    e.preventDefault();
    setDragOverHour(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      const oldStart = parseISO(data.start_time);
      const oldEnd = parseISO(data.end_time);
      const duration = oldEnd.getTime() - oldStart.getTime();
      const newStart = new Date(currentDate);
      newStart.setHours(hour, 0, 0, 0);
      const newEnd = new Date(newStart.getTime() + duration);
      onEventDrop(data.event_id, {
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
      });
    } catch (err) {
      console.error("Drop failed:", err);
    }
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
                className={cn(
                  "h-16 border-b border-border/50 cursor-pointer hover:bg-accent/30 transition-all",
                  dragOverHour === hour && "bg-primary/10"
                )}
                onClick={() => onTimeSlotClick(currentDate, hour)}
                onDragOver={(e) => handleSlotDragOver(e, hour)}
                onDragLeave={() => setDragOverHour(null)}
                onDrop={(e) => handleSlotDrop(e, hour)}
              />
            ))}

            {/* Events with overlap handling */}
            {positioned.map(({ event, startH, endH, col, totalCols }) => {
              const top = (Math.max(startH, GRID_START) - GRID_START) * HOUR_HEIGHT;
              const height = Math.max((Math.min(endH, GRID_END) - Math.max(startH, GRID_START)) * HOUR_HEIGHT, 24);
              const isRecurring = event.is_recurring_instance || (event.recurrence?.type && event.recurrence.type !== "none");
              const width = `calc(${100 / totalCols}% - 8px)`;
              const left = `calc(${(col / totalCols) * 100}% + 4px)`;

              return (
                <div
                  key={event.event_id}
                  data-testid={`day-event-${event.event_id}`}
                  draggable={!event.is_recurring_instance}
                  onDragStart={(e) => handleDragStart(e, event)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "absolute rounded-lg px-3 py-2 border cursor-pointer transition-opacity hover:opacity-80",
                    EVENT_COLORS[event.color] || EVENT_COLORS.indigo,
                    !event.is_recurring_instance && "cursor-grab active:cursor-grabbing"
                  )}
                  style={{ top: `${top}px`, height: `${height}px`, width, left }}
                  onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                >
                  <div className="text-sm font-semibold truncate flex items-center gap-1">
                    {isRecurring && <Repeat className="h-3 w-3 shrink-0 opacity-70" />}
                    <span className="truncate">{event.title}</span>
                  </div>
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
