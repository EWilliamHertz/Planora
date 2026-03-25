import { useEffect } from "react";
import { parseISO, format, isToday, isSameDay } from "date-fns";
import { X, Edit2, Trash2, Plus, Clock, Users, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const COLOR_MAP = {
  indigo:  { border: "#6366f1", bg: "bg-indigo-50 dark:bg-indigo-950/30",  text: "text-indigo-700 dark:text-indigo-300" },
  emerald: { border: "#10b981", bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-300" },
  amber:   { border: "#f59e0b", bg: "bg-amber-50 dark:bg-amber-950/30",   text: "text-amber-700 dark:text-amber-300" },
  sky:     { border: "#0ea5e9", bg: "bg-sky-50 dark:bg-sky-950/30",       text: "text-sky-700 dark:text-sky-300" },
  rose:    { border: "#f43f5e", bg: "bg-rose-50 dark:bg-rose-950/30",     text: "text-rose-700 dark:text-rose-300" },
  violet:  { border: "#8b5cf6", bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-700 dark:text-violet-300" },
  red:     { border: "#ef4444", bg: "bg-red-50 dark:bg-red-950/30",       text: "text-red-700 dark:text-red-300" },
  blue:    { border: "#3b82f6", bg: "bg-blue-50 dark:bg-blue-950/30",     text: "text-blue-700 dark:text-blue-300" },
  green:   { border: "#22c55e", bg: "bg-green-50 dark:bg-green-950/30",   text: "text-green-700 dark:text-green-300" },
};

const DEFAULT_COLOR = COLOR_MAP.indigo;

export function DayView({ date, events = [], onClose, onEditEvent, onDeleteEvent, onCreateEvent }) {
  useEffect(() => {
    if (!date) return;
    const handleKeyDown = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, date]);

  if (!date) return null;

  const dayEvents = events
    .filter((event) => {
      if (!event.start_time) return false;
      return isSameDay(parseISO(event.start_time), date);
    })
    .sort((a, b) => parseISO(a.start_time).getTime() - parseISO(b.start_time).getTime());

  const formatTimeRange = (startTime, endTime) => {
    return `${format(parseISO(startTime), "h:mm a")} – ${format(parseISO(endTime), "h:mm a")}`;
  };

  const getDuration = (startTime, endTime) => {
    const mins = Math.floor((parseISO(endTime) - parseISO(startTime)) / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const c = (color) => COLOR_MAP[color] || DEFAULT_COLOR;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-in fade-in-0 duration-200" onClick={onClose} data-testid="day-view-backdrop" />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg max-h-[85vh] bg-background border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200" data-testid="day-view-modal">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold tracking-tight" data-testid="day-view-title">
              {isToday(date) && <span className="text-primary mr-1.5">Today</span>}
              {format(date, "EEEE, MMMM d")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} data-testid="day-view-close-btn">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="max-h-[calc(85vh-130px)]">
          {dayEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center" data-testid="day-view-empty">
              <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mb-4">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium mb-1">No events scheduled</p>
              <p className="text-xs text-muted-foreground mb-4">
                {isToday(date) ? "Your day is free — add something!" : "Nothing planned for this day yet."}
              </p>
              <Button size="sm" onClick={() => onCreateEvent?.()} data-testid="day-view-create-btn">
                <Plus className="h-3.5 w-3.5 mr-1" /> New Event
              </Button>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {dayEvents.map((event) => {
                const color = c(event.color);
                return (
                  <div
                    key={event.event_id}
                    data-testid={`day-view-event-${event.event_id}`}
                    className={cn("rounded-xl border-l-[3px] p-4 transition-colors hover:bg-accent/30", color.bg)}
                    style={{ borderLeftColor: color.border }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className={cn("font-semibold text-sm mb-1.5 break-words", color.text)}>
                          {event.title}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>{formatTimeRange(event.start_time, event.end_time)}</span>
                          <span className="text-[10px] opacity-60">({getDuration(event.start_time, event.end_time)})</span>
                        </div>

                        {event.attendees?.length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                            <Users className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {event.attendees.length <= 2
                                ? event.attendees.map((a) => a.name || a.email).join(", ")
                                : `${event.attendees.slice(0, 2).map((a) => a.name || a.email).join(", ")} +${event.attendees.length - 2}`}
                            </span>
                          </div>
                        )}

                        {event.description && (
                          <div className="flex items-start gap-1.5 text-xs text-muted-foreground mt-1.5">
                            <FileText className="h-3 w-3 shrink-0 mt-0.5" />
                            <span className="line-clamp-2 break-words">{event.description}</span>
                          </div>
                        )}

                        {event.team_id && (
                          <span className="inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                            Team event
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditEvent?.(event)} data-testid={`day-view-edit-${event.event_id}`}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => onDeleteEvent?.(event.event_id)} data-testid={`day-view-delete-${event.event_id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">Close</Button>
          <Button size="sm" onClick={() => onCreateEvent?.()} className="text-xs" data-testid="day-view-footer-create-btn">
            <Plus className="h-3.5 w-3.5 mr-1" /> New Event
          </Button>
        </div>
      </div>
    </>
  );
}
