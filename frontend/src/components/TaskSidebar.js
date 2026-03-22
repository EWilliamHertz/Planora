import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Plus, Clock, CalendarDays, Trash2 } from "lucide-react";
import { format, parseISO, isBefore, isToday, isTomorrow } from "date-fns";

const EVENT_DOT_COLORS = {
  indigo: "bg-indigo-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
};

function formatDueLabel(dateStr) {
  if (!dateStr) return null;
  const d = parseISO(dateStr);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  if (isBefore(d, new Date())) return "Overdue";
  return format(d, "MMM d");
}

export function TaskSidebar({ tasks, events, onToggleTask, onTaskClick, onDeleteTask, onCreateTask }) {
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });

  const upcomingEvents = events
    .filter((e) => e.start_time && !isBefore(parseISO(e.start_time), new Date()))
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .slice(0, 5);

  return (
    <div className="h-full flex flex-col" data-testid="task-sidebar">
      {/* Header */}
      <div className="p-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-tight uppercase">Tasks</h2>
          <Button
            data-testid="sidebar-create-task-btn"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onCreateTask}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-1.5">
          {sortedTasks.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">
              No tasks yet. Create one to get started.
            </div>
          )}
          {sortedTasks.map((task, i) => {
            const dueLabel = formatDueLabel(task.due_date);
            const isOverdue = dueLabel === "Overdue";
            return (
              <div
                key={task.task_id}
                data-testid={`task-item-${task.task_id}`}
                className={cn(
                  "group flex items-start gap-2.5 p-2.5 rounded-lg transition-colors hover:bg-accent/50 cursor-pointer animate-fadeIn",
                  task.completed && "opacity-60"
                )}
                style={{ animationDelay: `${i * 0.03}s` }}
              >
                <Checkbox
                  data-testid={`task-checkbox-${task.task_id}`}
                  checked={task.completed}
                  onCheckedChange={(checked) => onToggleTask(task.task_id, checked)}
                  className="mt-0.5"
                />
                <div
                  className="flex-1 min-w-0"
                  onClick={() => onTaskClick(task)}
                >
                  <div className={cn(
                    "text-sm font-medium truncate",
                    task.completed && "line-through text-muted-foreground"
                  )}>
                    {task.title}
                  </div>
                  {dueLabel && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />
                      <span
                        className={cn(
                          "text-xs",
                          isOverdue ? "text-destructive font-medium" : "text-muted-foreground"
                        )}
                      >
                        {dueLabel}
                      </span>
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTask(task.task_id);
                  }}
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
            );
          })}
        </div>

        {/* Upcoming Events */}
        <div className="px-4 pb-4">
          <div className="flex items-center gap-1.5 mb-3 pt-3 border-t border-border">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Upcoming
            </h3>
          </div>

          {upcomingEvents.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">
              No upcoming events
            </div>
          )}

          <div className="space-y-2">
            {upcomingEvents.map((event) => (
              <div
                key={event.event_id}
                data-testid={`upcoming-event-${event.event_id}`}
                className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className={cn("h-2 w-2 rounded-full mt-1.5 shrink-0", EVENT_DOT_COLORS[event.color] || "bg-indigo-500")} />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{event.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(parseISO(event.start_time), "EEE, MMM d 'at' h:mm a")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
