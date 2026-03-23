import { useState } from "react";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  isToday,
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

  // Assign columns using a greedy algorithm
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

  // Set total columns for overlapping groups
  for (const item of positioned) {
    // Find all items that overlap with this one
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

export function CalendarWeekView({ currentDate, events, onTimeSlotClick, onEventClick, onEventDrop }) {
  const [dragOverSlot, setDragOverSlot] = useState(null);
  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

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
    setDragOverSlot(null);
  };

  const handleSlotDragOver = (e, day, hour) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverSlot(`${format(day, "yyyy-MM-dd")}-${hour}`);
  };

  const handleSlotDrop = (e, day, hour) => {
    e.preventDefault();
    setDragOverSlot(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      const oldStart = parseISO(data.start_time);
      const oldEnd = parseISO(data.end_time);
      const duration = oldEnd.getTime() - oldStart.getTime();
      const newStart = new Date(day);
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
    <div className="flex flex-col h-full" data-testid="calendar-week-view">
      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border">
        <div className="py-2" />
        {weekDays.map((day) => (
          <div key={day.toISOString()} className="py-2 text-center border-l border-border">
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {format(day, "EEE")}
            </div>
            <div className={cn("text-lg font-bold mt-0.5", isToday(day) && "text-primary")}>
              <span className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-full",
                isToday(day) && "bg-primary text-primary-foreground"
              )}>
                {format(day, "d")}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-[60px_repeat(7,1fr)] relative">
          {/* Time labels */}
          <div>
            {HOURS.map((hour) => (
              <div key={hour} className="h-16 flex items-start justify-end pr-2 -mt-2">
                <span className="text-[11px] text-muted-foreground font-medium">
                  {format(new Date(2000, 0, 1, hour), "h a")}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day) => {
            const dayEvents = events.filter(
              (e) => e.start_time && isSameDay(parseISO(e.start_time), day)
            );
            const positioned = layoutEvents(dayEvents);

            return (
              <div key={day.toISOString()} className="relative border-l border-border">
                {/* Hour slots */}
                {HOURS.map((hour) => {
                  const slotKey = `${format(day, "yyyy-MM-dd")}-${hour}`;
                  return (
                    <div
                      key={hour}
                      className={cn(
                        "h-16 border-b border-border/50 cursor-pointer hover:bg-accent/30 transition-all",
                        dragOverSlot === slotKey && "bg-primary/10"
                      )}
                      onClick={() => onTimeSlotClick(day, hour)}
                      onDragOver={(e) => handleSlotDragOver(e, day, hour)}
                      onDragLeave={() => setDragOverSlot(null)}
                      onDrop={(e) => handleSlotDrop(e, day, hour)}
                    />
                  );
                })}

                {/* Events with overlap handling */}
                {positioned.map(({ event, startH, endH, col, totalCols }) => {
                  const top = (Math.max(startH, GRID_START) - GRID_START) * HOUR_HEIGHT;
                  const height = Math.max((Math.min(endH, GRID_END) - Math.max(startH, GRID_START)) * HOUR_HEIGHT, 20);
                  const isRecurring = event.is_recurring_instance || (event.recurrence?.type && event.recurrence.type !== "none");
                  const width = `calc(${100 / totalCols}% - 2px)`;
                  const left = `calc(${(col / totalCols) * 100}% + 1px)`;

                  return (
                    <div
                      key={event.event_id}
                      data-testid={`week-event-${event.event_id}`}
                      draggable={!event.is_recurring_instance}
                      onDragStart={(e) => handleDragStart(e, event)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "absolute rounded-md px-1.5 py-1 border cursor-pointer transition-opacity hover:opacity-80 overflow-hidden",
                        EVENT_COLORS[event.color] || EVENT_COLORS.indigo,
                        !event.is_recurring_instance && "cursor-grab active:cursor-grabbing"
                      )}
                      style={{ top: `${top}px`, height: `${height}px`, width, left }}
                      onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                    >
                      <div className="text-xs font-semibold truncate flex items-center gap-0.5">
                        {isRecurring && <Repeat className="h-2.5 w-2.5 shrink-0 opacity-70" />}
                        <span className="truncate">{event.title}</span>
                      </div>
                      {height > 30 && (
                        <div className="text-[10px] opacity-80 truncate">
                          {format(parseISO(event.start_time), "h:mm a")}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
