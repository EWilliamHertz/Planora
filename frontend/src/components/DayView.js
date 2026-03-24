import { useEffect } from "react";
import { parseISO, format, isToday } from "date-fns";
import { X, Edit2, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DayView({
  date,
  events = [],
  onClose,
  onEditEvent,
  onDeleteEvent,
  onCreateEvent,
}) {
  if (!date) return null;

  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Format the date nicely
  const formattedDate = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Filter and sort events for this day chronologically
  const dayEvents = events
    .filter((event) => {
      const eventDate = parseISO(event.start_time);
      return (
        eventDate.getFullYear() === date.getFullYear() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getDate() === date.getDate()
      );
    })
    .sort((a, b) => {
      const timeA = parseISO(a.start_time).getTime();
      const timeB = parseISO(b.start_time).getTime();
      return timeA - timeB;
    });

  // Helper to format time range
  const formatTimeRange = (startTime, endTime) => {
    const start = parseISO(startTime);
    const end = parseISO(endTime);
    const startStr = format(start, "h:mm a");
    const endStr = format(end, "h:mm a");
    return `${startStr} - ${endStr}`;
  };

  // Helper to calculate duration
  const calculateDuration = (startTime, endTime) => {
    const start = parseISO(startTime);
    const end = parseISO(endTime);
    const minutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours} hour${hours > 1 ? "s" : ""}`;
    return `${hours}h ${mins}m`;
  };

  // Helper to get initials from attendee name
  const getAttendeeDisplay = (attendees = []) => {
    if (!attendees || attendees.length === 0) return null;
    if (attendees.length <= 2) {
      return attendees.map((a) => a.name || a.email).join(", ");
    }
    const shown = attendees.slice(0, 2).map((a) => a.name || a.email).join(", ");
    return `${shown} +${attendees.length - 2} more`;
  };

  // Helper to get event color
  const getEventColor = (color) => {
    const colors = {
      red: "bg-red-100 border-red-300 text-red-900",
      blue: "bg-blue-100 border-blue-300 text-blue-900",
      green: "bg-green-100 border-green-300 text-green-900",
      yellow: "bg-yellow-100 border-yellow-300 text-yellow-900",
      purple: "bg-purple-100 border-purple-300 text-purple-900",
      pink: "bg-pink-100 border-pink-300 text-pink-900",
      indigo: "bg-indigo-100 border-indigo-300 text-indigo-900",
      cyan: "bg-cyan-100 border-cyan-300 text-cyan-900",
    };
    return colors[color] || colors.blue;
  };

  const getColorIndicator = (color) => {
    const colors = {
      red: "bg-red-500",
      blue: "bg-blue-500",
      green: "bg-green-500",
      yellow: "bg-yellow-500",
      purple: "bg-purple-500",
      pink: "bg-pink-500",
      indigo: "bg-indigo-500",
      cyan: "bg-cyan-500",
    };
    return colors[color] || colors.blue;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl max-h-[80vh] bg-background border border-border rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card sticky top-0">
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              {isToday(date) ? "Today - " : ""}{formattedDate}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""} scheduled
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded-md transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(80vh-120px)]">
          {dayEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6">
              <div className="text-muted-foreground text-center mb-4">
                <p className="text-lg font-medium mb-2">No events scheduled</p>
                <p className="text-sm">
                  {isToday(date)
                    ? "Create your first event for today"
                    : "Create an event for this day"}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() =>
                  onCreateEvent?.({ date: new Date(date), time: "09:00" })
                }
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                New Event
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {dayEvents.map((event) => (
                <div
                  key={event.event_id}
                  className={`p-4 sm:p-6 border-l-4 transition-colors hover:bg-accent/50 ${getColorIndicator(
                    event.color
                  )} border-l-${event.color}-500`}
                  style={{ borderLeftColor: event.color || "#3b82f6" }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-foreground mb-2 break-words">
                        {event.title}
                      </h3>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span className="font-medium">
                            {formatTimeRange(
                              event.start_time,
                              event.end_time
                            )}
                          </span>
                          <span className="text-xs">
                            ({calculateDuration(event.start_time, event.end_time)})
                          </span>
                        </div>

                        {event.attendees && event.attendees.length > 0 && (
                          <div className="flex items-start gap-2">
                            <span className="text-muted-foreground flex-shrink-0">
                              Attendees:
                            </span>
                            <span className="text-foreground break-words">
                              {getAttendeeDisplay(event.attendees)}
                            </span>
                          </div>
                        )}

                        {event.location && (
                          <div className="flex items-start gap-2">
                            <span className="text-muted-foreground flex-shrink-0">
                              Location:
                            </span>
                            <span className="text-foreground break-words">
                              {event.location}
                            </span>
                          </div>
                        )}

                        {event.description && (
                          <div className="flex items-start gap-2 pt-2">
                            <span className="text-muted-foreground flex-shrink-0">
                              Notes:
                            </span>
                            <span className="text-foreground break-words line-clamp-2">
                              {event.description}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onEditEvent?.(event)}
                        title="Edit event"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:text-destructive"
                        onClick={() => onDeleteEvent?.(event.event_id)}
                        title="Delete event"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-card sticky bottom-0 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            Close
          </Button>
          <Button
            size="sm"
            onClick={() => onCreateEvent?.({ date: new Date(date), time: "09:00" })}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            New Event
          </Button>
        </div>
      </div>
    </>
  );
}
