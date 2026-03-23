import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Plus, Clock, CalendarDays, Trash2, ClipboardList, CalendarCheck } from "lucide-react";
import { format, parseISO, isBefore, isToday, isTomorrow } from "date-fns";
import { EmptyState } from "@/components/EmptyState";

const EVENT_DOT_COLORS = {
  indigo: "bg-indigo-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
};

const CATEGORY_STYLES = {
  work: { color: "bg-indigo-500", text: "text-indigo-600 dark:text-indigo-400" },
  personal: { color: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  urgent: { color: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" },
  health: { color: "bg-sky-500", text: "text-sky-600 dark:text-sky-400" },
  finance: { color: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
};

const FILTER_OPTIONS = [
  { value: null, label: "All" },
  { value: "work", label: "Work" },
  { value: "personal", label: "Personal" },
  { value: "urgent", label: "Urgent" },
  { value: "health", label: "Health" },
  { value: "finance", label: "Finance" },
];

function formatDueLabel(dateStr) {
  if (!dateStr) return null;
  const d = parseISO(dateStr);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  if (isBefore(d, new Date())) return "Overdue";
  return format(d, "MMM d");
}

export function TaskSidebar({ tasks, events, onToggleTask, onTaskClick, onDeleteTask, onCreateTask }) {
  const [categoryFilter, setCategoryFilter] = useState(null);

  const filteredTasks = tasks.filter((t) => !categoryFilter || t.category === categoryFilter);

  const sortedTasks = [...filteredTasks].sort((a, b) => {
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
        <div className="flex items-center justify-between mb-2">
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
        {/* Category Filter */}
        <div className="flex gap-1 flex-wrap" data-testid="task-category-filter">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value || "all"}
              data-testid={`filter-${opt.value || "all"}`}
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors",
                categoryFilter === opt.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent/50"
              )}
              onClick={() => setCategoryFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-1.5">
          {sortedTasks.length === 0 && (
            <EmptyState
              icon={ClipboardList}
              title={categoryFilter ? `No ${categoryFilter} tasks` : "No tasks yet"}
              description={categoryFilter ? "Try a different filter or create a new task." : "Create your first task to start organizing your work."}
              action={!categoryFilter && (
                <Button data-testid="empty-create-task-btn" size="sm" variant="outline" onClick={onCreateTask}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> New Task
                </Button>
              )}
              className="py-6"
            />
          )}
          {sortedTasks.map((task, i) => {
            const dueLabel = formatDueLabel(task.due_date);
            const isOverdue = dueLabel === "Overdue";
            const catStyle = task.category ? CATEGORY_STYLES[task.category] : null;
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
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {catStyle && (
                      <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium capitalize", catStyle.text)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", catStyle.color)} />
                        {task.category}
                      </span>
                    )}
                    {dueLabel && (
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        <span
                          className={cn(
                            "text-xs",
                            isOverdue ? "text-destructive font-medium" : "text-muted-foreground"
                          )}
                        >
                          {dueLabel}
                        </span>
                      </span>
                    )}
                  </div>
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
            <EmptyState
              icon={CalendarCheck}
              title="No upcoming events"
              description="Your schedule is clear. Time to plan something new!"
              className="py-4"
            />
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
